import type {
  BookAnswer,
  BookCitation,
  BookHit,
  BookKnowledgeItem,
  KnowledgeItemType,
} from './types';
import type { BookRetrieval } from './retrieve';
import { chunkTerms } from './chunk';
import { splitSentences } from './knowledge';

/**
 * Stage 7 — grounded answers.
 *
 * RETRIEVAL IS INTERNAL. What the pipeline finds — chunks, scored knowledge
 * items — is evidence, not the reply. This stage turns that evidence into one
 * short, composed answer: a lead sentence naming the book, the strongest
 * grounded claim reported as what the author says (not labelled with its
 * extraction type), and at most one short quotation when the exact wording
 * earns its place. A compact source line closes it. Nothing here lists
 * multiple typed bullets — that is retrieval machinery, and it stays out of
 * the user-facing text.
 *
 * Two rules still shape everything:
 *
 * Copyright: quoting is capped, hard, per answer. Paraphrase is the default;
 * a quotation mark only appears around text the source actually contains.
 *
 * Citation: every claim in the reply traces to a chunk that was actually
 * retrieved, and every page number comes from that chunk's recorded range.
 * When nothing was retrieved the answer says so instead of reaching elsewhere.
 */

/** Hard cap on quoted characters in one answer. */
const MAX_QUOTE = 220;

const REPORTED_VERB: Partial<Record<KnowledgeItemType, string>> = {
  definition: 'განმარტავს, რომ',
  claim: 'ამტკიცებს, რომ',
  position: 'იცავს პოზიციას, რომ',
  argument: 'ასაბუთებს, რომ',
  objection: 'ერთი შესაგებელია: რომ',
  reply: 'პასუხობს, რომ',
  counterargument: 'საწინააღმდეგოდ აღნიშნავს, რომ',
  distinction: 'გამიჯნავს ორ რამეს:',
  thoughtExperiment: 'გვთავაზობს შემდეგ სააზროვნო შემთხვევას:',
  example: 'მაგალითად იყენებს:',
};

export function citationOf(hit: BookHit): BookCitation {
  return {
    bookId: hit.book.id,
    bookTitle: hit.book.title,
    ...(hit.book.author ? { author: hit.book.author } : {}),
    ...(hit.section?.chapter ? { chapter: hit.section.chapter } : {}),
    pageStart: hit.chunk.pageStart,
    pageEnd: hit.chunk.pageEnd,
    chunkId: hit.chunk.id,
  };
}

/** Human-readable citation: "Title, გვ. 41–43". */
export function formatCitation(citation: BookCitation, index?: number): string {
  const pages =
    citation.pageStart === citation.pageEnd
      ? `გვ. ${citation.pageStart}`
      : `გვ. ${citation.pageStart}–${citation.pageEnd}`;
  const chapter = citation.chapter ? `, ${citation.chapter}` : '';
  const author = citation.author ? `${citation.author}, ` : '';
  const marker = index === undefined ? '' : `[${index}] `;
  return `${marker}${author}„${citation.bookTitle}"${chapter}, ${pages}`;
}

/**
 * The sentences in a chunk that actually address the question.
 *
 * Quoting a whole chunk would be both less useful and less defensible; this
 * picks the highest-overlap sentence and stops at the character cap.
 */
export function relevantExcerpt(text: string, query: string, cap = MAX_QUOTE): string {
  const queryTerms = new Set(chunkTerms(query));
  const sentences = splitSentences(text);
  const pool = sentences.length > 0 ? sentences : [text];

  const ranked = pool
    .map((sentence) => ({
      sentence,
      score: chunkTerms(sentence).filter((t) => queryTerms.has(t)).length,
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score === 0) {
    return pool[0]!.slice(0, cap).trim() + (pool[0]!.length > cap ? '…' : '');
  }
  return best.sentence.length > cap ? `${best.sentence.slice(0, cap - 1).trim()}…` : best.sentence.trim();
}

/** Structured items are more useful than raw prose, in this order. */
const TYPE_PRIORITY: KnowledgeItemType[] = [
  'definition',
  'position',
  'claim',
  'argument',
  'objection',
  'reply',
  'counterargument',
  'distinction',
  'thoughtExperiment',
  'example',
  'concept',
  'term',
  'question',
];

function rankKnowledge(items: readonly BookKnowledgeItem[]): BookKnowledgeItem[] {
  const confidenceRank = { high: 0, medium: 1, low: 2 } as const;
  return [...items].sort((a, b) => {
    const t = TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type);
    if (t !== 0) return t;
    return confidenceRank[a.confidence] - confidenceRank[b.confidence];
  });
}

/**
 * Fold a stored sentence into reported speech.
 *
 * The book's own content is never rewritten word-for-word (that would risk
 * drifting from what it actually says) — but it also never appears labelled
 * with its extraction type. Instead it is introduced the way a person
 * reporting what they read would introduce it: "X explains that…", "X
 * argues that…". The content itself is exactly what was extracted.
 */
function reportedSentence(item: BookKnowledgeItem, bookName: string, firstMention: boolean): string {
  const verb = REPORTED_VERB[item.type] ?? 'აღნიშნავს, რომ';
  const subject = firstMention ? `„${bookName}"` : 'იქვე';
  // A sentence that already reads as a complete claim ("X means Y.") does not
  // need "the book explains that" glued in front of it — that produces
  // doubled grammar ("განმარტავს, რომ X ნიშნავს Y-ს, რომ..."). Only prefix
  // when the extracted content is not already a self-contained statement.
  const alreadyReads = /^(.{0,20})(ნიშნავს|განისაზღვრება|წარმოადგენს)\b/u.test(item.content);
  if (alreadyReads) return `${subject} ${item.content}`;
  return `${subject} ${verb} ${item.content}`;
}

export interface ComposeOptions {
  /** Shown when the scope found nothing. */
  emptyMessage?: string;
}

export function answerFromBooks(
  query: string,
  retrieval: BookRetrieval,
  options: ComposeOptions = {},
): BookAnswer {
  const { hits, knowledge, searched } = retrieval;

  if (hits.length === 0 && knowledge.length === 0) {
    const names = searched.map((b) => `„${b.title}"`).join(', ');
    return {
      text:
        options.emptyMessage ??
        (searched.length
          ? `ამ კითხვაზე ${names}-ში შესაბამის ადგილს ვერ ვპოულობ. სცადე სხვა ფორმულირება, ან სხვა წყარო ჩართე.`
          : 'ჩართული წიგნი არ არის.'),
      citations: [],
      hits: [],
      knowledge: [],
      grounded: false,
    };
  }

  const citations: BookCitation[] = [];
  const citationIndex = new Map<string, number>();
  const cite = (hit: BookHit): number => {
    const existing = citationIndex.get(hit.chunk.id);
    if (existing) return existing;
    const citation = citationOf(hit);
    citations.push(citation);
    const n = citations.length;
    citationIndex.set(hit.chunk.id, n);
    return n;
  };

  const ranked = rankKnowledge(knowledge);
  const primary = ranked[0];
  const secondary = ranked
    .slice(1)
    .find((item) => item.type !== primary?.type || item.confidence !== 'low');

  const bookName = primary?.source.bookTitle ?? hits[0]?.book.title ?? '';
  const sentences: string[] = [];

  /* --- one or two claims, reported rather than labelled --------------- */
  if (primary) {
    sentences.push(reportedSentence(primary, bookName, true));
  }
  if (secondary && secondary.id !== primary?.id) {
    sentences.push(reportedSentence(secondary, bookName, false));
  }

  /* --- a short quotation, only when it adds something the paraphrase
         above did not already say -------------------------------------- */
  if (hits[0] && sentences.length < 2) {
    const excerpt = relevantExcerpt(hits[0].chunk.text, query, MAX_QUOTE);
    const alreadyCovered = [primary, secondary].some(
      (item) => item && excerpt.includes(item.content.slice(0, 30)),
    );
    if (excerpt && !alreadyCovered) sentences.push(`უშუალოდ ტექსტში ეწერება: „${excerpt}"`);
  }

  if (sentences.length === 0 && hits[0]) {
    sentences.push(`„${hits[0].book.title}" ეხება ამ საკითხს, თუმცა ზუსტი ციტატა ვერ გამოვყავი.`);
  }

  // Every sentence shown must be citable, in the order it was used.
  if (primary?.source.sourceChunkId) {
    const hit = hits.find((h) => h.chunk.id === primary.source.sourceChunkId);
    if (hit) cite(hit);
  }
  if (secondary?.source.sourceChunkId) {
    const hit = hits.find((h) => h.chunk.id === secondary.source.sourceChunkId);
    if (hit) cite(hit);
  }
  if (citations.length === 0 && hits[0]) cite(hits[0]);

  const citationLine =
    citations.length === 1
      ? `წყარო: ${formatCitation(citations[0]!)}`
      : `წყარო: ${citations.map((c, i) => formatCitation(c, i + 1)).join(' · ')}`;

  return {
    text: `${sentences.join(' ')}\n\n${citationLine}`,
    citations,
    hits,
    knowledge: [primary, secondary].filter((x): x is BookKnowledgeItem => Boolean(x)),
    grounded: true,
  };
}
