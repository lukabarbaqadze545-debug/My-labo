import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ask, buildGrounding, type Answer, type AnswerRef } from '@/domain/assistant';
import { AiError, streamChat, type ChatTurn } from '@/lib/claude';
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

const STORAGE_KEY = 'labo:ask:v1';
const uid = () => Math.random().toString(36).slice(2, 10);

const SYSTEM_BASE =
  'შენ ხარ „ლაბოს დამხმარე" — მოსწავლისთვის განკუთვნილი სასწავლო ასისტენტი. ' +
  'უპასუხე ქართულად, მკაფიოდ და მოკლედ (2–5 აბზაცი). ახსენი ისე, თითქოს ცნობისმოყვარე ' +
  'თინეიჯერს ელაპარაკები — კონკრეტული მაგალითებით, ჟარგონის გარეშე. თუ ქვემოთ მოცემულია ' +
  'ლაბოს ბიბლიოთეკის ამონარიდები, დაეყრდენი მათ; თუ არა, უპასუხე შენი ცოდნით და აღნიშნე ეს.';

function load(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Msg[];
    return parsed.map((m): Msg => ({ ...m, phase: 'done', shown: m.text.length })).slice(-40);
  } catch {
    return [];
  }
}

export function AskPage() {
  const t = useT();
  const ai = useAiSettings();
  const aiOn = ai.enabled && Boolean(ai.apiKey);

  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [msgs]);

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
      const system = grounding.context
        ? `${SYSTEM_BASE}\n\n--- ლაბოს ბიბლიოთეკიდან ---\n${grounding.context}`
        : SYSTEM_BASE;
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
    (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setInput('');
      setBusy(true);
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
    [busy, aiOn, runAi, runEngine],
  );

  const clear = () => {
    abortRef.current?.abort();
    setMsgs([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const starters = t.assistant.starters ?? [];

  return (
    <div className="page ask-page">
      <header className="hero">
        <h1 className="hero__title">{t.assistant.title}</h1>
        <p className="hero__sub">{t.assistant.subtitle}</p>
      </header>

      <div className="ask-modebar">
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

      <div className="ask-thread" ref={scrollRef}>
        {msgs.length === 0 ? (
          <div className="ask-empty">
            <span className="ask-empty__glyph" aria-hidden="true">✦</span>
            <p className="ask-empty__title">{t.assistant.emptyTitle}</p>
            <p className="ask-empty__hint">{t.assistant.emptyHint}</p>
            <div className="ask-chips">
              {starters.map((s) => (
                <button key={s} className="ask-chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="ask-msg ask-msg--user">
                <div className="ask-bubble ask-bubble--user">{m.text}</div>
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
                        <AnswerExtras answer={m.answer} onFollowUp={send} labels={t.assistant} />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ),
          )
        )}
      </div>

      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
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
              send(input);
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
        {msgs.length > 0 ? (
          <button className="btn btn--quiet btn--sm" onClick={clear}>
            {t.assistant.clear}
          </button>
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
