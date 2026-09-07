import { useState } from 'react';
import {
  CONSEQUENCE_KINDS,
  CONSEQUENCE_LEVELS,
  byLevel,
  causalChildren,
  wouldCycle,
  type Consequence,
  type ConsequenceKind,
  type ConsequenceLevel,
} from '@/domain/worlds';
import { KIND_GLYPH, KIND_LABEL, LEVEL_HINT, LEVEL_LABEL } from './labels';

/**
 * Consequences, arranged by depth.
 *
 * The three columns are the argument itself: what follows directly, what
 * follows from that, and what changes at the level of a whole system. Laying
 * them out side by side is what makes a one-step answer visibly incomplete —
 * an empty third column is a question the user has not answered yet.
 */

interface Props {
  consequences: Consequence[];
  onAdd: (kind: ConsequenceKind, level: ConsequenceLevel, text: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onLink: (childId: string, parentId: string) => void;
  onUnlink: (childId: string, parentId: string) => void;
}

export function ConsequenceBoard({
  consequences,
  onAdd,
  onEdit,
  onDelete,
  onLink,
  onUnlink,
}: Props) {
  const [draftLevel, setDraftLevel] = useState<ConsequenceLevel | null>(null);
  const [draftKind, setDraftKind] = useState<ConsequenceKind>('effect');
  const [draftText, setDraftText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  const grouped = byLevel(consequences);
  const byId = new Map(consequences.map((c) => [c.id, c]));

  const submit = (level: ConsequenceLevel) => {
    if (!draftText.trim()) return;
    onAdd(draftKind, level, draftText);
    setDraftText('');
    setDraftLevel(null);
  };

  return (
    <div className="cboard">
      {CONSEQUENCE_LEVELS.map((level) => {
        const list = grouped.get(level) ?? [];
        return (
          <section key={level} className="cboard__col">
            <header className="cboard__head">
              <span className="cboard__level">L{level}</span>
              <span className="cboard__label">{LEVEL_LABEL[level]}</span>
              <span className="cboard__count">{list.length}</span>
            </header>
            <p className="cboard__hint">{LEVEL_HINT[level]}</p>

            <ul className="cboard__list">
              {list.map((c) => {
                const causes = c.causedBy.map((id) => byId.get(id)).filter(Boolean) as Consequence[];
                const effects = causalChildren(c.id, consequences);
                return (
                  <li key={c.id} className={`ccard ccard--${c.kind}`}>
                    <div className="ccard__top">
                      <span className="ccard__kind" title={KIND_LABEL[c.kind]}>
                        {KIND_GLYPH[c.kind]} {KIND_LABEL[c.kind]}
                      </span>
                      <span className="ccard__actions">
                        <button
                          className="btn btn--quiet btn--sm"
                          title="მიზეზობრივი კავშირი"
                          onClick={() => setLinking(linking === c.id ? null : c.id)}
                        >
                          ⇢
                        </button>
                        <button
                          className="btn btn--quiet btn--sm"
                          title="რედაქტირება"
                          onClick={() => setEditing(editing === c.id ? null : c.id)}
                        >
                          ✎
                        </button>
                        <button
                          className="btn btn--quiet btn--sm popmenu__danger"
                          title="წაშლა"
                          onClick={() => onDelete(c.id)}
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    {editing === c.id ? (
                      <textarea
                        className="textarea"
                        rows={3}
                        autoFocus
                        defaultValue={c.text}
                        onBlur={(e) => {
                          onEdit(c.id, e.target.value);
                          setEditing(null);
                        }}
                      />
                    ) : (
                      <p className="ccard__text">{c.text}</p>
                    )}

                    {causes.length > 0 ? (
                      <ul className="ccard__causes">
                        {causes.map((cause) => (
                          <li key={cause.id}>
                            <span className="ccard__because">გამომდინარეობს</span>
                            <span className="ccard__causetext">{cause.text}</span>
                            <button
                              className="btn btn--quiet btn--sm"
                              title="კავშირის მოხსნა"
                              onClick={() => onUnlink(c.id, cause.id)}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {effects.length > 0 ? (
                      <p className="ccard__leads">→ {effects.length} შემდგომი შედეგი</p>
                    ) : null}

                    {linking === c.id ? (
                      <div className="ccard__linker">
                        <span className="xsmall muted">რისგან გამომდინარეობს?</span>
                        {consequences
                          .filter((other) => !wouldCycle(c.id, other.id, consequences))
                          .filter((other) => !c.causedBy.includes(other.id))
                          .map((other) => (
                            <button
                              key={other.id}
                              className="ask-chip ask-chip--sm"
                              onClick={() => {
                                onLink(c.id, other.id);
                                setLinking(null);
                              }}
                            >
                              L{other.level} · {other.text.slice(0, 40)}
                            </button>
                          ))}
                        {consequences.filter(
                          (other) => !wouldCycle(c.id, other.id, consequences) && !c.causedBy.includes(other.id),
                        ).length === 0 ? (
                          <span className="xsmall muted">დასაკავშირებელი არაფერია.</span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {draftLevel === level ? (
              <div className="cboard__draft">
                <div className="cboard__kinds">
                  {CONSEQUENCE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      className={`ask-chip ask-chip--sm${draftKind === kind ? ' ask-chip--action' : ''}`}
                      onClick={() => setDraftKind(kind)}
                    >
                      {KIND_GLYPH[kind]} {KIND_LABEL[kind]}
                    </button>
                  ))}
                </div>
                <textarea
                  className="textarea"
                  rows={3}
                  autoFocus
                  placeholder="რა გამომდინარეობს აქედან?"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(level);
                    if (e.key === 'Escape') setDraftLevel(null);
                  }}
                />
                <div className="row">
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={!draftText.trim()}
                    onClick={() => submit(level)}
                  >
                    დამატება
                  </button>
                  <button className="btn btn--quiet btn--sm" onClick={() => setDraftLevel(null)}>
                    გაუქმება
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="cboard__add"
                onClick={() => {
                  setDraftLevel(level);
                  setDraftText('');
                }}
              >
                + შედეგის დამატება
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
