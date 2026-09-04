import { kaStemDeep } from '@/language/ka';
import type { BookChunk, BookSection, Confidence } from './types';
import type { CleanedPage } from './clean';
import { buildParagraphs, toLines, type PositionedLine } from './structure';

/**
 * Stage 4 — chunking.
 *
 * Chunks are built from paragraphs, inside section boundaries, to a target
 * size — never by slicing at a character count. A chunk that begins mid-clause
 * retrieves badly and quotes worse.
 *
 * Every chunk carries the exact page range of the paragraphs it contains, so a
 * citation is a fact about the source rather than an estimate.
 */

const TARGET = 900;
const MAX = 1500;
const MIN = 120;

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'be', 'been',
  'that', 'this', 'it', 'as', 'for', 'with', 'on', 'at', 'by', 'from', 'but', 'not', 'we',
  'they', 'he', 'she', 'his', 'her', 'their', 'its', 'have', 'has', 'had', 'will', 'would',
  'can', 'could', 'may', 'might', 'do', 'does', 'did', 'so', 'if', 'then', 'than', 'there',
  'და', 'ან', 'თუ', 'რომ', 'როგორც', 'ის', 'ეს', 'ეგ', 'იმ', 'ამ', 'არის', 'იყო', 'მაგრამ',
  'თუმცა', 'ამიტომ', 'რადგან', 'ასევე', 'უფრო', 'ძალიან', 'მხოლოდ', 'კიდევ',
]);

/** Content terms of a passage, stemmed for cross-form matching. */
export function chunkTerms(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(kaStemDeep);
}

function termFrequencies(terms: readonly string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const term of terms) tf[term] = (tf[term] ?? 0) + 1;
  return tf;
}

/** Which section a line belongs to, by page and reading order. */
function sectionForIndex(
  sections: readonly BookSection[],
  lines: readonly PositionedLine[],
  index: number,
): BookSection | undefined {
  const page = lines[index]?.page;
  if (page === undefined) return sections[0];
  // Later sections win, so a page shared by two sections attributes to the
  // one that started on it.
  let found: BookSection | undefined;
  for (const section of sections) {
    if (page >= section.pageStart && page <= section.pageEnd) found = section;
  }
  return found ?? sections[0];
}

export interface ChunkOptions {
  targetChars?: number;
  maxChars?: number;
  /** Running heads per page, so a chunk stays findable by its author's name. */
  headsByPage?: Map<number, string[]>;
}

export function buildChunks(
  bookId: string,
  pages: readonly CleanedPage[],
  sections: readonly BookSection[],
  options: ChunkOptions = {},
): BookChunk[] {
  const target = options.targetChars ?? TARGET;
  const max = options.maxChars ?? MAX;

  const lines = toLines(pages);
  if (lines.length === 0) return [];

  const qualityByPage = new Map(pages.map((p) => [p.page, p.quality]));
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const chunks: BookChunk[] = [];
  let order = 0;

  // Group lines by section first, so a chunk never straddles a chapter break.
  const bySection = new Map<string, PositionedLine[]>();
  lines.forEach((line, index) => {
    const section = sectionForIndex(sections, lines, index);
    const key = section?.id ?? sections[0]?.id ?? `sec_${bookId}_0`;
    const bucket = bySection.get(key);
    if (bucket) bucket.push(line);
    else bySection.set(key, [line]);
  });

  for (const [sectionId, sectionLines] of bySection) {
    const paragraphs = buildParagraphs(sectionLines);

    let buffer: string[] = [];
    let spans: BookChunk['spans'] = [];
    let pageStart = paragraphs[0]?.pageStart ?? 1;
    let pageEnd = pageStart;
    let size = 0;

    const flush = () => {
      const text = buffer.join('\n\n').trim();
      if (text.length < MIN) {
        buffer = [];
        spans = [];
        size = 0;
        return;
      }
      /*
       * A chunk is searchable by its section's heading as well as its body.
       *
       * In an anthology the author's name is the running head, which cleaning
       * removes — so „პლატონი" survives only in the section title. Without
       * this, a question naming a thinker cannot reach that thinker's pages.
       */
      const section = sectionById.get(sectionId);
      const headingTerms = section
        ? chunkTerms(`${section.title} ${section.chapter ?? ''}`)
        : [];
      // The running head — the author's name in an anthology — is searchable
      // even though it was stripped from the body text.
      const headTerms: string[] = [];
      for (let p = pageStart; p <= pageEnd; p++) {
        for (const head of options.headsByPage?.get(p) ?? []) headTerms.push(...chunkTerms(head));
      }
      const terms = [...chunkTerms(text), ...headingTerms, ...headTerms];
      const pageQualities = [];
      for (let p = pageStart; p <= pageEnd; p++) {
        const q = qualityByPage.get(p);
        if (q !== undefined) pageQualities.push(q);
      }
      const avgQuality = pageQualities.length
        ? pageQualities.reduce((a, b) => a + b, 0) / pageQualities.length
        : 0.5;
      const quality: Confidence = avgQuality >= 0.75 ? 'high' : avgQuality >= 0.5 ? 'medium' : 'low';

      chunks.push({
        id: `chunk_${bookId}_${order}`,
        bookId,
        sectionId,
        text,
        pageStart,
        pageEnd,
        order,
        terms,
        tf: termFrequencies(terms),
        length: terms.length,
        quality,
        spans,
      });
      order++;
      buffer = [];
      spans = [];
      size = 0;
    };

    for (const paragraph of paragraphs) {
      // A single oversized paragraph becomes its own chunk rather than being
      // cut: splitting it would break the sentence it is made of.
      if (paragraph.text.length > max && buffer.length > 0) flush();

      if (buffer.length === 0) pageStart = paragraph.pageStart;
      pageEnd = paragraph.pageEnd;
      // Offset of this paragraph once the buffer is joined with blank lines.
      const start = buffer.reduce((n, p) => n + p.length + 2, 0);
      buffer.push(paragraph.text);
      spans.push({
        start,
        end: start + paragraph.text.length,
        pageStart: paragraph.pageStart,
        pageEnd: paragraph.pageEnd,
      });
      size += paragraph.text.length;

      if (size >= target) flush();
    }
    flush();
  }

  return chunks;
}
