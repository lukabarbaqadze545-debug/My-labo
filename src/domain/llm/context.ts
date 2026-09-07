import { groundingItems, topicPassage } from '@/domain/assistant';
import {
  citationOf,
  isBookExclusive,
  relevantExcerpt,
  retrieveFromBooks,
  type BookCorpus,
  type BookKnowledgeItem,
  type BookScope,
} from '@/domain/books';
import type { ConversationState } from '@/domain/conversation';
import { graphContext, type KnowledgeGraph } from '@/domain/knowledge';
import type { Evidence, ReasoningContext } from './types';

/**
 * Stage 1 — build a compact reasoning context.
 *
 * The model never sees the library. It sees the handful of passages retrieval
 * selected for *this* question, each with an id it can cite, inside a fixed
 * character budget. That is the difference between retrieval-augmented
 * reasoning and stuffing a context window: the budget here is what keeps the
 * system usable as the library grows to hundreds of books.
 *
 * Scope is honoured exactly as the deterministic engine honours it. In a
 * book-exclusive mode Labo's own authored knowledge is not merely ranked lower,
 * it is never assembled, so "answer only from this book" stays a guarantee
 * rather than a preference the model might talk itself out of.
 */

/** Total characters of evidence text allowed in one prompt. */
const BUDGET = 6000;
/** Per-item caps. A single long chapter must not eat the whole budget. */
const TOPIC_CAP = 900;
const CHUNK_CAP = 700;
const KNOWLEDGE_CAP = 500;

/** Turns kept verbatim; everything older is summarised. */
const VERBATIM_TURNS = 8;

export interface ContextInput {
  query: string;
  state: ConversationState;
  bookScope?: BookScope | undefined;
  bookCorpus?: BookCorpus | undefined;
  memories?: readonly string[];
  /** Prior turns, oldest first. */
  history?: readonly { role: 'user' | 'assistant'; content: string }[];
  /**
   * The knowledge graph, when one is available.
   *
   * It contributes two different things, and keeping them apart is the whole
   * point: *structure* (relationships) goes to the prompt as context, while the
   * *content* behind graph-linked topics enters as ordinary evidence and is
   * validated exactly like anything else.
   */
  graph?: KnowledgeGraph | undefined;
}

function clip(text: string, cap: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > cap ? `${clean.slice(0, cap - 1).trimEnd()}…` : clean;
}

/** Labo's own authored material, ranked by the library retriever. */
function laboEvidence(query: string): Omit<Evidence, 'id'>[] {
  return groundingItems(query, 4).map((item) => ({
    kind: 'topic' as const,
    title: item.title,
    text: clip(item.text, TOPIC_CAP),
    ...(item.ref ? { ref: item.ref } : {}),
  }));
}

/** An extracted knowledge item, rendered so its structure survives. */
function knowledgeText(item: BookKnowledgeItem): string {
  if (item.premises?.length && item.conclusion) {
    return clip(`${item.premises.join(' ')} → ${item.conclusion}`, KNOWLEDGE_CAP);
  }
  return clip(item.content, KNOWLEDGE_CAP);
}

/** Imported books, within scope, ranked by BM25 plus structured knowledge. */
function bookEvidence(query: string, scope: BookScope, corpus: BookCorpus) {
  const retrieval = retrieveFromBooks(query, scope, corpus, { limit: 5 });
  const out: Omit<Evidence, 'id'>[] = [];

  for (const item of retrieval.knowledge.slice(0, 5)) {
    out.push({
      kind: 'book_knowledge',
      title: `${item.conceptLabel} — ${item.type}`,
      text: knowledgeText(item),
      pages: {
        bookTitle: item.source.bookTitle,
        ...(item.source.chapter ? { chapter: item.source.chapter } : {}),
        pageStart: item.source.pageStart,
        pageEnd: item.source.pageEnd,
      },
      confidence: item.confidence,
    });
  }

  for (const hit of retrieval.hits) {
    const citation = citationOf(hit);
    out.push({
      kind: 'book',
      title: hit.section?.title ?? hit.book.title,
      // The sentences that actually address the question, not the whole chunk:
      // the model reasons better over a tight passage, and a tight passage is
      // also what makes a page citation defensible.
      text: relevantExcerpt(hit.chunk.text, query, CHUNK_CAP),
      pages: {
        bookTitle: citation.bookTitle,
        ...(citation.chapter ? { chapter: citation.chapter } : {}),
        pageStart: citation.pageStart,
        pageEnd: citation.pageEnd,
      },
      confidence: hit.chunk.quality,
    });
  }

  return { items: out, searchedButEmpty: retrieval.searchedButEmpty };
}

/**
 * Topics reached through the graph rather than through the query's words.
 *
 * This is retrieval expansion: asking about Dijkstra should be able to surface
 * the graph-theory topic it depends on, even when the question never used that
 * word. Only material with real text qualifies — a subject or a formula node
 * carries no passage and would be structure masquerading as a source.
 */
function graphEvidence(graph: KnowledgeGraph, query: string): {
  items: Omit<Evidence, 'id'>[];
  structure: string;
} {
  const context = graphContext(graph, query, { roots: 2, depth: 1, limit: 12 });
  const items: Omit<Evidence, 'id'>[] = [];

  for (const source of context.sources) {
    if (source.type !== 'topic') continue;
    const text = topicPassage(source.sourceEntityId, TOPIC_CAP);
    if (!text) continue;
    items.push({
      kind: 'topic',
      title: source.title,
      text: clip(text, TOPIC_CAP),
      ref: { label: source.title, href: `/topics/${source.sourceEntityId}` },
    });
  }

  return { items, structure: context.structure };
}

/**
 * Interleave two ranked lists.
 *
 * In `with_labo` a book with many strong chunks would otherwise fill the budget
 * before Labo's own topic on the same subject is reached, and the answer would
 * silently stop using half the knowledge the user has.
 */
function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]!);
    if (b[i]) out.push(b[i]!);
  }
  return out;
}

/**
 * Compact turns that are too old to send verbatim into a short structured note.
 *
 * This is memory *compaction*, not reasoning, so it stays deterministic: it
 * costs nothing, works offline, and cannot drift from the transcript. What the
 * model needs from turn 3 of 40 is which subjects were open and what the user
 * committed to — not the wording.
 */
export function summariseHistory(
  older: readonly { role: 'user' | 'assistant'; content: string }[],
  state: ConversationState,
): string {
  if (older.length === 0) return '';
  const parts: string[] = [];

  const subjects = [...new Set(state.recentEntities.map((e) => e.label))].slice(0, 6);
  if (subjects.length) parts.push(`განხილული თემები: ${subjects.join(', ')}.`);

  // A position the user stated is the thing most worth carrying forward: it is
  // what a later "why?" or "I disagree" refers back to.
  const positions = older
    .filter((turn) => turn.role === 'user' && turn.content.length > 25)
    .slice(-3)
    .map((turn) => clip(turn.content, 120));
  if (positions.length) parts.push(`მომხმარებლის ნათქვამი: ${positions.join(' | ')}`);

  parts.push(`სულ ${older.length} ადრინდელი რეპლიკა შეჯამდა.`);
  return parts.join(' ');
}

/*
 * Note that nothing here depends on the answering mode. What may be *said*
 * differs between grounded and free modes; what is worth *retrieving* does
 * not, and keeping that out of the retrieval stage is what stops mode-specific
 * behaviour from leaking into the part of the system that has to stay honest.
 * Scope, which genuinely does constrain retrieval, is passed explicitly.
 */
export function buildContext(input: ContextInput): ReasoningContext {
  const { query, state } = input;
  const scope = input.bookScope;
  const corpus = input.bookCorpus;

  const booksOn = Boolean(scope && scope.mode !== 'off' && corpus && corpus.books.length > 0);
  const exclusive = booksOn && isBookExclusive(scope!);

  const books = booksOn ? bookEvidence(query, scope!, corpus!) : { items: [], searchedButEmpty: false };
  // Free AI has the model's own knowledge to fall back on, but retrieval still
  // runs: grounded material is better than recalled material whenever it exists.
  const labo = exclusive ? [] : laboEvidence(query);

  // The graph never overrides lexical retrieval; it appends what relationships
  // suggest the question also touches, after the direct matches.
  const fromGraph = input.graph && !exclusive
    ? graphEvidence(input.graph, query)
    : { items: [], structure: '' };

  const seenTitles = new Set(labo.map((item) => item.title));
  const graphExtra = fromGraph.items.filter((item) => !seenTitles.has(item.title));

  const ranked = exclusive ? books.items : [...interleave(labo, books.items), ...graphExtra];

  const evidence: Evidence[] = [];
  let charsUsed = 0;
  for (const item of ranked) {
    if (charsUsed + item.text.length > BUDGET) continue;
    charsUsed += item.text.length;
    evidence.push({ ...item, id: `E${evidence.length + 1}` });
  }

  const history = input.history ?? [];
  const cut = Math.max(0, history.length - VERBATIM_TURNS);
  const summary = summariseHistory(history.slice(0, cut), state);

  return {
    evidence,
    summary,
    structure: fromGraph.structure,
    recentTurns: history.slice(cut).map((turn) => ({ role: turn.role, content: turn.content })),
    memories: [...(input.memories ?? [])],
    charsUsed,
    searchedButEmpty: books.searchedButEmpty && evidence.length === 0,
  };
}
