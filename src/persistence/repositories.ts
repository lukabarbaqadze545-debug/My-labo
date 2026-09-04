import {
  db,
  newId,
  DEFAULT_PREFERENCES,
  DEFAULT_POMODORO_SETTINGS,
  DEFAULT_AI_SETTINGS,
  type AiSettings,
  type AiThread,
  type AiMessage,
  type AiMemory,
  type ActivityProgress,
  type Bookmark,
  type InteractionRecord,
  type PomodoroSession,
  type PomodoroSettings,
  type Preferences,
  type UserDocument,
  type SubjectOverride,
  type UserNote,
  type UserQuestion,
  type UserSubject,
  type UserTopic,
} from './db';
import type { Subject } from '@/content';

/**
 * Repository layer. React components talk to these functions, never to Dexie
 * directly, so persistence can be swapped or mocked and so the write-side
 * invariants (timestamps, interaction logging) live in one place.
 */

/* ------------------------------- preferences ------------------------------ */

export async function getPreferences(): Promise<Preferences> {
  const stored = await db.preferences.get('main');
  return stored ?? DEFAULT_PREFERENCES;
}

export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const current = await getPreferences();
  const next: Preferences = { ...current, ...patch, key: 'main', updatedAt: Date.now() };
  await db.preferences.put(next);
  return next;
}

/* ---------------------------------- notes --------------------------------- */

export async function listNotes(): Promise<UserNote[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray();
}

export async function createNote(input: Omit<UserNote, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserNote> {
  const now = Date.now();
  const note: UserNote = { ...input, id: newId('note'), createdAt: now, updatedAt: now };
  await db.notes.add(note);
  await recordInteraction({
    type: 'note',
    at: now,
    ...(note.subjectId ? { subjectId: note.subjectId } : {}),
    ...(note.topicId ? { topicId: note.topicId } : {}),
  });
  return note;
}

export async function updateNote(id: string, patch: Partial<UserNote>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

export async function notesForTopic(topicId: string): Promise<UserNote[]> {
  return db.notes.where('topicId').equals(topicId).reverse().sortBy('updatedAt');
}

/* -------------------------------- bookmarks ------------------------------- */

export async function listBookmarks(): Promise<Bookmark[]> {
  return db.bookmarks.orderBy('createdAt').reverse().toArray();
}

export async function isBookmarked(entityId: string): Promise<boolean> {
  const count = await db.bookmarks.where('entityId').equals(entityId).count();
  return count > 0;
}

/** Returns the new state so callers can update optimistic UI. */
export async function toggleBookmark(input: Omit<Bookmark, 'id' | 'createdAt'>): Promise<boolean> {
  const existing = await db.bookmarks.where('entityId').equals(input.entityId).first();
  if (existing) {
    await db.bookmarks.delete(existing.id);
    return false;
  }
  const bookmark: Bookmark = { ...input, id: newId('bm'), createdAt: Date.now() };
  await db.bookmarks.add(bookmark);
  await recordInteraction({
    type: 'bookmark',
    at: bookmark.createdAt,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
  });
  return true;
}

/* -------------------------------- questions ------------------------------- */

export async function listQuestions(): Promise<UserQuestion[]> {
  return db.questions.orderBy('createdAt').reverse().toArray();
}

export async function createQuestion(
  input: Omit<UserQuestion, 'id' | 'createdAt'>,
): Promise<UserQuestion> {
  const question: UserQuestion = { ...input, id: newId('q'), createdAt: Date.now() };
  await db.questions.add(question);
  await recordInteraction({
    type: 'note',
    at: question.createdAt,
    ...(question.subjectId ? { subjectId: question.subjectId } : {}),
  });
  return question;
}

export async function updateQuestion(id: string, patch: Partial<UserQuestion>): Promise<void> {
  await db.questions.update(id, patch);
}

export async function deleteQuestion(id: string): Promise<void> {
  await db.questions.delete(id);
}

/* ------------------------------ interactions ------------------------------ */

export async function recordInteraction(record: Omit<InteractionRecord, 'id'>): Promise<void> {
  try {
    await db.interactions.add(record as InteractionRecord);
    // Keep the log bounded — the interest profile only needs recent signal.
    const count = await db.interactions.count();
    if (count > 800) {
      const oldest = await db.interactions.orderBy('at').limit(count - 600).primaryKeys();
      await db.interactions.bulkDelete(oldest as number[]);
    }
  } catch {
    // Interaction logging must never break navigation.
  }
}

export async function listInteractions(): Promise<InteractionRecord[]> {
  return db.interactions.orderBy('at').reverse().limit(600).toArray();
}

export async function clearInteractions(): Promise<void> {
  await db.interactions.clear();
}

/* --------------------------- activity progress ---------------------------- */

export async function getActivityProgress(activityId: string): Promise<ActivityProgress | undefined> {
  return db.activityProgress.get(activityId);
}

export async function saveActivityProgress(
  activityId: string,
  patch: Partial<Omit<ActivityProgress, 'activityId' | 'updatedAt'>>,
): Promise<void> {
  const existing = await db.activityProgress.get(activityId);
  await db.activityProgress.put({
    activityId,
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function listActivityProgress(): Promise<ActivityProgress[]> {
  return db.activityProgress.toArray();
}

/* ----------------------------- user content ------------------------------- */

export async function listUserSubjects(): Promise<UserSubject[]> {
  return db.userSubjects.toArray();
}

export async function createUserSubject(
  input: Pick<Subject, 'name' | 'tagline' | 'theme'> & Partial<Subject>,
): Promise<UserSubject> {
  const now = Date.now();
  const subject: UserSubject = {
    id: newId('subj'),
    group: 'custom',
    modules: [],
    ...input,
    userCreated: true,
    order: 900,
    createdAt: now,
    updatedAt: now,
  };
  await db.userSubjects.add(subject);
  return subject;
}

export async function updateUserSubject(id: string, patch: Partial<UserSubject>): Promise<void> {
  await db.userSubjects.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteUserSubject(id: string): Promise<void> {
  await db.userSubjects.delete(id);
  await db.userTopics.where('subjectId').equals(id).delete();
}

export async function listSubjectOverrides(): Promise<SubjectOverride[]> {
  return db.subjectOverrides.toArray();
}

export async function saveSubjectOverride(
  subjectId: string,
  patch: Partial<Omit<SubjectOverride, 'subjectId' | 'updatedAt'>>,
): Promise<void> {
  const existing = await db.subjectOverrides.get(subjectId);
  await db.subjectOverrides.put({ subjectId, ...existing, ...patch, updatedAt: Date.now() });
}

export async function clearSubjectOverride(subjectId: string): Promise<void> {
  await db.subjectOverrides.delete(subjectId);
}

export async function listUserTopics(): Promise<UserTopic[]> {
  return db.userTopics.toArray();
}

export async function createUserTopic(
  input: Pick<UserTopic, 'subjectId' | 'title' | 'hook' | 'body'> & Partial<UserTopic>,
): Promise<UserTopic> {
  const now = Date.now();
  const topic: UserTopic = {
    id: newId('topic'),
    difficulty: 2,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  await db.userTopics.add(topic);
  return topic;
}

export async function updateUserTopic(id: string, patch: Partial<UserTopic>): Promise<void> {
  await db.userTopics.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteUserTopic(id: string): Promise<void> {
  await db.userTopics.delete(id);
}

/* -------------------------------- pomodoro -------------------------------- */

export async function getPomodoroSettings(): Promise<PomodoroSettings> {
  try {
    const stored = await db.pomodoroSettings.get('main');
    return { ...DEFAULT_POMODORO_SETTINGS, ...stored, key: 'main' };
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

export async function savePomodoroSettings(
  patch: Partial<Omit<PomodoroSettings, 'key' | 'updatedAt'>>,
): Promise<PomodoroSettings> {
  const current = await getPomodoroSettings();
  const next: PomodoroSettings = { ...current, ...patch, key: 'main', updatedAt: Date.now() };
  await db.pomodoroSettings.put(next);
  return next;
}

/**
 * The id is derived from `startedAt`, so a completion that the engine
 * reconciles twice (e.g. a StrictMode double-invoke) is idempotent: the second
 * `add` fails on the existing key and is swallowed.
 */
export async function recordPomodoroSession(input: Omit<PomodoroSession, 'id'>): Promise<void> {
  const session: PomodoroSession = { ...input, id: `pomo_${input.startedAt}` };
  try {
    await db.pomodoroSessions.add(session);
  } catch {
    return; // already recorded
  }
  await recordInteraction({
    type: 'activity',
    at: session.endedAt,
    ...(session.subjectId ? { subjectId: session.subjectId } : {}),
    ...(session.topicId ? { topicId: session.topicId } : {}),
  });
}

export async function listPomodoroSessions(): Promise<PomodoroSession[]> {
  try {
    return await db.pomodoroSessions.orderBy('startedAt').toArray();
  } catch {
    return [];
  }
}

export async function clearPomodoroSessions(): Promise<void> {
  await db.pomodoroSessions.clear();
}

/* ----------------------------------- ai ---------------------------------- */

export async function getAiSettings(): Promise<AiSettings> {
  try {
    const stored = await db.aiSettings.get('main');
    return { ...DEFAULT_AI_SETTINGS, ...stored, key: 'main' };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export async function saveAiSettings(
  patch: Partial<Omit<AiSettings, 'key' | 'updatedAt'>>,
): Promise<AiSettings> {
  const current = await getAiSettings();
  const next: AiSettings = { ...current, ...patch, key: 'main', updatedAt: Date.now() };
  await db.aiSettings.put(next);
  return next;
}

/* ------------------------------ ai threads ------------------------------- */

export async function listThreads(): Promise<AiThread[]> {
  try {
    const all = await db.aiThreads.orderBy('updatedAt').reverse().toArray();
    return all.sort((a, b) => Number(b.pinned ?? 0) - Number(a.pinned ?? 0));
  } catch {
    return [];
  }
}

export async function getThread(id: string): Promise<AiThread | undefined> {
  try {
    return await db.aiThreads.get(id);
  } catch {
    return undefined;
  }
}

export async function createThread(title: string, messages: AiMessage[] = []): Promise<AiThread> {
  const now = Date.now();
  const thread: AiThread = { id: newId('thr'), title, messages, createdAt: now, updatedAt: now };
  await db.aiThreads.add(thread);
  return thread;
}

export async function updateThread(
  id: string,
  patch: Partial<Pick<AiThread, 'title' | 'messages' | 'pinned'>>,
): Promise<void> {
  await db.aiThreads.update(id, { ...patch, updatedAt: Date.now() });
}

export async function renameThread(id: string, title: string): Promise<void> {
  await db.aiThreads.update(id, { title: title.trim() || 'უსათაურო', updatedAt: Date.now() });
}

export async function deleteThread(id: string): Promise<void> {
  await db.aiThreads.delete(id);
}

/* ------------------------------ ai memory ------------------------------- */

/** Loose duplicate guard: same text after lowering case and stripping punctuation. */
function memKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export async function listMemories(): Promise<AiMemory[]> {
  try {
    return await db.aiMemories.orderBy('createdAt').toArray();
  } catch {
    return [];
  }
}

export async function addMemory(text: string, kind: AiMemory['kind']): Promise<AiMemory | null> {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length < 4 || clean.length > 240) return null;
  const existing = await listMemories();
  const key = memKey(clean);
  if (existing.some((m) => memKey(m.text) === key)) return null;
  if (existing.length >= 60) return null;
  const memory: AiMemory = { id: newId('mem'), text: clean, kind, createdAt: Date.now() };
  await db.aiMemories.add(memory);
  return memory;
}

export async function deleteMemory(id: string): Promise<void> {
  await db.aiMemories.delete(id);
}

export async function clearMemories(): Promise<void> {
  await db.aiMemories.clear();
}

/* -------------------------------- documents ------------------------------- */

export async function listDocuments(): Promise<UserDocument[]> {
  try {
    const all = await db.documents.orderBy('updatedAt').reverse().toArray();
    return all.filter((d) => !d.trashedAt);
  } catch {
    return [];
  }
}

export async function listTrashedDocuments(): Promise<UserDocument[]> {
  try {
    const all = await db.documents.orderBy('updatedAt').reverse().toArray();
    return all.filter((d) => d.trashedAt);
  } catch {
    return [];
  }
}

export async function getDocument(id: string): Promise<UserDocument | undefined> {
  return db.documents.get(id);
}

export async function createDocument(
  input: Partial<Pick<UserDocument, 'title' | 'doc' | 'text' | 'wordCount' | 'subjectId'>> = {},
): Promise<UserDocument> {
  const now = Date.now();
  const doc: UserDocument = {
    id: newId('doc'),
    title: input.title ?? 'უსათაურო დოკუმენტი',
    doc: input.doc ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    text: input.text ?? '',
    wordCount: input.wordCount ?? 0,
    createdAt: now,
    updatedAt: now,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
  };
  await db.documents.add(doc);
  await recordInteraction({ type: 'note', at: now, ...(doc.subjectId ? { subjectId: doc.subjectId } : {}) });
  return doc;
}

export async function updateDocument(
  id: string,
  patch: Partial<Omit<UserDocument, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  await db.documents.update(id, { ...patch, updatedAt: Date.now() });
}

export async function trashDocument(id: string): Promise<void> {
  await db.documents.update(id, { trashedAt: Date.now(), updatedAt: Date.now() });
}

export async function restoreDocument(id: string): Promise<void> {
  const doc = await db.documents.get(id);
  if (!doc) return;
  const { trashedAt: _drop, ...rest } = doc;
  await db.documents.put({ ...rest, updatedAt: Date.now() });
}

export async function deleteDocumentForever(id: string): Promise<void> {
  await db.documents.delete(id);
}

export async function duplicateDocument(id: string): Promise<UserDocument | undefined> {
  const src = await db.documents.get(id);
  if (!src) return undefined;
  return createDocument({
    title: `${src.title} (ასლი)`,
    doc: src.doc,
    text: src.text,
    wordCount: src.wordCount,
    ...(src.subjectId ? { subjectId: src.subjectId } : {}),
  });
}

/* --------------------------------- export --------------------------------- */

/** Full local export — the user owns their data and can take it with them. */
export async function exportAllData(): Promise<string> {
  const [notes, bookmarks, questions, preferences, userSubjects, userTopics, progress, pomodoroSessions, pomodoroSettings] =
    await Promise.all([
      db.notes.toArray(),
      db.bookmarks.toArray(),
      db.questions.toArray(),
      getPreferences(),
      db.userSubjects.toArray(),
      db.userTopics.toArray(),
      db.activityProgress.toArray(),
      db.pomodoroSessions.toArray(),
      getPomodoroSettings(),
    ]);
  const documents = await db.documents.toArray();
  const ai = await getAiSettings();
  return JSON.stringify(
    {
      version: 4,
      exportedAt: new Date().toISOString(),
      // The API key is deliberately omitted — an export is often shared.
      ai: { enabled: ai.enabled, model: ai.model },
      notes,
      bookmarks,
      questions,
      preferences,
      userSubjects,
      userTopics,
      progress,
      pomodoroSessions,
      pomodoroSettings,
      documents,
    },
    null,
    2,
  );
}
