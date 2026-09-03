import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/primitives';

/**
 * Interim page body for routes that are wired into the shell but not built out
 * yet. Keeps navigation coherent instead of dead-ending on a 404.
 */
export function Placeholder({
  title,
  subtitle,
  glyph = '🧪',
  children,
}: {
  title: string;
  subtitle?: string;
  glyph?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{title}</h1>
        {subtitle ? <p className="hero__sub">{subtitle}</p> : null}
      </header>
      {children ?? (
        <EmptyState
          glyph={glyph}
          title="ეს გვერდი ჯერ შენდება"
          hint="მალე იქნება მზად — ამ დროისთვის დანარჩენი ლაბორატორია ხელმისაწვდომია."
          action={<Link className="btn btn--ghost" to="/">მთავარზე დაბრუნება</Link>}
        />
      )}
    </div>
  );
}
