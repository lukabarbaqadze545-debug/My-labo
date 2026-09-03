import type { AdapterContext, FetchOutcome, RadarCategoryMeta, ResearchItem } from './types';

/**
 * OpenAlex adapter — the Research Radar's primary source.
 *
 * Why OpenAlex and not arXiv: arXiv's API sends no CORS headers at all, so a
 * browser cannot call it. OpenAlex indexes arXiv preprints anyway, exposes a
 * usable taxonomy, and allows cross-origin requests.
 *
 * Quality gate: OpenAlex indexes everything, including junk. A live query for
 * recent physics returned a Zenodo upload whose listed author was "Claude".
 * Anything without a recognised venue, or from a general-purpose upload host,
 * is dropped rather than shown to a student as "current research".
 */

const API = 'https://api.openalex.org/works';

/** General-purpose upload hosts: real work lives here, but so does noise, and
 *  we cannot tell them apart from metadata alone. */
const EXCLUDED_VENUES = [
  'zenodo',
  'figshare',
  'researchgate',
  'preprints.org',
  'authorea',
  'osf',
  'ssrn',
  'techrxiv',
];

/** Recognised preprint servers — legitimate, but must be labelled as preprints. */
const PREPRINT_VENUES = ['arxiv', 'biorxiv', 'medrxiv', 'chemrxiv', 'psyarxiv', 'hal', 'research square'];

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_date?: string;
  type?: string;
  cited_by_count?: number;
  primary_location?: {
    is_oa?: boolean;
    landing_page_url?: string | null;
    source?: { display_name?: string | null; type?: string | null; host_organization_name?: string | null } | null;
  } | null;
  authorships?: { author?: { display_name?: string | null } | null }[];
  primary_topic?: { display_name?: string | null; field?: { display_name?: string | null } | null } | null;
  open_access?: { is_oa?: boolean } | null;
}

const SELECT = [
  'id',
  'doi',
  'title',
  'publication_date',
  'type',
  'cited_by_count',
  'primary_location',
  'authorships',
  'primary_topic',
  'open_access',
].join(',');

function daysAgoISO(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function buildQueryUrl(category: RadarCategoryMeta, opts: { perPage?: number; windowDays?: number } = {}): string {
  const { perPage = 12, windowDays = 45 } = opts;
  const field = category.fields[0] ?? 'fields/31';
  const filters = [
    `from_publication_date:${daysAgoISO(windowDays)}`,
    `primary_topic.field.id:${field}`,
    'has_doi:true',
    'is_paratext:false',
  ];
  const params = new URLSearchParams({
    filter: filters.join(','),
    select: SELECT,
    sort: 'publication_date:desc',
    'per-page': String(perPage * 3), // over-fetch: the quality gate drops a lot
  });
  if (category.search) params.set('search', category.search);
  return `${API}?${params.toString()}`;
}

function venueOf(work: OpenAlexWork): string | undefined {
  const name = work.primary_location?.source?.display_name;
  return name ? name.trim() : undefined;
}

/** Returns null when the work fails the quality gate. */
export function normalizeWork(work: OpenAlexWork, category: RadarCategoryMeta['id']): ResearchItem | null {
  const title = (work.title ?? work.display_name ?? '').trim();
  if (title.length < 12) return null;

  const venue = venueOf(work);
  if (!venue) return null;
  const venueLower = venue.toLowerCase();
  if (EXCLUDED_VENUES.some((bad) => venueLower.includes(bad))) return null;

  const url = work.doi ?? work.primary_location?.landing_page_url ?? work.id;
  if (!url) return null;

  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name?.trim())
    .filter((n): n is string => Boolean(n && n.length > 1));
  if (authors.length === 0) return null;

  const sourceType = work.primary_location?.source?.type ?? '';
  const isPreprintVenue = PREPRINT_VENUES.some((p) => venueLower.includes(p));

  let evidence: ResearchItem['evidence'];
  if (work.type === 'preprint' || isPreprintVenue) evidence = 'preprint';
  else if (work.type === 'review') evidence = 'review';
  else if (work.type === 'dataset') evidence = 'dataset';
  else if (sourceType === 'journal' || sourceType === 'conference') evidence = 'journalArticle';
  else return null; // unknown venue class — do not guess

  const item: ResearchItem = {
    id: work.id ?? url,
    title,
    evidence,
    category,
    source: {
      name: venue,
      url: url.startsWith('http') ? url : `https://doi.org/${url}`,
      ...(work.doi ? { doi: work.doi.replace('https://doi.org/', '') } : {}),
    },
    ...(work.publication_date ? { date: work.publication_date } : {}),
    authors: authors.slice(0, 4),
    ...(work.primary_topic?.display_name ? { topicLabel: work.primary_topic.display_name } : {}),
    ...(typeof work.open_access?.is_oa === 'boolean' ? { openAccess: work.open_access.is_oa } : {}),
  };
  return item;
}

export async function fetchOpenAlex(
  category: RadarCategoryMeta,
  { signal, mailto }: AdapterContext = {},
  opts: { perPage?: number; windowDays?: number } = {},
): Promise<FetchOutcome<ResearchItem[]>> {
  const url = buildQueryUrl(category, opts);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (mailto) headers['User-Agent'] = `LukasLabo/1.0 (mailto:${mailto})`;

  try {
    const response = await fetch(mailto ? `${url}&mailto=${encodeURIComponent(mailto)}` : url, {
      headers,
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      return { status: 'unavailable', reason: `OpenAlex: HTTP ${response.status}` };
    }
    const payload = (await response.json()) as { results?: OpenAlexWork[] };
    const results = payload.results ?? [];
    const items: ResearchItem[] = [];
    const seenTitles = new Set<string>();

    for (const work of results) {
      const item = normalizeWork(work, category.id);
      if (!item) continue;
      const key = item.title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      items.push(item);
      if (items.length >= (opts.perPage ?? 12)) break;
    }

    if (items.length === 0) {
      return { status: 'unavailable', reason: 'ამ კატეგორიაში სანდო ჩანაწერი ვერ მოიძებნა' };
    }
    return { status: 'ok', data: items, fetchedAt: Date.now() };
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'მოთხოვნა შეწყდა' : 'ქსელი მიუწვდომელია';
    return { status: 'unavailable', reason };
  }
}
