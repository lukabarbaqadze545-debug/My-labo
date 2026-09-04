import type { Claim, ClaimForce, ClaimScope, ClaimType, DomainPack, TermUsage } from './types';
import {
  contentTerms,
  cues,
  isQuestion,
  mainClause,
  quote,
  splitSentences,
  splitSubjectPredicate,
  surfaceFor,
  tokens,
  unframe,
} from './language';

/**
 * Claim extraction.
 *
 * A "claim" is any sentence in which the user asserts something. Questions are
 * not claims, but they still set the conversation's focus. Classification is
 * cue-driven and deliberately conservative: a misclassified claim costs the
 * engine one poorly-targeted question, so it prefers `factual` when unsure.
 */

function classify(sentence: string): ClaimType {
  const s = unframe(sentence);
  if (cues.conditional(s)) return 'conditional';
  if (cues.normative(s)) return 'normative';
  if (cues.existential(s)) return 'existential';
  if (cues.causal(s)) return 'causal';
  if (cues.universal(s)) return 'universal';
  if (cues.definitional(s)) return 'definition';
  if (cues.comparative(s)) return 'comparative';
  return 'factual';
}

function scopeOf(sentence: string): ClaimScope {
  if (cues.universal(sentence)) return 'universal';
  if (cues.hedged(sentence)) return 'hedged';
  return 'particular';
}

function forceOf(sentence: string): ClaimForce {
  if (cues.hedged(sentence)) return 'hedged';
  if (cues.emphatic(sentence) || cues.universal(sentence)) return 'strong';
  return 'moderate';
}

/**
 * Universal claims that are *also* normative stay typed `normative` — the
 * normative reading carries more assumptions — but their universal scope is
 * preserved separately, so counterexample hunting still applies.
 */
export function extractClaims(utterance: string, turnIndex: number): Claim[] {
  const out: Claim[] = [];
  const sentences = splitSentences(utterance);
  for (let i = 0; i < sentences.length; i++) {
    const raw = sentences[i]!;
    if (isQuestion(raw)) continue;
    const body = unframe(raw);
    const terms = contentTerms(body);
    // A bare "yes"/"no" or a two-filler-word reply asserts nothing trackable.
    if (terms.length === 0) continue;

    // Polarity and structure come from the unframed asserting clause, so a
    // qualifying "…when nobody forces them" cannot flip the claim's sign.
    // Force and scope are read off the *framed* text, because "I think that…"
    // is exactly the hedge that must not be lost.
    const main = mainClause(body);
    const framedMain = mainClause(raw);
    const { subject, predicate } = splitSubjectPredicate(main);
    out.push({
      id: `c${turnIndex}_${i}`,
      turnIndex,
      text: quote(raw, 160),
      type: classify(raw),
      subject,
      predicate,
      polarity: cues.negated(main) ? 'deny' : 'affirm',
      scope: scopeOf(framedMain),
      force: forceOf(framedMain),
      terms,
      subjectTerms: contentTerms(subject),
      predicateTerms: contentTerms(predicate),
      examined: false,
    });
  }
  return out;
}

/**
 * Track which words the conversation is leaning on. A term becomes a candidate
 * for a definition question when it recurs, carries argumentative weight, and
 * the user has never said what they mean by it.
 */
export function updateTerms(
  existing: readonly TermUsage[],
  utterance: string,
  pack: DomainPack,
): TermUsage[] {
  const next = existing.map((t) => ({ ...t }));
  // Pack terms are authored as stems already — stemming them again would blunt
  // them into prefixes that match half the language.
  const loadBearing = pack.loadBearingTerms.map((x) => x.normalize('NFC').toLowerCase());

  for (const st of contentTerms(utterance)) {
    const found = next.find((t) => t.stem === st);
    if (found) {
      found.uses++;
      found.surface = surfaceFor(st, utterance);
    } else {
      next.push({
        stem: st,
        surface: surfaceFor(st, utterance),
        uses: 1,
        senses: [],
        defined: false,
        loadBearing: loadBearing.some((lb) => st.startsWith(lb) || lb.startsWith(st)),
      });
    }
  }
  return next;
}

/**
 * When the user answers a "what do you mean by X" question, record the sense
 * so the engine stops asking and can later detect definitional drift.
 */
export function recordDefinition(
  terms: readonly TermUsage[],
  targetStem: string,
  utterance: string,
  turnIndex: number,
): TermUsage[] {
  return terms.map((t) =>
    t.stem === targetStem
      ? { ...t, defined: true, senses: [...t.senses, { turnIndex, text: quote(utterance, 160) }] }
      : t,
  );
}

/**
 * How much reasoning work the user put into this turn. Drives the engine's
 * willingness to keep asking: someone writing three reasoned sentences can
 * take another question; someone typing "I don't know" needs help.
 */
export function engagementOf(utterance: string, claims: readonly Claim[]): number {
  const wordCount = tokens(utterance).length;
  if (cues.wantsAnswer(utterance) && wordCount < 12) return 0.15;
  let score = 0;
  score += Math.min(0.4, wordCount / 60);
  score += Math.min(0.3, claims.length * 0.15);
  // Reasoning connectives are the strongest signal that the user is arguing.
  if (/(იმიტომ|რადგან|მაგალითად|თუმცა|მაგრამ|ამიტომ|შესაბამისად|ერთი მხრივ)/.test(utterance)) score += 0.3;
  return Math.max(0, Math.min(1, score));
}
