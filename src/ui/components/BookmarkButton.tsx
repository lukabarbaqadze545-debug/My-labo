import { useEffect, useState } from 'react';
import { isBookmarked, toggleBookmark } from '@/persistence/repositories';
import type { Bookmark } from '@/persistence/db';
import { useT } from '../state/AppState';

export function BookmarkButton({
  entityId,
  entityKind,
  label,
  href,
  subjectId,
  compact = false,
}: {
  entityId: string;
  entityKind: Bookmark['entityKind'];
  label: string;
  href: string;
  subjectId?: string;
  compact?: boolean;
}) {
  const t = useT();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void isBookmarked(entityId).then((value) => {
      if (!cancelled) setSaved(value);
    });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const onClick = async () => {
    // Optimistic: the toggle is local and effectively instant.
    setSaved((s) => !s);
    const next = await toggleBookmark({
      entityId,
      entityKind,
      label,
      href,
      ...(subjectId ? { subjectId } : {}),
    });
    setSaved(next);
  };

  if (compact) {
    return (
      <button
        className="btn btn--icon"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? t.common.bookmarked : t.common.bookmark}
        title={saved ? t.common.bookmarked : t.common.bookmark}
      >
        <span aria-hidden="true" style={{ color: saved ? 'var(--accent)' : undefined }}>
          {saved ? '★' : '☆'}
        </span>
      </button>
    );
  }

  return (
    <button className={saved ? 'btn btn--ghost' : 'btn btn--ghost'} onClick={onClick} aria-pressed={saved}>
      <span aria-hidden="true" style={{ color: saved ? 'var(--accent)' : undefined }}>
        {saved ? '★' : '☆'}
      </span>
      {saved ? t.common.bookmarked : t.common.bookmark}
    </button>
  );
}
