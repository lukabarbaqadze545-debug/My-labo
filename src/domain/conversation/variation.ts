/**
 * Repetition avoidance for anything picked from a small fixed list.
 *
 * The same mechanism serves greetings, closing questions and connectors:
 * given a list and a set of recently-used values, pick deterministically among
 * whatever is left. Deterministic means testable — the same conversation
 * always produces the same reply — but "left after excluding recent ones"
 * means three greetings in a row do not read identically.
 */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickAvoiding<T>(list: readonly T[], seed: string, recent: readonly T[] = []): T {
  const recentSet = new Set(recent);
  const fresh = list.filter((item) => !recentSet.has(item));
  const pool = fresh.length > 0 ? fresh : list;
  return pool[hash(seed) % pool.length]!;
}
