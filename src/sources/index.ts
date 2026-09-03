export * from './types';
export { fetchOpenAlex, buildQueryUrl, normalizeWork } from './openalex';
export { fetchApod, type ApodEntry } from './nasa';
export { fetchRecentQuakes, type QuakeEvent } from './usgs';
export { cachedFetch, describeAge, clearSourceCache } from './cache';

import { cachedFetch } from './cache';
import { fetchOpenAlex } from './openalex';
import { RADAR_CATEGORIES, type FetchOutcome, type RadarCategory, type ResearchItem } from './types';

/** Load one Research Radar category, cached and offline-tolerant. */
export function loadRadarCategory(
  categoryId: RadarCategory,
  options: { mailto?: string; signal?: AbortSignal } = {},
): Promise<FetchOutcome<ResearchItem[]>> {
  const category = RADAR_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) {
    return Promise.resolve({ status: 'unavailable', reason: 'უცნობი კატეგორია' });
  }
  return cachedFetch(`radar:${categoryId}`, () => fetchOpenAlex(category, options), {
    maxAgeMs: 6 * 60 * 60 * 1000,
  });
}

/** Research relevant to a single topic, using its authored research query. */
export function loadTopicResearch(
  topicId: string,
  query: { field?: string; search?: string },
  options: { mailto?: string; signal?: AbortSignal } = {},
): Promise<FetchOutcome<ResearchItem[]>> {
  const fields = query.field ? [query.field] : ['fields/31'];
  const category = {
    id: 'physics' as RadarCategory,
    label: '',
    glyph: '',
    fields,
    ...(query.search ? { search: query.search } : {}),
  };
  return cachedFetch(`topic-research:${topicId}`, () => fetchOpenAlex(category, options, { perPage: 5 }), {
    maxAgeMs: 12 * 60 * 60 * 1000,
  });
}
