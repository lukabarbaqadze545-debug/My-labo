import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { library, t as tr } from '@/content';
import {
  createQuestion,
  deleteQuestion,
  listQuestions,
  updateQuestion,
} from '@/persistence/repositories';
import { useT } from '../state/AppState';
import { Chip, EmptyState, SectionHead } from '../components/primitives';

const norm = (s: string) => s.normalize('NFC').toLowerCase();

/** Cheap topical match: how many meaningful question words land in a topic's text. */
function matchTopics(text: string, limit = 3): string[] {
  const words = norm(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return [];
  const scored = library.topics
    .map((topic) => {
      const hay = norm(`${tr(topic.title)} ${tr(topic.hook)} ${(topic.tags ?? []).join(' ')}`);
      const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
      return { id: topic.id, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.id);
}

function LinkedTopics({ ids }: { ids: string[] }) {
  const t = useT();
  const topics = ids.map((id) => library.topicById.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  if (topics.length === 0) return <p className="xsmall muted">{t.questions.noLinks}</p>;
  return (
    <div className="row">
      <span className="xsmall muted">{t.questions.linked}:</span>
      {topics.map((topic) => (
        <Link key={topic.id} to={`/topics/${topic.id}`}>
          <Chip tone="accent">{tr(topic.title)} →</Chip>
        </Link>
      ))}
    </div>
  );
}

export function QuestionsPage() {
  const t = useT();
  const questions = useLiveQuery(() => listQuestions(), []);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'answered'>('all');
  const [showExamples, setShowExamples] = useState(false);

  const add = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const linked = matchTopics(trimmed);
    await createQuestion({ text: trimmed, ...(linked.length ? { linkedTopicIds: linked } : {}) });
    setText('');
  };

  const existingText = useMemo(
    () => new Set((questions ?? []).map((q) => norm(q.text))),
    [questions],
  );

  const filtered = (questions ?? []).filter((q) =>
    filter === 'all' ? true : filter === 'answered' ? !!q.answeredAt : !q.answeredAt,
  );

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.questions.title}</h1>
        <p className="hero__sub">{t.questions.subtitle}</p>
      </header>

      <form
        className="row"
        style={{ marginBottom: 'var(--space-4)' }}
        onSubmit={(e) => {
          e.preventDefault();
          void add(text);
        }}
      >
        <input
          className="input"
          placeholder={t.questions.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn--primary" type="submit" disabled={!text.trim()}>
          {t.questions.add}
        </button>
      </form>

      {questions && questions.length > 0 ? (
        <>
          <div className="chips" style={{ marginBottom: 'var(--space-4)' }}>
            {(['all', 'open', 'answered'] as const).map((f) => (
              <button
                key={f}
                className={`chipbtn${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? t.saved.all : f === 'open' ? t.questions.title : t.questions.answered}
              </button>
            ))}
          </div>

          <div className="stack">
            {filtered.map((q) => {
              const linked = q.linkedTopicIds ?? matchTopics(q.text);
              return (
                <article key={q.id} className={`q-card${q.answeredAt ? ' is-answered' : ''}`}>
                  <div className="q-card__head">
                    <p className="q-card__text">{q.text}</p>
                    <button
                      className="btn btn--quiet btn--sm popmenu__danger"
                      onClick={() => void deleteQuestion(q.id)}
                      aria-label={t.notes.delete}
                    >
                      ✕
                    </button>
                  </div>
                  <LinkedTopics ids={linked} />
                  {q.answerNote ? <p className="q-card__answer">{q.answerNote}</p> : null}
                  <div className="row">
                    {q.answeredAt ? (
                      <Chip tone="accent">✓ {t.questions.answered}</Chip>
                    ) : (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => {
                          const note = window.prompt(t.questions.markAnswered);
                          void updateQuestion(q.id, {
                            answeredAt: Date.now(),
                            ...(note && note.trim() ? { answerNote: note.trim() } : {}),
                          });
                        }}
                      >
                        {t.questions.markAnswered}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState glyph="?" title={t.questions.empty} hint={t.questions.emptyHint} />
      )}

      <section className="section" style={{ marginTop: 'var(--space-6)' }}>
        <SectionHead
          title={t.questions.examples}
          action={
            <button className="btn btn--ghost btn--sm" onClick={() => setShowExamples((v) => !v)}>
              {showExamples ? '−' : '+'}
            </button>
          }
        />
        {showExamples ? (
          <div className="stack">
            {library.questions.map((seed) => {
              const already = existingText.has(norm(tr(seed.text)));
              return (
                <div key={seed.id} className="seed-q">
                  <span className="grow">{tr(seed.text)}</span>
                  <button
                    className="btn btn--quiet btn--sm"
                    disabled={already}
                    onClick={() => void add(tr(seed.text))}
                  >
                    {already ? '✓' : t.questions.add}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
