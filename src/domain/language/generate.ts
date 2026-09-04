import { SEED_UNITS } from './inventory';
import type { LanguageCorpus, LanguageFunction, LanguageUnit, Register } from './types';

/**
 * Role-based selection of Georgian discourse units.
 *
 * Two failure modes this exists to prevent:
 *
 *  1. Random insertion. A connective is chosen because the sentence performs
 *     that rhetorical role — contrast, conclusion, cause — never because a
 *     phrase was available.
 *
 *  2. Borrowed register. Vocabulary mined from a philosophy anthology must not
 *     make a binary-search explanation sound like a seminar. Every unit is
 *     graded, every subject has a ceiling, and „მაშასადამე" simply is not
 *     eligible when the topic is sorting algorithms.
 *
 * Density is capped too. Natural Georgian does not open every other sentence
 * with a connective, and an assistant that does reads as machine-generated.
 */

const RANK: Record<Register, number> = { neutral: 0, formal: 1, academic: 2 };

/** Subjects where a scholarly register is appropriate. */
const ACADEMIC_SUBJECTS = new Set([
  'philosophy',
  'georgian-literature',
  'world-literature',
  'history',
  'georgian-history',
  'civics',
  'linguistics',
]);

/** How formal this subject's prose may get. */
export function registerFor(subjectId?: string): Register {
  if (!subjectId) return 'formal';
  return ACADEMIC_SUBJECTS.has(subjectId) ? 'academic' : 'formal';
}

export interface GenerationContext {
  /** Subject under discussion. */
  subjectId?: string;
  /** Forced ceiling — set to 'neutral' when the user asked for it simply. */
  ceiling?: Register;
  /** Surfaces used recently, so the same connective does not repeat. */
  recent?: readonly string[];
  /** Connectives already placed in the reply being built. */
  usedInReply?: number;
  /** Mined evidence. Falls back to the seed inventory when absent. */
  corpus?: LanguageCorpus | null;
  /** Deterministic variation seed. */
  seed?: string;
}

/** Ceiling on connectives per reply. Beyond this, prose reads as padded. */
const MAX_PER_REPLY = 2;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pool(context: GenerationContext): LanguageUnit[] {
  return context.corpus?.units?.length ? context.corpus.units : SEED_UNITS;
}

/**
 * Pick the unit that performs `fn`, respecting register, recency and evidence.
 * Returns null when nothing is eligible — the caller then writes plain prose,
 * which is always an acceptable outcome.
 */
export function pickUnit(fn: LanguageFunction, context: GenerationContext = {}): LanguageUnit | null {
  if ((context.usedInReply ?? 0) >= MAX_PER_REPLY) return null;

  const ceiling = context.ceiling ?? registerFor(context.subjectId);
  const maxRank = RANK[ceiling];
  const recent = new Set(context.recent ?? []);

  const eligible = pool(context).filter(
    (unit) =>
      unit.function === fn &&
      unit.reusable &&
      (unit.domains.includes('*') || (context.subjectId ? unit.domains.includes(context.subjectId) : false)) &&
      RANK[unit.register] <= maxRank &&
      !recent.has(unit.surface),
  );

  if (eligible.length === 0) return null;

  // Prefer units a real corpus actually attests, then commoner ones. This is
  // where mining pays off: attested phrasing sounds like written Georgian.
  eligible.sort((a, b) => {
    const attested = Number(b.frequency > 0) - Number(a.frequency > 0);
    if (attested !== 0) return attested;
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return RANK[a.register] - RANK[b.register];
  });

  // Vary deterministically among the strongest few so replies do not become
  // formulaic, while staying reproducible for tests.
  const top = eligible.slice(0, Math.min(3, eligible.length));
  return top[hash(`${fn}:${context.seed ?? ''}`) % top.length]!;
}

/** The surface form to write, or null when no connective should be used. */
export function connective(fn: LanguageFunction, context: GenerationContext = {}): string | null {
  return pickUnit(fn, context)?.surface ?? null;
}

/**
 * Join two clauses with the connective for `fn`.
 *
 * Falls back to plain juxtaposition when nothing is eligible, which is the
 * point: the sentence still reads naturally without a discourse marker.
 */
export function joinWith(
  fn: LanguageFunction,
  first: string,
  second: string,
  context: GenerationContext = {},
): string {
  const unit = pickUnit(fn, context);
  if (!unit) return `${first.trim()} ${second.trim()}`;

  const a = first.trim().replace(/[.,]\s*$/, '');
  const b = second.trim();

  if (unit.position === 'initial') return `${a}. ${unit.surface}, ${b}`;
  return `${a}, ${unit.surface} ${b}`;
}

/**
 * Fill a stored pattern. Patterns hold placeholders only — never text from a
 * source — so this composes new sentences rather than reproducing old ones.
 */
export function applyPattern(unit: LanguageUnit, values: Record<string, string>): string | null {
  if (!unit.pattern) return null;
  let out = unit.pattern;
  for (const [key, value] of Object.entries(values)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  return /\{[A-Z]\}/.test(out) ? null : out;
}

/** Inflected forms of a word the corpus actually attested. */
export function formsOf(lemma: string, corpus: LanguageCorpus | null | undefined): string[] {
  if (!corpus) return [];
  const stem = lemma.normalize('NFC').toLowerCase();
  const lex = corpus.lexemes.find((l) => l.lemma === stem || l.lemma.startsWith(stem));
  return lex ? lex.forms.map((f) => f.form) : [];
}

/** Units grouped by what they do, for the inspector and Teach Labo. */
export function byFunction(corpus?: LanguageCorpus | null): Map<LanguageFunction, LanguageUnit[]> {
  const map = new Map<LanguageFunction, LanguageUnit[]>();
  for (const unit of corpus?.units?.length ? corpus.units : SEED_UNITS) {
    const bucket = map.get(unit.function);
    if (bucket) bucket.push(unit);
    else map.set(unit.function, [unit]);
  }
  return map;
}
