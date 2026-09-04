/**
 * Learn-from-Books: the data model.
 *
 * A book becomes four kinds of record, not one:
 *
 *   Book              what was imported, and how well it extracted
 *   BookSection       the structure the author wrote (chapters, headings)
 *   BookChunk         retrievable passages, each keeping its exact page range
 *   BookKnowledgeItem structured knowledge — definitions, claims, arguments,
 *                     objections, thought experiments — each with provenance
 *
 * Chunks alone would make this a search box. Knowledge items alone would lose
 * the evidence. Both together let the assistant answer *and* show the page it
 * came from.
 *
 * Nothing here trains anything. Model weights are untouched; this is document
 * ingestion and retrieval augmentation.
 */

export type ExtractionQuality = 'good' | 'fair' | 'poor' | 'failed';
export type Confidence = 'high' | 'medium' | 'low';
export type BookLanguage = 'ka' | 'en' | 'mixed' | 'unknown';

/* ------------------------------ provenance ------------------------------ */

/**
 * Where a piece of knowledge came from. Page numbers are carried from
 * extraction and are never synthesised: if a page is unknown the field is
 * absent rather than guessed.
 */
export interface BookProvenance {
  bookId: string;
  bookTitle: string;
  author?: string;
  chapter?: string;
  section?: string;
  pageStart: number;
  pageEnd: number;
  sourceChunkId?: string;
  importedAt: number;
  edition?: string;
  publisher?: string;
  year?: number;
  isbn?: string;
}

/* -------------------------------- records ------------------------------- */

export interface Book {
  id: string;
  title: string;
  author?: string;
  language: BookLanguage;
  subject?: string;
  tags: string[];
  totalPages: number;
  status: 'ready' | 'failed';
  extractionQuality: ExtractionQuality;
  /** 0..1 — share of pages that yielded usable text. */
  qualityScore: number;
  importedAt: number;
  edition?: string;
  publisher?: string;
  year?: number;
  isbn?: string;
  stats: { sections: number; chunks: number; knowledge: number };
  warnings: string[];
  /** Excluded from retrieval without deleting the import. */
  disabled?: boolean;
}

export interface BookSection {
  id: string;
  bookId: string;
  /** Chapter label as printed, when one was detected. */
  chapter?: string;
  title: string;
  level: 1 | 2;
  pageStart: number;
  pageEnd: number;
  order: number;
}

export interface BookChunk {
  id: string;
  bookId: string;
  sectionId: string;
  text: string;
  pageStart: number;
  pageEnd: number;
  order: number;
  /** Stemmed content terms. */
  terms: string[];
  /** Term frequencies, for BM25. */
  tf: Record<string, number>;
  /** Token count, for BM25 length normalisation. */
  length: number;
  quality: Confidence;
  /**
   * Character spans within `text`, each tagged with the page it came from.
   *
   * A chunk built from paragraphs on pages 4 and 5 must be able to say which
   * of its sentences was on which page — otherwise every citation widens to
   * the whole chunk and precision is lost for no reason.
   */
  spans: { start: number; end: number; pageStart: number; pageEnd: number }[];
}

export type KnowledgeItemType =
  | 'concept'
  | 'definition'
  | 'claim'
  | 'argument'
  | 'counterargument'
  | 'objection'
  | 'reply'
  | 'example'
  | 'thoughtExperiment'
  | 'distinction'
  | 'position'
  | 'question'
  | 'term';

export interface BookKnowledgeItem {
  id: string;
  bookId: string;
  type: KnowledgeItemType;
  /** Canonical concept key; matches a Labo topic id when one exists. */
  concept: string;
  conceptLabel: string;
  /** The extracted sentence or passage, as written in the book. */
  content: string;
  premises?: string[];
  conclusion?: string;
  confidence: Confidence;
  source: BookProvenance;
  terms: string[];
}

export type BookRelationKind =
  | 'supports'
  | 'contradicts'
  | 'challenges'
  | 'responds_to'
  | 'assumes'
  | 'clarifies'
  | 'distinguishes_from'
  | 'example_of';

export interface BookRelation {
  id: string;
  bookId: string;
  from: string;
  to: string;
  kind: BookRelationKind;
  confidence: Confidence;
}

/* ------------------------------ extraction ------------------------------ */

/** Raw output of the only impure stage: PDF bytes in, page text out. */
export interface PageText {
  page: number;
  text: string;
}

export interface RawBook {
  pages: PageText[];
  meta: {
    title?: string;
    author?: string;
    subject?: string;
    producer?: string;
    totalPages: number;
  };
}

export interface ExtractionReport {
  pages: number;
  /** 1-based page numbers that produced no usable text. */
  emptyPages: number[];
  /** Pages whose text looks like extraction noise. */
  lowQualityPages: number[];
  qualityScore: number;
  quality: ExtractionQuality;
  warnings: string[];
  /** Repeated running heads and feet that were stripped. */
  removedRunningText: string[];
  /** Line joins repaired across a hyphenated line break. */
  dehyphenated: number;
  counts: Record<string, number>;
}

/** Everything an import would create, before anything is committed. */
export interface ImportPreview {
  book: Omit<Book, 'id' | 'status' | 'importedAt' | 'stats'>;
  sections: BookSection[];
  chunks: BookChunk[];
  knowledge: BookKnowledgeItem[];
  relations: BookRelation[];
  report: ExtractionReport;
}

/* ------------------------------- retrieval ------------------------------ */

/**
 * How books participate in an answer.
 *
 *  off       books are ignored entirely (Strict Labo)
 *  book      exactly one book, and nothing else
 *  selected  a chosen set of books, and nothing else
 *  library   every imported book, and nothing else
 *  with_labo Labo's own knowledge plus every imported book
 *
 * The first four exclude Labo's authored knowledge, which is what makes
 * "answer only from this book" a real guarantee rather than a preference.
 */
export type BookMode = 'off' | 'book' | 'selected' | 'library' | 'with_labo';

export interface BookScope {
  mode: BookMode;
  /** Book ids for 'book' and 'selected'. */
  bookIds: string[];
}

export interface BookHit {
  chunk: BookChunk;
  book: Book;
  section?: BookSection;
  score: number;
  /** Which query terms matched. */
  matched: string[];
}

export interface BookAnswer {
  /** Composed reply text. Paraphrase plus short quoted evidence. */
  text: string;
  /** Citations in the order they are referenced in `text`. */
  citations: BookCitation[];
  hits: BookHit[];
  knowledge: BookKnowledgeItem[];
  /** False when nothing relevant was found in scope. */
  grounded: boolean;
}

export interface BookCitation {
  bookId: string;
  bookTitle: string;
  author?: string;
  chapter?: string;
  pageStart: number;
  pageEnd: number;
  chunkId: string;
}

/** One book's answer to a comparison question. */
export interface BookStance {
  book: Book;
  hits: BookHit[];
  knowledge: BookKnowledgeItem[];
  /** The most representative passage found in that book. */
  summary: string;
  citations: BookCitation[];
}

export interface BookConflict {
  concept: string;
  a: { bookId: string; bookTitle: string; content: string; citation: BookCitation };
  b: { bookId: string; bookTitle: string; content: string; citation: BookCitation };
  /** Why the two were judged to disagree. */
  note: string;
}
