import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { library, t as tr } from '@/content';
import { useT } from '../state/AppState';
import { BookmarkButton } from '../components/BookmarkButton';
import { SourceLine } from '../components/primitives';

/** Every fact, each with its source. */
export function FactsPage() {
  const t = useT();
  const [params] = useSearchParams();
  const open = params.get('open');

  const facts = useMemo(
    () => [...library.facts].sort((a, b) => (a.id === open ? -1 : b.id === open ? 1 : 0)),
    [open],
  );

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.facts.title}</h1>
        <p className="hero__sub">{t.facts.subtitle}</p>
      </header>

      <p className="xsmall muted">{t.facts.count(facts.length)}</p>

      <div className="stack mt-4">
        {facts.map((fact) => (
          <article
            key={fact.id}
            className="card"
            aria-current={fact.id === open ? 'true' : undefined}
          >
            <p className="card__body" style={{ color: 'var(--ink)' }}>{tr(fact.text)}</p>
            {fact.why ? (
              <p className="card__body">
                <strong>{t.facts.why}: </strong>
                {tr(fact.why)}
              </p>
            ) : null}
            <div className="row row--between">
              <SourceLine
                label={fact.source.label}
                publisher={fact.source.publisher}
                {...(fact.source.url ? { url: fact.source.url } : {})}
              />
              <BookmarkButton
                entityId={fact.id}
                entityKind="fact"
                label={tr(fact.text).slice(0, 80)}
                href={`/facts?open=${fact.id}`}
                {...(fact.subjectId ? { subjectId: fact.subjectId } : {})}
                compact
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
