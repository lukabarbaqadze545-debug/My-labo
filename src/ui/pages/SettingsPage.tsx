import { useApp, useT } from '../state/AppState';
import { SectionHead } from '../components/primitives';
import { AiSettings } from '../components/AiSettings';

/** Appearance and language now; data export/import lands with persistence UI. */
export function SettingsPage() {
  const t = useT();
  const { prefs, updatePrefs } = useApp();

  const themes: { key: 'dark' | 'light' | 'system'; label: string }[] = [
    { key: 'dark', label: t.settings.themeDark },
    { key: 'light', label: t.settings.themeLight },
    { key: 'system', label: t.settings.themeSystem },
  ];

  const locales: { key: 'ka' | 'en'; label: string }[] = [
    { key: 'ka', label: 'ქართული' },
    { key: 'en', label: 'English' },
  ];

  return (
    <div className="page">
      <header className="hero">
        <h1 className="hero__title">{t.settings.title}</h1>
      </header>

      <section className="section">
        <SectionHead title={t.settings.appearance} />
        <div className="row">
          {themes.map((theme) => (
            <button
              key={theme.key}
              className={prefs.theme === theme.key ? 'btn btn--active' : 'btn btn--ghost'}
              onClick={() => void updatePrefs({ theme: theme.key })}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead title={t.settings.language} />
        <div className="row">
          {locales.map((locale) => (
            <button
              key={locale.key}
              className={prefs.locale === locale.key ? 'btn btn--active' : 'btn btn--ghost'}
              onClick={() => void updatePrefs({ locale: locale.key })}
            >
              {locale.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHead title={t.ai.title} subtitle={t.ai.subtitle} />
        <AiSettings />
      </section>

      <section className="section">
        <SectionHead title={t.settings.about} />
        <p className="prose">{t.settings.aboutText}</p>
      </section>
    </div>
  );
}
