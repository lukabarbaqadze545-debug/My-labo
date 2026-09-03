import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { t as tr } from '@/content';
import type { Bookmark } from '@/persistence/db';
import { listBookmarks, toggleBookmark } from '@/persistence/repositories';
import { useApp, useT } from '../state/AppState';
import { Chip, EmptyState } from '../components/primitives';

type Kind = Bookmark['entityKind'];

export function SavedPage() {
  const t = useT();
  const { subjectById } = useApp();
  const bookmarks = useLiveQuery(() => listBookmarks(), []);
  const [kind, setKind] = useState<Kind | 'all'>('all');

  const kindLabel: Record<Kind, string> = {
    topic: t.search.inTopics,
    formula: t.search.inFormulas,
    fact: t.search.inFacts,
    person: t.search.inPeople,
    event: t.search.inEvents,
    activity: t.search.inActivities,
    research: t.nav.research,
  };

  const kinds = useMemo(() => {
    const set = new Set<Kind>();
    for (const b of bookmarks ?? []) set.add(b.entityKind);
    return [...set];
  }, [bookmarks]);

  const filtered = (bookmarks ?? []).filter((b) => kind === 'all' || b.entityKind === kind);

  const remove = (b: Bookmark) =>
    void toggleBookmark({
      entityId: b.entityId,
      entityKind: b.entityKind,
      label: b.label,
      href: b.href,
      ...(b.subjectId ? { subjectId: b.subjectId } : {}),
    });

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.saved.title}</h1>
        <p className="hero__sub">{t.saved.subtitle}</p>
      </header>

      {bookmarks && bookmarks.length > 0 ? (
        <>
          {kinds.length > 1 ? (
            <div className="chips" style={{ marginBottom: 'var(--space-4)' }}>
              <button
                className={`chipbtn${kind === 'all' ? ' is-active' : ''}`}
                onClick={() => setKind('all')}
              >
                {t.saved.all}
              </button>
              {kinds.map((k) => (
                <button
                  key={k}
                  className={`chipbtn${kind === k ? ' is-active' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {kindLabel[k]}
                </button>
              ))}
            </div>
          ) : null}

          <div className="stack">
            {filtered.map((b) => {
              const subject = b.subjectId ? subjectById.get(b.subjectId) : undefined;
              return (
                <div key={b.id} className="saved-row">
                  <Link to={b.href} className="saved-row__link">
                    <span className="saved-row__kind">{kindLabel[b.entityKind]}</span>
                    <span className="saved-row__label">{b.label}</span>
                  </Link>
                  {subject ? <Chip>{tr(subject.name)}</Chip> : null}
                  <button
                    className="btn btn--quiet btn--sm"
                    onClick={() => remove(b)}
                    aria-label={t.common.remove}
                    title={t.common.remove}
                  >
                    ★
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState glyph="⌘" title={t.saved.empty} hint={t.saved.emptyHint} />
      )}
    </div>
  );
}
