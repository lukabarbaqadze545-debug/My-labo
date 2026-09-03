import { Link, useParams } from 'react-router-dom';
import { library, t as tr } from '@/content';
import { useApp, useT } from '../state/AppState';
import { Chip, DifficultyChip, EmptyState, SectionHead, subjectStyle } from '../components/primitives';

/** One lab: its topics, formulas, facts, people and activities. */
export function SubjectPage() {
  const t = useT();
  const { subjectId = '' } = useParams();
  const { subjectById } = useApp();
  const subject = subjectById.get(subjectId);

  if (!subject) {
    return (
      <div className="page">
        <EmptyState
          title={t.common.notFound}
          hint={t.common.notFoundHint}
          action={
            <Link className="btn btn--ghost" to="/labs">
              {t.nav.labs}
            </Link>
          }
        />
      </div>
    );
  }

  const topics = library.topicsBySubject.get(subject.id) ?? [];
  const formulas = library.formulasBySubject.get(subject.id) ?? [];
  const facts = library.factsBySubject.get(subject.id) ?? [];
  const people = library.peopleBySubject.get(subject.id) ?? [];

  return (
    <div className="page" style={subjectStyle(subject)}>
      <header className="hero">
        <p className="hero__greeting">
          <span aria-hidden="true">{subject.theme.glyph}</span> {tr(subject.tagline)}
        </p>
        <h1 className="hero__title">{tr(subject.name)}</h1>
      </header>

      <section className="section">
        <SectionHead title={t.subject.topics} subtitle={`${topics.length}`} />
        {topics.length === 0 ? (
          <EmptyState title={t.subject.empty} hint={t.subject.emptyHint} />
        ) : (
          <div className="grid-2">
            {topics.map((topic) => (
              <Link key={topic.id} to={`/topics/${topic.id}`} className="card">
                <div className="row">
                  <DifficultyChip level={topic.difficulty} />
                  {topic.tags?.slice(0, 2).map((tag) => <Chip key={tag}>{tag}</Chip>)}
                </div>
                <p className="card__title">{tr(topic.title)}</p>
                <p className="card__body">{tr(topic.hook)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {formulas.length > 0 ? (
        <section className="section">
          <SectionHead title={t.subject.formulas} action={<Link className="btn btn--ghost" to="/formulas">{t.common.showAll} →</Link>} />
          <div className="grid-2">
            {formulas.map((formula) => (
              <Link key={formula.id} to={`/formulas?open=${formula.id}`} className="card">
                <p className="card__title">{tr(formula.name)}</p>
                <p className="mono card__body">{formula.expression}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {facts.length > 0 ? (
        <section className="section">
          <SectionHead title={t.subject.facts} />
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
          <SectionHead title={t.subject.people} />
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
    </div>
  );
}
