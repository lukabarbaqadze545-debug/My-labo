import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { library, t as tr } from '@/content';
import { useT } from '../state/AppState';
import { FormulaPanel } from '../components/Blocks';
import { BookmarkButton } from '../components/BookmarkButton';
import { EmptyState } from '../components/primitives';

/** The formula library: search by name, symbol or meaning. */
export function FormulasPage() {
  const t = useT();
  const [params] = useSearchParams();
  const open = params.get('open');
  const [query, setQuery] = useState('');

  const formulas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...library.formulas].sort((a, b) => (a.id === open ? -1 : b.id === open ? 1 : 0));
    if (!q) return all;
    return all.filter((f) => {
      const haystack = `${tr(f.name)} ${tr(f.name, 'en')} ${f.expression}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, open]);

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.formulas.title}</h1>
        <p className="hero__sub">{t.formulas.subtitle}</p>
      </header>

      <input
        className="input"
        type="search"
        placeholder={t.formulas.searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <p className="xsmall muted mt-4">{t.formulas.count(formulas.length)}</p>

      {formulas.length === 0 ? (
        <EmptyState title={t.formulas.empty} hint={t.formulas.emptyHint} />
      ) : (
        <div className="stack mt-4">
          {formulas.map((formula) => (
            <div key={formula.id} className="formula-wrap">
              <FormulaPanel formula={formula} />
              <div className="formula-wrap__bm">
                <BookmarkButton
                  entityId={formula.id}
                  entityKind="formula"
                  label={tr(formula.name)}
                  href={`/formulas?open=${formula.id}`}
                  {...(formula.subjectId ? { subjectId: formula.subjectId } : {})}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
