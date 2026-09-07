import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CT_CATEGORY_LABELS, ctTopicById } from '@/content/competitive';
import type { CtStatus } from '@/domain/competitive/types';
import { recommendNext, relatedTopics } from '@/domain/competitive';
import {
  bumpCtSolved,
  createNote,
  deleteNote,
  setCtStatus,
  toggleCtReview,
} from '@/persistence/repositories';
import { useCompetitive, useTopicNotes } from '../state/useCompetitive';
import { StatusControl } from '../components/tournament/StatusControl';
import { TopicSections } from '../components/tournament/TopicSections';
import { CT_PRIORITY_LABEL, CT_SECTION_LABEL } from '../components/tournament/labels';

/**
 * One topic as a focused learning document: content sections top to bottom,
 * then the two runtime sections — personal notes (shared notes table) and
 * learning status (ctProgress). A rail on the right holds the status control
 * and jump links so the long page stays navigable.
 */
export function TournamentTopicPage() {
  const { topicId = '' } = useParams();
  const topic = ctTopicById.get(topicId);
  const { viewOf, views, progressOf } = useCompetitive();
  const notes = useTopicNotes(topicId) ?? [];
  const [noteDraft, setNoteDraft] = useState('');

  if (!topic) {
    return (
      <div className="page ct-page">
        <p className="ct-muted">თემა ვერ მოიძებნა.</p>
        <Link to="/tournament" className="btn btn--ghost btn--sm">← როუდმაპი</Link>
      </div>
    );
  }

  const view = viewOf(topicId);
  const progress = progressOf(topicId);
  const authored = view?.authored ?? false;

  // "Next" for this topic: its own declared next, else the global recommendation.
  const declaredNext = relatedTopics(topic.next)[0];
  const globalNext = recommendNext(views.filter((v) => v.topic.id !== topicId));
  const nextTopic = declaredNext ?? globalNext?.topic;

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body) return;
    await createNote({ kind: 'note', body, topicId });
    setNoteDraft('');
  };

  return (
    <div className="page ct-page ct-topic">
      <div className="ct-topic__layout">
        <article className="ct-topic__main">
          <nav className="ct-crumbs">
            <Link to="/tournament">როუდმაპი</Link>
            <span aria-hidden="true">/</span>
            <span>{CT_CATEGORY_LABELS[topic.category].ka}</span>
          </nav>

          <header className="ct-topic__head">
            <h1 className="ct-topic__title">{topic.title}</h1>
            {topic.titleKa ? <p className="ct-topic__ka">{topic.titleKa}</p> : null}
            <div className="ct-topic__tags">
              <span className={`ct-prio ct-prio--${topic.priority}`}>
                {CT_PRIORITY_LABEL[topic.priority]}
              </span>
              {!authored ? <span className="ct-card__soon">მალე</span> : null}
            </div>
          </header>

          {view && !view.unlocked ? (
            <div className="ct-lockbar">
              ჯერ ღირს: {view.missingPrereqs.map((t) => (
                <Link key={t.id} to={`/tournament/${t.id}`}>{t.title}</Link>
              ))}
            </div>
          ) : null}

          <TopicSections topic={topic} authored={authored} />

          {/* 17. personal notes — shared notes table */}
          <section className="ct-sec" id="notes">
            <h2 className="ct-sec__h">{CT_SECTION_LABEL.notes}</h2>
            <ul className="ct-notes">
              {notes.map((note) => (
                <li key={note.id}>
                  <span>{note.body}</span>
                  <button
                    className="btn btn--quiet btn--sm popmenu__danger"
                    onClick={() => void deleteNote(note.id)}
                    aria-label="წაშლა"
                  >
                    ✕
                  </button>
                </li>
              ))}
              {notes.length === 0 ? <li className="ct-muted">ჯერ ჩანაწერი არ არის.</li> : null}
            </ul>
            <div className="ct-notes__add">
              <textarea
                className="textarea"
                rows={2}
                placeholder="ინსაითი, ხრიკი, შეცდომა რომ აღარ გავიმეორო…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void addNote();
                }}
              />
              <button className="btn btn--ghost btn--sm" disabled={!noteDraft.trim()} onClick={() => void addNote()}>
                დამატება
              </button>
            </div>
          </section>

          {nextTopic ? (
            <Link to={`/tournament/${nextTopic.id}`} className="ct-next ct-next--inline">
              <span className="ct-next__label">შემდეგ</span>
              <span className="ct-next__title">{nextTopic.title}</span>
              <span className="ct-next__go" aria-hidden="true">→</span>
            </Link>
          ) : null}
        </article>

        {/* rail: status + jump links */}
        <aside className="ct-rail">
          <div className="ct-rail__status">
            <h2 className="ct-sec__h">{CT_SECTION_LABEL.status}</h2>
            <StatusControl
              status={progress.status}
              solved={progress.solved}
              reviewFlag={progress.reviewFlag}
              onStatus={(s: CtStatus) => void setCtStatus(topicId, s)}
              onSolved={(d) => void bumpCtSolved(topicId, d)}
              onToggleReview={() => void toggleCtReview(topicId)}
            />
            {progress.lastStudiedAt ? (
              <p className="ct-muted ct-rail__last">
                ბოლოს: {new Date(progress.lastStudiedAt).toLocaleDateString('ka-GE')}
              </p>
            ) : null}
          </div>

          {authored ? (
            <nav className="ct-jump">
              {JUMP_LINKS.map(([id, label]) => (
                <a key={id} href={`#${id}`}>{label}</a>
              ))}
            </nav>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const JUMP_LINKS: [string, string][] = [
  ['what-is', CT_SECTION_LABEL.whatIs],
  ['naive', CT_SECTION_LABEL.naive],
  ['walkthrough', CT_SECTION_LABEL.walkthrough],
  ['cpp', CT_SECTION_LABEL.cpp],
  ['mistakes', CT_SECTION_LABEL.mistakes],
  ['practice', CT_SECTION_LABEL.practice],
  ['notes', CT_SECTION_LABEL.notes],
];
