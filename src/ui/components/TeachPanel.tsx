import { useState } from 'react';
import { library, t } from '@/content';
import { PHILOSOPHY } from '@/content/philosophy';
import {
  addUserAlias,
  addUserKnowledge,
  deleteUserAlias,
  deleteUserKnowledge,
} from '@/persistence/repositories';
import type { TaughtKind } from '@/persistence/db';
import { useTeachings } from '../state/useTeachings';
import { useT } from '../state/AppState';

/**
 * Teach Labo.
 *
 * Two things can be taught, matching the two ways the assistant fails: a word
 * it did not recognise (an alias) and a fact it did not hold (knowledge).
 * Both are stored locally and applied on the next message.
 */

const FACETS: { value: string; label: string }[] = [
  { value: 'simple', label: 'მარტივი ახსნა' },
  { value: 'example', label: 'მაგალითი' },
  { value: 'limitation', label: 'შეზღუდვა' },
  { value: 'whenToUse', label: 'როდის გამოვიყენოთ' },
  { value: 'why', label: 'რატომ მუშაობს' },
  { value: 'compare', label: 'შედარება' },
  { value: 'definition', label: 'განმარტება' },
];

const KINDS: { value: TaughtKind; label: string }[] = [
  { value: 'facet', label: 'ცოდნა თემაზე' },
  { value: 'claim', label: 'ფილოსოფიური მტკიცება' },
  { value: 'argument', label: 'არგუმენტი' },
  { value: 'socratic', label: 'სოკრატესეული კითხვა' },
];

export function TeachPanel() {
  const t9n = useT();
  const { aliases, knowledge } = useTeachings();
  const [tab, setTab] = useState<'word' | 'knowledge'>('word');

  // Teach a word
  const [forms, setForms] = useState('');
  const [concept, setConcept] = useState('');
  const [label, setLabel] = useState('');

  // Teach knowledge
  const [kind, setKind] = useState<TaughtKind>('facet');
  const [topicId, setTopicId] = useState('');
  const [facet, setFacet] = useState('example');
  const [conceptId, setConceptId] = useState('free-will');
  const [text, setText] = useState('');

  const [saved, setSaved] = useState<string | null>(null);
  const flash = (msg: string) => {
    setSaved(msg);
    window.setTimeout(() => setSaved(null), 1800);
  };

  const submitWord = async () => {
    const list = forms.split(',').map((f) => f.trim()).filter(Boolean);
    const added = await addUserAlias(concept, label, list);
    if (added) {
      setForms('');
      setLabel('');
      flash(t9n.teach.savedWord);
    }
  };

  const submitKnowledge = async () => {
    const added = await addUserKnowledge({
      kind,
      ...(kind === 'facet' ? { topicId, facet } : { concept: conceptId }),
      text,
    });
    if (added) {
      setText('');
      flash(t9n.teach.savedKnowledge);
    }
  };

  return (
    <div className="teach">
      <div className="teach__tabs">
        <button
          className={`chipbtn${tab === 'word' ? ' is-active' : ''}`}
          onClick={() => setTab('word')}
        >
          {t9n.teach.tabWord}
        </button>
        <button
          className={`chipbtn${tab === 'knowledge' ? ' is-active' : ''}`}
          onClick={() => setTab('knowledge')}
        >
          {t9n.teach.tabKnowledge}
        </button>
      </div>

      {tab === 'word' ? (
        <div className="teach__form">
          <p className="xsmall muted">{t9n.teach.wordHint}</p>
          <label className="field">
            <span className="field__label">{t9n.teach.forms}</span>
            <input
              className="input"
              placeholder="binary search, ორობითი ძებნა, bin search"
              value={forms}
              onChange={(e) => setForms(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t9n.teach.concept}</span>
            <select className="input" value={concept} onChange={(e) => setConcept(e.target.value)}>
              <option value="">—</option>
              {library.topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {t(topic.title)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">{t9n.teach.label}</span>
            <input
              className="input"
              placeholder={t9n.teach.labelPlaceholder}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <button
            className="btn btn--primary btn--sm"
            disabled={!forms.trim() || !concept}
            onClick={() => void submitWord()}
          >
            {t9n.teach.save}
          </button>

          {aliases.length > 0 ? (
            <ul className="teach__list">
              {aliases.map((row) => (
                <li key={row.id} className="teach__item">
                  <span>
                    <strong>{row.label}</strong> — {row.forms.join(', ')}
                  </span>
                  <button className="btn btn--quiet btn--sm" onClick={() => void deleteUserAlias(row.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="teach__form">
          <p className="xsmall muted">{t9n.teach.knowledgeHint}</p>
          <label className="field">
            <span className="field__label">{t9n.teach.kind}</span>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as TaughtKind)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          {kind === 'facet' ? (
            <>
              <label className="field">
                <span className="field__label">{t9n.teach.topic}</span>
                <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                  <option value="">—</option>
                  {library.topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {t(topic.title)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">{t9n.teach.facet}</span>
                <select className="input" value={facet} onChange={(e) => setFacet(e.target.value)}>
                  {FACETS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="field">
              <span className="field__label">{t9n.teach.philConcept}</span>
              <select className="input" value={conceptId} onChange={(e) => setConceptId(e.target.value)}>
                {PHILOSOPHY.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span className="field__label">{t9n.teach.text}</span>
            <textarea
              className="textarea"
              rows={3}
              placeholder={t9n.teach.textPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <button
            className="btn btn--primary btn--sm"
            disabled={!text.trim() || (kind === 'facet' && !topicId)}
            onClick={() => void submitKnowledge()}
          >
            {t9n.teach.save}
          </button>

          {knowledge.length > 0 ? (
            <ul className="teach__list">
              {knowledge.map((row) => (
                <li key={row.id} className="teach__item">
                  <span>
                    <em>{row.facet ?? row.kind}</em> · {row.text.slice(0, 70)}
                  </span>
                  <button
                    className="btn btn--quiet btn--sm"
                    onClick={() => void deleteUserKnowledge(row.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {saved ? <p className="xsmall" style={{ color: 'var(--success)' }}>{saved}</p> : null}
    </div>
  );
}
