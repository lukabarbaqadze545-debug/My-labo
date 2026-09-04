import {
  answerFromBooks,
  compareBooks,
  detectConflicts,
  isBookExclusive,
  renderComparison,
  retrieveFromBooks,
  type BookCorpus,
  type BookKnowledgeItem,
  type BookScope,
} from '@/domain/books';
import { connective } from '@/domain/language';
import type {
  ConfidenceBreakdown,
  ConversationReply,
  ConversationState,
  NextAction,
  NormalizedMessage,
  UnderstandingVerdict,
} from './types';

/**
 * The bridge between imported books and the conversation engine.
 *
 * Books are a retrieval source inside the existing pipeline, not a second
 * assistant. The same intent detection, the same conversation state and the
 * same confidence vocabulary apply — only the place the evidence comes from
 * changes.
 */

/** Does the question explicitly point at the books? */
const BOOK_REFERENCE =
  /(ამ\s+წიგნ|წიგნის\s+მიხედვით|წიგნში|წიგნის\s+თანახმად|ავტორის\s+მიხედვით|according\s+to\s+the\s+book|in\s+the\s+book)/iu;

const COMPARE_REFERENCE =
  /(შეადარე|განსხვავ|რით.*განსხვავდებ|compare|difference\s+between|vs\b)/iu;

export function mentionsBook(text: string): boolean {
  return BOOK_REFERENCE.test(text);
}

export interface BookTurnInput {
  message: NormalizedMessage;
  state: ConversationState;
  scope: BookScope;
  corpus: BookCorpus;
  socratic: boolean;
}

export interface BookTurnResult {
  reply: ConversationReply;
  action: NextAction;
  verdict: UnderstandingVerdict;
  confidence: Pick<ConfidenceBreakdown, 'retrieval' | 'knowledge'>;
  /** Structured items the answer leaned on, for the inspector. */
  used: BookKnowledgeItem[];
  citationCount: number;
  /** False when the scope was searched and had nothing. */
  grounded: boolean;
  /** Inspector payload: what was searched and what scored. */
  debug: NonNullable<import('./types').PipelineTrace['books']>;
}

/**
 * A Socratic question built from what the books actually contain.
 *
 * When the retrieved material holds two opposing positions, the useful move is
 * to make the reader choose a premise rather than to hand them both answers.
 * The question names only positions that were extracted from the source — it
 * never attributes a view to an author who did not state it.
 */
export function socraticFromBooks(items: readonly BookKnowledgeItem[]): string | null {
  const positions = items.filter((i) => i.type === 'position' || i.type === 'claim');
  const byBook = new Map<string, BookKnowledgeItem>();
  for (const item of positions) {
    if (!byBook.has(item.bookId)) byBook.set(item.bookId, item);
  }

  const distinct = [...byBook.values()];
  if (distinct.length >= 2) {
    const [a, b] = distinct;
    const contrast = connective('contrast', { ceiling: 'academic', seed: `${a!.id}:${b!.id}` }) ?? 'მეორე მხრივ';
    return (
      `„${a!.source.bookTitle}" ამბობს: ${a!.content} ${contrast}, „${b!.source.bookTitle}" ამბობს: ${b!.content}\n\n` +
      `რომელი წანამძღვარი უფრო მისაღებია შენთვის — და რატომ?`
    );
  }

  const objection = items.find((i) => i.type === 'objection');
  if (objection) {
    return (
      `წიგნში ამ პოზიციის წინააღმდეგ ასეთი შესაგებელია: ${objection.content} (გვ. ${objection.source.pageStart})\n\n` +
      `შენ როგორ უპასუხებდი?`
    );
  }

  const single = distinct[0];
  if (single) {
    return `„${single.source.bookTitle}" ამბობს: ${single.content}\n\nეთანხმები? რაზე ეყრდნობა ეს მტკიცება?`;
  }

  return null;
}

/** Counterarguments the books supply, for the philosophy path. */
export function bookCounterarguments(items: readonly BookKnowledgeItem[]): BookKnowledgeItem[] {
  return items.filter(
    (i) => i.type === 'objection' || i.type === 'counterargument' || i.type === 'reply',
  );
}

export function runBookTurn(input: BookTurnInput): BookTurnResult {
  const { message, scope, corpus, socratic } = input;
  const query = message.raw;

  const wantsComparison =
    COMPARE_REFERENCE.test(query) && (scope.mode === 'selected' || scope.mode === 'library');

  /* ------------------------------ comparison ---------------------------- */
  if (wantsComparison) {
    const ids =
      scope.mode === 'selected'
        ? scope.bookIds
        : corpus.books.filter((b) => b.status === 'ready' && !b.disabled).map((b) => b.id);
    const stances = compareBooks(query, ids, corpus);
    const conflicts = detectConflicts(stances);
    const text = renderComparison(stances);
    const anyMaterial = stances.some((s) => s.summary);

    return {
      reply: {
        text,
        sources: stances.flatMap((s) =>
          s.citations.slice(0, 1).map((c) => ({
            label: `${c.bookTitle}, გვ. ${c.pageStart}`,
            href: `/books/${c.bookId}`,
          })),
        ),
        related: [],
        suggestions: anyMaterial ? ['რომელია უფრო დამაჯერებელი?', 'კონტრარგუმენტი?'] : [],
        action: 'compare_books',
        verdict: anyMaterial ? 'answer' : 'known_but_missing',
      },
      action: {
        kind: 'compare_books',
        rationale: `წიგნები ცალ-ცალკე მოვიძიე და ატრიბუციით გამოვყავი${conflicts.length ? '; აღმოჩნდა შეუთანხმებლობა' : ''}.`,
        score: 9,
      },
      verdict: anyMaterial ? 'answer' : 'known_but_missing',
      confidence: { retrieval: anyMaterial ? 0.8 : 0, knowledge: anyMaterial ? 1 : 0 },
      used: stances.flatMap((s) => s.knowledge),
      citationCount: stances.reduce((n, s) => n + s.citations.length, 0),
      grounded: anyMaterial,
      debug: {
        mode: scope.mode,
        searched: stances.map((s) => s.book.title),
        hits: stances.flatMap((s) =>
          s.hits.map((h) => ({
            book: h.book.title,
            pages: `${h.chunk.pageStart}–${h.chunk.pageEnd}`,
            score: Math.round(h.score * 100) / 100,
            chunkId: h.chunk.id,
          })),
        ),
        knowledgeUsed: stances.flatMap((s) =>
          s.knowledge.slice(0, 3).map((k) => ({
            type: k.type,
            pages: `${k.source.pageStart}–${k.source.pageEnd}`,
            confidence: k.confidence,
            book: k.source.bookTitle,
          })),
        ),
        citations: stances.reduce((n, s) => n + s.citations.length, 0),
      },
    };
  }

  /* ------------------------------- retrieval ---------------------------- */
  const retrieval = retrieveFromBooks(query, scope, corpus);
  const grounded = retrieval.hits.length > 0 || retrieval.knowledge.length > 0;

  const debug = {
    mode: scope.mode,
    searched: retrieval.searched.map((b) => b.title),
    hits: retrieval.hits.map((h) => ({
      book: h.book.title,
      pages: `${h.chunk.pageStart}–${h.chunk.pageEnd}`,
      score: Math.round(h.score * 100) / 100,
      chunkId: h.chunk.id,
    })),
    knowledgeUsed: retrieval.knowledge.slice(0, 5).map((k) => ({
      type: k.type,
      pages: `${k.source.pageStart}–${k.source.pageEnd}`,
      confidence: k.confidence,
      book: k.source.bookTitle,
    })),
    citations: 0,
  };

  /* -------------------------------- socratic ---------------------------- */
  if (socratic && grounded) {
    const question = socraticFromBooks(retrieval.knowledge);
    if (question) {
      return {
        reply: {
          text: question,
          sources: retrieval.knowledge.slice(0, 2).map((k) => ({
            label: `${k.source.bookTitle}, გვ. ${k.source.pageStart}`,
            href: `/books/${k.bookId}`,
          })),
          related: [],
          suggestions: ['კონტრარგუმენტი?', 'რა წერია წიგნში ზუსტად?'],
          action: 'ask_socratic_question',
          verdict: 'answer',
        },
        action: {
          kind: 'ask_socratic_question',
          rationale: 'წიგნიდან ამოღებული პოზიციები კითხვად უფრო სასარგებლოა, ვიდრე პასუხად.',
          score: 9,
        },
        verdict: 'answer',
        confidence: { retrieval: 0.8, knowledge: 1 },
        used: retrieval.knowledge,
        citationCount: retrieval.knowledge.length,
        grounded: true,
        debug: { ...debug, citations: retrieval.knowledge.length },
      };
    }
  }

  /* --------------------------------- answer ----------------------------- */
  const answer = answerFromBooks(query, retrieval);

  return {
    reply: {
      text: answer.text,
      sources: answer.citations.map((c) => ({
        label: `${c.bookTitle}, გვ. ${c.pageStart}${c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ''}`,
        href: `/books/${c.bookId}`,
      })),
      related: [],
      suggestions: answer.grounded
        ? ['უფრო მარტივად', 'კონტრარგუმენტი?', 'საიდან იცი?']
        : [],
      action: 'answer_from_book',
      verdict: answer.grounded ? 'answer' : 'known_but_missing',
    },
    action: {
      kind: answer.grounded ? 'answer_from_book' : 'admit_missing_knowledge',
      rationale: answer.grounded
        ? `პასუხი ${retrieval.searched.length} ჩართული წიგნიდან, გვერდების მითითებით.`
        : isBookExclusive(scope)
          ? 'მხოლოდ წიგნის რეჟიმია — გარე ცოდნა დაუშვებელია, წიგნში კი ვერაფერი ვიპოვე.'
          : 'წიგნებში შესაბამისი მასალა ვერ ვიპოვე.',
      score: answer.grounded ? 8 : 6,
    },
    verdict: answer.grounded ? 'answer' : 'known_but_missing',
    confidence: {
      retrieval: answer.grounded ? Math.min(1, (retrieval.hits[0]?.score ?? 0) / 8) : 0,
      knowledge: answer.grounded ? 1 : 0,
    },
    used: answer.knowledge,
    citationCount: answer.citations.length,
    grounded: answer.grounded,
    debug: { ...debug, citations: answer.citations.length },
  };
}
