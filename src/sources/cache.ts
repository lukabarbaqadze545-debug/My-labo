import type { FetchOutcome } from './types';

/**
 * Tiny persistent cache in front of every network adapter.
 *
 * The offline story depends on this: when a fetch fails we fall back to the
 * last good payload and downgrade the outcome to `stale`, so the UI can show
 * the content *and* tell the truth about its age. Nothing is ever silently
 * presented as fresh.
 */

const PREFIX = 'labo:cache:';

interface CacheEnvelope<T> {
  data: T;
  fetchedAt: number;
}

function read<T>(key: string): CacheEnvelope<T> | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (typeof parsed?.fetchedAt !== 'number') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function write<T>(key: string, envelope: CacheEnvelope<T>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota or private mode — caching is an optimisation, never a requirement.
  }
}

export interface CachedFetchOptions {
  /** How long a cached payload counts as fresh. */
  maxAgeMs?: number;
}

/**
 * Run `loader`, but serve a fresh cache hit without touching the network and
 * fall back to a stale one if the network fails.
 */
export async function cachedFetch<T>(
  key: string,
  loader: () => Promise<FetchOutcome<T>>,
  { maxAgeMs = 6 * 60 * 60 * 1000 }: CachedFetchOptions = {},
): Promise<FetchOutcome<T>> {
  const cached = read<T>(key);
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;

  if (cached && age < maxAgeMs) {
    return { status: 'ok', data: cached.data, fetchedAt: cached.fetchedAt };
  }

  const outcome = await loader();
  if (outcome.status === 'ok') {
    write(key, { data: outcome.data, fetchedAt: outcome.fetchedAt });
    return outcome;
  }

  if (cached) {
    return {
      status: 'stale',
      data: cached.data,
      fetchedAt: cached.fetchedAt,
      reason: outcome.status === 'unavailable' ? outcome.reason : 'ახალი მონაცემები ვერ ჩამოიტვირთა',
    };
  }
  return outcome;
}

/** Human-readable Georgian age label for stale content. */
export function describeAge(fetchedAt: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - fetchedAt) / 60_000);
  if (minutes < 1) return 'ახლახან';
  if (minutes < 60) return `${minutes} წუთის წინ`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} საათის წინ`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'გუშინ';
  if (days < 30) return `${days} დღის წინ`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'თვის წინ' : `${months} თვის წინ`;
}

export function clearSourceCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
