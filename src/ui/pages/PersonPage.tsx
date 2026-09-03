import { Link, useParams } from 'react-router-dom';
import { library, t as tr } from '@/content';
import { useT } from '../state/AppState';
import { BookmarkButton } from '../components/BookmarkButton';
import { Chip, EmptyState, SectionHead, SourceLine } from '../components/primitives';

/** One person: who they were, what they are known for, and the topics they touch. */
export function PersonPage() {
  const t = useT();
  const { personId = '' } = useParams();
  const person = library.personById.get(personId);

  if (!person) {
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

  const topics = (person.topicIds ?? [])
    .map((id) => library.topicById.get(id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <div className="page">
      <header className="hero">
        <p className="hero__greeting">{person.lived}</p>
        <h1 className="hero__title">{tr(person.name)}</h1>
        <p className="hero__sub">{tr(person.known)}</p>
        <div className="row mt-4">
          <BookmarkButton
            entityId={person.id}
            entityKind="person"
            label={tr(person.name)}
            href={`/people/${person.id}`}
            compact
          />
        </div>
      </header>

      <section className="section">
        <p className="prose">{tr(person.story)}</p>
      </section>

      {topics.length > 0 ? (
        <section className="section">
          <SectionHead title={t.topic.related} />
          <div className="row">
            {topics.map((topic) => (
              <Link key={topic.id} to={`/topics/${topic.id}`}>
                <Chip tone="accent">{tr(topic.title)}</Chip>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {person.sources && person.sources.length > 0 ? (
        <section className="section">
          <SectionHead title={t.common.sources} />
          <div className="stack">
            {person.sources.map((source, i) => (
              <SourceLine
                key={i}
                label={source.label}
                publisher={source.publisher}
                {...(source.url ? { url: source.url } : {})}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
