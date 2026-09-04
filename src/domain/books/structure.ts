import type { BookSection } from './types';
import type { CleanedPage } from './clean';

/**
 * Stage 3 — structure.
 *
 * Recovering the author's own divisions matters for two reasons: a citation
 * that names a chapter is far more useful than one that names only a page,
 * and chunking inside a section keeps a retrieved passage topically coherent.
 *
 * Detection is heuristic and says so. When no headings are found the book
 * becomes one section covering every page — which is honest, and still fully
 * retrievable, rather than a fabricated table of contents.
 */

/** A line, with the page it appeared on. */
export interface PositionedLine {
  page: number;
  text: string;
}

export interface Paragraph {
  text: string;
  pageStart: number;
  pageEnd: number;
}

const CHAPTER_PATTERNS: RegExp[] = [
  /^(chapter|part|book)\s+([0-9]{1,3}|[ivxlcdm]{1,7})\b/i,
  /^(თავი|ნაწილი|წიგნი)\s+([0-9]{1,3}|[ivxlcdm]{1,7})\b/i,
  /^([0-9]{1,2})\.\s+\p{Lu}/u,
];

const SECTION_PATTERNS: RegExp[] = [
  /^([0-9]{1,2}\.[0-9]{1,2})\.?\s+\S/u,
  /^§\s*[0-9]+/u,
];

/** Flatten pages to lines while keeping each line's page number. */
export function toLines(pages: readonly CleanedPage[]): PositionedLine[] {
  const out: PositionedLine[] = [];
  for (const page of pages) {
    for (const text of page.text.split('\n')) {
      const trimmed = text.trim();
      if (trimmed) out.push({ page: page.page, text: trimmed });
    }
  }
  return out;
}

const SENTENCE_END = /[.!?:;»""'”’)\]]\s*$/u;

/**
 * A short line in title case or capitals, standing alone, is almost always a
 * heading. Requiring the absence of terminal punctuation rejects ordinary
 * short sentences.
 */
function looksLikeHeading(line: string): boolean {
  const text = line.trim();
  if (text.length < 3 || text.length > 80) return false;
  if (SENTENCE_END.test(text)) return false;
  if (/[,;]/.test(text)) return false;

  const words = text.split(/\s+/u);
  if (words.length > 12) return false;

  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (letters.length === 0) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;

  // All-caps heading.
  if (upper / letters.length > 0.7) return true;

  // Title Case: most words begin with a capital.
  const capitalised = words.filter((w) => /^\p{Lu}/u.test(w)).length;
  return words.length >= 2 && capitalised / words.length >= 0.6;
}

/**
 * A paragraph-break signal for caseless scripts.
 *
 * `looksLikeHeading` leans on capitalisation, which Mkhedruli does not have:
 * „თავი XVI სიუხვისა და სიძუნწისათვის" scores as ordinary text and gets glued
 * onto the sentence after it, so the extracted passage becomes a splice that
 * appears nowhere on the page it cites. A short, unpunctuated line in a
 * caseless script is treated as a break — conservatively, since body lines in
 * a typeset book run close to full measure.
 */
function isCaselessHeadingLine(line: string): boolean {
  const text = line.trim();
  if (text.length < 3 || text.length > 50) return false;
  if (SENTENCE_END.test(text)) return false;
  if (/[,;]/.test(text)) return false;
  if (text.split(/\s+/u).length > 5) return false;
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (letters.length === 0) return false;
  // Only when the line has no cased letters to judge by.
  return letters.every((c) => c === c.toUpperCase() && c === c.toLowerCase());
}

export interface DetectedHeading {
  index: number;
  page: number;
  text: string;
  level: 1 | 2;
  chapter?: string;
}

export function detectHeadings(lines: readonly PositionedLine[]): DetectedHeading[] {
  const out: DetectedHeading[] = [];

  lines.forEach((line, index) => {
    const text = line.text;

    for (const pattern of CHAPTER_PATTERNS) {
      const match = pattern.exec(text);
      if (match) {
        // „Chapter 4" alone is a label; the real title is usually the next
        // line, so the two are joined when that next line looks like one.
        const next = lines[index + 1];
        const title =
          text.length < 24 && next && next.page === line.page && looksLikeHeading(next.text)
            ? `${text} — ${next.text}`
            : text;
        out.push({ index, page: line.page, text: title, level: 1, chapter: text });
        return;
      }
    }

    for (const pattern of SECTION_PATTERNS) {
      if (pattern.test(text)) {
        out.push({ index, page: line.page, text, level: 2 });
        return;
      }
    }

    // Caseless headings count too. In a Georgian anthology the author's name
    // is the section heading, and without it a question naming a thinker has
    // nothing to match — the running head carrying that name is stripped as
    // furniture before this point.
    if (looksLikeHeading(text) || isCaselessHeadingLine(text)) {
      out.push({ index, page: line.page, text, level: 2 });
    }
  });

  return out;
}

let sectionSeq = 0;

export function buildSections(
  bookId: string,
  lines: readonly PositionedLine[],
  headings: readonly DetectedHeading[],
): BookSection[] {
  if (lines.length === 0) return [];

  const lastPage = lines[lines.length - 1]!.page;

  if (headings.length === 0) {
    return [
      {
        id: `sec_${bookId}_0`,
        bookId,
        title: 'სრული ტექსტი',
        level: 1,
        pageStart: lines[0]!.page,
        pageEnd: lastPage,
        order: 0,
      },
    ];
  }

  const sections: BookSection[] = [];

  // Text before the first heading is front matter, but it is still content.
  if (headings[0]!.index > 0) {
    sections.push({
      id: `sec_${bookId}_${sectionSeq++}`,
      bookId,
      title: 'დასაწყისი',
      level: 1,
      pageStart: lines[0]!.page,
      pageEnd: lines[headings[0]!.index - 1]!.page,
      order: 0,
    });
  }

  let currentChapter: string | undefined;
  headings.forEach((heading, i) => {
    if (heading.level === 1) currentChapter = heading.chapter ?? heading.text;
    const next = headings[i + 1];
    const endIndex = next ? next.index - 1 : lines.length - 1;
    const pageEnd = lines[Math.max(heading.index, endIndex)]!.page;

    sections.push({
      id: `sec_${bookId}_${sectionSeq++}`,
      bookId,
      ...(currentChapter ? { chapter: currentChapter } : {}),
      title: heading.text,
      level: heading.level,
      pageStart: heading.page,
      pageEnd,
      order: sections.length,
    });
  });

  return sections;
}

/**
 * Group lines into paragraphs, keeping page ranges.
 *
 * A paragraph continues across a page break when the last line does not end a
 * sentence — which is exactly what happens in a printed book, and what makes
 * a page-boundary chunk otherwise start mid-clause.
 */
/**
 * Build sections from the running heads themselves.
 *
 * An anthology's real structure is not „თავი 1, თავი 2" — it is „პლატონი",
 * „ნიკოლო მაკიაველი", „ადამ სმითი". That structure lives entirely in the
 * running head, which cleaning strips as furniture. Recovering it here is what
 * makes „მაკიაველი რას წერს…" answerable: contiguous pages sharing a head
 * become one section named after it, and every chunk and extracted claim
 * inside inherits that name as a searchable term.
 *
 * Returns an empty array when heads cover too little of the book to be its
 * organising principle.
 */
export function buildSectionsFromHeads(
  bookId: string,
  lines: readonly PositionedLine[],
  headsByPage: ReadonlyMap<number, string[]>,
): BookSection[] {
  if (lines.length === 0 || headsByPage.size === 0) return [];

  const pages = [...new Set(lines.map((l) => l.page))].sort((a, b) => a - b);
  const covered = pages.filter((p) => (headsByPage.get(p) ?? []).length > 0).length;
  // Heads must organise most of the book before they are trusted as structure.
  if (covered / pages.length < 0.5) return [];

  // And they must actually vary. One head repeated throughout is the book's
  // own title — a monograph — and its real divisions are its chapter
  // headings, which this would otherwise discard.
  const distinct = new Set<string>();
  for (const heads of headsByPage.values()) for (const h of heads) distinct.add(h);
  if (distinct.size < 2) return [];

  const sections: BookSection[] = [];
  let currentHead: string | null = null;
  let start = pages[0]!;
  let previous = pages[0]!;
  let order = 0;

  const push = (head: string | null, from: number, to: number) => {
    if (!head) return;
    sections.push({
      id: `sec_${bookId}_h${order}`,
      bookId,
      chapter: head,
      title: head,
      level: 1,
      pageStart: from,
      pageEnd: to,
      order: order++,
    });
  };

  /*
   * Printed books alternate running heads between verso and recto — author on
   * one side, work title on the other. Treating every switch as a section
   * boundary would produce a one-page section per leaf, so a run stays open
   * while its heads keep recurring, and closes only when a genuinely new head
   * holds for two consecutive pages.
   */
  const headAt = (page: number): string | null => {
    const heads = [...(headsByPage.get(page) ?? [])].sort((a, b) => b.length - a.length);
    return heads[0] ?? null;
  };

  let runHeads = new Set<string>();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const head = headAt(page);
    if (!head) {
      previous = page;
      continue;
    }

    if (currentHead === null) {
      currentHead = head;
      runHeads = new Set([head]);
      start = page;
    } else if (!runHeads.has(head)) {
      const next = pages[i + 1];
      const persists = next !== undefined && headAt(next) === head;
      if (persists) {
        push(currentHead, start, previous);
        currentHead = head;
        runHeads = new Set([head]);
        start = page;
      } else {
        // A one-page interruption is the facing page's head, not a new section.
        runHeads.add(head);
      }
    }
    previous = page;
  }
  push(currentHead, start, previous);

  // Front matter before the first head is still content.
  if (sections.length > 0 && sections[0]!.pageStart > pages[0]!) {
    sections.unshift({
      id: `sec_${bookId}_h_front`,
      bookId,
      title: 'დასაწყისი',
      level: 1,
      pageStart: pages[0]!,
      pageEnd: sections[0]!.pageStart - 1,
      order: -1,
    });
  }

  return sections;
}

export function buildParagraphs(lines: readonly PositionedLine[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let buffer: string[] = [];
  let pageStart = lines[0]?.page ?? 1;
  let pageEnd = pageStart;

  const flush = () => {
    const text = buffer.join(' ').replace(/\s+/gu, ' ').trim();
    if (text) paragraphs.push({ text, pageStart, pageEnd });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (buffer.length === 0) pageStart = line.page;
    pageEnd = line.page;
    buffer.push(line.text);

    const next = lines[i + 1];
    const endsSentence = SENTENCE_END.test(line.text);
    // A short line that ends a sentence is a paragraph end; a long line that
    // ends one may just be a full line of justified text.
    const shortAndFinished = endsSentence && line.text.length < 72;
    const nextIsHeading = next
      ? looksLikeHeading(next.text) || isCaselessHeadingLine(next.text)
      : true;
    // A completed sentence at a page break ends the paragraph. A real printed
    // paragraph that continues onto the next page does not end its last line
    // with a full stop — and merging across the break anyway would widen every
    // citation drawn from it to a two-page range for no reason.
    const pageBreakAfterSentence = Boolean(next && next.page !== line.page && endsSentence);

    if (
      !next ||
      nextIsHeading ||
      shortAndFinished ||
      pageBreakAfterSentence ||
      buffer.join(' ').length > 1400
    ) {
      flush();
    }
  }
  flush();

  return paragraphs;
}
