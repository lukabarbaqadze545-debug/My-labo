import type { ExtractionQuality, PageText } from './types';

/**
 * Stage 2 — cleaning.
 *
 * Real books carry furniture that is not content: running heads on every
 * page, page numbers, footnote markers, and words split across a line break.
 * Left in, all of it pollutes retrieval — a running head repeated 300 times
 * becomes the highest-frequency phrase in the book.
 *
 * The stage also *scores* what it sees. A scanned PDF with no text layer, or
 * one whose extraction produced letter soup, must be detected and reported
 * rather than silently imported as knowledge.
 */

export interface CleanedPage extends PageText {
  /** 0..1 — how much this page looks like real prose. */
  quality: number;
  /** Text before cleaning, kept so the report can show what was removed. */
  original: string;
}

export interface CleanResult {
  pages: CleanedPage[];
  removedRunningText: string[];
  /**
   * Which running head sat on which page, as printed.
   *
   * In an anthology the running head is the author's name, so stripping it
   * from the body would make „პლატონის მიხედვით…" unanswerable. The text is
   * cleaned, but the association is kept so retrieval can still use it.
   */
  headsByPage: Map<number, string[]>;
  dehyphenated: number;
  emptyPages: number[];
  lowQualityPages: number[];
  qualityScore: number;
  quality: ExtractionQuality;
  warnings: string[];
}

const LETTER = /[\p{L}]/u;

/**
 * Does this text read like prose?
 *
 * The failure modes worth catching are letter-spaced output („T h i s"), text
 * that is mostly symbols, and pages that are almost entirely digits — which is
 * usually an index or a table that extracted badly.
 */
export function pageQuality(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length < 20) return 0;

  const chars = [...trimmed];
  const letters = chars.filter((c) => LETTER.test(c)).length;
  const letterRatio = letters / chars.length;

  const words = trimmed.split(/\s+/u).filter(Boolean);
  if (words.length < 5) return 0.2;

  const singleCharWords = words.filter((w) => w.length === 1 && LETTER.test(w)).length;
  const singleRatio = singleCharWords / words.length;

  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  const digitHeavy = chars.filter((c) => /\d/.test(c)).length / chars.length;

  let score = 1;
  // Letter-spaced extraction: „T h i s   i s   t e x t".
  if (singleRatio > 0.3) score -= 0.6;
  else if (singleRatio > 0.15) score -= 0.25;
  if (letterRatio < 0.55) score -= 0.35;
  if (avgWordLength < 2 || avgWordLength > 18) score -= 0.3;
  if (digitHeavy > 0.35) score -= 0.3;

  return Math.max(0, Math.min(1, score));
}

/** Lines that are only a page number, with or without decoration. */
function isPageNumberLine(line: string): boolean {
  return /^[\s—–\-|[\]().]*\d{1,4}[\s—–\-|[\]().]*$/u.test(line.trim());
}

/**
 * Find running heads and feet by frequency.
 *
 * A line that appears at the top or bottom of many pages is furniture. The
 * threshold scales with the book: three repetitions in a five-page document
 * means nothing, but 40 in a 300-page one is certain.
 */
function findRunningText(pages: readonly PageText[]): Set<string> {
  const counts = new Map<string, number>();
  const bump = (line: string) => {
    const key = line.trim().toLowerCase().replace(/\d+/g, '#');
    if (key.length < 3 || key.length > 90) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const page of pages) {
    const lines = page.text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    bump(lines[0]!);
    if (lines.length > 1) bump(lines[lines.length - 1]!);
    if (lines.length > 2) bump(lines[1]!);
  }

  const nonEmpty = pages.filter((p) => p.text.trim()).length;
  /*
   * Threshold, bounded at both ends.
   *
   * A fixed floor of four never fires on a short document, so a three-page
   * extract keeps its running head on every page. A pure percentage fails at
   * the other extreme: in a 544-page anthology each author's running head
   * covers only their own section, so „პლატონი" appears perhaps sixty times
   * and 30% of the book (164) never matches. Any line appearing at the top or
   * bottom of a dozen pages is furniture regardless of the book's length.
   */
  const threshold =
    nonEmpty <= 5
      ? Math.max(2, nonEmpty - 1)
      : Math.min(12, Math.max(4, Math.ceil(nonEmpty * 0.3)));
  const running = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= threshold) running.add(key);
  }
  return running;
}

/**
 * Rejoin a word split across a line break.
 *
 * „determin-\nism" must become „determinism", or the term is invisible to
 * retrieval. Only joined when the next line starts lower-case, so a genuine
 * hyphenated compound at a line end („self-\nEvident") is left alone.
 */
function dehyphenate(text: string): { text: string; joins: number } {
  let joins = 0;
  const out = text.replace(/(\p{L})-\n(\p{Ll})/gu, (_m, a: string, b: string) => {
    joins++;
    return `${a}${b}`;
  });
  return { text: out, joins };
}

export interface CleanOptions {
  /** Strip lines matching a detected running head or foot. */
  removeRunningText?: boolean;
}

export function cleanPages(pages: readonly PageText[], options: CleanOptions = {}): CleanResult {
  const removeRunning = options.removeRunningText ?? true;
  const running = removeRunning ? findRunningText(pages) : new Set<string>();
  const removedRunningText: string[] = [];
  const headsByPage = new Map<number, string[]>();
  let dehyphenated = 0;

  const cleaned: CleanedPage[] = pages.map((page) => {
    const lines = page.text.split('\n');
    const kept: string[] = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (isPageNumberLine(line)) continue;
      const key = line.toLowerCase().replace(/\d+/g, '#');
      if (running.has(key)) {
        if (!removedRunningText.includes(key)) removedRunningText.push(key);
        const seen = headsByPage.get(page.page);
        if (seen) { if (!seen.includes(line)) seen.push(line); }
        else headsByPage.set(page.page, [line]);
        continue;
      }
      kept.push(line);
    }

    const joined = kept.join('\n');
    const { text, joins } = dehyphenate(joined);
    dehyphenated += joins;

    return {
      page: page.page,
      text,
      original: page.text,
      quality: pageQuality(text),
    };
  });

  const emptyPages = cleaned.filter((p) => !p.text.trim()).map((p) => p.page);
  const lowQualityPages = cleaned
    .filter((p) => p.text.trim() && p.quality < 0.5)
    .map((p) => p.page);

  const usable = cleaned.filter((p) => p.text.trim());
  const qualityScore =
    usable.length === 0 ? 0 : usable.reduce((sum, p) => sum + p.quality, 0) / cleaned.length;

  const quality: ExtractionQuality =
    qualityScore >= 0.75 ? 'good' : qualityScore >= 0.5 ? 'fair' : qualityScore > 0.15 ? 'poor' : 'failed';

  const warnings: string[] = [];
  if (emptyPages.length > 0) {
    warnings.push(
      `${emptyPages.length} გვერდი ტექსტის გარეშე (${emptyPages.slice(0, 8).join(', ')}${emptyPages.length > 8 ? '…' : ''}).`,
    );
  }
  if (lowQualityPages.length > 0) {
    warnings.push(
      `${lowQualityPages.length} გვერდზე ამოღების ხარისხი დაბალია (${lowQualityPages.slice(0, 8).join(', ')}${lowQualityPages.length > 8 ? '…' : ''}).`,
    );
  }
  if (quality === 'poor' || quality === 'failed') {
    warnings.push('ტექსტის ამოღების ხარისხი დაბალია — სავარაუდოდ სკანირებული წიგნია და OCR სჭირდება.');
  }
  if (removedRunningText.length > 0) {
    warnings.push(`ამოღებულია გამეორებადი კოლონტიტული: ${removedRunningText.slice(0, 3).join(' · ')}`);
  }

  return {
    pages: cleaned,
    removedRunningText,
    headsByPage,
    dehyphenated,
    emptyPages,
    lowQualityPages,
    qualityScore,
    quality,
    warnings,
  };
}
