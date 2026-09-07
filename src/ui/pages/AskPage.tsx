import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Answer, AnswerRef } from '@/domain/assistant';
import {
  replay,
  resolvePack,
  type Move,
  type MoveKind,
  type ReplayTurn,
} from '@/domain/reasoning';
import {
  converse,
  emptyConversationState,
  type ConversationState,
  type PipelineTrace,
} from '@/domain/conversation';
import { anthropicProvider, reason } from '@/domain/llm';
import { db, ASSISTANT_MODES, type AiMessage, type AssistantMode } from '@/persistence/db';
import type { BookCorpus, BookMode, BookScope } from '@/domain/books';
import {
  addMemory,
  createThread,
  deleteThread,
  listMemories,
  renameThread,
  updateThread,
} from '@/persistence/repositories';
import { useT } from '../state/AppState';
import { AiSettings, useAiSettings } from '../components/AiSettings';
import { ReasoningPanel } from '../components/ReasoningPanel';
import { DebugInspector } from '../components/DebugInspector';
import { TeachPanel } from '../components/TeachPanel';
import { useTeachings } from '../state/useTeachings';
import { useKnowledgeGraph } from '../state/useKnowledgeGraph';
import { saveAiSettings } from '@/persistence/repositories';
import type { AliasEntry } from '@/language/ka';

type Phase = 'thinking' | 'typing' | 'done';

interface SocraticMeta {
  moveKind: string;
  targetId?: string;
  key: string;
  rationale?: string;
}

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  shown: number;
  phase: Phase;
  answer?: Answer;
  note?: string;
  socratic?: SocraticMeta;
  /** False when a claim in the answer could not be tied to the evidence. */
  grounded?: boolean;
  /** Page-accurate book citations behind the answer. */
  citations?: string[];
}

type Labels = ReturnType<typeof useT>;

/** Mode names and one-line explanations, keyed by the stored mode value. */
const MODE_LABEL = (t: Labels): Record<AssistantMode, string> => ({
  strict_labo: t.modes.strictLabo,
  labo_llm: t.modes.laboLlm,
  free_ai: t.modes.freeAi,
});

const MODE_HINT = (t: Labels): Record<AssistantMode, string> => ({
  strict_labo: t.modes.strictLaboHint,
  labo_llm: t.modes.laboLlmHint,
  free_ai: t.modes.freeAiHint,
});

const LEGACY_KEY = 'labo:ask:v1';
const ACTIVE_KEY = 'labo:ask:active';
const uid = () => Math.random().toString(36).slice(2, 10);

/* Personal statements worth remembering across chats. */
const MEMORY_HINT =
  /(მqვია|მქვია|მე\s+ვარ\b|მე\s+ვ[a-zა-ჰ]|მიყვარ|მძულ|მაინტერეს|ვსწავლ|ვცხოვრ|ვმუშა|ჩემი\s|ვოცნებ|მინდა\s+(გავხდე|ვიყო|ვისწავლ)|წლის\s+ვარ|კლას(ში|ის)\s|ოცნება\s+მაქვს|მიზანი\s+მაქვს|მიჭირს\b|მირჩევნია)/i;

function looksPersonal(q: string): boolean {
  if (q.length < 6 || q.length > 200) return false;
  if (q.trim().endsWith('?') || q.includes('როგორ ') || q.includes('რატომ ') || q.includes('რა არის'))
    return false;
  return MEMORY_HINT.test(q);
}

function deriveTitle(q: string): string {
  const clean = q.replace(/\s+/g, ' ').trim();
  return clean.length > 40 ? `${clean.slice(0, 38)}…` : clean;
}

function toMsg(s: AiMessage): Msg {
  const hasExtras = Boolean(s.meta && (s.meta.sources?.length || s.meta.related?.length || s.meta.followUps?.length));
  return {
    id: s.id,
    role: s.role,
    text: s.text,
    shown: s.text.length,
    phase: 'done',
    note: s.meta?.note,
    socratic: s.meta?.socratic,
    ...(s.meta?.grounded !== undefined ? { grounded: s.meta.grounded } : {}),
    ...(s.meta?.citations ? { citations: s.meta.citations } : {}),
    answer: hasExtras
      ? {
          text: s.text,
          confidence: s.role === 'assistant' ? 'high' : 'none',
          sources: s.meta?.sources ?? [],
          related: s.meta?.related ?? [],
          followUps: s.meta?.followUps ?? [],
        }
      : undefined,
  };
}

function toStored(m: Msg): AiMessage {
  const meta =
    m.answer || m.note || m.socratic || m.citations
      ? {
          sources: m.answer?.sources,
          related: m.answer?.related,
          followUps: m.answer?.followUps,
          note: m.note,
          socratic: m.socratic,
          citations: m.citations,
          grounded: m.grounded,
        }
      : undefined;
  return { id: m.id, role: m.role, text: m.text, at: Date.now(), meta };
}

/**
 * Rebuild conversational state by folding the stored user turns back through
 * the pipeline. Cheap (sub-millisecond per turn) and, like the reasoning
 * engine's replay, it guarantees the state can never disagree with the
 * transcript the user is looking at.
 */
function replayConversation(
  msgs: readonly Msg[],
  socratic: boolean,
  extraAliases: readonly AliasEntry[],
): ConversationState {
  let state = emptyConversationState();
  for (const m of msgs) {
    if (m.role !== 'user' || !m.text.trim()) continue;
    state = converse(state, m.text, { socratic, extraAliases }).state;
  }
  return state;
}

/** Transcript shape the reasoning engine replays state from. */
function toReplayTurns(msgs: readonly Msg[]): ReplayTurn[] {
  return msgs
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role,
      text: m.text,
      ...(m.socratic
        ? {
            socratic: {
              moveKind: m.socratic.moveKind as MoveKind,
              ...(m.socratic.targetId ? { targetId: m.socratic.targetId } : {}),
              key: m.socratic.key,
            },
          }
        : {}),
    }));
}

export function AskPage() {
  const t = useT();
  const ai = useAiSettings();
  const aiOn = ai.enabled && Boolean(ai.apiKey);

  const threads = useLiveQuery(
    () => db.aiThreads.orderBy('updatedAt').reverse().toArray(),
    [],
  );
  const sortedThreads = useMemo(
    () => (threads ?? []).slice().sort((a, b) => Number(b.pinned ?? 0) - Number(a.pinned ?? 0)),
    [threads],
  );

  const [activeId, setActiveId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY),
  );
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [savedMemo, setSavedMemo] = useState<string | null>(null);
  const [socraticOn, setSocraticOn] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [showTeach, setShowTeach] = useState(false);
  const [lastTrace, setLastTrace] = useState<PipelineTrace | null>(null);

  const { extraAliases } = useTeachings();
  // Relationship-aware retrieval: the graph can surface material the question's
  // own words never mentioned. Structure and content stay separated downstream.
  const { graph } = useKnowledgeGraph();
  const convRef = useRef<ConversationState>(emptyConversationState());

  /**
   * Book data is read once and reused for every message. Re-reading IndexedDB
   * per question would make chat noticeably slower as the library grows.
   */
  const bookRows = useLiveQuery(
    () =>
      Promise.all([
        db.books.toArray(),
        db.bookSections.toArray(),
        db.bookChunks.toArray(),
        db.bookKnowledge.toArray(),
      ]),
    [],
  );
  const bookCorpus = useMemo<BookCorpus>(
    () => ({
      books: bookRows?.[0] ?? [],
      sections: bookRows?.[1] ?? [],
      chunks: bookRows?.[2] ?? [],
      knowledge: bookRows?.[3] ?? [],
    }),
    [bookRows],
  );
  /** General Georgian learned from imported books — used by every subject. */
  const languageCorpus = useLiveQuery(
    () => db.languageCorpus.get('main').then((r) => r?.corpus ?? null),
    [],
  );

  const bookScope = useMemo<BookScope>(
    () => ({ mode: ai.bookMode, bookIds: ai.bookIds }),
    [ai.bookMode, ai.bookIds],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const loadedRef = useRef<string | null>(null);
  const migratedRef = useRef(false);
  const resumedRef = useRef(false);
  const freshRef = useRef<Set<string>>(new Set());

  /* One-time migration of the old single-conversation store into a thread. */
  useEffect(() => {
    if (migratedRef.current || threads === undefined) return;
    migratedRef.current = true;
    if (threads.length > 0) return;
    let legacy: Msg[] = [];
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) legacy = (JSON.parse(raw) as Msg[]).filter((m) => m?.text?.trim());
    } catch {
      /* ignore */
    }
    if (legacy.length === 0) return;
    const title = deriveTitle(legacy.find((m) => m.role === 'user')?.text ?? t.assistant.untitled);
    void createThread(title, legacy.map(toStored)).then((thr) => {
      freshRef.current.add(thr.id);
      loadedRef.current = thr.id;
      setActiveId(thr.id);
      setMsgs(legacy.map((m) => ({ ...m, phase: 'done', shown: m.text.length })));
      try {
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* ignore */
      }
    });
  }, [threads, t.assistant.untitled]);

  /* On first load, resume the last conversation (once). After that, a null
     activeId means "new chat draft" and must be left alone. */
  useEffect(() => {
    if (resumedRef.current || threads === undefined) return;
    resumedRef.current = true;
    const stored = localStorage.getItem(ACTIVE_KEY);
    const target = threads.find((x) => x.id === stored) ?? threads[0];
    if (target) setActiveId(target.id);
  }, [threads]);

  /* If the active thread vanished (deleted), drop to a draft — but ignore the
     brief window before a freshly created thread shows up in the live query. */
  useEffect(() => {
    if (!activeId || threads === undefined) return;
    const present = threads.some((x) => x.id === activeId);
    if (present) {
      freshRef.current.delete(activeId);
      return;
    }
    if (freshRef.current.has(activeId)) return;
    if (loadedRef.current === activeId) {
      loadedRef.current = null;
      setActiveId(null);
      setMsgs([]);
    }
  }, [threads, activeId]);

  /* Load messages when the active thread changes (not on every live update). */
  useEffect(() => {
    // Clearing to a blank conversation is done explicitly by newChat /
    // removeThread — never inferred here, to avoid racing an in-flight send.
    if (!activeId) return;
    if (loadedRef.current === activeId) return;
    const thread = (threads ?? []).find((x) => x.id === activeId);
    if (!thread) return;
    loadedRef.current = activeId;
    abortRef.current?.abort();
    setBusy(false);
    setSocraticOn(Boolean(thread.socratic));
    const loaded = thread.messages.map(toMsg);
    setMsgs(loaded);
    convRef.current = replayConversation(loaded, Boolean(thread.socratic), extraAliases);
    setLastTrace(null);
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      /* ignore */
    }
  }, [activeId, threads]);

  /* Remember which conversation is open, including one created mid-session. */
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, [activeId]);

  /* Persist the active thread (debounced) once the exchange settles. */
  useEffect(() => {
    if (!activeId || loadedRef.current !== activeId) return;
    if (msgs.some((m) => m.phase !== 'done')) return;
    const id = window.setTimeout(() => {
      const patch: Parameters<typeof updateThread>[1] = { messages: msgs.map(toStored) };
      const thread = (threads ?? []).find((x) => x.id === activeId);
      const firstUser = msgs.find((m) => m.role === 'user');
      if (thread && (!thread.title || thread.title === t.assistant.untitled) && firstUser) {
        patch.title = deriveTitle(firstUser.text);
      }
      void updateThread(activeId, patch);
    }, 700);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [msgs, activeId, threads, t.assistant.untitled]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      abortRef.current?.abort();
    },
    [],
  );

  // Fake typewriter — only for the retrieval-engine path (AI streams for real).
  useEffect(() => {
    const i = msgs.findIndex((m) => m.phase === 'typing' && m.shown < m.text.length);
    if (i === -1) return;
    const msg = msgs[i]!;
    const step = Math.max(1, Math.ceil(msg.text.length / 90));
    const id = window.setTimeout(() => {
      setMsgs((prev) =>
        prev.map((m, j) => {
          if (j !== i) return m;
          const shown = Math.min(m.text.length, m.shown + step);
          return { ...m, shown, phase: shown >= m.text.length ? 'done' : 'typing' };
        }),
      );
    }, 16);
    timers.current.push(id);
    return () => window.clearTimeout(id);
  }, [msgs]);

  useEffect(() => {
    if (busy && msgs.every((m) => m.phase === 'done')) setBusy(false);
  }, [msgs, busy]);

  const patch = useCallback((id: string, fn: (m: Msg) => Msg) => {
    setMsgs((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  /**
   * Strict Labo. The conversational pipeline answers entirely from stored
   * knowledge: no model, no network. This is the default and must be good on
   * its own — every other mode is a wrapper around this one's decisions.
   */
  const runConversation = useCallback(
    (q: string, botId: string) => {
      const result = converse(convRef.current, q, {
        socratic: socraticOn,
        extraAliases,
        bookScope,
        bookCorpus,
        languageCorpus,
      });
      convRef.current = result.state;
      setLastTrace(result.trace);

      const delay = 260 + Math.random() * 320;
      const id = window.setTimeout(() => {
        patch(botId, (m) => ({
          ...m,
          text: result.reply.text,
          phase: 'typing',
          answer: {
            text: result.reply.text,
            confidence:
              result.reply.verdict === 'answer'
                ? 'high'
                : result.reply.verdict === 'known_but_missing'
                  ? 'none'
                  : 'medium',
            sources: result.reply.sources,
            related: result.reply.related,
            followUps: result.reply.suggestions,
          },
        }));
      }, delay);
      timers.current.push(id);
    },
    [patch, socraticOn, extraAliases, bookScope, bookCorpus, languageCorpus],
  );

  /**
   * Labo LLM and Free AI.
   *
   * `reason()` owns the whole path: the deterministic engine runs first and
   * supplies retrieval, scoping, conversation state and a ready fallback, then
   * the model reasons over the *evidence* that engine found and its claims are
   * validated back against that evidence before anything is shown.
   *
   * Nothing here decides what to say. That is the point of the refactor: this
   * component streams text and renders provenance.
   */
  const runLlm = useCallback(
    async (q: string, botId: string, history: Msg[], mode: AssistantMode) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const memories = ai.memory ? await listMemories() : [];

      try {
        const result = await reason({
          message: q,
          state: convRef.current,
          mode,
          provider: anthropicProvider(ai),
          socratic: socraticOn,
          extraAliases,
          bookScope,
          bookCorpus,
          languageCorpus,
          graph,
          memories: memories.map((m) => m.text),
          history: history
            .filter((m) => m.text.trim())
            .map((m) => ({ role: m.role, content: m.text })),
          signal: controller.signal,
          onText: (text) => {
            patch(botId, (m) => ({ ...m, text, shown: text.length, phase: 'typing' }));
          },
        });

        convRef.current = result.state;
        setLastTrace(result.trace.pipeline);

        // Stopping on purpose is not a failure: keep whatever had streamed in
        // rather than replacing it with the engine's answer.
        if (result.fallbackReason === 'aborted') {
          patch(botId, (m) => ({ ...m, phase: 'done' }));
          return;
        }

        patch(botId, (m) => ({
          ...m,
          text: result.text,
          shown: result.text.length,
          phase: result.fellBack ? 'typing' : 'done',
          ...(result.fellBack ? { note: t.ai.fellBack } : {}),
          grounded: result.grounded,
          citations: result.citations,
          answer: {
            text: result.text,
            confidence: result.grounded ? 'high' : 'medium',
            sources: result.sources,
            related: result.related,
            followUps: result.suggestions,
          },
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [ai, patch, t, socraticOn, extraAliases, bookScope, bookCorpus, languageCorpus, graph],
  );

  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;

  const send = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setInput('');
      setBusy(true);
      setRailOpen(false);

      let threadId = activeId;
      if (!threadId) {
        const thr = await createThread(deriveTitle(q));
        threadId = thr.id;
        freshRef.current.add(thr.id);
        loadedRef.current = thr.id;
        setActiveId(thr.id);
        if (socraticOn) void updateThread(thr.id, { socratic: true });
      }

      if (aiOn && ai.memory && looksPersonal(q)) void addMemory(q, 'auto');

      const history = msgsRef.current;
      const userMsg: Msg = { id: uid(), role: 'user', text: q, shown: q.length, phase: 'done' };
      const botId = uid();
      setMsgs((prev) => [
        ...prev,
        userMsg,
        { id: botId, role: 'assistant' as const, text: '', shown: 0, phase: 'thinking' as const },
      ]);
      // Strict Labo is the floor and the fallback: the model only participates
      // when a key exists *and* the user chose a mode that wants it.
      const mode: AssistantMode = aiOn ? ai.mode : 'strict_labo';
      if (mode === 'strict_labo') runConversation(q, botId);
      else void runLlm(q, botId, history, mode);
    },
    [busy, aiOn, ai.memory, ai.mode, activeId, socraticOn, runLlm, runConversation],
  );

  const sendNow = useCallback((raw: string) => void send(raw), [send]);

  /**
   * The reasoning state shown in the map is *replayed* from the transcript
   * rather than stored, so what the panel shows can never drift from the
   * conversation the user is looking at.
   */
  const reasoning = useMemo(() => {
    if (!socraticOn) return null;
    const settled = msgs.filter((m) => m.phase === 'done');
    if (settled.length === 0) return null;
    const pack = resolvePack(settled.map((m) => m.text).join(' '));
    const lastBot = [...settled].reverse().find((m) => m.role === 'assistant' && m.socratic);
    const lastMove: Move | undefined = lastBot?.socratic
      ? {
          kind: lastBot.socratic.moveKind as MoveKind,
          text: lastBot.text,
          rationale: lastBot.socratic.rationale ?? '',
          score: 0,
          sources: [],
          key: lastBot.socratic.key,
        }
      : undefined;
    return { state: replay(toReplayTurns(settled), pack), pack, lastMove };
  }, [msgs, socraticOn]);

  const toggleSocratic = () => {
    const next = !socraticOn;
    setSocraticOn(next);
    if (activeId) void updateThread(activeId, { socratic: next });
  };

  const newChat = () => {
    abortRef.current?.abort();
    setBusy(false);
    loadedRef.current = null;
    setActiveId(null);
    setMsgs([]);
    setRailOpen(false);
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  };

  const removeThread = async (id: string) => {
    if (!window.confirm(t.assistant.deleteChatConfirm)) return;
    await deleteThread(id);
    if (id === activeId) {
      loadedRef.current = null;
      setActiveId(null);
      setMsgs([]);
    }
  };

  const rememberMsg = async (text: string) => {
    const added = await addMemory(text, 'manual');
    setSavedMemo(added ? added.id : `dup-${uid()}`);
    window.setTimeout(() => setSavedMemo(null), 1600);
  };

  const starters = t.assistant.starters ?? [];

  return (
    <div className="page ask-page">
      <header className="ask-head">
        <h1 className="ask-head__title">{t.assistant.title}</h1>
        <p className="ask-head__sub">{t.assistant.subtitle}</p>
      </header>

      {/*
        The toolbar is grouped rather than a single run of pills: session
        actions, then what the assistant may answer from, then view toggles.
        Grouping is what makes it scannable — the middle group is the only one
        that changes answers, so it is the only one that carries weight.
      */}
      <div className="ask-bar">
        <div className="ask-bar__group">
          <button className="ask-tool ask-tool--rail" onClick={() => setRailOpen((v) => !v)}>
            <span aria-hidden="true">☰</span> {t.assistant.chats}
          </button>
          <button className="ask-tool" onClick={newChat}>
            <span aria-hidden="true">+</span> {t.assistant.newChat}
          </button>
        </div>

        <div className="ask-bar__group ask-bar__group--scope">
          <div className="ask-modes" role="group" aria-label={t.modes.label}>
          {ASSISTANT_MODES.map((mode) => {
            const locked = mode !== 'strict_labo' && !aiOn;
            // Highlight what is actually answering, not what is merely stored:
            // without a key the chosen LLM mode is not the one running, and
            // showing it as active would misreport where the answer came from.
            const effective = aiOn ? ai.mode : 'strict_labo';
            return (
              <button
                key={mode}
                className={`ask-modes__btn${effective === mode ? ' is-active' : ''}`}
                disabled={locked}
                title={locked ? t.ai.aiNotSet : MODE_HINT(t)[mode]}
                onClick={() => void saveAiSettings({ mode })}
              >
                {MODE_LABEL(t)[mode]}
              </button>
            );
          })}
        </div>
          {bookCorpus.books.length > 0 ? (
            <select
              className="ask-select"
              value={ai.bookMode}
              title={t.books.modeLabel}
              onChange={(e) => {
                const mode = e.target.value as BookMode;
                const ids =
                  mode === 'book' && ai.bookIds.length === 0 && bookCorpus.books[0]
                    ? [bookCorpus.books[0].id]
                    : ai.bookIds;
                void saveAiSettings({ bookMode: mode, bookIds: ids });
              }}
            >
              <option value="off">📚 {t.books.modeOff}</option>
              <option value="book">📕 {t.books.modeBook}</option>
              <option value="selected">📗 {t.books.modeSelected}</option>
              <option value="library">📚 {t.books.modeLibrary}</option>
              <option value="with_labo">✦📚 {t.books.modeWithLabo}</option>
            </select>
          ) : null}
        </div>

        <div className="ask-bar__group ask-bar__group--toggles">
          <button
            className={`ask-tool${socraticOn ? ' is-on' : ''}`}
            onClick={toggleSocratic}
            aria-pressed={socraticOn}
            title={t.assistant.socratic}
          >
            <span aria-hidden="true">🜁</span>
            <span className="ask-tool__label">{t.assistant.socratic}</span>
          </button>
          <button
            className={`ask-tool${showTeach ? ' is-on' : ''}`}
            onClick={() => setShowTeach((v) => !v)}
            aria-pressed={showTeach}
            title={t.teach.open}
          >
            <span aria-hidden="true">✎</span>
            <span className="ask-tool__label">{t.teach.open}</span>
          </button>
          <button
            className={`ask-tool${showSettings ? ' is-on' : ''}`}
            onClick={() => setShowSettings((v) => !v)}
            aria-pressed={showSettings}
            title={aiOn ? t.ai.modeAi : t.ai.modeLibrary}
          >
            <span aria-hidden="true">✦</span>
            <span className="ask-tool__label">{aiOn ? t.ai.modeAi : t.ai.modeLibrary}</span>
            <span className="ask-tool__gear" aria-hidden="true">⚙</span>
          </button>
          <button
            className={`ask-tool${showDebug ? ' is-on' : ''}`}
            onClick={() => setShowDebug((v) => !v)}
            aria-pressed={showDebug}
            title={t.debug.toggle}
          >
            <span aria-hidden="true">⌥</span>
            <span className="ask-tool__label">{t.debug.toggle}</span>
          </button>
        </div>
      </div>

      {showTeach ? (
        <div className="ask-settingspanel">
          <p className="ask-panel__title">{t.teach.title}</p>
          <TeachPanel />
        </div>
      ) : null}

      {socraticOn ? (
        <div className="ask-socratic-note">
          <strong>{t.assistant.socraticOn}</strong>
          <span>{t.assistant.socraticHint}</span>
          {reasoning ? (
            <button className="btn btn--quiet btn--sm" onClick={() => setShowMap((v) => !v)}>
              {showMap ? t.assistant.reasoningHide : t.assistant.reasoning}
            </button>
          ) : null}
        </div>
      ) : null}

      {showSettings ? (
        <div className="ask-settingspanel">
          <p className="ask-panel__title">{t.ai.subtitle}</p>
          <AiSettings />
        </div>
      ) : null}

      <div
        className={`ask-layout${railOpen ? ' ask-layout--rail-open' : ''}${
          reasoning && showMap ? ' ask-layout--map' : ''
        }`}
      >
        <aside className="ask-rail">
          <button className="btn btn--ghost btn--sm ask-rail__new" onClick={newChat}>
            + {t.assistant.newChat}
          </button>
          <ul className="ask-rail__list">
            {sortedThreads.map((thr) => (
              <li
                key={thr.id}
                className={`ask-rail__item${thr.id === activeId ? ' is-active' : ''}`}
              >
                {renaming === thr.id ? (
                  <input
                    className="input input--sm"
                    autoFocus
                    defaultValue={thr.title}
                    onBlur={(e) => {
                      void renameThread(thr.id, e.target.value);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    className="ask-rail__title"
                    onClick={() => {
                      setActiveId(thr.id);
                      setRailOpen(false);
                    }}
                  >
                    {thr.pinned ? '📌 ' : ''}
                    {thr.title || t.assistant.untitled}
                  </button>
                )}
                <span className="ask-rail__actions">
                  <button
                    className="btn btn--quiet btn--sm"
                    title={thr.pinned ? t.assistant.unpin : t.assistant.pin}
                    onClick={() => void updateThread(thr.id, { pinned: !thr.pinned })}
                  >
                    {thr.pinned ? '📌' : '📍'}
                  </button>
                  <button
                    className="btn btn--quiet btn--sm"
                    title={t.assistant.rename}
                    onClick={() => setRenaming(thr.id)}
                  >
                    ✎
                  </button>
                  <button
                    className="btn btn--quiet btn--sm popmenu__danger"
                    title={t.assistant.deleteChat}
                    onClick={() => void removeThread(thr.id)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="ask-main">
          {/*
            Thread and composer live inside one bordered surface so the page
            reads as a single workspace rather than a stack of loose widgets.
          */}
          <div className="ask-workspace">
          <div className="ask-thread" ref={scrollRef}>
            {msgs.length === 0 ? (
              <div className="ask-empty">
                <span className="ask-empty__glyph" aria-hidden="true">✦</span>
                <p className="ask-empty__title">{t.assistant.emptyTitle}</p>
                <p className="ask-empty__hint">{t.assistant.emptyHint}</p>
                <div className="ask-chips">
                  {starters.map((s) => (
                    <button key={s} className="ask-chip" onClick={() => sendNow(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="ask-msg ask-msg--user">
                    <div className="ask-bubble ask-bubble--user">
                      {m.text}
                      {aiOn ? (
                        <button
                          className="ask-remember"
                          title={t.ai.remember}
                          onClick={() => void rememberMsg(m.text)}
                        >
                          🧠
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <article key={m.id} className="ask-msg ask-msg--bot">
                    <span className="ask-avatar" aria-hidden="true">✦</span>
                    <div className="ask-answer">
                      {m.phase === 'thinking' ? (
                        <span className="ask-dots" aria-label={t.assistant.thinking}>
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : (
                        <>
                          <div className="ask-text">
                            {m.text.slice(0, m.shown)}
                            {m.phase === 'typing' ? <span className="ask-caret" /> : null}
                          </div>
                          {m.note ? <p className="ask-note">{m.note}</p> : null}
                          {m.phase === 'done' && m.citations?.length ? (
                            <p className="ask-cites">
                              <span className="ask-cites__label">{t.modes.citations}</span>
                              {m.citations.join(' · ')}
                            </p>
                          ) : null}
                          {m.phase === 'done' && m.answer ? (
                            <AnswerExtras answer={m.answer} onFollowUp={sendNow} labels={t.assistant} />
                          ) : null}
                        </>
                      )}
                    </div>
                  </article>
                ),
              )
            )}
          </div>

          {savedMemo ? <p className="ask-note ask-note--ok ask-note--inline">{t.ai.memorySaved}</p> : null}

          <form
            className="ask-composer"
            onSubmit={(e) => {
              e.preventDefault();
              sendNow(input);
            }}
          >
            <textarea
              className="textarea ask-composer__input"
              rows={1}
              placeholder={t.assistant.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendNow(input);
                }
              }}
            />
            <button
              className="btn btn--primary ask-composer__send"
              type="submit"
              disabled={!input.trim() || busy}
            >
              {busy ? t.assistant.thinking : t.assistant.send}
            </button>
          </form>

          <div className="ask-foot">
            <span className="ask-foot__hint">
              {aiOn ? MODE_HINT(t)[ai.mode] : t.modes.strictLaboHint}
            </span>
          </div>
          </div>

          {showDebug && lastTrace ? <DebugInspector trace={lastTrace} /> : null}
        </div>

        {reasoning && showMap ? (
          <ReasoningPanel
            state={reasoning.state}
            pack={reasoning.pack}
            lastMove={reasoning.lastMove}
          />
        ) : null}
      </div>
    </div>
  );
}

function AnswerExtras({
  answer,
  onFollowUp,
  labels,
}: {
  answer: Answer;
  onFollowUp: (q: string) => void;
  labels: { sources: string; related: string; followUps: string };
}) {
  const rows: { label: string; items: (AnswerRef | string)[]; link: boolean; follow?: boolean }[] = [
    { label: labels.sources, items: answer.sources, link: true },
    { label: labels.related, items: answer.related, link: true },
    { label: labels.followUps, items: answer.followUps, link: false, follow: true },
  ];
  if (rows.every((r) => r.items.length === 0)) return null;
  return (
    <div className="ask-extras">
      {rows.map((row) =>
        row.items.length === 0 ? null : (
          <div key={row.label} className="ask-extras__row">
            <span className="ask-extras__label">{row.label}</span>
            {row.items.map((it) =>
              typeof it === 'string' ? (
                <button key={it} className="ask-chip ask-chip--sm ask-chip--action" onClick={() => onFollowUp(it)}>
                  {it}
                </button>
              ) : row.link ? (
                <Link key={it.href} to={it.href} className={row.label === labels.sources ? 'ask-source' : 'ask-chip ask-chip--sm'}>
                  {it.label}
                  {row.label === labels.sources ? ' ↗' : ''}
                </Link>
              ) : null,
            )}
          </div>
        ),
      )}
    </div>
  );
}
