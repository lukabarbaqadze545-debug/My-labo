import type { KnowledgeNodeType, RelationType } from './types';

/** Georgian labels for edges, read in the direction the arrow points. */
export const RELATION_LABEL: Record<RelationType, string> = {
  PART_OF: 'ნაწილია',
  DEPENDS_ON: 'ეყრდნობა',
  PREREQUISITE_OF: 'წინაპირობაა',
  LEADS_TO: 'მიგვიყვანს',
  EXPLAINS: 'ხსნის',
  CONTRASTS: 'უპირისპირდება',
  DISCOVERED_BY: 'უკავშირდება',
  APPLIES_TO: 'გამოიყენება',
  RELATED_TO: 'დაკავშირებულია',
  USED_BY: 'გამოიყენება მასში',
  LEARNED_FROM: 'ნასწავლია წყაროდან',
  INSPIRED_BY: 'შთაგონებულია',
  SIMILAR_TO: 'ჰგავს',
};

export const NODE_TYPE_LABEL: Record<KnowledgeNodeType, string> = {
  subject: 'საგანი',
  topic: 'თემა',
  concept: 'ცნება',
  document: 'დოკუმენტი',
  note: 'ჩანაწერი',
  book: 'წიგნი',
  person: 'ადამიანი',
  formula: 'ფორმულა',
  fact: 'ფაქტი',
  event: 'მოვლენა',
  project: 'პროექტი',
  technology: 'ტექნოლოგია',
  goal: 'მიზანი',
  idea: 'იდეა',
};

/** One glyph per type, matching the app's existing navigation iconography. */
export const NODE_TYPE_GLYPH: Record<KnowledgeNodeType, string> = {
  subject: '⬡',
  topic: '◇',
  concept: '◈',
  document: '✍',
  note: '✎',
  book: '📚',
  person: '☺',
  formula: '∑',
  fact: '💡',
  event: '⌛',
  project: '⚙',
  technology: '⌗',
  goal: '◎',
  idea: '✧',
};
