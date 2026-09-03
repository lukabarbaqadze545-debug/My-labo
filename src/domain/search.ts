import { library, t, type EntityKind, type LocaleCode } from '@/content';

/**
 * Global search across every entity kind.
 *
 * Georgian-specific notes that shaped this implementation:
 *  - Mkhedruli has no letter case, so folding only matters for Latin text.
 *    We still lowercase, because subject names and sources contain Latin.
 *  - Georgian is agglutinative: query words are usually *stems* of the word in
 *    the text („ატომ" for „ატომები"), so prefix matching on tokens matters far
 *    more than exact token equality.
 *  - Text is normalised to NFC so Georgian typed from different keyboards and
 *    input methods compares equal.
 */

export interface SearchDoc {
  id: string;
  kind: EntityKind;
  /** Primary label shown in results. */
  title: string;
  /** Secondary line — subject path, subtitle, snippet. */
  subtitle?: string;
  /** Everything searchable, already flattened. */
  haystack: string;
  subjectId?: string;
  /** Route the result navigates to. */
  href: string;
  /** Baseline importance, used to break ties (topics beat facts, etc.). */
  weight: number;
}

export interface SearchResult extends SearchDoc {
  score: number;
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().trim();

export function tokenize(query: string): string[] {
  return norm(query)
    .split(/[\s,.;:!?"'()[\]{}\-–—/\\]+/u)
    .filter((token) => token.length > 0);
}

/** Build the searchable documents for all bundled content. */
export function buildContentIndex(locale: LocaleCode = 'ka'): SearchDoc[] {
  const docs: SearchDoc[] = [];
  const subjectName = (id: string) => t(library.subjectById.get(id)?.name, locale);

  for (const s of library.subjects) {
    docs.push({
      id: s.id,
      kind: 'subject',
      title: t(s.name, locale),
      subtitle: t(s.tagline, locale),
      haystack: norm([t(s.name, locale), s.name.en ?? '', t(s.tagline, locale), s.id].join(' ')),
      subjectId: s.id,
      href: `/labs/${s.id}`,
      weight: 1.3,
    });
  }

  for (const topic of library.topics) {
    const bodyText = topic.sections
      .flatMap((section) =>
        section.blocks.map((block) => {
          switch (block.type) {
            case 'paragraph':
              return t(block.text, locale);
            case 'list':
              return block.items.map((i) => t(i, locale)).join(' ');
            case 'callout':
              return `${t(block.title, locale)} ${t(block.text, locale)}`;
            case 'termList':
              return block.items.map((i) => `${t(i.term, locale)} ${t(i.def, locale)}`).join(' ');
            case 'quote':
              return t(block.text, locale);
            case 'code':
              return block.code;
            default:
              return '';
          }
        }),
      )
      .join(' ');
    docs.push({
      id: topic.id,
      kind: 'topic',
      title: t(topic.title, locale),
      subtitle: `${subjectName(topic.subjectId)} · ${t(topic.hook, locale)}`,
      haystack: norm(
        [t(topic.title, locale), topic.title.en ?? '', t(topic.hook, locale), (topic.tags ?? []).join(' '), bodyText].join(' '),
      ),
      subjectId: topic.subjectId,
      href: `/topics/${topic.id}`,
      weight: 1.5,
    });
  }

  for (const f of library.formulas) {
    docs.push({
      id: f.id,
      kind: 'formula',
      title: t(f.name, locale),
      subtitle: f.expression,
      haystack: norm(
        [
          t(f.name, locale),
          f.name.en ?? '',
          f.expression,
          t(f.explanation, locale),
          f.variables.map((v) => `${v.symbol} ${t(v.meaning, locale)} ${v.unit ?? ''}`).join(' '),
        ].join(' '),
      ),
      subjectId: f.subjectId,
      href: `/formulas?open=${f.id}`,
      weight: 1.2,
    });
  }

  for (const fact of library.facts) {
    docs.push({
      id: fact.id,
      kind: 'fact',
      title: t(fact.text, locale).slice(0, 90),
      subtitle: subjectName(fact.subjectId),
      haystack: norm([t(fact.text, locale), t(fact.why, locale), (fact.tags ?? []).join(' ')].join(' ')),
      subjectId: fact.subjectId,
      href: `/facts?open=${fact.id}`,
      weight: 0.9,
    });
  }

  for (const p of library.people) {
    docs.push({
      id: p.id,
      kind: 'person',
      title: t(p.name, locale),
      subtitle: `${p.lived} · ${t(p.known, locale)}`,
      haystack: norm([t(p.name, locale), p.name.en ?? '', t(p.known, locale), t(p.story, locale), p.lived].join(' ')),
      subjectId: p.subjectId,
      href: `/people/${p.id}`,
      weight: 1.1,
    });
  }

  for (const e of library.events) {
    docs.push({
      id: e.id,
      kind: 'event',
      title: t(e.title, locale),
      subtitle: `${e.year} · ${subjectName(e.subjectId)}`,
      haystack: norm(
        [t(e.title, locale), t(e.summary, locale), t(e.cause, locale), t(e.consequence, locale), String(e.year)].join(' '),
      ),
      subjectId: e.subjectId,
      href: `/timeline?open=${e.id}`,
      weight: 1.0,
    });
  }

  for (const q of library.questions) {
    docs.push({
      id: q.id,
      kind: 'question',
      title: t(q.text, locale),
      subtitle: q.subjectId ? subjectName(q.subjectId) : undefined,
      haystack: norm(t(q.text, locale)),
      ...(q.subjectId ? { subjectId: q.subjectId } : {}),
      href: `/questions?open=${q.id}`,
      weight: 0.8,
    });
  }

  for (const a of library.activities) {
    docs.push({
      id: a.id,
      kind: 'activity',
      title: t(a.title, locale),
      subtitle: `${t(a.invitation, locale)} · ${subjectName(a.subjectId)}`,
      haystack: norm([t(a.title, locale), t(a.invitation, locale)].join(' ')),
      subjectId: a.subjectId,
      href: a.topicId ? `/topics/${a.topicId}#activity-${a.id}` : `/labs/${a.subjectId}`,
      weight: 0.85,
    });
  }

  return docs;
}

/**
 * Score one document against tokenised query terms.
 * Returns 0 when any term is missing entirely — search is AND, not OR, which
 * keeps multi-word queries from returning the whole library.
 */
export function scoreDoc(doc: SearchDoc, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const title = norm(doc.title);
  let score = 0;

  for (const term of terms) {
    let termScore = 0;
    if (title === term) termScore = 12;
    else if (title.startsWith(term)) termScore = 8;
    else if (new RegExp(`(^|\\s)${escapeRegExp(term)}`, 'u').test(title)) termScore = 6;
    else if (title.includes(term)) termScore = 4;

    if (termScore === 0) {
      if (new RegExp(`(^|\\s)${escapeRegExp(term)}`, 'u').test(doc.haystack)) termScore = 2;
      else if (doc.haystack.includes(term)) termScore = 1;
    }

    // Every term must appear somewhere.
    if (termScore === 0) return 0;
    score += termScore;
  }

  return score * doc.weight;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface SearchOptions {
  limit?: number;
  kinds?: readonly EntityKind[];
  /** Extra documents (user notes, questions, cached research) merged in. */
  extraDocs?: readonly SearchDoc[];
}

export function search(query: string, docs: readonly SearchDoc[], options: SearchOptions = {}): SearchResult[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const pool = options.extraDocs ? [...docs, ...options.extraDocs] : docs;
  const kinds = options.kinds ? new Set(options.kinds) : undefined;

  const results: SearchResult[] = [];
  for (const doc of pool) {
    if (kinds && !kinds.has(doc.kind)) continue;
    const score = scoreDoc(doc, terms);
    if (score > 0) results.push({ ...doc, score });
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ka'));
  return results.slice(0, options.limit ?? 40);
}

/** Group results by entity kind, preserving relevance order within groups. */
export function groupResults(results: readonly SearchResult[]): Map<EntityKind, SearchResult[]> {
  const grouped = new Map<EntityKind, SearchResult[]>();
  for (const result of results) {
    const bucket = grouped.get(result.kind);
    if (bucket) bucket.push(result);
    else grouped.set(result.kind, [result]);
  }
  return grouped;
}
