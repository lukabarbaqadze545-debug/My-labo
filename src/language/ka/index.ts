export * from './morphology';
export * from './signals';
export * from './aliases';
export * from './phrasing';

import { ALIASES, type AliasEntry } from './aliases';
import { kaStemDeep } from './morphology';

/**
 * Alias lookup index, built once.
 *
 * Multi-word forms ("binary search") are indexed by their full stemmed phrase
 * *and* by each token, so both „binary search ამიხსენი" and a bare „search"
 * find their way. Single tokens map to every concept that claims them, and
 * ranking is left to the retrieval layer.
 */
export interface AliasIndex {
  /** Stemmed phrase → entries. */
  byPhrase: Map<string, AliasEntry[]>;
  /** Stemmed single token → entries. */
  byToken: Map<string, AliasEntry[]>;
  /** Every distinct stemmed token an alias mentions, for fuzzy matching. */
  vocabulary: string[];
  byConcept: Map<string, AliasEntry>;
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const bucket = map.get(key);
  if (bucket) {
    if (!bucket.includes(value)) bucket.push(value);
  } else map.set(key, [value]);
}

export function stemPhrase(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[\s\-_]+/u)
    .filter(Boolean)
    .map(kaStemDeep)
    .join(' ');
}

let cache: AliasIndex | null = null;

export function aliasIndex(extra: readonly AliasEntry[] = []): AliasIndex {
  if (cache && extra.length === 0) return cache;

  const byPhrase = new Map<string, AliasEntry[]>();
  const byToken = new Map<string, AliasEntry[]>();
  const byConcept = new Map<string, AliasEntry>();
  const vocabulary = new Set<string>();

  for (const entry of [...ALIASES, ...extra]) {
    byConcept.set(entry.concept, entry);
    for (const form of entry.forms) {
      const phrase = stemPhrase(form);
      if (!phrase) continue;
      push(byPhrase, phrase, entry);
      for (const token of phrase.split(' ')) {
        if (token.length < 2) continue;
        push(byToken, token, entry);
        vocabulary.add(token);
      }
    }
  }

  const index: AliasIndex = { byPhrase, byToken, byConcept, vocabulary: [...vocabulary] };
  if (extra.length === 0) cache = index;
  return index;
}

/** Invalidate the cached index after user-taught aliases change. */
export function resetAliasIndex(): void {
  cache = null;
}
