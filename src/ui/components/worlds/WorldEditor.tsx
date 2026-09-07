import { useState } from 'react';
import { Link } from 'react-router-dom';
import { library, t as tr } from '@/content';
import {
  WORLD_STATUSES,
  lineageOf,
  reasoningDepth,
  type Consequence,
  type ConsequenceKind,
  type ConsequenceLevel,
  type ParallelWorld,
  type ResolvedWorld,
} from '@/domain/worlds';
import { ConsequenceBoard } from './ConsequenceBoard';
import { STATUS_LABEL } from './labels';

/**
 * One thought experiment, as a workspace.
 *
 * The order on screen is the order of the reasoning: what the system is, the
 * single thing that changed, what follows at three depths, what is still open,
 * and only then a conclusion. Fields save on blur — this is a notebook, not a
 * form with a submit button at the bottom.
 */

interface Props {
  world: ResolvedWorld;
  byId: ReadonlyMap<string, ParallelWorld>;
  consequences: Consequence[];
  onPatch: (patch: Partial<ParallelWorld>) => void;
  onAddConsequence: (kind: ConsequenceKind, level: ConsequenceLevel, text: string) => void;
  onEditConsequence: (id: string, text: string) => void;
  onDeleteConsequence: (id: string) => void;
  onLink: (childId: string, parentId: string) => void;
  onUnlink: (childId: string, parentId: string) => void;
  onBranch: () => void;
  onDelete: () => void;
  onCompare: () => void;
  onSelect: (id: string) => void;
}

export function WorldEditor({
  world,
  byId,
  consequences,
  onPatch,
  onAddConsequence,
  onEditConsequence,
  onDeleteConsequence,
  onLink,
  onUnlink,
  onBranch,
  onDelete,
  onCompare,
  onSelect,
}: Props) {
  const [questionDraft, setQuestionDraft] = useState('');
  const lineage = lineageOf(world.id, byId);
  const depth = reasoningDepth(consequences);
  const topics = world.topicIds
    .map((id) => library.topicById.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const addQuestion = () => {
    const text = questionDraft.trim();
    if (!text) return;
    onPatch({ openQuestions: [...world.openQuestions, text] });
    setQuestionDraft('');
  };

  return (
    <div className="wed">
      {/* ------------------------------ header ----------------------------- */}
      <header className="wed__head">
        <input
          className="wed__title"
          value={world.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          aria-label="სამყაროს სათაური"
        />
        <div className="wed__meta">
          <select
            className="ask-select"
            value={world.status}
            onChange={(e) => onPatch({ status: e.target.value as ParallelWorld['status'] })}
          >
            {WORLD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button
            className={`ask-tool${world.favorite ? ' is-on' : ''}`}
            onClick={() => onPatch({ favorite: !world.favorite })}
            title="რჩეული"
          >
            ★
          </button>
          <button className="ask-tool" onClick={onBranch} title="ამ წერტილიდან ტოტის გაშვება">
            ⑂ ტოტი
          </button>
          <button className="ask-tool" onClick={onCompare} title="შედარება">
            ⇄ შედარება
          </button>
          <button className="ask-tool" onClick={onDelete} title="წაშლა">
            ✕
          </button>
        </div>
      </header>

      {/* lineage — where this branch came from */}
      {lineage.length > 1 ? (
        <nav className="wed__lineage" aria-label="ტოტის წარმომავლობა">
          {lineage.map((step, i) => (
            <span key={step.id}>
              {i > 0 ? <span className="wed__arrow" aria-hidden="true">→</span> : null}
              <button
                className={`wed__crumb${step.id === world.id ? ' is-current' : ''}`}
                onClick={() => onSelect(step.id)}
              >
                {step.title}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      {/* --------------------------- base and change ----------------------- */}
      <div className="wed__rules">
        <label className="wed__field">
          <span className="wed__label">
            ბაზისური რეალობა
            {world.inherited.baseRule ? (
              <em className="wed__inherited" title="მემკვიდრეობით მშობელი სამყაროდან">
                მემკვიდრეობითი
              </em>
            ) : null}
          </span>
          <textarea
            className="textarea wed__mono"
            rows={2}
            placeholder="რა წესი მოქმედებს ახლა?"
            value={world.baseRule}
            onChange={(e) => onPatch({ baseRule: e.target.value })}
          />
        </label>

        <label className="wed__field wed__field--change">
          <span className="wed__label">შეცვლილი წესი</span>
          <textarea
            className="textarea wed__mono"
            rows={2}
            placeholder="ერთი რამ, რაც შეიცვალა"
            value={world.changedRule}
            onChange={(e) => onPatch({ changedRule: e.target.value })}
          />
        </label>
      </div>

      {/* ------------------------------ links ------------------------------ */}
      <div className="wed__links">
        <span className="wed__label">ლაბოს თემები</span>
        <select
          className="ask-select"
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (id && !world.topicIds.includes(id)) {
              onPatch({ topicIds: [...world.topicIds, id] });
            }
          }}
        >
          <option value="">+ თემის მიბმა…</option>
          {library.topics.slice(0, 200).map((topic) => (
            <option key={topic.id} value={topic.id}>
              {tr(topic.title)}
            </option>
          ))}
        </select>
        {topics.map((topic) => (
          <span key={topic.id} className="ask-chip ask-chip--sm wed__topic">
            <Link to={`/topics/${topic.id}`}>{tr(topic.title)}</Link>
            <button
              className="wed__unlink"
              title="მოხსნა"
              onClick={() => onPatch({ topicIds: world.topicIds.filter((x) => x !== topic.id) })}
            >
              ✕
            </button>
          </span>
        ))}
        {world.inherited.topicIds ? (
          <em className="wed__inherited">მემკვიდრეობითი</em>
        ) : null}
      </div>

      {/* --------------------------- consequences -------------------------- */}
      <section className="wed__section">
        <header className="wed__sechead">
          <h2 className="wed__h2">შედეგები</h2>
          <span className="wed__depth" title="რამდენად ღრმად მიდის მსჯელობა">
            სიღრმე {depth}/3
          </span>
        </header>
        <ConsequenceBoard
          consequences={consequences}
          onAdd={onAddConsequence}
          onEdit={onEditConsequence}
          onDelete={onDeleteConsequence}
          onLink={onLink}
          onUnlink={onUnlink}
        />
      </section>

      {/* -------------------------- open questions ------------------------- */}
      <section className="wed__section">
        <h2 className="wed__h2">ღია კითხვები</h2>
        <ul className="wed__questions">
          {world.openQuestions.map((q, i) => (
            <li key={`${q}-${i}`}>
              <span>{q}</span>
              <button
                className="btn btn--quiet btn--sm popmenu__danger"
                onClick={() =>
                  onPatch({ openQuestions: world.openQuestions.filter((_, j) => j !== i) })
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="wed__qadd">
          <input
            className="input input--sm"
            placeholder="რა რჩება გაურკვეველი?"
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addQuestion();
              }
            }}
          />
          <button className="btn btn--ghost btn--sm" disabled={!questionDraft.trim()} onClick={addQuestion}>
            დამატება
          </button>
        </div>
      </section>

      {/* ----------------------------- conclusion -------------------------- */}
      <section className="wed__section">
        <h2 className="wed__h2">დასკვნა</h2>
        <textarea
          className="textarea"
          rows={3}
          placeholder="რას ასწავლის ეს სამყარო რეალურზე?"
          value={world.conclusion}
          onChange={(e) => onPatch({ conclusion: e.target.value })}
        />
      </section>
    </div>
  );
}
