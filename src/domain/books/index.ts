export * from './types';
export { extractPdf, BookExtractionError } from './extract';
export { cleanPages, pageQuality, type CleanedPage, type CleanResult } from './clean';
export {
  toLines,
  detectHeadings,
  buildSections,
  buildSectionsFromHeads,
  buildParagraphs,
  type Paragraph,
  type PositionedLine,
  type DetectedHeading,
} from './structure';
export { buildChunks, chunkTerms } from './chunk';
export { extractKnowledge, assignConcept, splitSentences, pagesForSentence } from './knowledge';
export {
  buildIndex,
  scoreChunk,
  booksInScope,
  isBookExclusive,
  retrieveFromBooks,
  type BookCorpus,
  type BookIndex,
  type BookRetrieval,
} from './retrieve';
export {
  answerFromBooks,
  citationOf,
  formatCitation,
  relevantExcerpt,
} from './answer';
export {
  compareBooks,
  renderComparison,
  detectConflicts,
  answerOrCompare,
} from './compare';
export { buildPreview, ingestPdf, previewToBook, type IngestOptions } from './pipeline';
