import type { AdapterContext, FetchOutcome } from './types';

/**
 * NASA APOD (Astronomy Picture of the Day).
 *
 * Constraint found while testing: the endpoint *requires* an API key. The
 * shared DEMO_KEY reports `x-ratelimit-limit: 10` per hour per IP, so on a
 * shared network it will fail often. The astronomy lab therefore treats APOD as
 * a bonus: it renders fully without it, and when the call fails we say the
 * picture is unavailable rather than showing a placeholder as if it were today's.
 *
 * The user can supply their own free key in settings; it is stored locally.
 */

export interface ApodEntry {
  title: string;
  explanation: string;
  date: string;
  url: string;
  hdurl?: string;
  mediaType: 'image' | 'video' | 'other';
  copyright?: string;
}

const ENDPOINT = 'https://api.nasa.gov/planetary/apod';

export async function fetchApod(
  apiKey: string | undefined,
  { signal }: AdapterContext = {},
): Promise<FetchOutcome<ApodEntry>> {
  const key = apiKey?.trim() || 'DEMO_KEY';
  try {
    const response = await fetch(`${ENDPOINT}?api_key=${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
      ...(signal ? { signal } : {}),
    });
    if (response.status === 429) {
      return {
        status: 'unavailable',
        reason: key === 'DEMO_KEY'
          ? 'NASA-ს საერთო გასაღების ლიმიტი ამოიწურა. პარამეტრებში შეგიძლია საკუთარი, უფასო გასაღები დაამატო.'
          : 'NASA-ს მოთხოვნების ლიმიტი ამოიწურა.',
      };
    }
    if (!response.ok) return { status: 'unavailable', reason: `NASA APOD: HTTP ${response.status}` };

    const raw = (await response.json()) as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title : '';
    const url = typeof raw.url === 'string' ? raw.url : '';
    if (!title || !url) return { status: 'unavailable', reason: 'NASA-ს პასუხი არასრულია' };

    const mediaTypeRaw = typeof raw.media_type === 'string' ? raw.media_type : 'other';
    const entry: ApodEntry = {
      title,
      explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
      date: typeof raw.date === 'string' ? raw.date : new Date().toISOString().slice(0, 10),
      url,
      mediaType: mediaTypeRaw === 'image' || mediaTypeRaw === 'video' ? mediaTypeRaw : 'other',
      ...(typeof raw.hdurl === 'string' ? { hdurl: raw.hdurl } : {}),
      ...(typeof raw.copyright === 'string' ? { copyright: raw.copyright.trim() } : {}),
    };
    return { status: 'ok', data: entry, fetchedAt: Date.now() };
  } catch {
    return { status: 'unavailable', reason: 'ქსელი მიუწვდომელია' };
  }
}
