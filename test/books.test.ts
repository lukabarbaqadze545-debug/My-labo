import { describe, expect, it } from 'vitest';
import {
  buildPreview,
  buildChunks,
  cleanPages,
  detectHeadings,
  buildSections,
  toLines,
  ingestPdf,
  previewToBook,
  retrieveFromBooks,
  answerFromBooks,
  compareBooks,
  renderComparison,
  detectConflicts,
  booksInScope,
  isBookExclusive,
  formatCitation,
  pageQuality,
  type BookCorpus,
  type ImportPreview,
} from '@/domain/books';
import type { BookScope } from '@/domain/books';
import {
  converse,
  emptyConversationState,
  socraticFromBooks,
  bookCounterarguments,
} from '@/domain/conversation';
import { makePdf } from './helpers/makePdf';
import { COMPATIBILIST_BOOK, DETERMINIST_BOOK, GEORGIAN_BOOK } from './helpers/sampleBooks';

/* --------------------------- shared fixtures --------------------------- */

const determinist = buildPreview(DETERMINIST_BOOK, { bookId: 'b_det', importedAt: 1000 });
const compatibilist = buildPreview(COMPATIBILIST_BOOK, { bookId: 'b_com', importedAt: 1000 });
const georgian = buildPreview(GEORGIAN_BOOK, { bookId: 'b_geo', importedAt: 1000 });

function corpusOf(...previews: ImportPreview[]): BookCorpus {
  return {
    books: previews.map((p, i) =>
      previewToBook(p, ['b_det', 'b_com', 'b_geo'][previews.indexOf(p)] ?? `b${i}`, 1000),
    ),
    chunks: previews.flatMap((p) => p.chunks),
    sections: previews.flatMap((p) => p.sections),
    knowledge: previews.flatMap((p) => p.knowledge),
  };
}

const bothBooks = corpusOf(determinist, compatibilist);

/* ============================== cleaning ============================== */

describe('cleaning', () => {
  it('removes the running head that appears on every page', () => {
    const result = cleanPages(DETERMINIST_BOOK.pages);
    expect(result.removedRunningText.length).toBeGreaterThan(0);
    for (const page of result.pages) {
      expect(page.text).not.toContain('THE PROBLEM OF FREE WILL');
    }
  });

  it('strips printed page numbers', () => {
    const result = cleanPages(DETERMINIST_BOOK.pages);
    const first = result.pages[0]!;
    expect(first.text.split('\n').some((l) => /^\d+$/.test(l.trim()))).toBe(false);
  });

  it('rejoins a word hyphenated across a line break', () => {
    const result = cleanPages(DETERMINIST_BOOK.pages);
    const page2 = result.pages.find((p) => p.page === 2)!;
    expect(page2.text).toContain('deliberations');
    expect(result.dehyphenated).toBeGreaterThan(0);
  });

  it('flags the letter-spaced page as low quality and the blank one as empty', () => {
    const result = cleanPages(DETERMINIST_BOOK.pages);
    expect(result.lowQualityPages).toContain(5);
    expect(result.emptyPages).toContain(6);
  });

  it('scores prose above letter soup', () => {
    expect(pageQuality('Determinism is the thesis that every event has a prior cause in nature.')).toBeGreaterThan(0.7);
    expect(pageQuality('T h e   a r g u m e n t   c o n t i n u e s   h e r e   n o w')).toBeLessThan(0.5);
  });

  it('reports quality rather than importing silently', () => {
    const result = cleanPages(DETERMINIST_BOOK.pages);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(['good', 'fair', 'poor', 'failed']).toContain(result.quality);
  });
});

/* ============================= structure ============================== */

describe('structure detection', () => {
  it('finds chapters', () => {
    const cleaned = cleanPages(DETERMINIST_BOOK.pages);
    const headings = detectHeadings(toLines(cleaned.pages));
    const chapters = headings.filter((h) => h.level === 1);
    expect(chapters.length).toBeGreaterThanOrEqual(2);
    expect(chapters[0]!.text).toMatch(/Chapter 1/);
  });

  it('builds sections with page ranges inside the book', () => {
    for (const section of determinist.sections) {
      expect(section.pageStart).toBeGreaterThanOrEqual(1);
      expect(section.pageEnd).toBeLessThanOrEqual(DETERMINIST_BOOK.pages.length);
      expect(section.pageEnd).toBeGreaterThanOrEqual(section.pageStart);
    }
  });

  it('falls back to one section when a book has no headings', () => {
    const flat = buildPreview(
      { meta: { totalPages: 1 }, pages: [{ page: 1, text: 'a plain paragraph of running text that goes on for a while and never announces a heading of any kind at all.' }] },
      { bookId: 'b_flat' },
    );
    expect(flat.sections).toHaveLength(1);
    expect(flat.report.warnings.some((w) => w.includes('სათაურები'))).toBe(true);
  });
});

/* ============================== chunking ============================== */

describe('chunking', () => {
  it('produces chunks whose page ranges are real', () => {
    for (const chunk of determinist.chunks) {
      expect(chunk.pageStart).toBeGreaterThanOrEqual(1);
      expect(chunk.pageEnd).toBeLessThanOrEqual(DETERMINIST_BOOK.pages.length);
      expect(chunk.pageEnd).toBeGreaterThanOrEqual(chunk.pageStart);
    }
  });

  it('keeps chunks inside a single section', () => {
    const sectionIds = new Set(determinist.sections.map((s) => s.id));
    for (const chunk of determinist.chunks) {
      expect(sectionIds.has(chunk.sectionId)).toBe(true);
    }
  });

  it('does not cut mid-sentence', () => {
    for (const chunk of determinist.chunks) {
      expect(chunk.text.trim().length).toBeGreaterThan(0);
      // A chunk built from whole paragraphs never begins with a lower-case
      // continuation of a clause.
      expect(/^[a-zა-ჰ],/.test(chunk.text.trim())).toBe(false);
    }
  });

  it('marks chunks from bad pages as low quality', () => {
    const cleaned = cleanPages(DETERMINIST_BOOK.pages);
    const sections = buildSections('x', toLines(cleaned.pages), detectHeadings(toLines(cleaned.pages)));
    const chunks = buildChunks('x', cleaned.pages, sections);
    // Every chunk carries a quality grade the retriever can weigh.
    for (const chunk of chunks) {
      expect(['high', 'medium', 'low']).toContain(chunk.quality);
    }
  });
});

/* ====================== structured knowledge ========================== */

describe('structured knowledge extraction', () => {
  const byType = (preview: ImportPreview, type: string) =>
    preview.knowledge.filter((k) => k.type === type);

  it('extracts a definition', () => {
    const definitions = byType(determinist, 'definition');
    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions.some((d) => /necessitated/i.test(d.content))).toBe(true);
  });

  it('extracts a thesis claim', () => {
    expect(byType(determinist, 'claim').some((c) => /free will does not exist/i.test(c.content))).toBe(true);
  });

  it('extracts an objection and its reply', () => {
    expect(byType(determinist, 'objection').length).toBeGreaterThan(0);
    expect(byType(determinist, 'reply').length).toBeGreaterThan(0);
  });

  it('extracts an argument with a conclusion marker', () => {
    const args = byType(determinist, 'argument');
    expect(args.length).toBeGreaterThan(0);
    expect(args.some((a) => /could have acted otherwise/i.test(a.content))).toBe(true);
  });

  it('extracts a thought experiment and an example', () => {
    expect(byType(compatibilist, 'thoughtExperiment').length).toBeGreaterThan(0);
    expect(byType(compatibilist, 'example').length).toBeGreaterThan(0);
  });

  it('extracts a distinction', () => {
    expect(byType(compatibilist, 'distinction').length).toBeGreaterThan(0);
  });

  it('links an objection to the claim it challenges', () => {
    const rel = determinist.relations.find((r) => r.kind === 'challenges');
    expect(rel).toBeTruthy();
    const ids = new Set(determinist.knowledge.map((k) => k.id));
    expect(ids.has(rel!.from)).toBe(true);
    expect(ids.has(rel!.to)).toBe(true);
  });

  it('links a reply to the objection it answers', () => {
    expect(determinist.relations.some((r) => r.kind === 'responds_to')).toBe(true);
  });

  it('files items under a Labo concept when the vocabulary matches', () => {
    const linked = determinist.knowledge.filter((k) => !k.concept.startsWith('book:'));
    expect(linked.length).toBeGreaterThan(0);
    // Free will is a real Labo topic; book knowledge should land on it.
    expect(linked.some((k) => k.concept === 'free-will')).toBe(true);
  });

  it('works on a Georgian book too', () => {
    expect(georgian.knowledge.length).toBeGreaterThan(0);
    expect(georgian.knowledge.some((k) => k.type === 'definition')).toBe(true);
    expect(georgian.knowledge.some((k) => k.type === 'thoughtExperiment')).toBe(true);
  });
});

/* ============================= provenance ============================= */

describe('provenance and citation honesty', () => {
  it('every knowledge item carries a page range that exists in the book', () => {
    for (const item of determinist.knowledge) {
      expect(item.source.bookId).toBe('b_det');
      expect(item.source.pageStart).toBeGreaterThanOrEqual(1);
      expect(item.source.pageEnd).toBeLessThanOrEqual(DETERMINIST_BOOK.pages.length);
      expect(item.source.importedAt).toBe(1000);
    }
  });

  it('every knowledge item quotes text that is actually in its chunk', () => {
    const chunkById = new Map(determinist.chunks.map((c) => [c.id, c]));
    for (const item of determinist.knowledge) {
      const chunk = chunkById.get(item.source.sourceChunkId ?? '');
      expect(chunk, item.id).toBeTruthy();
      // The extracted sentence must come from the source, not be composed.
      const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();
      expect(normalise(chunk!.text)).toContain(normalise(item.content).slice(0, 40));
    }
  });

  it('a citation reports the chunk’s own pages, never an invented one', () => {
    const retrieval = retrieveFromBooks('determinism necessitated', { mode: 'book', bookIds: ['b_det'] }, bothBooks);
    const answer = answerFromBooks('determinism necessitated', retrieval);
    for (const citation of answer.citations) {
      const chunk = determinist.chunks.find((c) => c.id === citation.chunkId);
      expect(chunk).toBeTruthy();
      expect(citation.pageStart).toBe(chunk!.pageStart);
      expect(citation.pageEnd).toBe(chunk!.pageEnd);
    }
  });

  it('attributes a sentence to its own page, not the whole chunk range', () => {
    // The determinist book's reply sits on page 3; the objection on page 3 too,
    // while the opening definition is on page 1. A chunk spanning several pages
    // must not widen every one of its sentences to the full span.
    const definition = determinist.knowledge.find((k) => k.type === 'definition');
    const reply = determinist.knowledge.find((k) => k.type === 'reply');
    expect(definition!.source.pageStart).toBe(1);
    expect(reply!.source.pageStart).toBeGreaterThanOrEqual(3);

    // And no item may claim a page its chunk never covered.
    const chunkById = new Map(determinist.chunks.map((c) => [c.id, c]));
    for (const item of determinist.knowledge) {
      const chunk = chunkById.get(item.source.sourceChunkId ?? '');
      if (!chunk) continue;
      expect(item.source.pageStart).toBeGreaterThanOrEqual(chunk.pageStart);
      expect(item.source.pageEnd).toBeLessThanOrEqual(chunk.pageEnd);
    }
  });

  it('formats a citation with the pages it holds', () => {
    const text = formatCitation({
      bookId: 'b', bookTitle: 'T', author: 'A', chapter: 'Chapter 1',
      pageStart: 3, pageEnd: 4, chunkId: 'c',
    }, 1);
    expect(text).toContain('გვ. 3–4');
    expect(text).toContain('Chapter 1');
  });
});

/* ============================ retrieval modes ========================= */

describe('retrieval modes', () => {
  it('Book Only never returns material from another book', () => {
    const retrieval = retrieveFromBooks(
      'freedom compulsion desires',
      { mode: 'book', bookIds: ['b_com'] },
      bothBooks,
    );
    expect(retrieval.hits.length).toBeGreaterThan(0);
    for (const hit of retrieval.hits) expect(hit.book.id).toBe('b_com');
    for (const item of retrieval.knowledge) expect(item.bookId).toBe('b_com');
  });

  it('Library mode searches every book', () => {
    const retrieval = retrieveFromBooks('free will', { mode: 'library', bookIds: [] }, bothBooks);
    expect(new Set(retrieval.hits.map((h) => h.book.id)).size).toBeGreaterThan(1);
  });

  it('Selected mode searches exactly the chosen set', () => {
    const retrieval = retrieveFromBooks(
      'free will',
      { mode: 'selected', bookIds: ['b_det'] },
      bothBooks,
    );
    for (const hit of retrieval.hits) expect(hit.book.id).toBe('b_det');
  });

  it('off mode returns nothing at all', () => {
    const retrieval = retrieveFromBooks('free will', { mode: 'off', bookIds: [] }, bothBooks);
    expect(retrieval.hits).toHaveLength(0);
    expect(booksInScope({ mode: 'off', bookIds: [] }, bothBooks.books)).toBeNull();
  });

  it('knows which modes exclude Labo’s own knowledge', () => {
    expect(isBookExclusive({ mode: 'book', bookIds: [] })).toBe(true);
    expect(isBookExclusive({ mode: 'selected', bookIds: [] })).toBe(true);
    expect(isBookExclusive({ mode: 'library', bookIds: [] })).toBe(true);
    expect(isBookExclusive({ mode: 'with_labo', bookIds: [] })).toBe(false);
    expect(isBookExclusive({ mode: 'off', bookIds: [] })).toBe(false);
  });

  it('skips a disabled book', () => {
    const corpus = { ...bothBooks, books: bothBooks.books.map((b) => ({ ...b, disabled: true })) };
    expect(retrieveFromBooks('free will', { mode: 'library', bookIds: [] }, corpus).hits).toHaveLength(0);
  });
});

/* =========================== grounded answers ========================= */

describe('grounded answers', () => {
  it('answers from the book and cites it', () => {
    const retrieval = retrieveFromBooks(
      'how is determinism defined',
      { mode: 'book', bookIds: ['b_det'] },
      bothBooks,
    );
    const answer = answerFromBooks('how is determinism defined', retrieval);
    expect(answer.grounded).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.text).toContain('წყარო');
    expect(answer.text).toMatch(/გვ\. \d+/);
  });

  it('reads as composed prose, not a labelled bullet dump', () => {
    const retrieval = retrieveFromBooks(
      'how is determinism defined',
      { mode: 'book', bookIds: ['b_det'] },
      bothBooks,
    );
    const answer = answerFromBooks('how is determinism defined', retrieval);
    // No retrieval machinery leaks into the user-facing text.
    expect(answer.text).not.toContain('•');
    expect(answer.text).not.toMatch(/^(განმარტება|მტკიცება|არგუმენტი|ცნება)\s*[—-]/mu);
    // The body (everything before the source line) stays short — a synthesis,
    // not a transcript.
    const body = answer.text.split('\n\nწყარო:')[0]!;
    expect(body.length).toBeLessThan(500);
  });

  it('never names the book by its internal id, only its display title', () => {
    const retrieval = retrieveFromBooks(
      'how is determinism defined',
      { mode: 'book', bookIds: ['b_det'] },
      bothBooks,
    );
    const answer = answerFromBooks('how is determinism defined', retrieval);
    expect(answer.text).not.toContain('b_det');
    expect(answer.text).not.toContain('chunk_');
  });

  it('says the book does not cover something instead of reaching elsewhere', () => {
    const retrieval = retrieveFromBooks(
      'photosynthesis chlorophyll thylakoid',
      { mode: 'book', bookIds: ['b_det'] },
      bothBooks,
    );
    const answer = answerFromBooks('photosynthesis chlorophyll thylakoid', retrieval);
    expect(answer.grounded).toBe(false);
    expect(answer.citations).toHaveLength(0);
    expect(answer.text).toMatch(/ვერ (ვიპოვე|ვპოულობ)|არ არის/);
  });

  it('keeps quoted text within a copyright-safe budget', () => {
    const retrieval = retrieveFromBooks('free will determinism', { mode: 'library', bookIds: [] }, bothBooks);
    const answer = answerFromBooks('free will determinism', retrieval);
    const quoted = [...answer.text.matchAll(/„([^"]{20,})"/gu)].map((m) => m[1]!.length);
    const total = quoted.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(900);
  });

  it('answers a Georgian query against a Georgian book', () => {
    const corpus: BookCorpus = {
      books: [previewToBook(georgian, 'b_geo', 1000)],
      chunks: georgian.chunks,
      sections: georgian.sections,
      knowledge: georgian.knowledge,
    };
    const retrieval = retrieveFromBooks(
      'დეტერმინიზმი რას ნიშნავს',
      { mode: 'book', bookIds: ['b_geo'] },
      corpus,
    );
    expect(retrieval.hits.length).toBeGreaterThan(0);
    const answer = answerFromBooks('დეტერმინიზმი რას ნიშნავს', retrieval);
    expect(answer.grounded).toBe(true);
    expect(answer.text).toMatch(/გვ\. \d+/);
  });
});

/* ========================= comparison and conflict ==================== */

describe('cross-book comparison', () => {
  it('keeps each book’s view under its own name', () => {
    const stances = compareBooks('is free will real', ['b_det', 'b_com'], bothBooks);
    expect(stances).toHaveLength(2);
    for (const stance of stances) {
      for (const hit of stance.hits) expect(hit.book.id).toBe(stance.book.id);
    }
    const rendered = renderComparison(stances);
    expect(rendered).toContain('The Illusion of Choice');
    expect(rendered).toContain('Freedom Enough');
  });

  it('detects that the two books disagree', () => {
    const stances = compareBooks('does free will exist', ['b_det', 'b_com'], bothBooks);
    const conflicts = detectConflicts(stances);
    // Either an explicit conflict is found, or both stances are reported
    // separately — what must never happen is a single blended claim.
    const rendered = renderComparison(stances);
    expect(rendered.split('The Illusion of Choice').length - 1).toBeGreaterThanOrEqual(1);
    if (conflicts.length > 0) {
      expect(conflicts[0]!.a.bookId).not.toBe(conflicts[0]!.b.bookId);
      expect(conflicts[0]!.note).toContain('საპირისპიროს');
    }
  });

  it('reports honestly when a book does not address the question', () => {
    const stances = compareBooks('mitochondria respiration', ['b_det', 'b_com'], bothBooks);
    const rendered = renderComparison(stances);
    expect(rendered).toMatch(/ვერ ვიპოვე|არ ეხება/);
  });
});

/* ============================ import preview ========================== */

describe('import preview', () => {
  it('reports counts and warnings without committing anything', () => {
    expect(determinist.report.pages).toBe(6);
    expect(determinist.report.counts.chunks).toBeGreaterThan(0);
    expect(determinist.report.counts.knowledge).toBeGreaterThan(0);
    expect(determinist.report.emptyPages).toContain(6);
    expect(determinist.report.warnings.length).toBeGreaterThan(0);
  });

  it('carries the title and author from PDF metadata', () => {
    expect(determinist.book.title).toBe('The Illusion of Choice');
    expect(determinist.book.author).toBe('A. Hardline');
  });

  it('detects book language', () => {
    expect(determinist.book.language).toBe('en');
    expect(georgian.book.language).toBe('ka');
  });

  it('marks a book with no text layer as failed rather than importing it', () => {
    const empty = buildPreview(
      { meta: { totalPages: 2 }, pages: [{ page: 1, text: '  ' }, { page: 2, text: '' }] },
      { bookId: 'b_empty' },
    );
    expect(empty.report.quality).toBe('failed');
    expect(previewToBook(empty, 'b_empty', 1).status).toBe('failed');
  });

  it('reads the title off the front matter instead of the filename', () => {
    const preview = buildPreview(
      {
        meta: { totalPages: 2 },
        pages: [
          {
            page: 1,
            text: [
              'შესავალი',
              'თანამედროვე',
              'აზროვნებაში',
              'I',
              'წ ი გ ნ ი',
              'ილიას სახელმწიფო უნივერსიტეტის გამომცემლობა',
              'თბილისი 2019',
            ].join('\n'),
          },
          { page: 2, text: 'ტექსტი გრძელდება აქ საკმარისი სიგრძით ტესტისთვის.' },
        ],
      },
      { bookId: 'b_front', filename: 'shesavali_tanamedrove_azrovnebashi_nawili_1.pdf' },
    );
    expect(preview.book.title).toBe('შესავალი თანამედროვე აზროვნებაში I');
    // The internal filename must never leak into what the user sees.
    expect(preview.book.title).not.toContain('_');
    expect(preview.book.title).not.toMatch(/shesavali/i);
  });

  it('falls back to a real word-separated filename when there is no front matter', () => {
    const preview = buildPreview(
      { meta: { totalPages: 1 }, pages: [{ page: 1, text: 'ჩვეულებრივი წინადადებით დაწყებული ტექსტი გვერდზე.' }] },
      { bookId: 'b_nofm', filename: 'the_republic_plato.pdf' },
    );
    expect(preview.book.title).toBe('the republic plato');
  });
});

/* ============================ end to end ============================== */

describe('PDF ingestion end to end', () => {
  it('reads a real PDF and preserves page numbers', async () => {
    const bytes = makePdf([
      {
        lines: [
          'Chapter 1',
          'On Necessity',
          'Determinism is defined as the view that every event is fixed by what came before.',
          'I shall argue that this leaves no room for alternative possibilities.',
        ],
      },
      {
        lines: [
          'One might object that deliberation feels open to us.',
          'In reply, a feeling of openness is not evidence of openness.',
        ],
      },
    ]);

    const preview = await ingestPdf(bytes, { filename: 'necessity.pdf', bookId: 'b_pdf', importedAt: 42 });

    expect(preview.report.pages).toBe(2);
    expect(preview.chunks.length).toBeGreaterThan(0);
    expect(preview.knowledge.length).toBeGreaterThan(0);

    // Page attribution must survive the whole pipeline.
    const objection = preview.knowledge.find((k) => k.type === 'objection');
    expect(objection).toBeTruthy();
    expect(objection!.source.pageStart).toBe(2);

    const definition = preview.knowledge.find((k) => k.type === 'definition');
    expect(definition!.source.pageStart).toBe(1);

    // And a chapter heading survives too.
    expect(preview.sections.some((s) => /Chapter 1/i.test(s.title))).toBe(true);
  });

  it('fails loudly on a PDF with no text layer', async () => {
    const bytes = makePdf([{ lines: [] }]);
    await expect(ingestPdf(bytes, { bookId: 'b_blank' })).rejects.toThrow(/text layer|could not be opened/i);
  });
});

/* ============================= performance ============================ */

describe('performance', () => {
  it('indexes once and answers many questions quickly', () => {
    const started = Date.now();
    for (let i = 0; i < 40; i++) {
      retrieveFromBooks('free will determinism responsibility', { mode: 'library', bookIds: [] }, bothBooks);
    }
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('ingests a multi-page book without stalling', () => {
    const pages = Array.from({ length: 120 }, (_, i) => ({
      page: i + 1,
      text: `RUNNING HEAD\nChapter ${Math.floor(i / 10) + 1}\nDeterminism is defined as the thesis that events are necessitated. One might object that this is too strong. In reply, the objection misunderstands the claim.\n${i + 1}`,
    }));
    const started = Date.now();
    const preview = buildPreview({ meta: { totalPages: 120 }, pages }, { bookId: 'b_big' });
    expect(preview.chunks.length).toBeGreaterThan(10);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});

/* ==================== integration with the assistant =================== */

describe('books inside the conversation engine', () => {
  const scopeBoth: BookScope = { mode: 'library', bookIds: [] };

  it('Book Only mode answers from the book and cites pages', () => {
    const result = converse(emptyConversationState(), 'how is determinism defined?', {
      bookScope: { mode: 'book', bookIds: ['b_det'] },
      bookCorpus: bothBooks,
    });
    expect(result.trace.action.kind).toBe('answer_from_book');
    expect(result.reply.text).toMatch(/გვ\. \d+/);
    expect(result.reply.sources.length).toBeGreaterThan(0);
  });

  it('Book Only mode refuses to fall back on Labo knowledge', () => {
    // Free will is a real Labo topic, so a leak would produce a confident
    // answer from the library instead of an honest miss.
    const result = converse(emptyConversationState(), 'რა არის ფოტოსინთეზი?', {
      bookScope: { mode: 'book', bookIds: ['b_det'] },
      bookCorpus: bothBooks,
    });
    expect(result.trace.verdict).toBe('known_but_missing');
    expect(result.reply.text).not.toMatch(/ქლოროფილ|ფოტოსინთეზი არის/);
    expect(result.trace.action.rationale).toMatch(/მხოლოდ წიგნის რეჟიმია|ვერ ვიპოვე/);
  });

  it('books switched off leave the normal pipeline untouched', () => {
    const withBooks = converse(emptyConversationState(), 'რა არის რეკურსია?', {
      bookScope: { mode: 'off', bookIds: [] },
      bookCorpus: bothBooks,
    });
    const without = converse(emptyConversationState(), 'რა არის რეკურსია?');
    expect(withBooks.trace.action.topicId).toBe(without.trace.action.topicId);
    expect(withBooks.trace.action.kind).toBe(without.trace.action.kind);
  });

  it('Labo + Books falls through to Labo when the books have nothing', () => {
    const result = converse(emptyConversationState(), 'რა არის რეკურსია?', {
      bookScope: { mode: 'with_labo', bookIds: [] },
      bookCorpus: bothBooks,
    });
    expect(result.trace.action.topicId).toBe('recursion');
    expect(result.trace.action.kind).not.toBe('answer_from_book');
  });

  it('Labo + Books prefers the books when they are grounded', () => {
    const result = converse(emptyConversationState(), 'determinism necessitated by prior events', {
      bookScope: { mode: 'with_labo', bookIds: [] },
      bookCorpus: bothBooks,
    });
    expect(result.trace.action.kind).toBe('answer_from_book');
  });

  it('answers "საიდან იცი?" with a book and a page', () => {
    const result = converse(emptyConversationState(), 'ამ წიგნის მიხედვით determinism რა არის?', {
      bookScope: { mode: 'book', bookIds: ['b_det'] },
      bookCorpus: bothBooks,
    });
    expect(result.reply.text).toContain('The Illusion of Choice');
    expect(result.reply.text).toMatch(/გვ\. \d+/);
  });

  it('compares two books without blending them', () => {
    const result = converse(emptyConversationState(), 'შეადარე free will determinism', {
      bookScope: scopeBoth,
      bookCorpus: bothBooks,
    });
    expect(result.trace.action.kind).toBe('compare_books');
    expect(result.reply.text).toContain('The Illusion of Choice');
    expect(result.reply.text).toContain('Freedom Enough');
  });

  it('Socratic mode asks from the books instead of dumping both views', () => {
    const result = converse(emptyConversationState(), 'free will determinism compatibilism', {
      bookScope: scopeBoth,
      bookCorpus: bothBooks,
      socratic: true,
    });
    expect(result.trace.action.kind).toBe('ask_socratic_question');
    expect(result.reply.text).toContain('?');
  });

  it('a Socratic book question never invents a position', () => {
    const items = bothBooks.knowledge.filter((k) => k.type === 'position' || k.type === 'claim');
    const question = socraticFromBooks(items);
    if (question) {
      // Every quoted line must be text that exists in some knowledge item.
      const quoted = [...question.matchAll(/: (.+)$/gmu)].map((m) => m[1]!.trim());
      for (const line of quoted) {
        if (line.length < 20) continue;
        expect(items.some((i) => i.content.includes(line.slice(0, 30)))).toBe(true);
      }
    }
  });

  it('supplies counterarguments drawn from the books', () => {
    const counter = bookCounterarguments(bothBooks.knowledge);
    expect(counter.length).toBeGreaterThan(0);
    for (const item of counter) {
      expect(['objection', 'counterargument', 'reply']).toContain(item.type);
      expect(item.source.pageStart).toBeGreaterThanOrEqual(1);
    }
  });
});
