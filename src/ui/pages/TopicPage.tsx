import { Link, useParams } from 'react-router-dom';
import {
  activitiesForTopic,
  eventsForTopic,
  factsForTopic,
  formulasForTopic,
  library,
  peopleForTopic,
  t as tr,
  type SectionKind,
} from '@/content';
import { useApp, useT } from '../state/AppState';
import type { Dictionary } from '@/i18n';
import { Blocks, FormulaPanel } from '../components/Blocks';
import { BookmarkButton } from '../components/BookmarkButton';
import { Chip, DifficultyChip, EmptyState, SectionHead, subjectStyle } from '../components/primitives';

function sectionLabel(t: Dictionary, kind: SectionKind): string {
  switch (kind) {
    case 'whatIs':
      return t.topic.whatIs;
    case 'whyInteresting':
      return t.topic.whyInteresting;
    case 'keyIdeas':
      return t.topic.keyIdeas;
    case 'formulas':
      return t.topic.formulas;
    case 'history':
      return t.topic.history;
    case 'currentResearch':
      return t.topic.currentResearch;
  }
}

/** A single topic: authored sections plus everything cross-referenced to it. */
export function TopicPage() {
  const t = useT();
  const { topicId = '' } = useParams();
  const { subjectById, track } = useApp();
  const topic = library.topicById.get(topicId);

  if (!topic) {
    return (
      <div className="page">
        <EmptyState
          title={t.common.notFound}
          hint={t.common.notFoundHint}
          action={<Link className="btn btn--ghost" to="/">{t.common.goHome}</Link>}
        />
      </div>
    );
  }

  const subject = subjectById.get(topic.subjectId);
  const formulas = formulasForTopic(topic.id);
  const facts = factsForTopic(topic.id);
  const people = peopleForTopic(topic.id);
  const events = eventsForTopic(topic.id);
  const activities = activitiesForTopic(topic.id);

  return (
    <div className="page" style={subjectStyle(subject)}>
      <header className="hero">
        <p className="hero__greeting">
          {subject ? (
            <Link to={`/labs/${subject.id}`} className="link">
              {tr(subject.name)}
            </Link>
          ) : null}
        </p>
        <h1 className="hero__title">{tr(topic.title)}</h1>
        <p className="hero__sub">{tr(topic.hook)}</p>
        <div className="row mt-4">
          <DifficultyChip level={topic.difficulty} />
          {topic.tags?.map((tag) => <Chip key={tag}>{tag}</Chip>)}
          <span className="grow" />
          <BookmarkButton
            entityId={topic.id}
            entityKind="topic"
            label={tr(topic.title)}
            href={`/topics/${topic.id}`}
            {...(subject ? { subjectId: subject.id } : {})}
            compact
          />
        </div>
      </header>

      {topic.sections.map((section, i) => (
        <section className="section" key={i}>
          <SectionHead title={sectionLabel(t, section.kind)} />
          <Blocks blocks={section.blocks} />
        </section>
      ))}

      {formulas.length > 0 ? (
        <section className="section">
          <SectionHead title={t.topic.formulas} />
          <div className="stack">
            {formulas.map((formula) => (
              <FormulaPanel key={formula.id} formula={formula} />
            ))}
          </div>
        </section>
      ) : null}

      {facts.length > 0 ? (
        <section className="section">
          <SectionHead title={t.topic.didYouKnow} />
          <div className="stack">
            {facts.map((fact) => (
              <Link key={fact.id} to={`/facts?open=${fact.id}`} className="card">
                <p className="card__body" style={{ color: 'var(--ink)' }}>{tr(fact.text)}</p>
                <span className="xsmall muted">{fact.source.publisher}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {people.length > 0 ? (
        <section className="section">
          <SectionHead title={t.topic.people} />
          <div className="grid-2">
            {people.map((person) => (
              <Link key={person.id} to={`/people/${person.id}`} className="card">
                <p className="card__title">{tr(person.name)}</p>
                <p className="card__body">{person.lived} · {tr(person.known)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {events.length > 0 ? (
        <section className="section">
          <SectionHead title={t.topic.events} />
          <div className="stack">
            {events.map((event) => (
              <Link key={event.id} to={`/timeline?open=${event.id}`} className="card">
                <p className="card__title">{event.year} · {tr(event.title)}</p>
                <p className="card__body">{tr(event.summary)}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {activities.length > 0 ? (
        <section className="section">
          <SectionHead title={t.topic.doSomething} />
          <div className="grid-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                id={`activity-${activity.id}`}
                className="card"
                onClick={() => track({ type: 'view', subjectId: activity.subjectId, topicId: topic.id })}
              >
                <p className="card__title">{tr(activity.title)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
