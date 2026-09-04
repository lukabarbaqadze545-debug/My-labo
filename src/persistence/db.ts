import Dexie, { type Table } from 'dexie';
import type { Difficulty, Subject, Topic } from '@/content';

/**
 * All personal data lives locally in IndexedDB. There is no account and no
 * server: onboarding answers, notes, bookmarks and reading history never leave
 * the device. That is a product decision (the brief asks for no forced
 * registration) as much as a technical one.
 */

export interface UserNote {
  id: string;
  /** observation | question | idea | hypothesis | note */
  kind: 'observation' | 'question' | 'idea' | 'hypothesis' | 'note';
  title?: string;
  body: string;
  /** Optional anchor to a topic, subject, formula… */
  topicId?: string;
  subjectId?: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  /** Set when the note is a question the user considers answered. */
  resolvedAt?: number;
}

export interface Bookmark {
  id: string;
  entityId: string;
  entityKind: 'topic' | 'formula' | 'fact' | 'person' | 'event' | 'activity' | 'research';
  /** Snapshot of the label so saved research survives a cache clear. */
  label: string;
  href: string;
  subjectId?: string;
  createdAt: number;
}

export interface UserQuestion {
  id: string;
  text: string;
  subjectId?: string;
  linkedTopicIds?: string[];
  createdAt: number;
  answeredAt?: number;
  answerNote?: string;
}

export interface InteractionRecord {
  id?: number;
  subjectId?: string;
  topicId?: string;
  type: 'view' | 'activity' | 'bookmark' | 'note' | 'search';
  at: number;
}

export interface ActivityProgress {
  activityId: string;
  /** The user's own words, for predict-type activities. */
  prediction?: string;
  completedAt?: number;
  /** Free-form per-activity state (quiz answers, ordering, etc.). */
  state?: unknown;
  updatedAt: number;
}

export interface Preferences {
  key: 'main';
  onboarded: boolean;
  grade?: string;
  favouriteSubjects: string[];
  improveSubjects: string[];
  preferredDifficulty: Difficulty;
  theme: 'dark' | 'light' | 'system';
  locale: 'ka' | 'en';
  nasaApiKey?: string;
  /** Sent to OpenAlex's polite pool when the user opts in. */
  contactEmail?: string;
  updatedAt: number;
}

/** User-authored subjects, merged over the bundled library at read time. */
export interface UserSubject extends Subject {
  createdAt: number;
  updatedAt: number;
}

/** Overrides for bundled subjects — rename, recolour, hide. */
export interface SubjectOverride {
  subjectId: string;
  nameKa?: string;
  hue?: number;
  glyph?: string;
  hidden?: boolean;
  pinned?: boolean;
  updatedAt: number;
}

export interface UserTopic extends Omit<Topic, 'sections'> {
  /** User topics use plain prose rather than the authored block system. */
  body: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------- pomodoro -------------------------------- */

export type PomodoroPhase = 'focus' | 'short' | 'long';

/**
 * One recorded focus interval. Breaks are not stored — the analytics only care
 * about focused time. A session ended early keeps `completed: false` and the
 * partial `actualMs`, so "how often do I bail" is answerable.
 */
export interface PomodoroSession {
  id: string;
  startedAt: number;
  endedAt: number;
  /** The duration the timer was set to run for. */
  plannedMs: number;
  /** Actual focused milliseconds (equals plannedMs for a full run). */
  actualMs: number;
  completed: boolean;
  /** Local calendar day, `YYYY-MM-DD`, for grouping without timezone drift. */
  dateKey: string;
  subjectId?: string;
  topicId?: string;
  label?: string;
}

/* ------------------------------- documents ------------------------------ */

/**
 * A rich-text document authored in the writing room. `doc` is the editor's
 * ProseMirror JSON; `text` and `wordCount` are denormalised snapshots kept for
 * previews, search and the status bar without re-parsing the tree.
 */
export interface UserDocument {
  id: string;
  title: string;
  doc: unknown;
  text: string;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  subjectId?: string;
  /** Set while the doc is in the trash; cleared on restore. */
  trashedAt?: number;
}

export interface PomodoroSettings {
  key: 'main';
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** Focus intervals between long breaks. */
  cycleLength: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  /** Daily target, in completed focus intervals. */
  dailyGoal: number;
  sound: boolean;
  notifications: boolean;
  updatedAt: number;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  key: 'main',
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  cycleLength: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  dailyGoal: 8,
  sound: true,
  notifications: false,
  updatedAt: 0,
};

/* ---------------------------------- ai ---------------------------------- */

export const AI_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const;
export type AiModel = (typeof AI_MODELS)[number];

/**
 * Optional "bring your own key" AI. The key is stored only in this browser's
 * IndexedDB and used to call Anthropic directly from the page — nothing passes
 * through any server of ours. Off by default; the library assistant works
 * fully without it.
 */
export interface AiSettings {
  key: 'main';
  enabled: boolean;
  apiKey?: string;
  model: AiModel;
  /** Auto-capture durable facts about the user from the conversation. */
  memory: boolean;
  updatedAt: number;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  key: 'main',
  enabled: false,
  model: 'claude-opus-5',
  memory: true,
  updatedAt: 0,
};

/** One turn inside a saved conversation. */
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  meta?: {
    sources?: { label: string; href: string }[];
    related?: { label: string; href: string }[];
    followUps?: string[];
    note?: string;
  };
}

/** A named conversation with the assistant. Messages live inline. */
export interface AiThread {
  id: string;
  title: string;
  messages: AiMessage[];
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
}

/** A durable fact the assistant should remember about the user across chats. */
export interface AiMemory {
  id: string;
  text: string;
  kind: 'manual' | 'auto';
  createdAt: number;
}

export class LaboDatabase extends Dexie {
  notes!: Table<UserNote, string>;
  bookmarks!: Table<Bookmark, string>;
  questions!: Table<UserQuestion, string>;
  interactions!: Table<InteractionRecord, number>;
  activityProgress!: Table<ActivityProgress, string>;
  preferences!: Table<Preferences, string>;
  userSubjects!: Table<UserSubject, string>;
  subjectOverrides!: Table<SubjectOverride, string>;
  userTopics!: Table<UserTopic, string>;
  pomodoroSessions!: Table<PomodoroSession, string>;
  pomodoroSettings!: Table<PomodoroSettings, string>;
  documents!: Table<UserDocument, string>;
  aiSettings!: Table<AiSettings, string>;
  aiThreads!: Table<AiThread, string>;
  aiMemories!: Table<AiMemory, string>;

  constructor() {
    super('lukas-labo');
    this.version(1).stores({
      notes: 'id, kind, topicId, subjectId, createdAt, updatedAt',
      bookmarks: 'id, entityId, entityKind, subjectId, createdAt',
      questions: 'id, subjectId, createdAt, answeredAt',
      interactions: '++id, subjectId, topicId, type, at',
      activityProgress: 'activityId, completedAt, updatedAt',
      preferences: 'key',
      userSubjects: 'id, group, createdAt',
      subjectOverrides: 'subjectId',
      userTopics: 'id, subjectId, createdAt',
    });
    this.version(2).stores({
      notes: 'id, kind, topicId, subjectId, createdAt, updatedAt',
      bookmarks: 'id, entityId, entityKind, subjectId, createdAt',
      questions: 'id, subjectId, createdAt, answeredAt',
      interactions: '++id, subjectId, topicId, type, at',
      activityProgress: 'activityId, completedAt, updatedAt',
      preferences: 'key',
      userSubjects: 'id, group, createdAt',
      subjectOverrides: 'subjectId',
      userTopics: 'id, subjectId, createdAt',
      pomodoroSessions: 'id, startedAt, dateKey, subjectId',
      pomodoroSettings: 'key',
    });
    this.version(3).stores({
      notes: 'id, kind, topicId, subjectId, createdAt, updatedAt',
      bookmarks: 'id, entityId, entityKind, subjectId, createdAt',
      questions: 'id, subjectId, createdAt, answeredAt',
      interactions: '++id, subjectId, topicId, type, at',
      activityProgress: 'activityId, completedAt, updatedAt',
      preferences: 'key',
      userSubjects: 'id, group, createdAt',
      subjectOverrides: 'subjectId',
      userTopics: 'id, subjectId, createdAt',
      pomodoroSessions: 'id, startedAt, dateKey, subjectId',
      pomodoroSettings: 'key',
      documents: 'id, updatedAt, subjectId, trashedAt',
    });
    this.version(4).stores({
      notes: 'id, kind, topicId, subjectId, createdAt, updatedAt',
      bookmarks: 'id, entityId, entityKind, subjectId, createdAt',
      questions: 'id, subjectId, createdAt, answeredAt',
      interactions: '++id, subjectId, topicId, type, at',
      activityProgress: 'activityId, completedAt, updatedAt',
      preferences: 'key',
      userSubjects: 'id, group, createdAt',
      subjectOverrides: 'subjectId',
      userTopics: 'id, subjectId, createdAt',
      pomodoroSessions: 'id, startedAt, dateKey, subjectId',
      pomodoroSettings: 'key',
      documents: 'id, updatedAt, subjectId, trashedAt',
      aiSettings: 'key',
    });
    this.version(5).stores({
      notes: 'id, kind, topicId, subjectId, createdAt, updatedAt',
      bookmarks: 'id, entityId, entityKind, subjectId, createdAt',
      questions: 'id, subjectId, createdAt, answeredAt',
      interactions: '++id, subjectId, topicId, type, at',
      activityProgress: 'activityId, completedAt, updatedAt',
      preferences: 'key',
      userSubjects: 'id, group, createdAt',
      subjectOverrides: 'subjectId',
      userTopics: 'id, subjectId, createdAt',
      pomodoroSessions: 'id, startedAt, dateKey, subjectId',
      pomodoroSettings: 'key',
      documents: 'id, updatedAt, subjectId, trashedAt',
      aiSettings: 'key',
      aiThreads: 'id, updatedAt, createdAt, pinned',
      aiMemories: 'id, createdAt, kind',
    });
  }
}

export const db = new LaboDatabase();

export const DEFAULT_PREFERENCES: Preferences = {
  key: 'main',
  onboarded: false,
  favouriteSubjects: [],
  improveSubjects: [],
  preferredDifficulty: 2,
  theme: 'system',
  locale: 'ka',
  updatedAt: 0,
};

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
