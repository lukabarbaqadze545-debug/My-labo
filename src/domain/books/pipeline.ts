import type {
  Book,
  BookLanguage,
  ExtractionReport,
  ImportPreview,
  RawBook,
} from './types';
import { cleanPages } from './clean';
import { buildSections, buildSectionsFromHeads, detectHeadings, toLines } from './structure';
import { buildChunks } from './chunk';
import { extractKnowledge } from './knowledge';
import { extractPdf, BookExtractionError, type ExtractOptions } from './extract';

/**
 * The ingestion pipeline.
 *
 *   PDF → pages → clean → structure → chunk → knowledge → preview
 *
 * `buildPreview` is pure and takes already-extracted pages, so every stage
 * after PDF parsing is testable with synthetic input. `ingestPdf` is the thin
 * shell that adds the one impure step.
 *
 * Nothing is written to storage here. The result is a *preview*: the caller
 * shows it, the user decides, and only then is it committed. A book is never
 * silently absorbed.
 */

function detectLanguage(text: string): BookLanguage {
  const georgian = (text.match(/[Ⴀ-ჿ]/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const total = georgian + latin;
  if (total < 50) return 'unknown';
  const ratio = georgian / total;
  if (ratio > 0.8) return 'ka';
  if (ratio < 0.2) return 'en';
  return 'mixed';
}

const GENERIC_FILENAME = /^(document|doc|scan|untitled|file|new|download|pdf|\d+)[\s\d()_-]*$/i;
const CHAPTER_LABEL = /^(chapter|part|book|თავი|ნაწილი|წიგნი)\b/i;
/** Lines that mark the front matter has moved past the title into imprint text. */
const IMPRINT_MARK =
  /(გამომცემლ|universit|university|press|isbn|თბილისი|tbilisi|©|\d{4})/i;

/**
 * Read the book's own title off its first printed page.
 *
 * A cover or title page states its title in a few short, undecorated lines
 * before the imprint (publisher, city, year, ISBN). Stopping at the first
 * imprint marker — and skipping purely decorative letter-spaced lines like
 * „წ ი გ ნ ი" rather than ending on them — recovers the real title, which is
 * far more trustworthy than a filename: a Latin, underscore-joined filename
 * is an internal artefact, not something to show the user as the book's name.
 */
function frontMatterTitle(pages: readonly { page: number; text: string }[]): string | null {
  const first = pages.find((p) => p.text.trim());
  if (!first) return null;

  const collected: string[] = [];
  for (const raw of first.text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (IMPRINT_MARK.test(line) || CHAPTER_LABEL.test(line)) break;
    if (line.length > 60) break;

    // Decorative spacing ("წ ი გ ნ ი") is skipped, not treated as the end —
    // real title lines often follow it. This only fires for *several* single
    // character tokens together; a lone standalone letter (a volume number
    // like "I") is real content, not decoration, and must not be dropped.
    const words = line.split(/\s+/u);
    const singleCharShare = words.filter((w) => w.length === 1).length / words.length;
    if (words.length >= 3 && singleCharShare > 0.6) continue;

    // A line ending in sentence punctuation is body prose that happens to
    // start the page, not a title — stop collecting rather than absorbing it.
    if (/[.!?]\s*$/u.test(line)) break;

    collected.push(line);
    if (collected.length >= 4) break;
  }

  const title = collected.join(' ').trim();
  return title.length >= 3 && title.length <= 90 ? title : null;
}

/**
 * Best available title, in order of trust: PDF metadata, the book's own
 * front matter, a meaningful filename, and only then a heading — a chapter
 * label is the *worst* candidate, because "Chapter 1 — Determinism and Its
 * Consequences" as a library entry is simply wrong.
 */
function deriveTitle(
  raw: RawBook,
  headings: readonly { text: string; level: 1 | 2 }[],
  filename: string,
  frontPages: readonly { page: number; text: string }[],
): string {
  const metaTitle = raw.meta.title?.trim();
  if (metaTitle && metaTitle.length >= 3 && !/^untitled$/i.test(metaTitle)) return metaTitle;

  const front = frontMatterTitle(frontPages);
  if (front) return front;

  const fromFile = filename.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  if (fromFile.length >= 3 && !GENERIC_FILENAME.test(fromFile)) return fromFile;

  // A heading that is not a chapter label may well be the title page.
  const titleish = headings.find(
    (h) => !CHAPTER_LABEL.test(h.text) && h.text.length >= 3 && h.text.length <= 90,
  );
  if (titleish) return titleish.text;

  const anyHeading = headings[0];
  if (anyHeading && anyHeading.text.length <= 90) return anyHeading.text;

  return 'უსახელო წიგნი';
}

export interface BuildPreviewOptions {
  /** Used for the title when the PDF carries no usable metadata. */
  filename?: string;
  bookId?: string;
  subject?: string;
  tags?: string[];
  importedAt?: number;
  removeRunningText?: boolean;
}

let bookSeq = 0;

export function buildPreview(raw: RawBook, options: BuildPreviewOptions = {}): ImportPreview {
  const bookId = options.bookId ?? `book_${Date.now().toString(36)}_${bookSeq++}`;
  const importedAt = options.importedAt ?? Date.now();

  /* ---------------------------- clean ------------------------------- */
  const cleaned = cleanPages(raw.pages, {
    removeRunningText: options.removeRunningText ?? true,
  });

  /* -------------------------- structure ------------------------------ */
  const lines = toLines(cleaned.pages);
  const headings = detectHeadings(lines);
  // Running heads win when they organise the book, because in an anthology
  // they carry the author names that headings do not.
  const headSections = buildSectionsFromHeads(bookId, lines, cleaned.headsByPage);
  const sections = headSections.length > 0 ? headSections : buildSections(bookId, lines, headings);

  /* ---------------------------- chunks ------------------------------- */
  const chunks = buildChunks(bookId, cleaned.pages, sections, {
    headsByPage: cleaned.headsByPage,
  });

  /* --------------------------- metadata ------------------------------ */
  const fullText = cleaned.pages.map((p) => p.text).join('\n');
  const language = detectLanguage(fullText);
  const title = deriveTitle(raw, headings, options.filename ?? '', cleaned.pages);

  /* --------------------------- knowledge ----------------------------- */
  const { items, relations } = extractKnowledge({
    bookId,
    bookTitle: title,
    ...(raw.meta.author ? { author: raw.meta.author } : {}),
    chunks,
    sections,
    importedAt,
  });

  /* ---------------------------- report ------------------------------- */
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;

  const warnings = [...cleaned.warnings];
  if (chunks.length === 0) {
    warnings.push('რეტრივალისთვის ვარგისი ტექსტი ვერ ჩამოყალიბდა.');
  }
  if (headings.length === 0) {
    warnings.push('სათაურები ვერ ვიპოვე — წიგნი ერთ სექციად შეინახება.');
  }
  if (items.length === 0 && chunks.length > 0) {
    warnings.push('სტრუქტურირებული ცოდნა ვერ ამოვიღე — მხოლოდ ტექსტის ძებნა იმუშავებს.');
  }
  const lowConfidence = items.filter((i) => i.confidence === 'low').length;
  if (lowConfidence > 0) {
    warnings.push(`${lowConfidence} ჩანაწერი დაბალი სანდოობითაა მონიშნული.`);
  }

  const report: ExtractionReport = {
    pages: raw.pages.length,
    emptyPages: cleaned.emptyPages,
    lowQualityPages: cleaned.lowQualityPages,
    qualityScore: cleaned.qualityScore,
    quality: cleaned.quality,
    warnings,
    removedRunningText: cleaned.removedRunningText,
    dehyphenated: cleaned.dehyphenated,
    counts: {
      ...counts,
      sections: sections.length,
      chunks: chunks.length,
      knowledge: items.length,
      relations: relations.length,
    },
  };

  const book: ImportPreview['book'] = {
    title,
    ...(raw.meta.author ? { author: raw.meta.author } : {}),
    language,
    ...(options.subject ? { subject: options.subject } : {}),
    tags: options.tags ?? [],
    totalPages: raw.meta.totalPages || raw.pages.length,
    extractionQuality: cleaned.quality,
    qualityScore: cleaned.qualityScore,
    warnings,
  };

  return { book, sections, chunks, knowledge: items, relations, report };
}

export interface IngestOptions extends BuildPreviewOptions, ExtractOptions {}

/** Full path: PDF bytes to an uncommitted preview. */
export async function ingestPdf(
  data: ArrayBuffer | Uint8Array,
  options: IngestOptions = {},
): Promise<ImportPreview> {
  const raw = await extractPdf(data, options);
  return buildPreview(raw, options);
}

/** Turn a preview into the record that would be stored. */
export function previewToBook(preview: ImportPreview, bookId: string, importedAt: number): Book {
  return {
    id: bookId,
    ...preview.book,
    status: preview.report.quality === 'failed' ? 'failed' : 'ready',
    importedAt,
    stats: {
      sections: preview.sections.length,
      chunks: preview.chunks.length,
      knowledge: preview.knowledge.length,
    },
  };
}

export { BookExtractionError };
