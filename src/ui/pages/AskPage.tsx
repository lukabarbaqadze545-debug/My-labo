import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ask, type Answer } from '@/domain/assistant';
import { useT } from '../state/AppState';

type Phase = 'thinking' | 'typing' | 'done';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  shown: number;
  phase: Phase;
  answer?: Answer;
}

const STORAGE_KEY = 'labo:ask:v1';
const uid = () => Math.random().toString(36).slice(2, 10);

function load(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Msg[];
    // Any answer left mid-stream is shown complete on reload.
    return parsed
      .map((m): Msg => ({ ...m, phase: 'done', shown: m.text.length }))
      .slice(-40);
  } catch {
    return [];
  }
}

export function AskPage() {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

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

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // Typewriter: reveal the last streaming answer character group by group.
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

  const send = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (!q || busy) return;
      setInput('');
      setBusy(true);
      const userMsg: Msg = { id: uid(), role: 'user', text: q, shown: q.length, phase: 'done' };
      const botId = uid();
      setMsgs((prev) => [
        ...prev,
        userMsg,
        { id: botId, role: 'assistant', text: '', shown: 0, phase: 'thinking' },
      ]);
      const delay = 360 + Math.random() * 440;
      const id = window.setTimeout(() => {
        const answer = ask(q);
        setMsgs((prev) =>
          prev.map((m) => (m.id === botId ? { ...m, text: answer.text, answer, phase: 'typing' } : m)),
        );
      }, delay);
      timers.current.push(id);
    },
    [busy],
  );

  const clear = () => {
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

      <div className="ask-thread" ref={scrollRef}>
        {msgs.length === 0 ? (
          <div className="ask-empty">
            <span className="ask-empty__glyph" aria-hidden="true">
              ✦
            </span>
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
                <span className="ask-avatar" aria-hidden="true">
                  ✦
                </span>
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
        <span className="xsmall muted">{t.assistant.disclaimer}</span>
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
  return (
    <div className="ask-extras">
      {answer.sources.length > 0 ? (
        <div className="ask-extras__row">
          <span className="ask-extras__label">{labels.sources}:</span>
          {answer.sources.map((s) => (
            <Link key={s.href} to={s.href} className="ask-source">
              {s.label} ↗
            </Link>
          ))}
        </div>
      ) : null}
      {answer.related.length > 0 ? (
        <div className="ask-extras__row">
          <span className="ask-extras__label">{labels.related}:</span>
          {answer.related.map((r) => (
            <Link key={r.href} to={r.href} className="ask-chip ask-chip--sm">
              {r.label}
            </Link>
          ))}
        </div>
      ) : null}
      {answer.followUps.length > 0 ? (
        <div className="ask-extras__row">
          <span className="ask-extras__label">{labels.followUps}:</span>
          {answer.followUps.map((q) => (
            <button key={q} className="ask-chip ask-chip--sm" onClick={() => onFollowUp(q)}>
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
