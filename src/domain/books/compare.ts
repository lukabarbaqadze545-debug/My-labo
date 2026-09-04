import type { BookConflict, BookScope, BookStance } from './types';
import { retrieveFromBooks, type BookCorpus } from './retrieve';
import { answerFromBooks, citationOf, formatCitation, relevantExcerpt } from './answer';

/**
 * Stages 11 and 12 — comparison and disagreement.
 *
 * Two books on the same subject must never be blended into one unattributed
 * paragraph. Each is retrieved *separately*, within its own scope, and
 * reported under its own name. That is both an honesty requirement and the
 * only way the reader can tell whose view they are reading.
 *
 * Where two books make opposing claims about the same concept, the conflict is
 * surfaced rather than resolved. For philosophy that is the normal case, and
 * silently choosing a winner would be the worst possible behaviour.
 */

export function compareBooks(
  query: string,
  bookIds: readonly string[],
  corpus: BookCorpus,
): BookStance[] {
  const stances: BookStance[] = [];

  for (const bookId of bookIds) {
    const book = corpus.books.find((b) => b.id === bookId);
    if (!book) continue;

    // One book at a time: scoping per call is what keeps the sources apart.
    const scope: BookScope = { mode: 'book', bookIds: [bookId] };
    const retrieval = retrieveFromBooks(query, scope, corpus, { limit: 4 });

    const citations = retrieval.hits.map(citationOf);
    const summary =
      retrieval.knowledge[0]?.content ??
      (retrieval.hits[0] ? relevantExcerpt(retrieval.hits[0].chunk.text, query) : '');

    stances.push({
      book,
      hits: retrieval.hits,
      knowledge: retrieval.knowledge,
      summary,
      citations,
    });
  }

  return stances;
}

/** Compose a side-by-side answer that keeps every source attributed. */
export function renderComparison(stances: readonly BookStance[]): string {
  const withMaterial = stances.filter((s) => s.summary);
  if (withMaterial.length === 0) {
    return 'არც ერთ ჩართულ წიგნში შესაბამისი ადგილი ვერ ვიპოვე.';
  }

  const parts: string[] = [];
  for (const stance of stances) {
    if (!stance.summary) {
      parts.push(`„${stance.book.title}" — ამ საკითხს არ ეხება (ან ვერ ვიპოვე).`);
      continue;
    }
    const citation = stance.citations[0];
    const where = citation ? ` (${formatCitation(citation)})` : '';
    parts.push(`„${stance.book.title}": ${stance.summary}${where}`);
  }

  const conflicts = detectConflicts(stances);
  if (conflicts.length > 0) {
    parts.push('\nწყაროები არ ეთანხმებიან ერთმანეთს:');
    for (const conflict of conflicts.slice(0, 2)) {
      parts.push(`• ${conflict.note}`);
    }
  }

  return parts.join('\n\n');
}

/* ------------------------------- conflicts ------------------------------ */

const NEGATORS = [
  /\bno\s+such\s+thing\b/i,
  /\bdoes\s+not\s+exist\b/i,
  /\bis\s+an?\s+illusion\b/i,
  /\bis\s+(?:false|mistaken|incoherent)\b/i,
  /\bcannot\b/i,
  /\bარ\s+არსებობს\b/u,
  /\bილუზიაა\b/u,
  /\bმცდარია\b/u,
];

const AFFIRMERS = [
  /\bis\s+(?:real|genuine|compatible)\b/i,
  /\bdoes\s+exist\b/i,
  /\bwe\s+(?:do\s+)?have\b/i,
  /\bარსებობს\b/u,
  /\bრეალურია\b/u,
  /\bშეთავსებადია\b/u,
];

const polarity = (text: string): 'affirm' | 'deny' | null => {
  const denies = NEGATORS.some((p) => p.test(text));
  const affirms = AFFIRMERS.some((p) => p.test(text));
  if (denies && !affirms) return 'deny';
  if (affirms && !denies) return 'affirm';
  return null;
};

/**
 * Find opposing claims about the same concept across books.
 *
 * Deliberately narrow: it fires only when two books have items filed under the
 * same concept with clearly opposite polarity. A false "these sources
 * disagree" is worse than a missed one, because it invents a dispute.
 */
export function detectConflicts(stances: readonly BookStance[]): BookConflict[] {
  const conflicts: BookConflict[] = [];

  for (let i = 0; i < stances.length; i++) {
    for (let j = i + 1; j < stances.length; j++) {
      const a = stances[i]!;
      const b = stances[j]!;

      for (const itemA of a.knowledge) {
        const polA = polarity(itemA.content);
        if (!polA) continue;

        for (const itemB of b.knowledge) {
          if (itemB.concept !== itemA.concept) continue;
          const polB = polarity(itemB.content);
          if (!polB || polB === polA) continue;

          const citationA = a.citations[0];
          const citationB = b.citations[0];
          if (!citationA || !citationB) continue;

          conflicts.push({
            concept: itemA.concept,
            a: {
              bookId: a.book.id,
              bookTitle: a.book.title,
              content: itemA.content,
              citation: citationA,
            },
            b: {
              bookId: b.book.id,
              bookTitle: b.book.title,
              content: itemB.content,
              citation: citationB,
            },
            note:
              `„${a.book.title}" და „${b.book.title}" ერთსა და იმავე საკითხზე ` +
              `საპირისპიროს ამბობენ (${itemA.conceptLabel}). ორივე პოზიცია შენახულია — არჩევანი შენია.`,
          });
          break;
        }
      }
    }
  }

  return conflicts;
}

/** Convenience: retrieve across a scope and compose either one answer or a comparison. */
export function answerOrCompare(
  query: string,
  scope: BookScope,
  corpus: BookCorpus,
): { text: string; comparison: boolean; stances?: BookStance[] } {
  const multiBook = scope.mode === 'selected' || scope.mode === 'library';
  const wantsComparison =
    /(შეადარე|განსხვავ|vs\b|compare|difference|რით.*განსხვავდებ)/iu.test(query);

  if (multiBook && wantsComparison) {
    const ids =
      scope.mode === 'selected'
        ? scope.bookIds
        : corpus.books.filter((b) => b.status === 'ready' && !b.disabled).map((b) => b.id);
    const stances = compareBooks(query, ids, corpus);
    return { text: renderComparison(stances), comparison: true, stances };
  }

  const retrieval = retrieveFromBooks(query, scope, corpus);
  return { text: answerFromBooks(query, retrieval).text, comparison: false };
}
