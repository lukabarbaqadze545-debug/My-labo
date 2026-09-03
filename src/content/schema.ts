/**
 * Content schema for Luka's Labo.
 *
 * Everything educational is *data*, never JSX. UI components render these
 * shapes; they never hard-code a topic. This keeps the library able to grow to
 * thousands of entries and makes localisation a data concern rather than a
 * rewrite.
 */

export type LocaleCode = 'ka' | 'en';

/**
 * Every human-visible string. `ka` is required because Georgian is the
 * production language; `en` is optional and filled in progressively.
 */
export interface L10n {
  ka: string;
  en?: string;
}

export type EntityKind =
  | 'subject'
  | 'topic'
  | 'concept'
  | 'formula'
  | 'fact'
  | 'person'
  | 'event'
  | 'question'
  | 'activity'
  | 'note'
  | 'research';

/** 1 = curious beginner, 5 = university level. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * Provenance. Required on anything factual that a reader might want to verify.
 * `kind` lets the UI show *what sort* of authority is behind a claim rather
 * than a bare link.
 */
export interface SourceRef {
  label: string;
  publisher: string;
  url?: string;
  year?: number;
  kind:
    | 'institution'
    | 'encyclopedia'
    | 'journal'
    | 'textbook'
    | 'dataset'
    | 'museum'
    | 'observatory';
}

/* ------------------------------------------------------------------ *
 * Content blocks — the vocabulary a topic page is written in.
 * ------------------------------------------------------------------ */

export type Block =
  | { type: 'paragraph'; text: L10n }
  | { type: 'list'; ordered?: boolean; items: L10n[] }
  | {
      type: 'callout';
      tone: 'insight' | 'question' | 'caution' | 'history';
      title?: L10n;
      text: L10n;
    }
  | { type: 'code'; lang: string; code: string; caption?: L10n }
  | { type: 'formulaRef'; formulaId: string }
  | { type: 'quote'; text: L10n; attribution?: string }
  | { type: 'termList'; items: { term: L10n; def: L10n }[] }
  /** Renders a named built-in visual/simulation component. */
  | { type: 'figure'; figure: string; caption?: L10n };

/** The canonical section order of a rich topic page. */
export type SectionKind =
  | 'whatIs'
  | 'whyInteresting'
  | 'keyIdeas'
  | 'formulas'
  | 'history'
  | 'currentResearch';

export interface TopicSection {
  kind: SectionKind;
  blocks: Block[];
}

/* ------------------------------------------------------------------ *
 * Core entities
 * ------------------------------------------------------------------ */

/** Visual identity per lab, so each room feels different. */
export interface SubjectTheme {
  /** Base hue in degrees — drives accent, glow and chart colours. */
  hue: number;
  /** Background character of the lab header. */
  atmosphere: 'deep-space' | 'grid' | 'organic' | 'mineral' | 'archive' | 'circuit' | 'paper';
  glyph: string;
}

export type SubjectGroup =
  | 'exact'
  | 'natural'
  | 'technology'
  | 'humanities'
  | 'language'
  | 'custom';

export interface Subject {
  id: string;
  name: L10n;
  tagline: L10n;
  group: SubjectGroup;
  theme: SubjectTheme;
  /** Named lab modules this subject offers, e.g. 'periodicTable'. */
  modules?: string[];
  /** OpenAlex field/topic ids used to pull live research for this lab. */
  researchFields?: string[];
  /** User-created subjects are editable and stored locally. */
  userCreated?: boolean;
  order?: number;
}

export interface Topic {
  id: string;
  subjectId: string;
  title: L10n;
  /** One-sentence hook shown on cards. Not a definition — a reason to care. */
  hook: L10n;
  difficulty: Difficulty;
  sections: TopicSection[];
  factIds?: string[];
  formulaIds?: string[];
  personIds?: string[];
  eventIds?: string[];
  activityIds?: string[];
  /** OpenAlex concept/topic ids for the "what are people researching now" pane. */
  researchQuery?: { field?: string; search?: string };
  sources?: SourceRef[];
  tags?: string[];
  /** Marks a topic as visually featured material. */
  spotlight?: boolean;
}

export interface Concept {
  id: string;
  subjectId: string;
  term: L10n;
  definition: L10n;
  topicId?: string;
}

export interface FormulaVariable {
  symbol: string;
  meaning: L10n;
  unit?: string;
}

export interface Formula {
  id: string;
  subjectId: string;
  name: L10n;
  /** Plain-text/unicode rendering. Deliberately not LaTeX: renders offline,
   *  is searchable as text, and stays legible next to Georgian type. */
  expression: string;
  variables: FormulaVariable[];
  explanation: L10n;
  example?: L10n;
  category: 'mathematics' | 'physics' | 'chemistry' | 'statistics' | 'engineering' | 'computing';
  difficulty: Difficulty;
  relatedFormulaIds?: string[];
  topicIds?: string[];
  sources?: SourceRef[];
}

export interface Fact {
  id: string;
  subjectId: string;
  text: L10n;
  /** Why this is more than trivia — the idea it teaches. */
  why?: L10n;
  difficulty: Difficulty;
  topicIds?: string[];
  source: SourceRef;
  tags?: string[];
}

export interface Person {
  id: string;
  subjectId: string;
  name: L10n;
  lived: string;
  known: L10n;
  story: L10n;
  topicIds?: string[];
  sources?: SourceRef[];
}

export interface HistoricalEvent {
  id: string;
  subjectId: string;
  title: L10n;
  year: number;
  /** 1-12 / 1-31 when known — powers „ამ დღეს ისტორიაში". */
  month?: number;
  day?: number;
  era?: L10n;
  summary: L10n;
  /** Cause → event → consequence, the reason history is not a date list. */
  cause?: L10n;
  consequence?: L10n;
  place?: L10n;
  region?: 'georgia' | 'world' | 'science';
  topicIds?: string[];
  sources?: SourceRef[];
}

export interface SeedQuestion {
  id: string;
  text: L10n;
  subjectId?: string;
  topicIds?: string[];
}

/* ------------------------------------------------------------------ *
 * Activities — the "I want to do something" layer.
 * ------------------------------------------------------------------ */

export interface QuizOption {
  text: L10n;
  correct?: boolean;
}

export type ActivityBody =
  | {
      kind: 'quiz';
      questions: { prompt: L10n; options: QuizOption[]; explain: L10n }[];
    }
  /** Write your prediction first, then reveal. The APE pattern. */
  | { kind: 'predict'; prompt: L10n; hint?: L10n; reveal: L10n }
  /** Mount a named interactive simulation component. */
  | { kind: 'sim'; sim: string; prompt?: L10n }
  /** Drag-free classification: assign each item to a bucket. */
  | {
      kind: 'classify';
      buckets: { id: string; label: L10n }[];
      items: { id: string; label: L10n; bucketId: string; explain?: L10n }[];
    }
  /** Put items into the right order — timelines, algorithm steps, processes. */
  | { kind: 'order'; instruction: L10n; items: { id: string; label: L10n }[]; explain?: L10n }
  /** Estimate a number; graded with tolerance. */
  | {
      kind: 'estimate';
      prompt: L10n;
      answer: number;
      unit?: string;
      tolerance: number;
      explain: L10n;
    };

export interface Activity {
  id: string;
  subjectId: string;
  topicId?: string;
  title: L10n;
  /** Verb-first invitation, e.g. „იწინასწარმეტყველე". */
  invitation: L10n;
  difficulty: Difficulty;
  body: ActivityBody;
  estimatedMinutes?: number;
}

/* ------------------------------------------------------------------ *
 * Knowledge graph
 * ------------------------------------------------------------------ */

export type RelationKind =
  | 'leadsTo'
  | 'explains'
  | 'requires'
  | 'contrasts'
  | 'discoveredBy'
  | 'appliesTo'
  | 'partOf';

export interface Relationship {
  from: string;
  to: string;
  kind: RelationKind;
  /** Optional gloss shown on the edge, e.g. „აზოგადებს". */
  note?: L10n;
}

/** A node reference used when traversing the graph across entity types. */
export interface GraphRef {
  id: string;
  kind: EntityKind;
}
