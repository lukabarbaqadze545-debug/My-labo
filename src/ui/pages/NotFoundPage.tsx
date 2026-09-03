import { Link } from 'react-router-dom';
import { useT } from '../state/AppState';
import { EmptyState } from '../components/primitives';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="page">
      <EmptyState
        glyph="🧭"
        title={t.common.notFound}
        hint={t.common.notFoundHint}
        action={<Link className="btn btn--ghost" to="/">{t.common.goHome}</Link>}
      />
    </div>
  );
}
