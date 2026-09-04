import type {
  Assumption,
  AssumptionSchema,
  Claim,
  Contradiction,
  DomainPack,
  ReasoningState,
  TermUsage,
} from './types';
import { cues, fuzzyOverlap, fuzzySim, quote } from './language';

/**
 * Assumption inference and contradiction detection — the two analyses that let
 * the engine ask something the user has not already thought of.
 */

/* ----------------------------- assumptions ------------------------------ */

/**
 * Schemas that hold in any domain. A claim's *form* carries premises
 * regardless of subject: a universal claim assumes no exceptions, a causal
 * claim assumes the link is not mere correlation, and so on.
 */
export const BASE_SCHEMAS: AssumptionSchema[] = [
  {
    id: 'no-exception',
    when: (c) => c.scope === 'universal',
    build: () => ({
      text: 'არც ერთი გამონაკლისი არ არსებობს — არა უბრალოდ „უმეტესად ასეა".',
      load: 0.9,
    }),
  },
  {
    id: 'causal-not-correlation',
    when: (c) => c.type === 'causal',
    build: () => ({
      text: 'კავშირი ნამდვილად მიზეზობრივია და არა უბრალო თანხვედრა ან საერთო მესამე მიზეზი.',
      load: 0.8,
    }),
  },
  {
    id: 'normative-standard',
    when: (c) => c.type === 'normative',
    build: () => ({
      text: 'არსებობს საზომი, რომლითაც „სწორსა" და „არასწორს" ვარჩევთ — და ეს საზომი ორივესთვის ერთია.',
      load: 0.85,
    }),
  },
  {
    id: 'exhaustive-search',
    when: (c) => c.type === 'existential' && c.polarity === 'deny',
    build: () => ({
      text: 'ყველა შესაძლო შემთხვევა შემოწმებულია — თორემ „ვერ ვიპოვე" და „არ არსებობს" სხვადასხვა რამაა.',
      load: 0.75,
    }),
  },
  {
    id: 'antecedent-holds',
    when: (c) => c.type === 'conditional',
    build: () => ({
      text: 'პირობა, რომელსაც ეყრდნობა დასკვნა, ნამდვილად სრულდება.',
      load: 0.6,
    }),
  },
  {
    id: 'comparison-scale',
    when: (c) => c.type === 'comparative',
    build: () => ({
      text: 'ორივე მხარეს ერთი და იმავე საზომით ვზომავთ.',
      load: 0.55,
    }),
  },
];

export function inferAssumptions(
  claim: Claim,
  state: ReasoningState,
  pack: DomainPack,
): Assumption[] {
  const out: Assumption[] = [];
  const seen = new Set(state.assumptions.map((a) => `${a.claimId}:${a.schema}`));
  const globallySeen = new Set(state.assumptions.map((a) => a.schema));

  for (const schema of [...BASE_SCHEMAS, ...pack.assumptionSchemas]) {
    if (!schema.when(claim, state)) continue;
    if (seen.has(`${claim.id}:${schema.id}`)) continue;
    // The same generic premise twice in a conversation is noise, not insight.
    if (globallySeen.has(schema.id)) continue;
    const built = schema.build(claim);
    if (!built) continue;
    out.push({
      // Derived, not sequential — replaying a transcript must reproduce ids.
      id: `a:${claim.id}:${schema.id}`,
      claimId: claim.id,
      text: built.text,
      schema: schema.id,
      load: built.load,
      status: 'inferred',
    });
  }
  return out;
}

/* ---------------------------- contradictions ---------------------------- */

function conflictNote(a: Claim, b: Claim, kind: Contradiction['kind']): string {
  switch (kind) {
    case 'scope':
      return `ადრე ნათქვამი მოქმედებდა ყველა შემთხვევაზე, ახლანდელი კი ერთ შემთხვევას გამონაკლისად აყენებს.`;
    case 'definitional':
      return `„${quote(a.text, 40)}" და „${quote(b.text, 40)}" ერთსა და იმავე სიტყვას სხვადასხვა მნიშვნელობით იყენებს.`;
    case 'normative':
      return `ერთი წესი დგება, მეორე მსჯელობა კი ამ წესს არღვევს.`;
    default:
      return `ერთი და იმავე რამის შესახებ ორი საპირისპირო მტკიცებაა.`;
  }
}

/**
 * Compare the newest claims against everything said earlier. Only reasonably
 * confident conflicts are reported — a false "you contradicted yourself" is
 * far more damaging to the conversation than a missed one.
 */
export function detectContradictions(
  fresh: readonly Claim[],
  state: ReasoningState,
): Contradiction[] {
  const out: Contradiction[] = [];
  const known = new Set(state.contradictions.map((c) => `${c.aClaimId}:${c.bClaimId}`));

  for (const b of fresh) {
    for (const a of state.claims) {
      if (a.id === b.id || a.turnIndex === b.turnIndex) continue;
      if (known.has(`${a.id}:${b.id}`) || known.has(`${b.id}:${a.id}`)) continue;

      const subj = fuzzyOverlap(b.subjectTerms, a.subjectTerms.concat(a.terms));
      const pred = fuzzyOverlap(b.predicateTerms, a.predicateTerms.concat(a.terms));
      const whole = fuzzySim(a.terms, b.terms);
      const opposed = a.polarity !== b.polarity;

      let kind: Contradiction['kind'] | null = null;
      let strength = 0;

      if (opposed && subj >= 0.5 && pred >= 0.4) {
        kind = 'negation';
        strength = Math.min(1, 0.45 + subj * 0.3 + pred * 0.3);
      } else if (opposed && a.scope === 'universal' && b.scope === 'particular' && whole >= 0.3) {
        kind = 'scope';
        strength = Math.min(1, 0.4 + whole * 0.6);
      } else if (
        a.type === 'normative' &&
        b.type === 'normative' &&
        opposed &&
        whole >= 0.28
      ) {
        kind = 'normative';
        strength = Math.min(1, 0.35 + whole * 0.6);
      } else if (
        a.type === 'definition' &&
        b.type === 'definition' &&
        fuzzyOverlap(a.subjectTerms, b.subjectTerms) >= 0.6 &&
        fuzzySim(a.predicateTerms, b.predicateTerms) < 0.2
      ) {
        kind = 'definitional';
        strength = 0.6;
      }

      // Hedged statements are explorations, not commitments. Accusing someone
      // of self-contradiction while they are visibly thinking aloud is the
      // worst failure this analysis can have, so hedging costs more than the
      // 0.5 gate can absorb from a merely decent signal.
      if (kind && (a.force === 'hedged' || b.force === 'hedged')) strength -= 0.35;

      if (kind && strength >= 0.5) {
        out.push({
          id: `x:${a.id}:${b.id}`,
          kind,
          aClaimId: a.id,
          bClaimId: b.id,
          note: conflictNote(a, b, kind),
          strength,
          resolved: false,
        });
      }
    }
  }
  return out;
}

/* ------------------------------ definitions ----------------------------- */

/**
 * Terms worth pausing on: recurring, argumentatively load-bearing, and never
 * pinned down. Sorted so the most central undefined term comes first.
 */
export function undefinedLoadBearing(terms: readonly TermUsage[]): TermUsage[] {
  return terms
    .filter((t) => !t.defined && (t.loadBearing || t.uses >= 3))
    .sort((a, b) => Number(b.loadBearing) - Number(a.loadBearing) || b.uses - a.uses);
}

/** True when the user's reply reads as accepting the premise just surfaced. */
export function readsAsAgreement(utterance: string): boolean {
  return cues.agrees(utterance) && !cues.disagrees(utterance);
}

export function readsAsRejection(utterance: string): boolean {
  return cues.disagrees(utterance);
}
