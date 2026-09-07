import type { ConsequenceKind, ConsequenceLevel, WorldStatus } from '@/domain/worlds';

/** Georgian labels for the world vocabulary, shared by every world view. */

export const STATUS_LABEL: Record<WorldStatus, string> = {
  draft: 'მონახაზი',
  exploring: 'კვლევაში',
  developed: 'გამოკვლეული',
  archived: 'დაარქივებული',
};

export const KIND_LABEL: Record<ConsequenceKind, string> = {
  effect: 'შედეგი',
  breaks: 'რა იშლება',
  enables: 'რა ხდება შესაძლებელი',
  unexpected: 'მოულოდნელი',
};

export const KIND_GLYPH: Record<ConsequenceKind, string> = {
  effect: '→',
  breaks: '✕',
  enables: '+',
  unexpected: '!',
};

export const LEVEL_LABEL: Record<ConsequenceLevel, string> = {
  1: 'პირდაპირი',
  2: 'ირიბი',
  3: 'სისტემური',
};

export const LEVEL_HINT: Record<ConsequenceLevel, string> = {
  1: 'პირდაპირ გამომდინარეობს შეცვლილი წესიდან',
  2: 'გამომდინარეობს პირდაპირი შედეგებიდან',
  3: 'გრძელვადიანი, სტრუქტურული, ცივილიზაციური',
};
