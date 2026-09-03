import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Difficulty, Subject } from '@/content';
import { difficultyLabel } from '@/i18n';
import { useT } from '../state/AppState';

/** Applies a subject's hue so descendants can theme off `--room-h` / `--accent-h`. */
export function subjectStyle(subject?: Pick<Subject, 'theme'>): CSSProperties {
  const hue = subject?.theme.hue ?? 224;
  return { ['--room-h' as string]: String(hue), ['--accent-h' as string]: String(hue) };
}

export function Chip({
  children,
  tone = 'default',
  title,
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'strong' | 'caution' | 'medium';
  title?: string;
}) {
  const cls = tone === 'default' ? 'chip' : `chip chip--${tone}`;
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}

export function DifficultyChip({ level }: { level: Difficulty }) {
  const t = useT();
  return (
    <Chip tone="medium" title={`${t.subject.difficulty}: ${difficultyLabel(level, t)}`}>
      <span aria-hidden="true">{'●'.repeat(level)}{'○'.repeat(5 - level)}</span>
      <span className="sr-only">{difficultyLabel(level, t)}</span>
    </Chip>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section__head">
      <div>
        <h2 className="section__title">{title}</h2>
        {subtitle ? <p className="section__sub">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  glyph = '🔭',
  title,
  hint,
  action,
}: {
  glyph?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__glyph" aria-hidden="true">
        {glyph}
      </span>
      <p className="empty__title">{title}</p>
      {hint ? <p className="empty__hint">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Notice({
  children,
  tone = 'default',
  glyph = 'ℹ',
}: {
  children: ReactNode;
  tone?: 'default' | 'caution';
  glyph?: string;
}) {
  return (
    <div className={tone === 'caution' ? 'notice notice--caution' : 'notice'}>
      <span className="notice__glyph" aria-hidden="true">
        {glyph}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ height = 80, count = 1 }: { height?: number; count?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

/** Card that links somewhere; keeps hover/active affordances consistent. */
export function LinkCard({
  to,
  children,
  className = 'card',
  style,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Link to={to} className={className} style={style}>
      {children}
    </Link>
  );
}

export function SourceLine({
  label,
  publisher,
  url,
}: {
  label: string;
  publisher: string;
  url?: string;
}) {
  const text = `${publisher} — ${label}`;
  if (!url) {
    return <span className="xsmall muted">{text}</span>;
  }
  return (
    <a className="xsmall muted" href={url} target="_blank" rel="noreferrer noopener" title={text}>
      {text} ↗
    </a>
  );
}
