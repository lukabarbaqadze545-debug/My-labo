import { useEffect, useState } from 'react';
import { t as tr, type Activity, type ActivityBody } from '@/content';
import { getActivityProgress, saveActivityProgress } from '@/persistence/repositories';
import { useApp, useT } from '../state/AppState';
import { Chip, DifficultyChip } from './primitives';
import { Simulation } from '../labs/Simulation';

/**
 * Runs any activity kind.
 *
 * Design rules, from the research: no score, no streak, no "you failed". The
 * predict-first pattern is enforced for `predict` activities — the reveal
 * button stays disabled until the user has actually committed to an answer,
 * because that commitment is what makes the reveal land.
 */
export function ActivityRunner({ activity }: { activity: Activity }) {
  const t = useT();
  const { track } = useApp();
  const [progress, setProgress] = useState<{ prediction?: string; completedAt?: number } | undefined>();

  useEffect(() => {
    let cancelled = false;
    void getActivityProgress(activity.id).then((stored) => {
      if (!cancelled && stored) setProgress({ ...(stored.prediction ? { prediction: stored.prediction } : {}), ...(stored.completedAt ? { completedAt: stored.completedAt } : {}) });
    });
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  const markDone = () => {
    void saveActivityProgress(activity.id, { completedAt: Date.now() });
    track({ type: 'activity', subjectId: activity.subjectId, ...(activity.topicId ? { topicId: activity.topicId } : {}) });
  };

  return (
    <section className="activity" id={`activity-${activity.id}`}>
      <header className="activity__head">
        <div>
          <p className="activity__invite">{tr(activity.invitation)}</p>
          <h3 className="activity__title">{tr(activity.title)}</h3>
        </div>
        <div className="activity__meta">
          <DifficultyChip level={activity.difficulty} />
          {activity.estimatedMinutes ? <Chip>{t.activity.minutes(activity.estimatedMinutes)}</Chip> : null}
          {progress?.completedAt ? <Chip tone="strong">{t.activity.done}</Chip> : null}
        </div>
      </header>

      <div className="activity__body">
        <Body
          body={activity.body}
          activityId={activity.id}
          savedPrediction={progress?.prediction}
          onComplete={markDone}
        />
      </div>
    </section>
  );
}

function Body({
  body,
  activityId,
  savedPrediction,
  onComplete,
}: {
  body: ActivityBody;
  activityId: string;
  savedPrediction?: string;
  onComplete: () => void;
}) {
  switch (body.kind) {
    case 'predict':
      return <Predict body={body} activityId={activityId} saved={savedPrediction} onComplete={onComplete} />;
    case 'quiz':
      return <Quiz body={body} onComplete={onComplete} />;
    case 'classify':
      return <Classify body={body} onComplete={onComplete} />;
    case 'order':
      return <Ordering body={body} onComplete={onComplete} />;
    case 'estimate':
      return <Estimate body={body} onComplete={onComplete} />;
    case 'sim':
      return (
        <>
          {body.prompt ? <p className="activity__prompt">{tr(body.prompt)}</p> : null}
          <Simulation name={body.sim} />
        </>
      );
  }
}

/* -------------------------------- predict -------------------------------- */

function Predict({
  body,
  activityId,
  saved,
  onComplete,
}: {
  body: Extract<ActivityBody, { kind: 'predict' }>;
  activityId: string;
  saved?: string;
  onComplete: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(saved ?? '');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (saved) setText(saved);
  }, [saved]);

  const canReveal = text.trim().length >= 3;

  const reveal = () => {
    setRevealed(true);
    void saveActivityProgress(activityId, { prediction: text.trim() });
    onComplete();
  };

  return (
    <>
      <p className="activity__prompt">{tr(body.prompt)}</p>
      {body.hint ? (
        <p className="xsmall muted">
          <span aria-hidden="true">💭</span> {tr(body.hint)}
        </p>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor={`predict-${activityId}`}>
          {t.activity.yourPrediction}
        </label>
        <textarea
          id={`predict-${activityId}`}
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.activity.predictionPlaceholder}
        />
      </div>

      {!revealed ? (
        <button className="btn btn--primary" disabled={!canReveal} onClick={reveal}>
          {canReveal ? t.activity.reveal : t.activity.revealLocked}
        </button>
      ) : (
        <div className="reveal">
          <p className="reveal__label">{t.activity.answer}</p>
          <p>{tr(body.reveal)}</p>
        </div>
      )}
    </>
  );
}

/* --------------------------------- quiz ---------------------------------- */

function Quiz({
  body,
  onComplete,
}: {
  body: Extract<ActivityBody, { kind: 'quiz' }>;
  onComplete: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const question = body.questions[index];
  if (!question) return null;

  const answered = picked !== null;
  const isLast = index === body.questions.length - 1;

  const next = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  };

  return (
    <>
      <div className="row row--between">
        <div className="progressdots" aria-hidden="true">
          {body.questions.map((_, i) => (
            <span
              key={i}
              className={
                i < index
                  ? 'progressdots__dot progressdots__dot--done'
                  : i === index
                    ? 'progressdots__dot progressdots__dot--current'
                    : 'progressdots__dot'
              }
            />
          ))}
        </div>
        <span className="xsmall muted">
          {index + 1} / {body.questions.length}
        </span>
      </div>

      <p className="activity__prompt">{tr(question.prompt)}</p>

      <div className="stack">
        {question.options.map((option, i) => {
          let cls = 'option';
          if (answered) {
            if (option.correct) cls = 'option option--correct';
            else if (i === picked) cls = 'option option--wrong';
          }
          return (
            <button key={i} className={cls} disabled={answered} onClick={() => setPicked(i)}>
              <span className="option__marker" aria-hidden="true">
                {answered ? (option.correct ? '✓' : i === picked ? '×' : '') : String.fromCharCode(65 + i)}
              </span>
              <span>{tr(option.text)}</span>
            </button>
          );
        })}
      </div>

      {answered ? (
        <>
          <div className="reveal">
            <p className="reveal__label">{t.activity.explanation}</p>
            <p>{tr(question.explain)}</p>
          </div>
          <button className="btn btn--primary" onClick={next}>
            {isLast ? t.activity.finish : t.activity.next}
          </button>
        </>
      ) : null}
    </>
  );
}

/* -------------------------------- classify -------------------------------- */

function Classify({
  body,
  onComplete,
}: {
  body: Extract<ActivityBody, { kind: 'classify' }>;
  onComplete: () => void;
}) {
  const t = useT();
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const allAssigned = body.items.every((item) => assignments[item.id]);

  return (
    <>
      <div className="stack">
        {body.items.map((item) => {
          const assigned = assignments[item.id];
          const correct = checked && assigned === item.bucketId;
          const wrong = checked && assigned !== undefined && assigned !== item.bucketId;
          return (
            <div
              key={item.id}
              className={`orderitem${correct ? ' orderitem--correct' : ''}${wrong ? ' orderitem--wrong' : ''}`}
            >
              <span className="orderitem__label">{tr(item.label)}</span>
              <select
                className="select"
                style={{ width: 'auto', minWidth: 150 }}
                value={assigned ?? ''}
                disabled={checked}
                onChange={(e) => setAssignments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                aria-label={tr(item.label)}
              >
                <option value="">—</option>
                {body.buckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {tr(bucket.label)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {!checked ? (
        <button
          className="btn btn--primary"
          disabled={!allAssigned}
          onClick={() => {
            setChecked(true);
            onComplete();
          }}
        >
          {t.activity.check}
        </button>
      ) : (
        <>
          <div className="reveal">
            <p className="reveal__label">{t.activity.explanation}</p>
            <ul className="blocklist" style={{ margin: 0 }}>
              {body.items.map((item) =>
                item.explain ? (
                  <li key={item.id} className="blocklist__item">
                    <span className="blocklist__marker" aria-hidden="true">
                      {assignments[item.id] === item.bucketId ? '✓' : '→'}
                    </span>
                    <span>
                      <strong>{tr(item.label)}</strong> — {tr(item.explain)}
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setChecked(false);
              setAssignments({});
            }}
          >
            {t.activity.reset}
          </button>
        </>
      )}
    </>
  );
}

/* -------------------------------- ordering -------------------------------- */

function shuffleStable<T>(items: readonly T[]): T[] {
  // Deterministic reversal + rotation: always a "wrong" starting order without
  // the flicker of Math.random on every render.
  const out = [...items];
  out.reverse();
  const first = out.shift();
  if (first) out.splice(Math.floor(out.length / 2), 0, first);
  return out;
}

function Ordering({
  body,
  onComplete,
}: {
  body: Extract<ActivityBody, { kind: 'order' }>;
  onComplete: () => void;
}) {
  const t = useT();
  const [order, setOrder] = useState(() => shuffleStable(body.items));
  const [checked, setChecked] = useState(false);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const item = next[from];
    if (!item) return;
    next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };

  return (
    <>
      <p className="activity__prompt">{tr(body.instruction)}</p>
      <p className="xsmall muted">{t.activity.dragHint}</p>

      <ol className="orderlist">
        {order.map((item, i) => {
          const correct = checked && body.items[i]?.id === item.id;
          const wrong = checked && !correct;
          return (
            <li
              key={item.id}
              className={`orderitem${correct ? ' orderitem--correct' : ''}${wrong ? ' orderitem--wrong' : ''}`}
            >
              <span className="orderitem__index">{i + 1}</span>
              <span className="orderitem__label">{tr(item.label)}</span>
              {!checked ? (
                <span className="orderitem__controls">
                  <button className="iconbtn" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t.activity.moveUp}>
                    ↑
                  </button>
                  <button
                    className="iconbtn"
                    disabled={i === order.length - 1}
                    onClick={() => move(i, i + 1)}
                    aria-label={t.activity.moveDown}
                  >
                    ↓
                  </button>
                </span>
              ) : (
                <span aria-hidden="true">{correct ? '✓' : '×'}</span>
              )}
            </li>
          );
        })}
      </ol>

      {!checked ? (
        <button
          className="btn btn--primary"
          onClick={() => {
            setChecked(true);
            onComplete();
          }}
        >
          {t.activity.check}
        </button>
      ) : (
        <>
          {body.explain ? (
            <div className="reveal">
              <p className="reveal__label">{t.activity.explanation}</p>
              <p>{tr(body.explain)}</p>
            </div>
          ) : null}
          <button
            className="btn btn--ghost"
            onClick={() => {
              setChecked(false);
              setOrder(shuffleStable(body.items));
            }}
          >
            {t.activity.reset}
          </button>
        </>
      )}
    </>
  );
}

/* -------------------------------- estimate -------------------------------- */

function Estimate({
  body,
  onComplete,
}: {
  body: Extract<ActivityBody, { kind: 'estimate' }>;
  onComplete: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const [checked, setChecked] = useState(false);
  const numeric = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(numeric);
  const close = valid && Math.abs(numeric - body.answer) <= body.tolerance;

  return (
    <>
      <p className="activity__prompt">{tr(body.prompt)}</p>
      <div className="row">
        <input
          className="input"
          style={{ maxWidth: 200 }}
          inputMode="decimal"
          value={value}
          disabled={checked}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t.activity.estimatePlaceholder}
          aria-label={t.activity.estimatePlaceholder}
        />
        {body.unit ? <span className="muted small">{body.unit}</span> : null}
        {!checked ? (
          <button
            className="btn btn--primary"
            disabled={!valid}
            onClick={() => {
              setChecked(true);
              onComplete();
            }}
          >
            {t.activity.check}
          </button>
        ) : null}
      </div>

      {checked ? (
        <>
          <div className="row">
            <Chip tone={close ? 'strong' : 'caution'}>{close ? t.activity.correct : t.activity.incorrect}</Chip>
            <span className="small muted">
              {t.activity.yourAnswer}: {value} {body.unit ?? ''}
            </span>
          </div>
          <div className="reveal">
            <p className="reveal__label">{t.activity.explanation}</p>
            <p>{tr(body.explain)}</p>
          </div>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setChecked(false);
              setValue('');
            }}
          >
            {t.activity.reset}
          </button>
        </>
      ) : null}
    </>
  );
}
