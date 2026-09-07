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
  type UserAlias,
  type UserKnowledge,
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
  type GraphPreferences,
  type ConsequenceRecord,
  type WorldRecord,
  type CtProgressRecord,
  type KnowledgeEdgeRecord,
  type KnowledgeNodeRecord,
  DEFAULT_GRAPH_PREFERENCES,
} from './db';
import type { KnowledgeNodeType, RelationType } from '@/domain/knowledge/types';
import { emptyProgress, type CtStatus } from '@/domain/competitive/types';
import { descendantsOf, wouldCycle } from '@/domain/worlds';
import type {
  Consequence,
  ConsequenceKind,
  ConsequenceLevel,
  ParallelWorld,
  WorldStatus,
} from '@/domain/worlds';
import type { Subject } from '@/content';
import { previewToBook } from '@/domain/books';
import type {
  Book,
  BookChunk,
  BookKnowledgeItem,
  BookRelation,
  BookSection,
  ImportPreview,
} from '@/domain/books';
import type { BookCorpus } from '@/domain/books';
import { mineLanguage, mergeCorpora } from '@/domain/language';
import type { LanguageCorpus } from '@/domain/language';

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
  patch: Partial<Pick<AiThread, 'title' | 'messages' | 'pinned' | 'socratic' | 'packId'>>,
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

/* ------------------------------ teach labo ------------------------------- */

export async function listUserAliases(): Promise<UserAlias[]> {
  try {
    return await db.userAliases.orderBy('createdAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function addUserAlias(
  concept: string,
  label: string,
  forms: readonly string[],
): Promise<UserAlias | null> {
  const clean = [...new Set(forms.map((f) => f.trim().toLowerCase()).filter((f) => f.length >= 2))];
  if (clean.length === 0 || !concept.trim()) return null;
  const alias: UserAlias = {
    id: newId('alias'),
    concept: concept.trim(),
    label: label.trim() || concept.trim(),
    forms: clean,
    createdAt: Date.now(),
  };
  await db.userAliases.add(alias);
  return alias;
}

export async function deleteUserAlias(id: string): Promise<void> {
  await db.userAliases.delete(id);
}

export async function listUserKnowledge(): Promise<UserKnowledge[]> {
  try {
    return await db.userKnowledge.orderBy('createdAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function addUserKnowledge(
  entry: Omit<UserKnowledge, 'id' | 'createdAt'>,
): Promise<UserKnowledge | null> {
  if (!entry.text.trim()) return null;
  const stored: UserKnowledge = {
    ...entry,
    text: entry.text.trim(),
    id: newId('know'),
    createdAt: Date.now(),
  };
  await db.userKnowledge.add(stored);
  return stored;
}

export async function deleteUserKnowledge(id: string): Promise<void> {
  await db.userKnowledge.delete(id);
}

/* --------------------------------- books --------------------------------- */

/**
 * Books are stored once, at import, with their index already built. Nothing is
 * re-parsed on startup: reopening the app reads chunks and knowledge straight
 * out of IndexedDB.
 */
export async function listBooks(): Promise<Book[]> {
  try {
    return await db.books.orderBy('importedAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function getBook(id: string): Promise<Book | undefined> {
  try {
    return await db.books.get(id);
  } catch {
    return undefined;
  }
}

/** Commit a reviewed preview. Nothing reaches storage before this is called. */
export async function commitBook(preview: ImportPreview): Promise<Book> {
  const importedAt = Date.now();
  const bookId = preview.sections[0]?.bookId ?? preview.chunks[0]?.bookId ?? newId('book');
  const book = previewToBook(preview, bookId, importedAt);

  await db.transaction(
    'rw',
    [db.books, db.bookSections, db.bookChunks, db.bookKnowledge, db.bookRelations],
    async () => {
      await db.books.put(book);
      await db.bookSections.bulkPut(preview.sections);
      await db.bookChunks.bulkPut(preview.chunks);
      await db.bookKnowledge.bulkPut(preview.knowledge);
      await db.bookRelations.bulkPut(preview.relations);
    },
  );

  // Learn the *language* of the source as well as its claims. This is what
  // lets a connective found in a philosophy anthology be used later in an
  // explanation of binary search. It runs outside the transaction because a
  // mining failure must never lose an otherwise good import.
  try {
    await learnLanguageFrom(preview.chunks.map((c) => c.text).join('\n\n'), bookId);
  } catch (err) {
    console.warn('language mining failed for', bookId, err);
  }

  return book;
}

/* ---------------------------- language layer ----------------------------- */

/**
 * General Georgian mined from imported sources.
 *
 * Kept separate from book knowledge: deleting a book removes what it *said*,
 * but the language learned from it stays, because grammar is not the book's
 * property and is used by every subject.
 */
export async function getLanguageCorpus(): Promise<LanguageCorpus | null> {
  try {
    return (await db.languageCorpus.get('main'))?.corpus ?? null;
  } catch {
    return null;
  }
}

export async function learnLanguageFrom(text: string, sourceId: string): Promise<LanguageCorpus> {
  const mined = mineLanguage(text, { sourceId });
  const existing = await getLanguageCorpus();
  const merged = existing ? mergeCorpora([existing, mined]) : mined;
  await db.languageCorpus.put({ key: 'main', corpus: merged });
  return merged;
}

/** Remove a book and everything derived from it. */
export async function deleteBook(bookId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.books, db.bookSections, db.bookChunks, db.bookKnowledge, db.bookRelations],
    async () => {
      await db.books.delete(bookId);
      await db.bookSections.where('bookId').equals(bookId).delete();
      await db.bookChunks.where('bookId').equals(bookId).delete();
      await db.bookKnowledge.where('bookId').equals(bookId).delete();
      await db.bookRelations.where('bookId').equals(bookId).delete();
    },
  );
}

/** Exclude a book from retrieval without discarding the import. */
export async function setBookDisabled(bookId: string, disabled: boolean): Promise<void> {
  await db.books.update(bookId, { disabled });
}

/** Everything the retriever needs, read once and cached by the caller. */
export async function loadBookCorpus(): Promise<BookCorpus> {
  try {
    const [books, sections, chunks, knowledge] = await Promise.all([
      db.books.toArray(),
      db.bookSections.toArray(),
      db.bookChunks.toArray(),
      db.bookKnowledge.toArray(),
    ]);
    return { books, sections, chunks, knowledge };
  } catch {
    return { books: [], sections: [], chunks: [], knowledge: [] };
  }
}

export async function bookRelations(bookId: string): Promise<BookRelation[]> {
  try {
    return await db.bookRelations.where('bookId').equals(bookId).toArray();
  } catch {
    return [];
  }
}

/** Portable snapshot of one book, so a processed import can be moved. */
export async function exportBook(bookId: string): Promise<{
  book: Book;
  sections: BookSection[];
  chunks: BookChunk[];
  knowledge: BookKnowledgeItem[];
  relations: BookRelation[];
} | null> {
  const book = await getBook(bookId);
  if (!book) return null;
  const [sections, chunks, knowledge, relations] = await Promise.all([
    db.bookSections.where('bookId').equals(bookId).toArray(),
    db.bookChunks.where('bookId').equals(bookId).toArray(),
    db.bookKnowledge.where('bookId').equals(bookId).toArray(),
    db.bookRelations.where('bookId').equals(bookId).toArray(),
  ]);
  return { book, sections, chunks, knowledge, relations };
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

/* --------------------------- knowledge graph ----------------------------- */

/**
 * Storage for hand-made graph data only. Derived nodes and edges are rebuilt
 * from the library on every load and are deliberately never written here.
 */

export async function listGraphNodes(): Promise<KnowledgeNodeRecord[]> {
  try {
    return await db.knowledgeNodes.toArray();
  } catch {
    return [];
  }
}

export async function listGraphEdges(): Promise<KnowledgeEdgeRecord[]> {
  try {
    return await db.knowledgeEdges.toArray();
  } catch {
    return [];
  }
}

export interface NewGraphNode {
  type: KnowledgeNodeType;
  title: string;
  description?: string;
  subjectId?: string;
  tags?: string[];
  masteryLevel?: number;
}

export async function createGraphNode(input: NewGraphNode): Promise<KnowledgeNodeRecord | null> {
  const title = input.title.trim();
  if (!title) return null;
  const now = Date.now();
  const node: KnowledgeNodeRecord = {
    id: newId('kn'),
    type: input.type,
    title,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    tags: input.tags ?? [],
    origin: 'manual',
    ...(input.masteryLevel !== undefined
      ? { masteryLevel: input.masteryLevel, masterySource: 'declared' as const }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.knowledgeNodes.add(node);
  return node;
}

export async function updateGraphNode(
  id: string,
  patch: Partial<Omit<KnowledgeNodeRecord, 'id' | 'origin' | 'createdAt'>>,
): Promise<void> {
  const next: Partial<KnowledgeNodeRecord> = { ...patch, updatedAt: Date.now() };
  // A level typed in by hand is a declaration, never an estimate.
  if (patch.masteryLevel !== undefined) next.masterySource = 'declared';
  await db.knowledgeNodes.update(id, next);
}

/**
 * Delete a node and every hand-drawn edge touching it.
 *
 * Without the cascade the graph would keep edges pointing at something that no
 * longer exists. Normalisation drops such edges defensively anyway, but
 * leaving them in storage would slowly fill the table with dead rows and make
 * an export carry connections the user cannot see.
 */
export async function deleteGraphNode(id: string): Promise<void> {
  await db.transaction('rw', db.knowledgeNodes, db.knowledgeEdges, async () => {
    await db.knowledgeNodes.delete(id);
    const orphans = await db.knowledgeEdges
      .filter((edge) => edge.sourceNodeId === id || edge.targetNodeId === id)
      .toArray();
    await db.knowledgeEdges.bulkDelete(orphans.map((edge) => edge.id));
  });
}

export async function createGraphEdge(
  sourceNodeId: string,
  targetNodeId: string,
  relationType: RelationType,
  note?: string,
): Promise<KnowledgeEdgeRecord | null> {
  if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return null;

  // The same relationship drawn twice is not an error worth showing; it is
  // simply already there.
  const existing = await db.knowledgeEdges
    .filter(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.targetNodeId === targetNodeId &&
        edge.relationType === relationType,
    )
    .first();
  if (existing) return existing;

  const edge: KnowledgeEdgeRecord = {
    id: newId('ke'),
    sourceNodeId,
    targetNodeId,
    relationType,
    ...(note?.trim() ? { note: note.trim() } : {}),
    origin: 'manual',
    createdAt: Date.now(),
  };
  await db.knowledgeEdges.add(edge);
  return edge;
}

export async function updateGraphEdge(
  id: string,
  patch: { relationType?: RelationType; note?: string },
): Promise<void> {
  await db.knowledgeEdges.update(id, patch);
}

export async function deleteGraphEdge(id: string): Promise<void> {
  await db.knowledgeEdges.delete(id);
}

export async function getGraphPreferences(): Promise<GraphPreferences> {
  try {
    const stored = await db.graphPrefs.get('main');
    return { ...DEFAULT_GRAPH_PREFERENCES, ...stored, key: 'main' };
  } catch {
    return DEFAULT_GRAPH_PREFERENCES;
  }
}

export async function saveGraphPreferences(
  patch: Partial<Omit<GraphPreferences, 'key' | 'updatedAt'>>,
): Promise<void> {
  const current = await getGraphPreferences();
  await db.graphPrefs.put({ ...current, ...patch, key: 'main', updatedAt: Date.now() });
}

/** Replace or merge imported graph data. Import never touches derived data. */
export async function importGraphData(
  nodes: readonly KnowledgeNodeRecord[],
  edges: readonly KnowledgeEdgeRecord[],
  mode: 'merge' | 'replace' = 'merge',
): Promise<void> {
  await db.transaction('rw', db.knowledgeNodes, db.knowledgeEdges, async () => {
    if (mode === 'replace') {
      await db.knowledgeNodes.clear();
      await db.knowledgeEdges.clear();
    }
    await db.knowledgeNodes.bulkPut([...nodes]);
    // An imported edge whose endpoints are missing is dropped rather than
    // stored: the graph builder would ignore it anyway.
    const ids = new Set([...(await db.knowledgeNodes.toArray())].map((n) => n.id));
    await db.knowledgeEdges.bulkPut(
      edges.filter((edge) => ids.has(edge.sourceNodeId) && ids.has(edge.targetNodeId)),
    );
  });
}

/* --------------------------- parallel worlds ----------------------------- */

export async function listWorlds(): Promise<WorldRecord[]> {
  try {
    return await db.worlds.toArray();
  } catch {
    return [];
  }
}

export async function listConsequences(): Promise<ConsequenceRecord[]> {
  try {
    return await db.worldConsequences.toArray();
  } catch {
    return [];
  }
}

export interface NewWorld {
  title: string;
  baseRule?: string;
  changedRule?: string;
  subjectId?: string;
  topicIds?: string[];
  parentId?: string;
}

export async function createWorld(input: NewWorld): Promise<WorldRecord | null> {
  const title = input.title.trim();
  if (!title) return null;
  const now = Date.now();

  const world: WorldRecord = {
    id: newId('w'),
    title,
    baseRule: input.baseRule?.trim() ?? '',
    changedRule: input.changedRule?.trim() ?? '',
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    topicIds: input.topicIds ?? [],
    openQuestions: [],
    conclusion: '',
    status: 'draft',
    ...(input.parentId ? { parentId: input.parentId } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.worlds.add(world);
  return world;
}

/**
 * Branch from an existing world.
 *
 * Only the divergence is stored. Base reality, subject and linked topics are
 * left empty on purpose so they resolve through the parent at read time — a
 * branch that copied them would quietly stop tracking edits to its parent.
 */
export async function branchWorld(
  parentId: string,
  title: string,
  changedRule?: string,
): Promise<WorldRecord | null> {
  const parent = await db.worlds.get(parentId);
  if (!parent) return null;
  return createWorld({
    title,
    parentId,
    ...(changedRule?.trim() ? { changedRule: changedRule.trim() } : {}),
  });
}

export async function updateWorld(
  id: string,
  patch: Partial<Omit<ParallelWorld, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.worlds.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setWorldStatus(id: string, status: WorldStatus): Promise<void> {
  await updateWorld(id, { status });
}

export async function toggleWorldFavorite(id: string): Promise<void> {
  const world = await db.worlds.get(id);
  if (!world) return;
  await updateWorld(id, { favorite: !world.favorite });
}

/**
 * Delete a world, its consequences, and — recursively — every branch beneath
 * it. Leaving branches behind would orphan them; the caller is expected to
 * have warned, because this destroys authored reasoning.
 */
export async function deleteWorld(id: string): Promise<void> {
  await db.transaction('rw', db.worlds, db.worldConsequences, async () => {
    const all = await db.worlds.toArray();
    const doomed = [id, ...descendantsOf(id, all).map((w) => w.id)];
    await db.worlds.bulkDelete(doomed);
    const consequences = await db.worldConsequences
      .filter((c) => doomed.includes(c.worldId))
      .toArray();
    await db.worldConsequences.bulkDelete(consequences.map((c) => c.id));
  });
}

export interface NewConsequence {
  worldId: string;
  kind: ConsequenceKind;
  level: ConsequenceLevel;
  text: string;
  causedBy?: string[];
}

export async function addConsequence(input: NewConsequence): Promise<ConsequenceRecord | null> {
  const text = input.text.trim();
  if (!text) return null;

  const siblings = await db.worldConsequences.where('worldId').equals(input.worldId).toArray();
  const consequence: ConsequenceRecord = {
    id: newId('c'),
    worldId: input.worldId,
    kind: input.kind,
    level: input.level,
    text,
    causedBy: input.causedBy ?? [],
    order: siblings.length,
    createdAt: Date.now(),
  };
  await db.worldConsequences.add(consequence);
  await updateWorld(input.worldId, {});
  return consequence;
}

export async function updateConsequence(
  id: string,
  patch: Partial<Omit<Consequence, 'id' | 'worldId' | 'createdAt'>>,
): Promise<void> {
  await db.worldConsequences.update(id, patch);
}

/** Link a consequence to the one it follows from, refusing to close a loop. */
export async function linkConsequence(childId: string, parentId: string): Promise<boolean> {
  const child = await db.worldConsequences.get(childId);
  if (!child) return false;

  const siblings = await db.worldConsequences.where('worldId').equals(child.worldId).toArray();
  if (wouldCycle(childId, parentId, siblings)) return false;
  if (child.causedBy.includes(parentId)) return true;

  await db.worldConsequences.update(childId, { causedBy: [...child.causedBy, parentId] });
  return true;
}

export async function unlinkConsequence(childId: string, parentId: string): Promise<void> {
  const child = await db.worldConsequences.get(childId);
  if (!child) return;
  await db.worldConsequences.update(childId, {
    causedBy: child.causedBy.filter((id) => id !== parentId),
  });
}

/** Remove a consequence and every causal arrow pointing at it. */
export async function deleteConsequence(id: string): Promise<void> {
  await db.transaction('rw', db.worldConsequences, async () => {
    const target = await db.worldConsequences.get(id);
    await db.worldConsequences.delete(id);
    if (!target) return;
    const dependents = await db.worldConsequences
      .where('worldId')
      .equals(target.worldId)
      .filter((c) => c.causedBy.includes(id))
      .toArray();
    for (const dependent of dependents) {
      await db.worldConsequences.update(dependent.id, {
        causedBy: dependent.causedBy.filter((x) => x !== id),
      });
    }
  });
}

/** Merge imported worlds. Existing ids are overwritten by the file's version. */
export async function importWorldsData(
  worlds: readonly WorldRecord[],
  consequences: readonly ConsequenceRecord[],
): Promise<void> {
  await db.transaction('rw', db.worlds, db.worldConsequences, async () => {
    await db.worlds.bulkPut([...worlds]);
    const ids = new Set((await db.worlds.toArray()).map((w) => w.id));
    await db.worldConsequences.bulkPut(consequences.filter((c) => ids.has(c.worldId)));
  });
}


/* -------------------- competitive tournament progress -------------------- */

/**
 * Per-topic learning state. Only status / solved / confidence / review is
 * stored here; notes go through `createNote({ topicId: '<ct id>' })` and the
 * "last studied" timestamp is bumped on any write below and mirrored to the
 * shared interaction log so the rest of the app sees the activity.
 */

export async function listCtProgress(): Promise<CtProgressRecord[]> {
  try {
    return await db.ctProgress.toArray();
  } catch {
    return [];
  }
}

export async function getCtProgress(topicId: string): Promise<CtProgressRecord> {
  const row = await db.ctProgress.get(topicId).catch(() => undefined);
  return row ?? emptyProgress(topicId);
}

/**
 * Merge a patch into a topic's progress, stamping `lastStudiedAt` and
 * `updatedAt`. Creates the row on first touch.
 */
export async function updateCtProgress(
  topicId: string,
  patch: Partial<Omit<CtProgressRecord, 'topicId' | 'updatedAt'>>,
): Promise<CtProgressRecord> {
  const now = Date.now();
  const current = await getCtProgress(topicId);
  const next: CtProgressRecord = {
    ...current,
    ...patch,
    topicId,
    lastStudiedAt: now,
    updatedAt: now,
  };
  await db.ctProgress.put(next);
  await recordInteraction({ type: 'view', at: now, topicId });
  return next;
}

export async function setCtStatus(topicId: string, status: CtStatus): Promise<void> {
  await updateCtProgress(topicId, { status });
}

export async function toggleCtReview(topicId: string): Promise<void> {
  const current = await getCtProgress(topicId);
  await updateCtProgress(topicId, { reviewFlag: !current.reviewFlag });
}

/** Bump the solved counter by a delta (may be negative), floored at 0. */
export async function bumpCtSolved(topicId: string, delta: number): Promise<void> {
  const current = await getCtProgress(topicId);
  await updateCtProgress(topicId, { solved: Math.max(0, current.solved + delta) });
}
