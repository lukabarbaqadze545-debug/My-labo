import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp, useT } from '../state/AppState';
import { SearchOverlay } from './SearchOverlay';
import { DiscoveryDialog } from './DiscoveryDialog';
import { MiniTimer } from './MiniTimer';
import { PwaPrompt } from './PwaPrompt';

const PRIMARY = [
  { to: '/', glyph: '◎', key: 'home' as const, end: true },
  { to: '/ask', glyph: '✦', key: 'ask' as const },
  { to: '/books', glyph: '📚', key: 'books' as const },
  { to: '/labs', glyph: '⬡', key: 'labs' as const },
  { to: '/research', glyph: '✷', key: 'research' as const },
  { to: '/formulas', glyph: '∑', key: 'formulas' as const },
  { to: '/facts', glyph: '💡', key: 'facts' as const },
  { to: '/timeline', glyph: '⌛', key: 'timeline' as const },
];

const PERSONAL = [
  { to: '/focus', glyph: '◷', key: 'focus' as const },
  { to: '/write', glyph: '✍', key: 'write' as const },
  { to: '/notes', glyph: '✎', key: 'notes' as const },
  { to: '/questions', glyph: '?', key: 'questions' as const },
  { to: '/saved', glyph: '⌘', key: 'saved' as const },
];

const MOBILE = [
  { to: '/', glyph: '◎', key: 'home' as const, end: true },
  { to: '/ask', glyph: '✦', key: 'ask' as const },
  { to: '/books', glyph: '📚', key: 'books' as const },
  { to: '/labs', glyph: '⬡', key: 'labs' as const },
  { to: '/focus', glyph: '◷', key: 'focus' as const },
  { to: '/write', glyph: '✍', key: 'write' as const },
];

export function Shell({ children }: { children: ReactNode }) {
  const t = useT();
  const { prefs, updatePrefs, online } = useApp();
  const [searchOpen, setSearchOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const location = useLocation();

  // Cmd/Ctrl+K opens search from anywhere; Escape is handled by the overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setDiscoverOpen(false);
  }, [location.pathname]);

  const cycleTheme = () => {
    const next = prefs.theme === 'dark' ? 'light' : prefs.theme === 'light' ? 'system' : 'dark';
    void updatePrefs({ theme: next });
  };
  const themeGlyph = prefs.theme === 'dark' ? '☾' : prefs.theme === 'light' ? '☀' : '◐';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" stroke="currentColor">
              <path
                d="M13 7h6v6.5l6 10.5a3 3 0 0 1-2.6 4.5H9.6A3 3 0 0 1 7 24l6-10.5z"
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              <path
                d="M11.6 20h8.8l2.6 4.6a1.5 1.5 0 0 1-1.3 2.2H10.3A1.5 1.5 0 0 1 9 24.6z"
                fill="currentColor"
              />
              <line x1="11.6" y1="7" x2="20.4" y2="7" strokeWidth="2.3" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <span className="brand__name">{t.app.name}</span>
            <br />
            <span className="brand__tagline">{t.app.tagline}</span>
          </span>
        </div>

        <button className="btn btn--surprise btn--block" onClick={() => setDiscoverOpen(true)}>
          <span aria-hidden="true">✧</span> {t.nav.surprise}
        </button>

        <nav className="nav-group" aria-label={t.nav.menu}>
          {PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              <span className="nav-link__glyph" aria-hidden="true">
                {item.glyph}
              </span>
              {t.nav[item.key]}
            </NavLink>
          ))}
        </nav>

        <div className="nav-group">
          <span className="nav-group__label">{t.nav.notes}</span>
          {PERSONAL.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              <span className="nav-link__glyph" aria-hidden="true">
                {item.glyph}
              </span>
              {t.nav[item.key]}
            </NavLink>
          ))}
        </div>

        <div className="sidebar__spacer" />

        <NavLink
          to="/settings"
          className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
        >
          <span className="nav-link__glyph" aria-hidden="true">
            ⚙
          </span>
          {t.nav.settings}
        </NavLink>
      </aside>

      <div className="shell__main">
        {!online ? (
          <div className="offline-bar" role="status">
            <span aria-hidden="true">⚡</span>
            {t.common.offline} — {t.common.offlineHint}
          </div>
        ) : null}

        <header className="topbar">
          <button className="topbar__search" onClick={() => setSearchOpen(true)}>
            <span aria-hidden="true">⌕</span>
            <span className="grow" style={{ textAlign: 'start' }}>
              {t.search.placeholder}
            </span>
            <kbd>⌘K</kbd>
          </button>
          <div className="topbar__actions">
            <MiniTimer />
            <button
              className="btn btn--icon"
              onClick={cycleTheme}
              aria-label={t.settings.appearance}
              title={t.settings.appearance}
            >
              <span aria-hidden="true">{themeGlyph}</span>
            </button>
            <button
              className="btn btn--surprise"
              onClick={() => setDiscoverOpen(true)}
              data-mobile-surprise
            >
              <span aria-hidden="true">✧</span>
              <span className="surprise-label">{t.nav.surprise}</span>
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>

      <nav className="mobilenav" aria-label={t.nav.menu}>
        <ul className="mobilenav__list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {MOBILE.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'mobilenav__item mobilenav__item--active' : 'mobilenav__item')}
              >
                <span className="mobilenav__glyph" aria-hidden="true">
                  {item.glyph}
                </span>
                {t.nav[item.key]}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
      {discoverOpen ? <DiscoveryDialog onClose={() => setDiscoverOpen(false)} /> : null}
      <PwaPrompt />
    </div>
  );
}
