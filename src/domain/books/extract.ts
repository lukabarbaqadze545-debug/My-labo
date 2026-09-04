import type { PageText, RawBook } from './types';

/**
 * Stage 1 — PDF bytes to page text.
 *
 * This is the only impure module in the ingestion pipeline. Everything
 * downstream operates on `PageText[]`, which means the cleaning, structuring,
 * chunking and extraction stages are all testable without a PDF at all — and
 * a different source format (EPUB, plain text) can be added by writing a new
 * adapter here and nothing else.
 *
 * pdf.js is dynamically imported so the ~400KB parser only loads when someone
 * actually imports a book.
 */

export class BookExtractionError extends Error {
  constructor(
    message: string,
    readonly kind: 'unreadable' | 'encrypted' | 'empty' | 'unsupported',
  ) {
    super(message);
    this.name = 'BookExtractionError';
  }
}

type TextItem = { str?: string; transform?: number[]; hasEOL?: boolean };

/**
 * Reassemble a page's text items into lines.
 *
 * pdf.js returns positioned fragments, not lines. Grouping by vertical
 * position is what recovers line structure — and line structure is what makes
 * heading detection and hyphenation repair possible later.
 */
function itemsToLines(items: readonly TextItem[]): string {
  const rows = new Map<number, { x: number; str: string }[]>();

  for (const item of items) {
    const str = item.str ?? '';
    if (!str) continue;
    const transform = item.transform;
    // transform is [a, b, c, d, e, f]; e/f are x/y in text space.
    const y = transform ? Math.round(transform[5] ?? 0) : 0;
    const x = transform ? (transform[4] ?? 0) : 0;
    // Bucket to the nearest 2 units so a slightly-offset glyph stays on its line.
    const key = Math.round(y / 2) * 2;
    const row = rows.get(key);
    if (row) row.push({ x, str });
    else rows.set(key, [{ x, str }]);
  }

  return [...rows.entries()]
    // PDF y grows upward, so descending y is reading order.
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((cell) => cell.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

async function loadPdfjs() {
  // The legacy build runs in both browsers and Node without a DOM.
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument: (opts: Record<string, unknown>) => { promise: Promise<PdfDocument> };
    GlobalWorkerOptions: { workerSrc: string };
  };

  // In the browser the parser needs an explicit worker URL, or it falls back
  // to parsing on the main thread and freezes the tab on a large book. In Node
  // there is no worker and pdf.js handles that itself.
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default: string }).default;
    } catch {
      // Without a worker parsing still succeeds, just on the main thread.
    }
  }

  return pdfjs;
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: TextItem[] }> }>;
  getMetadata: () => Promise<{ info?: Record<string, unknown> }>;
  destroy?: () => Promise<void>;
}

export interface ExtractOptions {
  /** Called after each page, for progress reporting. */
  onProgress?: (page: number, total: number) => void;
  /** Guard against a pathological upload locking up the tab. */
  maxPages?: number;
}

export async function extractPdf(
  data: ArrayBuffer | Uint8Array,
  options: ExtractOptions = {},
): Promise<RawBook> {
  const pdfjs = await loadPdfjs();

  let doc: PdfDocument;
  try {
    doc = await pdfjs.getDocument({
      data: data instanceof Uint8Array ? data : new Uint8Array(data),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: false,
      // A password-protected file should fail loudly, not hang on a prompt.
      password: '',
    }).promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/password/i.test(message)) {
      throw new BookExtractionError('PDF is password protected', 'encrypted');
    }
    throw new BookExtractionError(`PDF could not be opened: ${message}`, 'unreadable');
  }

  const total = Math.min(doc.numPages, options.maxPages ?? 2000);
  const pages: PageText[] = [];

  for (let n = 1; n <= total; n++) {
    try {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push({ page: n, text: itemsToLines(content.items) });
    } catch {
      // One bad page must not abort a 300-page import; it is recorded as
      // empty and shows up in the quality report.
      pages.push({ page: n, text: '' });
    }
    options.onProgress?.(n, total);
  }

  let meta: RawBook['meta'] = { totalPages: doc.numPages };
  try {
    const info = (await doc.getMetadata()).info ?? {};
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    meta = {
      totalPages: doc.numPages,
      ...(str(info.Title) ? { title: str(info.Title)! } : {}),
      ...(str(info.Author) ? { author: str(info.Author)! } : {}),
      ...(str(info.Subject) ? { subject: str(info.Subject)! } : {}),
      ...(str(info.Producer) ? { producer: str(info.Producer)! } : {}),
    };
  } catch {
    /* metadata is optional */
  }

  await doc.destroy?.();

  if (pages.every((p) => !p.text.trim())) {
    throw new BookExtractionError(
      'No text layer found. This is likely a scanned PDF and would need OCR.',
      'empty',
    );
  }

  return { pages, meta };
}
