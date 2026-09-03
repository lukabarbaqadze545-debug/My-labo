import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { library, t as tr } from '@/content';
import type { UserNote } from '@/persistence/db';
import { createNote, deleteNote, listNotes, updateNote } from '@/persistence/repositories';
import { useApp, useT } from '../state/AppState';
import { Chip, EmptyState } from '../components/primitives';

type Kind = UserNote['kind'];
const KINDS: Kind[] = ['observation', 'question', 'idea', 'hypothesis', 'note'];

const norm = (s: string) => s.normalize('NFC').toLowerCase();
const parseTags = (raw: string) =>
  raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

function kindLabel(t: ReturnType<typeof useT>, k: Kind): string {
  return k === 'observation'
    ? t.notes.kindObservation
    : k === 'question'
      ? t.notes.kindQuestion
      : k === 'idea'
        ? t.notes.kindIdea
        : k === 'hypothesis'
          ? t.notes.kindHypothesis
          : t.notes.kindNote;
}

interface Draft {
  id?: string;
  kind: Kind;
  title: string;
  body: string;
  subjectId: string;
  topicId: string;
  tags: string;
}

const emptyDraft: Draft = { kind: 'observation', title: '', body: '', subjectId: '', topicId: '', tags: '' };

function NoteComposer({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const { subjects } = useApp();
  const topics = draft.subjectId ? (library.topicsBySubject.get(draft.subjectId) ?? []) : [];

  return (
    <div className="composer">
      <div className="composer__row">
        <select
          className="input input--sm"
          value={draft.kind}
          onChange={(e) => onChange({ ...draft, kind: e.target.value as Kind })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(t, k)}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder={t.notes.titlePlaceholder}
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </div>
      <textarea
        className="textarea"
        placeholder={t.notes.bodyPlaceholder}
        value={draft.body}
        rows={4}
        onChange={(e) => onChange({ ...draft, body: e.target.value })}
      />
      <div className="composer__row">
        <select
          className="input input--sm"
          value={draft.subjectId}
          onChange={(e) => onChange({ ...draft, subjectId: e.target.value, topicId: '' })}
        >
          <option value="">{t.notes.noTopic}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {tr(s.name)}
            </option>
          ))}
        </select>
        <select
          className="input input--sm"
          value={draft.topicId}
          disabled={topics.length === 0}
          onChange={(e) => onChange({ ...draft, topicId: e.target.value })}
        >
          <option value="">{t.notes.linkTopic}…</option>
          {topics.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tr(tp.title)}
            </option>
          ))}
        </select>
        <input
          className="input input--sm"
          placeholder="#თეგები"
          value={draft.tags}
          onChange={(e) => onChange({ ...draft, tags: e.target.value })}
        />
      </div>
      <div className="composer__actions">
        <button className="btn btn--primary btn--sm" onClick={onSave} disabled={!draft.body.trim()}>
          {t.notes.save}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onCancel}>
          {t.notes.cancel}
        </button>
      </div>
    </div>
  );
}

export function NotesPage() {
  const t = useT();
  const { subjectById } = useApp();
  const notes = useLiveQuery(() => listNotes(), []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return (notes ?? []).filter((n) => {
      if (kindFilter !== 'all' && n.kind !== kindFilter) return false;
      if (!q) return true;
      return norm(`${n.title ?? ''} ${n.body} ${(n.tags ?? []).join(' ')}`).includes(q);
    });
  }, [notes, query, kindFilter]);

  const startNew = () => setDraft({ ...emptyDraft });
  const startEdit = (n: UserNote) =>
    setDraft({
      id: n.id,
      kind: n.kind,
      title: n.title ?? '',
      body: n.body,
      subjectId: n.subjectId ?? '',
      topicId: n.topicId ?? '',
      tags: (n.tags ?? []).join(', '),
    });

  const save = async () => {
    if (!draft) return;
    const payload = {
      kind: draft.kind,
      body: draft.body.trim(),
      ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
      ...(draft.subjectId ? { subjectId: draft.subjectId } : {}),
      ...(draft.topicId ? { topicId: draft.topicId } : {}),
      ...(parseTags(draft.tags).length ? { tags: parseTags(draft.tags) } : {}),
    };
    if (draft.id) await updateNote(draft.id, payload);
    else await createNote(payload);
    setDraft(null);
  };

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.notes.title}</h1>
        <p className="hero__sub">{t.notes.subtitle}</p>
      </header>

      {draft ? (
        <NoteComposer draft={draft} onChange={setDraft} onSave={() => void save()} onCancel={() => setDraft(null)} />
      ) : (
        <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
          <button className="btn btn--primary" onClick={startNew}>
            + {t.notes.newNote}
          </button>
        </div>
      )}

      {notes && notes.length > 0 ? (
        <>
          <div className="filterbar">
            <input
              className="input"
              type="search"
              placeholder={t.notes.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="chips">
              <button
                className={`chipbtn${kindFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => setKindFilter('all')}
              >
                {t.saved.all}
              </button>
              {KINDS.map((k) => (
                <button
                  key={k}
                  className={`chipbtn${kindFilter === k ? ' is-active' : ''}`}
                  onClick={() => setKindFilter(k)}
                >
                  {kindLabel(t, k)}
                </button>
              ))}
            </div>
          </div>

          <p className="xsmall muted">{t.notes.count(filtered.length)}</p>

          <div className="stack mt-4">
            {filtered.map((n) => {
              const subject = n.subjectId ? subjectById.get(n.subjectId) : undefined;
              const topic = n.topicId ? library.topicById.get(n.topicId) : undefined;
              return (
                <article key={n.id} className="note-card">
                  <div className="note-card__head">
                    <Chip tone={n.kind === 'question' ? 'caution' : 'accent'}>{kindLabel(t, n.kind)}</Chip>
                    {n.title ? <span className="note-card__title">{n.title}</span> : null}
                    <span className="grow" />
                    <button className="btn btn--quiet btn--sm" onClick={() => startEdit(n)}>
                      {t.notes.edit}
                    </button>
                    <button
                      className="btn btn--quiet btn--sm popmenu__danger"
                      onClick={() => void deleteNote(n.id)}
                    >
                      {t.notes.delete}
                    </button>
                  </div>
                  <p className="note-card__body">{n.body}</p>
                  <div className="note-card__foot">
                    {subject ? <Chip>{tr(subject.name)}</Chip> : null}
                    {topic ? (
                      <Link to={`/topics/${topic.id}`}>
                        <Chip tone="accent">{tr(topic.title)} →</Chip>
                      </Link>
                    ) : null}
                    {(n.tags ?? []).map((tag) => (
                      <span key={tag} className="tag">
                        #{tag}
                      </span>
                    ))}
                    <span className="grow" />
                    <span className="xsmall muted">
                      {new Date(n.updatedAt).toLocaleDateString('ka-GE')}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : draft ? null : (
        <EmptyState glyph="✎" title={t.notes.empty} hint={t.notes.emptyHint} />
      )}
    </div>
  );
}
