import type {
  Book,
  BookChunk,
  BookHit,
  BookKnowledgeItem,
  BookScope,
  BookSection,
} from './types';
import { chunkTerms } from './chunk';

/**
 * Stage 6 — retrieval.
 *
 * Lexical BM25 over chunks, built once at import and cached, plus a parallel
 * pass over structured knowledge items. No embeddings and no network: the
 * book system must work offline in a local-first app, and a semantic layer can
 * be added later as a re-ranker without changing this interface.
 *
 * Scope is applied *before* scoring, not as a filter afterwards. That is what
 * makes "answer only from this book" a guarantee: material outside scope is
 * never a candidate in the first place.
 */

const K1 = 1.5;
const B = 0.75;

export interface BookIndex {
  chunks: BookChunk[];
  /** stem → number of chunks containing it. */
  df: Map<string, number>;
  avgLength: number;
  total: number;
}

export function buildIndex(chunks: readonly BookChunk[]): BookIndex {
  const df = new Map<string, number>();
  let totalLength = 0;

  for (const chunk of chunks) {
    totalLength += chunk.length;
    for (const term of new Set(chunk.terms)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  return {
    chunks: [...chunks],
    df,
    avgLength: chunks.length ? totalLength / chunks.length : 1,
    total: chunks.length,
  };
}

function idf(term: string, index: BookIndex): number {
  const df = index.df.get(term) ?? 0;
  return Math.log(1 + (index.total - df + 0.5) / (df + 0.5));
}

/** How much a chunk's extraction quality is allowed to matter. */
const QUALITY_WEIGHT = { high: 1, medium: 0.85, low: 0.55 } as const;

export function scoreChunk(chunk: BookChunk, queryTerms: readonly string[], index: BookIndex): {
  score: number;
  matched: string[];
} {
  let score = 0;
  const matched: string[] = [];

  for (const term of new Set(queryTerms)) {
    const tf = chunk.tf[term] ?? 0;
    if (tf === 0) continue;
    matched.push(term);
    const norm = 1 - B + B * (chunk.length / (index.avgLength || 1));
    score += idf(term, index) * ((tf * (K1 + 1)) / (tf + K1 * norm));
  }

  return { score: score * QUALITY_WEIGHT[chunk.quality], matched };
}

/* -------------------------------- scoping ------------------------------- */

/** Book ids the scope allows. `null` means books are switched off entirely. */
export function booksInScope(scope: BookScope, books: readonly Book[]): Book[] | null {
  const usable = books.filter((b) => b.status === 'ready' && !b.disabled);
  switch (scope.mode) {
    case 'off':
      return null;
    case 'book':
    case 'selected':
      return usable.filter((b) => scope.bookIds.includes(b.id));
    case 'library':
    case 'with_labo':
      return usable;
    default:
      return null;
  }
}

/** True when the mode forbids answering from Labo's own authored knowledge. */
export function isBookExclusive(scope: BookScope): boolean {
  return scope.mode === 'book' || scope.mode === 'selected' || scope.mode === 'library';
}

/* ------------------------------- retrieval ------------------------------ */

export interface BookCorpus {
  books: readonly Book[];
  chunks: readonly BookChunk[];
  sections: readonly BookSection[];
  knowledge: readonly BookKnowledgeItem[];
}

export interface RetrieveOptions {
  limit?: number;
  /** Minimum score for a hit to count as relevant evidence. */
  minScore?: number;
}

export interface BookRetrieval {
  hits: BookHit[];
  knowledge: BookKnowledgeItem[];
  /** Books that were actually searched. */
  searched: Book[];
  /** True when the scope permitted books but nothing matched. */
  searchedButEmpty: boolean;
}

const indexCache = new WeakMap<readonly BookChunk[], BookIndex>();

function cachedIndex(chunks: readonly BookChunk[]): BookIndex {
  const hit = indexCache.get(chunks);
  if (hit) return hit;
  const built = buildIndex(chunks);
  indexCache.set(chunks, built);
  return built;
}

export function retrieveFromBooks(
  query: string,
  scope: BookScope,
  corpus: BookCorpus,
  options: RetrieveOptions = {},
): BookRetrieval {
  const allowed = booksInScope(scope, corpus.books);
  if (!allowed || allowed.length === 0) {
    return { hits: [], knowledge: [], searched: [], searchedButEmpty: false };
  }

  const allowedIds = new Set(allowed.map((b) => b.id));
  const scoped = corpus.chunks.filter((c) => allowedIds.has(c.bookId));
  if (scoped.length === 0) {
    return { hits: [], knowledge: [], searched: allowed, searchedButEmpty: true };
  }

  const index = cachedIndex(scoped);
  const queryTerms = chunkTerms(query);
  if (queryTerms.length === 0) {
    return { hits: [], knowledge: [], searched: allowed, searchedButEmpty: true };
  }

  const bookById = new Map(allowed.map((b) => [b.id, b]));
  const sectionById = new Map(corpus.sections.map((s) => [s.id, s]));

  const scored: BookHit[] = [];
  for (const chunk of scoped) {
    const { score, matched } = scoreChunk(chunk, queryTerms, index);
    if (score <= 0) continue;
    const book = bookById.get(chunk.bookId);
    if (!book) continue;
    const section = sectionById.get(chunk.sectionId);
    scored.push({ chunk, book, ...(section ? { section } : {}), score, matched });
  }

  scored.sort((a, b) => b.score - a.score);

  /**
   * Relevance is judged relative to the best hit, not against a fixed number.
   *
   * BM25 scores depend on corpus size: a common word in a two-book library
   * scores far lower than the same word in a large one, so an absolute floor
   * either rejects everything in a small library or admits noise in a big one.
   * The floor here only guards against a single incidental term match.
   */
  const top = scored[0]?.score ?? 0;
  const floor = Math.max(options.minScore ?? 0.25, top * 0.3);
  const hits = scored.filter((h) => h.score >= floor);

  /*
   * Structured knowledge is matched separately, but term *counts* are the
   * wrong measure here.
   *
   * On a real 559-item book, „პლატონის მიხედვით…" matched dozens of items
   * through „მიხედვით" alone and buried the handful that actually mention
   * Plato. Rare terms have to outweigh common ones, so matches are scored by
   * inverse document frequency across the in-scope knowledge, and an item has
   * to explain a real share of the query to survive.
   */
  const querySet = new Set(queryTerms);
  const scopedKnowledge = corpus.knowledge.filter((item) => allowedIds.has(item.bookId));

  const kdf = new Map<string, number>();
  for (const item of scopedKnowledge) {
    for (const term of new Set(item.terms)) kdf.set(term, (kdf.get(term) ?? 0) + 1);
  }
  const kn = scopedKnowledge.length || 1;
  const kidf = (term: string) => {
    const df = kdf.get(term) ?? 0;
    return Math.log(1 + (kn - df + 0.5) / (df + 0.5));
  };

  const confidenceRank = { high: 0, medium: 1, low: 2 } as const;
  const scoredKnowledge = scopedKnowledge
    .map((item) => {
      const matched = [...new Set(item.terms)].filter((t) => querySet.has(t));
      let score = matched.reduce((sum, t) => sum + kidf(t), 0);

      /*
       * Naming a section is a much stronger signal than matching a word in it.
       *
       * „მაკიაველი რას ამბობს…" should reach Machiavelli's pages, but on its
       * own „მაკიაველ" is just one term among several and common words in the
       * question outweigh it. A query that names the section an item belongs
       * to is asking about that section.
       */
      const sectionName = item.source.section ?? item.source.chapter;
      if (sectionName) {
        const sectionTerms = chunkTerms(sectionName);
        const named = sectionTerms.some((t) => querySet.has(t));
        if (named && sectionTerms.length > 0) score *= 3;
      }

      return { item, score, coverage: matched.length / querySet.size };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || confidenceRank[a.item.confidence] - confidenceRank[b.item.confidence]);

  const topKnowledge = scoredKnowledge[0]?.score ?? 0;
  const knowledge = scoredKnowledge
    .filter((x) => x.coverage >= 0.34 || x.score >= topKnowledge * 0.6)
    .slice(0, 12)
    .map((x) => x.item);

  const limited = hits.slice(0, options.limit ?? 6);

  return {
    hits: limited,
    knowledge,
    searched: allowed,
    searchedButEmpty: limited.length === 0 && knowledge.length === 0,
  };
}
