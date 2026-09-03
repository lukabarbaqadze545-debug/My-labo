import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildContentIndex, groupResults, search, type SearchDoc, type SearchResult } from '@/domain/search';
import type { EntityKind } from '@/content';
import { listNotes, listQuestions } from '@/persistence/repositories';
import { useApp, useT } from '../state/AppState';

const KIND_GLYPH: Record<string, string> = {
  subject: '⬡',
  topic: '◈',
  formula: '∑',
  fact: '💡',
  person: '☺',
  event: '⌛',
  question: '?',
  activity: '⚗',
  note: '✎',
  research: '✷',
  concept: '◇',
};

/**
 * Global search. The content index is built once and memoised; personal data
 * (notes and questions) is loaded when the overlay opens so results always
 * include what the user wrote — that was an explicit requirement.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { prefs, track } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [personalDocs, setPersonalDocs] = useState<SearchDoc[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const contentDocs = useMemo(() => buildContentIndex(prefs.locale), [prefs.locale]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [notes, questions] = await Promise.all([listNotes(), listQuestions()]);
        if (cancelled) return;
        const docs: SearchDoc[] = [
          ...notes.map((note) => ({
            id: note.id,
            kind: 'note' as EntityKind,
            title: note.title || note.body.slice(0, 70),
            subtitle: t.nav.notes,
            haystack: `${note.title ?? ''} ${note.body} ${(note.tags ?? []).join(' ')}`.toLowerCase(),
            ...(note.subjectId ? { subjectId: note.subjectId } : {}),
            href: `/notes?open=${note.id}`,
            weight: 1.4,
          })),
          ...questions.map((question) => ({
            id: question.id,
            kind: 'question' as EntityKind,
            title: question.text,
            subtitle: t.nav.questions,
            haystack: question.text.toLowerCase(),
            ...(question.subjectId ? { subjectId: question.subjectId } : {}),
            href: `/questions?open=${question.id}`,
            weight: 1.3,
          })),
        ];
        setPersonalDocs(docs);
      } catch {
        setPersonalDocs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t.nav.notes, t.nav.questions]);

  const results = useMemo(
    () => search(query, contentDocs, { extraDocs: personalDocs, limit: 40 }),
    [query, contentDocs, personalDocs],
  );

  useEffect(() => setActiveIndex(0), [query]);

  const grouped = useMemo(() => groupResults(results), [results]);
  const flat = useMemo(() => [...grouped.values()].flat(), [grouped]);

  const open = (result: SearchResult) => {
    track({ type: 'search', ...(result.subjectId ? { subjectId: result.subjectId } : {}) });
    navigate(result.href);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      const target = flat[activeIndex];
      if (target) {
        event.preventDefault();
        open(target);
      }
    }
  };

  const groupLabel = (kind: EntityKind): string => {
    switch (kind) {
      case 'subject':
        return t.search.inSubjects;
      case 'topic':
        return t.search.inTopics;
      case 'formula':
        return t.search.inFormulas;
      case 'fact':
        return t.search.inFacts;
      case 'person':
        return t.search.inPeople;
      case 'event':
        return t.search.inEvents;
      case 'note':
        return t.search.inNotes;
      case 'question':
        return t.search.inQuestions;
      case 'activity':
        return t.search.inActivities;
      default:
        return kind;
    }
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t.search.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="searchbox" onKeyDown={onKeyDown}>
        <div className="searchbox__input">
          <span aria-hidden="true" style={{ color: 'var(--ink-4)' }}>
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.title}
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button className="btn btn--quiet xsmall" onClick={() => setQuery('')}>
              {t.search.clear}
            </button>
          ) : null}
          <button className="btn btn--quiet xsmall" onClick={onClose} aria-label={t.nav.close}>
            Esc
          </button>
        </div>

        <div className="searchbox__results">
          {query.trim().length === 0 ? (
            <p className="muted small" style={{ padding: 'var(--space-4)' }}>
              {t.search.hint}
            </p>
          ) : flat.length === 0 ? (
            <div style={{ padding: 'var(--space-4)' }}>
              <p className="small">{t.search.noResults}</p>
              <p className="xsmall muted mt-4">{t.search.noResultsHint}</p>
            </div>
          ) : (
            <>
              <p className="sr-only" role="status">
                {t.search.results(flat.length)}
              </p>
              {[...grouped.entries()].map(([kind, items]) => (
                <div key={kind} className="searchgroup">
                  <p className="searchgroup__label">{groupLabel(kind)}</p>
                  {items.map((result) => {
                    const index = flat.indexOf(result);
                    return (
                      <button
                        key={`${result.kind}-${result.id}`}
                        className={index === activeIndex ? 'result result--active' : 'result'}
                        style={{ width: '100%' }}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => open(result)}
                      >
                        <span className="result__glyph" aria-hidden="true">
                          {KIND_GLYPH[result.kind] ?? '◇'}
                        </span>
                        <span className="result__text">
                          <span className="result__title">{result.title}</span>
                          {result.subtitle ? <span className="result__sub">{result.subtitle}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
