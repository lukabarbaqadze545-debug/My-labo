/**
 * Research source adapters.
 *
 * Editorial rules encoded here, not in the UI:
 *  - Every item must carry a resolvable source. No source, no item.
 *  - Evidence type is never guessed upward. A preprint is labelled a preprint,
 *    and the UI is required to show that label.
 *  - Adapters return `unavailable` rather than substituting invented content
 *    when a fetch fails. Saying "we could not load this" is the correct
 *    behaviour; inventing a plausible paper is not.
 */

export type EvidenceType =
  /** Published in a journal. Usually peer reviewed, but we do not assert it. */
  | 'journalArticle'
  /** Posted to a preprint server. Explicitly not peer reviewed. */
  | 'preprint'
  /** Review / survey article. */
  | 'review'
  /** Dataset or software record. */
  | 'dataset'
  /** Announcement from a research institution (NASA, CERN, NOAA…). */
  | 'institutional'
  /** Ongoing project or mission rather than a single result. */
  | 'project';

export interface ResearchSource {
  /** Publisher or venue, e.g. "Nature", "arXiv", "NASA". */
  name: string;
  url: string;
  /** DOI when one exists. */
  doi?: string;
}

export interface ResearchItem {
  id: string;
  title: string;
  /** Short plain-language summary when the adapter can supply one honestly. */
  summary?: string;
  evidence: EvidenceType;
  source: ResearchSource;
  /** ISO date string. */
  date?: string;
  authors?: string[];
  /** Which Research Radar category this belongs to. */
  category: RadarCategory;
  /** Free-text topic label from the provider's own taxonomy. */
  topicLabel?: string;
  openAccess?: boolean;
}

export type RadarCategory =
  | 'physics'
  | 'astronomy'
  | 'biology'
  | 'medicine'
  | 'chemistry'
  | 'mathematics'
  | 'cs'
  | 'ai'
  | 'climate'
  | 'earth'
  | 'archaeology'
  | 'engineering';

export interface RadarCategoryMeta {
  id: RadarCategory;
  label: string;
  glyph: string;
  /** OpenAlex field ids backing this category. */
  fields: string[];
  /** Optional search phrase to narrow within the field. */
  search?: string;
}

export const RADAR_CATEGORIES: RadarCategoryMeta[] = [
  { id: 'physics', label: 'ფიზიკა', glyph: '⚛', fields: ['fields/31'], search: 'physics' },
  { id: 'astronomy', label: 'ასტრონომია', glyph: '✦', fields: ['fields/31'], search: 'astronomy astrophysics' },
  { id: 'biology', label: 'ბიოლოგია', glyph: '🧬', fields: ['fields/13', 'fields/11'] },
  { id: 'medicine', label: 'მედიცინა', glyph: '⚕', fields: ['fields/27'] },
  { id: 'chemistry', label: 'ქიმია', glyph: '⚗', fields: ['fields/16'] },
  { id: 'mathematics', label: 'მათემატიკა', glyph: '∑', fields: ['fields/26'] },
  { id: 'cs', label: 'კომპიუტერული მეცნიერება', glyph: '⌘', fields: ['fields/17'] },
  { id: 'ai', label: 'ხელოვნური ინტელექტი', glyph: '◈', fields: ['fields/17'], search: 'machine learning' },
  { id: 'climate', label: 'კლიმატი', glyph: '🌍', fields: ['fields/23'], search: 'climate' },
  { id: 'earth', label: 'დედამიწის მეცნიერებები', glyph: '🜨', fields: ['fields/19'] },
  { id: 'archaeology', label: 'არქეოლოგია', glyph: '⌛', fields: ['fields/12'], search: 'archaeology' },
  { id: 'engineering', label: 'ინჟინერია', glyph: '⚙', fields: ['fields/22'] },
];

export const EVIDENCE_LABELS: Record<EvidenceType, { label: string; note: string; tone: 'strong' | 'medium' | 'caution' }> = {
  journalArticle: {
    label: 'ჟურნალის სტატია',
    note: 'გამოქვეყნებულია სამეცნიერო ჟურნალში',
    tone: 'strong',
  },
  preprint: {
    label: 'პრეპრინტი',
    note: 'ჯერ არ გაუვლია რეცენზირება — შედეგი შეიძლება შეიცვალოს',
    tone: 'caution',
  },
  review: { label: 'მიმოხილვა', note: 'აჯამებს არსებულ კვლევებს', tone: 'strong' },
  dataset: { label: 'მონაცემები', note: 'მონაცემთა ბაზა ან პროგრამული უზრუნველყოფა', tone: 'medium' },
  institutional: { label: 'ინსტიტუციური განცხადება', note: 'სამეცნიერო დაწესებულების ოფიციალური ინფორმაცია', tone: 'strong' },
  project: { label: 'მიმდინარე პროექტი', note: 'გრძელვადიანი კვლევა ან მისია', tone: 'medium' },
};

/** Result envelope: adapters never throw at the call site. */
export type FetchOutcome<T> =
  | { status: 'ok'; data: T; fetchedAt: number }
  | { status: 'stale'; data: T; fetchedAt: number; reason: string }
  | { status: 'unavailable'; reason: string };

export interface AdapterContext {
  signal?: AbortSignal;
  /** Contact address sent to APIs that request one (OpenAlex polite pool). */
  mailto?: string;
}
