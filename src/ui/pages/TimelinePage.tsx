import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { library, t as tr } from '@/content';
import { useT } from '../state/AppState';
import { BookmarkButton } from '../components/BookmarkButton';
import { Chip, EmptyState } from '../components/primitives';

type Filter = 'all' | 'georgia' | 'world' | 'science';

/** History as cause → event → consequence, not a list of dates. */
export function TimelinePage() {
  const t = useT();
  const [params] = useSearchParams();
  const open = params.get('open');
  const [filter, setFilter] = useState<Filter>('all');

  const events = useMemo(() => {
    const sorted = [...library.events].sort((a, b) => a.year - b.year);
    if (filter === 'all') return sorted;
    return sorted.filter((e) => e.region === filter);
  }, [filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t.timeline.filterAll },
    { key: 'georgia', label: t.timeline.filterGeorgia },
    { key: 'world', label: t.timeline.filterWorld },
    { key: 'science', label: t.timeline.filterScience },
  ];

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.timeline.title}</h1>
        <p className="hero__sub">{t.timeline.subtitle}</p>
      </header>

      <div className="row mt-4" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? 'btn btn--sm btn--active' : 'btn btn--sm btn--ghost'}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState title={t.timeline.empty} />
      ) : (
        <ol className="timeline mt-4" style={{ listStyle: 'none', padding: 0 }}>
          {events.map((event) => (
            <li
              key={event.id}
              className="card"
              aria-current={event.id === open ? 'true' : undefined}
            >
              <div className="row" style={{ alignItems: 'baseline', gap: 'var(--space-3)' }}>
                <span className="daily__year">{event.year}</span>
                <span className="card__title grow">{tr(event.title)}</span>
                {event.region ? <Chip>{event.region}</Chip> : null}
                <BookmarkButton
                  entityId={event.id}
                  entityKind="event"
                  label={`${event.year} · ${tr(event.title)}`}
                  href={`/timeline?open=${event.id}`}
                  {...(event.subjectId ? { subjectId: event.subjectId } : {})}
                  compact
                />
              </div>
              {event.cause ? (
                <p className="card__body"><strong>{t.timeline.cause}: </strong>{tr(event.cause)}</p>
              ) : null}
              <p className="card__body">{tr(event.summary)}</p>
              {event.consequence ? (
                <p className="card__body"><strong>{t.timeline.consequence}: </strong>{tr(event.consequence)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
