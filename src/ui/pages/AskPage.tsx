import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ask, buildGrounding, type Answer, type AnswerRef } from '@/domain/assistant';
import { AiError, streamChat, type ChatTurn } from '@/lib/claude';
import { db, type AiMessage } from '@/persistence/db';
import {
  addMemory,
  createThread,
  deleteThread,
  listMemories,
  renameThread,
  updateThread,
} from '@/persistence/repositories';
import { useT } from '../state/AppState';
import { AiSettings, errorText, useAiSettings } from '../components/AiSettings';

type Phase = 'thinking' | 'typing' | 'done';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  shown: number;
  phase: Phase;
  answer?: Answer;
  note?: string;
}

const LEGACY_KEY = 'labo:ask:v1';
const ACTIVE_KEY = 'labo:ask:active';
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * The assistant's voice. This is deliberately long: the model needs a felt
 * sense of *how* a Georgian teenager and their tutor actually talk, not just a
 * topic list. Tone first, facts second.
 */
const SYSTEM_BASE = [
  'შენ ხარ „ლაბოს დამხმარე" — ცოცხალი, თბილი და ცნობისმოყვარე სასწავლო თანამოსაუბრე ქართველი მოსწავლისთვის.',
  '',
  'როგორ საუბრობ:',
  '• წერ ბუნებრივ, სასაუბრო ქართულს — ისე, როგორც კარგი რეპეტიტორი ან უფროსი მეგობარი დაელაპარაკებოდა. არა ენციკლოპედიის ენით.',
  '• იყენებ ცოცხალ დამაკავშირებლებს: „აბა ასე", „მოკლედ", „კარგი კითხვაა", „ახლა ვნახოთ", „მარტივად რომ ვთქვათ", „ე.ი.", „ჰოდა".',
  '• პასუხი მოკლეა — ჩვეულებრივ 1–3 აბზაცი. სია მხოლოდ მაშინ, როცა ნამდვილად ეხმარება. არ გადააფორმატებ ყველაფერს სათაურებად და ბულეტებად.',
  '• ერგები მოსაუბრის ტონს: თუ ის მოკლედ წერს, შენც მოკლედ უპასუხე; თუ ხუმრობს, შენც ცოტა მსუბუქად.',
  '• სვამ დამაზუსტებელ კითხვას, როცა შეკითხვა ბუნდოვანია — არ გამოიცნობ ბრმად.',
  '• ასწავლი სოკრატესებურად: ხან შენ სვამ პატარა კითხვას, რომ მოსწავლემ თვითონ მიხვდეს.',
  '• პასუხს ამთავრებ ისე, რომ საუბარი გაგრძელდეს — მაგ. „გინდა უფრო ღრმად?" ან პატარა მაგალითით.',
  '',
  'რას აკეთებ და რას არა:',
  '• იყენებ კონკრეტულ, ხელშესახებ მაგალითებს ქართული ცხოვრებიდან (ჩაი, მარშრუტკა, ჭადრაკი, მთა).',
  '• როცა რაღაც არ იცი ან არ ხარ დარწმუნებული — პირდაპირ ამბობ: „ზუსტად არ ვიცი, მაგრამ…".',
  '• არ იგონებ ფაქტებს, თარიღებს ან ციტატებს. ჯობია თქვა „არ ვარ დარწმუნებული".',
  '• გახსოვს, რა თქვა მოსაუბრემ ამ საუბარში და მიბრუნდები მას.',
  '• მავნე, საშიშ ან ასაკისთვის შეუფერებელ თხოვნაზე თავაზიანად ამბობ უარს და სთავაზობ სხვა გზას.',
  '',
  'თუ ქვემოთ მოცემულია ლაბოს ბიბლიოთეკის ამონარიდები — დაეყრდენი მათ და, სადაც ჯდება, მიუთითე თემა. თუ ამონარიდი არ არის, უპასუხე შენი ცოდნით და ეს აღნიშნე.',
].join('\n');

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
    m.answer || m.note
      ? {
          sources: m.answer?.sources,
          related: m.answer?.related,
          followUps: m.answer?.followUps,
          note: m.note,
        }
      : undefined;
  return { id: m.id, role: m.role, text: m.text, at: Date.now(), meta };
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
    setMsgs(thread.messages.map(toMsg));
    try {
      localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {
      /* ignore */
    }
  }, [activeId, threads]);

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

  const runEngine = useCallback(
    (q: string, botId: string, note?: string) => {
      const delay = 340 + Math.random() * 420;
      const id = window.setTimeout(() => {
        const answer = ask(q);
        patch(botId, (m) => ({
          ...m,
          text: answer.text,
          answer,
          phase: 'typing',
          ...(note ? { note } : {}),
        }));
      }, delay);
      timers.current.push(id);
    },
    [patch],
  );

  const runAi = useCallback(
    async (q: string, botId: string, history: Msg[]) => {
      const grounding = buildGrounding(q);
      const engineTop = ask(q);
      const memories = await listMemories();
      const memoryBlock = memories.length
        ? `\n\n--- რა იცი მოსაუბრის შესახებ ---\n${memories.map((m) => `• ${m.text}`).join('\n')}`
        : '';
      const libraryBlock = grounding.context
        ? `\n\n--- ლაბოს ბიბლიოთეკიდან ---\n${grounding.context}`
        : '';
      const system = `${SYSTEM_BASE}${memoryBlock}${libraryBlock}`;

      const turns: ChatTurn[] = history
        .filter((m) => m.text.trim())
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.text }));
      // The API requires the first message to be from the user.
      while (turns.length && turns[0]!.role !== 'user') turns.shift();
      turns.push({ role: 'user', content: q });

      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';
      try {
        await streamChat(ai, {
          system,
          messages: turns,
          signal: controller.signal,
          onText: (delta) => {
            acc += delta;
            patch(botId, (m) => ({ ...m, text: acc, shown: acc.length, phase: 'typing' }));
          },
        });
        patch(botId, (m) => ({
          ...m,
          text: acc || m.text,
          shown: (acc || m.text).length,
          phase: 'done',
          answer: {
            text: acc,
            confidence: 'high',
            sources: grounding.sources,
            related: engineTop.related,
            followUps: engineTop.followUps,
          },
        }));
      } catch (err) {
        const kind = err instanceof AiError ? err.kind : 'unknown';
        if (kind === 'network' && controller.signal.aborted) {
          patch(botId, (m) => ({ ...m, phase: 'done' }));
          return;
        }
        // Graceful degrade: answer from the library instead.
        patch(botId, (m) => ({
          ...m,
          text: engineTop.text,
          answer: engineTop,
          phase: 'typing',
          note: `${errorText(kind, t)} · ${t.ai.fellBack}`,
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [ai, patch, t],
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
      if (aiOn) void runAi(q, botId, history);
      else runEngine(q, botId);
    },
    [busy, aiOn, ai.memory, activeId, runAi, runEngine],
  );

  const sendNow = useCallback((raw: string) => void send(raw), [send]);

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
      <header className="hero">
        <h1 className="hero__title">{t.assistant.title}</h1>
        <p className="hero__sub">{t.assistant.subtitle}</p>
      </header>

      <div className="ask-modebar">
        <button className="ask-mode" onClick={() => setRailOpen((v) => !v)}>
          <span aria-hidden="true">☰</span> {t.assistant.chats}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={newChat}>
          + {t.assistant.newChat}
        </button>
        <button
          className={`ask-mode${aiOn ? ' ask-mode--ai' : ''}`}
          onClick={() => setShowSettings((v) => !v)}
        >
          <span aria-hidden="true">✦</span> {aiOn ? t.ai.modeAi : t.ai.modeLibrary}
          <span className="ask-mode__gear" aria-hidden="true">⚙</span>
        </button>
      </div>

      {showSettings ? (
        <div className="ask-settingspanel">
          <p className="hero__sub" style={{ marginBottom: 'var(--space-3)' }}>{t.ai.subtitle}</p>
          <AiSettings />
        </div>
      ) : null}

      <div className={`ask-layout${railOpen ? ' ask-layout--rail-open' : ''}`}>
        <aside className="ask-rail">
          <button className="btn btn--primary btn--sm ask-rail__new" onClick={newChat}>
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
                  <div key={m.id} className="ask-msg ask-msg--bot">
                    <span className="ask-avatar" aria-hidden="true">✦</span>
                    <div className="ask-bubble">
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
                          {m.phase === 'done' && m.answer ? (
                            <AnswerExtras answer={m.answer} onFollowUp={sendNow} labels={t.assistant} />
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          {savedMemo ? <p className="ask-note ask-note--ok">{t.ai.memorySaved}</p> : null}

          <form
            className="ask-input"
            onSubmit={(e) => {
              e.preventDefault();
              sendNow(input);
            }}
          >
            <textarea
              className="textarea"
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
            <button className="btn btn--primary" type="submit" disabled={!input.trim() || busy}>
              {busy ? t.assistant.thinking : t.assistant.send}
            </button>
          </form>

          <div className="ask-foot">
            <span className="xsmall muted">
              {aiOn ? t.ai.privacy.split('.')[0] + '.' : t.assistant.disclaimer}
            </span>
          </div>
        </div>
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
            <span className="ask-extras__label">{row.label}:</span>
            {row.items.map((it) =>
              typeof it === 'string' ? (
                <button key={it} className="ask-chip ask-chip--sm" onClick={() => onFollowUp(it)}>
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
