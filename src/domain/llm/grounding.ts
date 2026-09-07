import { chunkTerms } from '@/domain/books';
import type { ClaimStatus, Evidence, ReasonedClaim, ReasoningEnvelope, ReasoningMode } from './types';
import { isGroundedMode } from './types';

/**
 * Stage 4 — validate what the model said against what retrieval actually
 * supplied.
 *
 * The model reports which evidence each claim rests on. This stage does not
 * take its word for it: it re-checks the claim's own content words against the
 * cited passages, using the same Georgian stemmer the retriever uses, so a
 * paraphrase counts as support and a fluent invention does not.
 *
 * Three outcomes matter, and conflating them is the whole failure mode this
 * layer exists to prevent:
 *
 *   grounded    the evidence carries it, so its words must overlap
 *   inferred    the model derived it — new wording is the point, so it only
 *               has to be anchored to the material, never paraphrase it
 *   uncertain   the model hedged it; it asserts nothing to verify
 *   unsupported nothing cited or found backs it up
 *
 * Nothing is silently deleted. Unsupported claims are surfaced, because an
 * assistant that quietly drops a sentence is harder to trust than one that
 * says which part it could not stand behind.
 */

/** Share of a stated fact's content words that must appear in its evidence. */
const GROUNDED_THRESHOLD = 0.4;
/** Below this many shared words, a ratio is noise rather than evidence. */
const MIN_MATCHES = 2;

const NUMBER = /\d+/gu;

function termsOf(text: string): string[] {
  return chunkTerms(text);
}

function overlap(claimTerms: readonly string[], evidenceTerms: ReadonlySet<string>): {
  ratio: number;
  matches: number;
} {
  if (claimTerms.length === 0) return { ratio: 0, matches: 0 };
  const unique = [...new Set(claimTerms)];
  const matches = unique.filter((term) => evidenceTerms.has(term)).length;
  return { ratio: matches / unique.length, matches };
}

/**
 * Every figure in a claim must appear in the evidence backing it.
 *
 * A wrong year or page number is the most damaging thing a grounded assistant
 * can produce and the least likely to be caught by word overlap, since the
 * surrounding sentence is usually a faithful paraphrase.
 */
function numbersChecked(claim: string, evidenceText: string): boolean {
  const figures = claim.match(NUMBER);
  if (!figures) return true;
  return figures.every((figure) => evidenceText.includes(figure));
}

export interface ValidationResult {
  claims: ReasonedClaim[];
  /** True when no claim came back unsupported. */
  grounded: boolean;
  unsupported: number;
  /** Georgian disclosure to append, when something could not be verified. */
  note?: string;
}

export function validateClaims(
  envelope: ReasoningEnvelope,
  evidence: readonly Evidence[],
  mode: ReasoningMode,
): ValidationResult {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const allTerms = new Set(evidence.flatMap((item) => termsOf(item.text)));
  const allText = evidence.map((item) => item.text).join(' ');

  const claims: ReasonedClaim[] = envelope.claims.map((claim) => {
    const claimTerms = termsOf(claim.text);

    const cited = claim.evidenceIds.map((id) => byId.get(id)).filter((e): e is Evidence => Boolean(e));
    const citedTerms = new Set(cited.flatMap((item) => termsOf(item.text)));

    const direct = overlap(claimTerms, citedTerms);
    const anywhere = overlap(claimTerms, allTerms);

    // A figure is checked against everything retrieved, not just the cited
    // passage: a correct number attached to a loose citation is a citation
    // problem, whereas a number found nowhere at all is an invention.
    const figuresOk = numbersChecked(claim.text, allText);

    const reject = (support: number): ReasonedClaim => ({
      text: claim.text,
      /*
       * In a grounded mode an unbacked claim is a failure of the answer. In
       * free mode the licence explicitly allows outside knowledge, so it is
       * downgraded to "uncertain" instead — unless the model asserted it as
       * `grounded`, which is the claim-to-evidence mismatch worth flagging in
       * any mode.
       */
      status: isGroundedMode(mode) || claim.status === 'grounded' ? 'unsupported' : 'uncertain',
      evidenceIds: claim.evidenceIds,
      support: Math.round(support * 100) / 100,
    });

    const accept = (status: ClaimStatus, evidenceIds: string[], support: number): ReasonedClaim => ({
      text: claim.text,
      status,
      evidenceIds,
      support: Math.round(support * 100) / 100,
    });

    /*
     * An inference is judged differently from a stated fact, and conflating
     * the two is the subtle way a validator like this goes wrong.
     *
     * "Therefore responsibility has to be rethought" follows from a passage
     * about determinism while sharing almost none of its words — that is what
     * makes it an inference rather than a paraphrase. Demanding lexical
     * overlap would flag exactly the reasoning this layer exists to enable.
     *
     * So an inference only has to be *anchored*: tied to real evidence the
     * model cited, or at least touching the material's vocabulary. What it may
     * never do is smuggle in a concrete figure that appears nowhere.
     */
    if (claim.status === 'inferred') {
      const anchored = cited.length > 0 || anywhere.matches > 0;
      if (!anchored || !figuresOk) return reject(Math.max(direct.ratio, anywhere.ratio));
      const ids = cited.length > 0 ? cited.map((item) => item.id) : claim.evidenceIds;
      return accept('inferred', ids, cited.length > 0 ? direct.ratio : anywhere.ratio);
    }

    /*
     * A claim the model already hedged needs no support to stand — it is not
     * asserting anything. It still may not carry an invented figure.
     */
    if (claim.status === 'uncertain') {
      if (!figuresOk) return reject(anywhere.ratio);
      return accept('uncertain', claim.evidenceIds, anywhere.ratio);
    }

    /* A stated fact must actually be in the material it points at. */
    const passesCited =
      cited.length > 0 &&
      direct.ratio >= GROUNDED_THRESHOLD &&
      direct.matches >= MIN_MATCHES &&
      figuresOk;

    if (passesCited) return accept('grounded', cited.map((item) => item.id), direct.ratio);

    /*
     * Citation repair. A model that reasons well often cites loosely — it
     * writes a correct sentence and attaches the wrong id, or none at all.
     * Rejecting that as a hallucination would punish good answers, so the
     * claim is re-checked against the whole evidence set and, if it holds, the
     * ids it actually matches are recorded instead.
     */
    const passesAnywhere =
      anywhere.ratio >= GROUNDED_THRESHOLD && anywhere.matches >= MIN_MATCHES && figuresOk;

    if (passesAnywhere) {
      const repaired = evidence
        .filter(
          (item) => overlap(claimTerms, new Set(termsOf(item.text))).ratio >= GROUNDED_THRESHOLD,
        )
        .map((item) => item.id);
      return accept('grounded', repaired.length > 0 ? repaired : claim.evidenceIds, anywhere.ratio);
    }

    return reject(Math.max(direct.ratio, anywhere.ratio));
  });

  const unsupported = claims.filter((c) => c.status === 'unsupported').length;
  const note =
    unsupported > 0
      ? unsupported === claims.length
        ? 'ამ პასუხს ჩემს მასალაში დასაყრდენი ვერ ვუპოვე — გადაამოწმე.'
        : `ამ პასუხის ${unsupported} მტკიცებას მასალაში პირდაპირი დასაყრდენი არ აქვს.`
      : undefined;

  return {
    claims,
    grounded: unsupported === 0,
    unsupported,
    ...(note ? { note } : {}),
  };
}

/**
 * Which evidence the answer actually used, in the order it was first relied on.
 * This is what the citation line is built from, so it reflects the claims that
 * survived validation rather than everything retrieval happened to fetch.
 */
export function usedEvidence(
  claims: readonly ReasonedClaim[],
  evidence: readonly Evidence[],
): Evidence[] {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const claim of claims) {
    if (claim.status === 'unsupported') continue;
    for (const id of claim.evidenceIds) {
      if (seen.has(id)) continue;
      const item = byId.get(id);
      if (!item) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}
