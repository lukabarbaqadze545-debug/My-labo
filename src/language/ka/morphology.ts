/**
 * Georgian morphology.
 *
 * Georgian is agglutinative and case-rich: one noun appears as ვექტორი,
 * ვექტორის, ვექტორს, ვექტორები, ვექტორებში… Matching on surface forms
 * therefore fails constantly, and a fixed-length trim (the previous approach)
 * unifies some pairs while splitting others apart.
 *
 * This module strips *known* suffixes longest-first, which handles regular
 * inflection properly. It deliberately does not attempt ablaut
 * (თავისუფალი / თავისუფლება) — that is lexical, and belongs in the alias
 * table, where a human can state the relationship once.
 */

/** Case endings, plural markers and postpositions, unsorted. */
const RAW_SUFFIXES = [
  // plural + case + postposition, longest first once sorted
  'ებისთვის', 'ებისათვის', 'ებისგან', 'ებისკენ', 'ებამდე', 'ებიდან', 'ებთან',
  'ებშიც', 'ებზეც', 'ებში', 'ებზე', 'ებით', 'ებად', 'ებმა', 'ების', 'ებს', 'ები', 'ებ',
  // singular case + postposition
  'ისთვის', 'ისათვის', 'ისგან', 'ისკენ', 'იდან', 'ამდე', 'თანაც', 'შიც', 'ზეც',
  'თვის', 'გან', 'კენ', 'მდე', 'თან', 'ვით', 'ურთ',
  'ში', 'ზე', 'ით', 'ად', 'ის', 'მა', 'თა', 'ნი', 'ებ',
  // bare vowel/consonant endings
  'ს', 'ი', 'ა', 'ე', 'ო', 'ც',
];

const SUFFIXES = [...new Set(RAW_SUFFIXES)].sort((a, b) => b.length - a.length);

/** Roots shorter than this are never produced — over-stripping destroys words. */
const MIN_STEM = 3;

const isGeorgian = (s: string) => /[Ⴀ-ჿ]/.test(s);

/**
 * Reduce a Georgian word to a matching stem. Latin words are lowercased and
 * returned unchanged, so mixed messages ("binary search-ის მაგალითი") work
 * without a separate code path.
 */
export function kaStem(word: string): string {
  const w = word.normalize('NFC').toLowerCase();
  if (!isGeorgian(w)) return w;
  if (w.length <= MIN_STEM) return w;

  for (const suffix of SUFFIXES) {
    if (w.length - suffix.length < MIN_STEM) continue;
    if (w.endsWith(suffix)) return w.slice(0, w.length - suffix.length);
  }
  return w;
}

/**
 * Stem twice. Georgian stacks morphemes, so „ვექტორებშიც" can need two
 * passes; a single pass leaves „ვექტორებ" where „ვექტორ" was wanted.
 */
export function kaStemDeep(word: string): string {
  const once = kaStem(word);
  const twice = kaStem(once);
  return twice.length >= MIN_STEM ? twice : once;
}

/** Do two words plausibly share a root? Used by the fuzzy retrieval layer. */
export function sameRoot(a: string, b: string): boolean {
  const sa = kaStemDeep(a);
  const sb = kaStemDeep(b);
  if (sa === sb) return true;
  const min = Math.min(sa.length, sb.length);
  if (min < 4) return false;
  let i = 0;
  while (i < min && sa[i] === sb[i]) i++;
  return i >= min - 1;
}

/**
 * Levenshtein distance, capped — beyond the cap the exact value does not
 * matter and the early exit keeps typo matching cheap.
 */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      curr[j] = v;
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    prev = curr;
  }
  return prev[b.length]!;
}

/** Typo tolerance that scales with word length. */
export function isTypoOf(a: string, b: string): boolean {
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;
  const budget = min <= 6 ? 1 : 2;
  return editDistance(a, b, budget) <= budget;
}

/** Character trigrams, for order-insensitive similarity. */
export function trigrams(word: string): string[] {
  const padded = `  ${word} `;
  const out: string[] = [];
  for (let i = 0; i < padded.length - 2; i++) out.push(padded.slice(i, i + 3));
  return out;
}

export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = new Set(trigrams(b));
  if (ta.length === 0) return 0;
  let shared = 0;
  for (const g of ta) if (tb.has(g)) shared++;
  return (2 * shared) / (ta.length + tb.size);
}
