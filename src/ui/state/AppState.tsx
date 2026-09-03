import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { library, type Subject } from '@/content';
import { dict, type Dictionary } from '@/i18n';
import {
  getPreferences,
  listInteractions,
  listSubjectOverrides,
  listUserSubjects,
  recordInteraction,
  savePreferences,
} from '@/persistence/repositories';
import type { Preferences, SubjectOverride, UserSubject } from '@/persistence/db';
import { DEFAULT_PREFERENCES } from '@/persistence/db';
import { buildInterestProfile, type InteractionEvent, type InterestProfile } from '@/domain/personalization';

/**
 * One context for cross-cutting app state: preferences, the merged subject list
 * (bundled + user-created + overrides), the interest profile, and connectivity.
 *
 * Deliberately *not* a general-purpose store — page-local state stays in pages.
 */

interface AppStateValue {
  ready: boolean;
  prefs: Preferences;
  t: Dictionary;
  subjects: Subject[];
  subjectById: Map<string, Subject>;
  profile: InterestProfile;
  online: boolean;
  updatePrefs: (patch: Partial<Preferences>) => Promise<void>;
  track: (event: Omit<InteractionEvent, 'at'>) => void;
  refreshSubjects: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function applyOverrides(
  base: Subject[],
  userSubjects: UserSubject[],
  overrides: SubjectOverride[],
): Subject[] {
  const overrideMap = new Map(overrides.map((o) => [o.subjectId, o]));
  const merged: Subject[] = [];

  for (const subject of [...base, ...userSubjects]) {
    const override = overrideMap.get(subject.id);
    if (override?.hidden) continue;
    if (!override) {
      merged.push(subject);
      continue;
    }
    merged.push({
      ...subject,
      ...(override.nameKa ? { name: { ...subject.name, ka: override.nameKa } } : {}),
      theme: {
        ...subject.theme,
        ...(typeof override.hue === 'number' ? { hue: override.hue } : {}),
        ...(override.glyph ? { glyph: override.glyph } : {}),
      },
      ...(override.pinned ? { order: -1 } : {}),
    });
  }

  return merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [subjects, setSubjects] = useState<Subject[]>(library.subjects);
  const [interactions, setInteractions] = useState<InteractionEvent[]>([]);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const refreshSubjects = useCallback(async () => {
    const [userSubjects, overrides] = await Promise.all([listUserSubjects(), listSubjectOverrides()]);
    setSubjects(applyOverrides(library.subjects, userSubjects, overrides));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedPrefs, userSubjects, overrides, records] = await Promise.all([
          getPreferences(),
          listUserSubjects(),
          listSubjectOverrides(),
          listInteractions(),
        ]);
        if (cancelled) return;
        setPrefs(storedPrefs);
        setSubjects(applyOverrides(library.subjects, userSubjects, overrides));
        setInteractions(
          records.map((r) => ({
            type: r.type,
            at: r.at,
            ...(r.subjectId ? { subjectId: r.subjectId } : {}),
            ...(r.topicId ? { topicId: r.topicId } : {}),
          })),
        );
      } catch {
        // A blocked IndexedDB (private mode, storage off) must not break the
        // app: the bundled library and defaults are enough to run.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Theme is applied to <html> so CSS custom properties cascade everywhere.
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme);
    root.lang = prefs.locale;
  }, [prefs.theme, prefs.locale]);

  const updatePrefs = useCallback(async (patch: Partial<Preferences>) => {
    const next = await savePreferences(patch);
    setPrefs(next);
  }, []);

  const track = useCallback((event: Omit<InteractionEvent, 'at'>) => {
    const record = { ...event, at: Date.now() };
    setInteractions((prev) => [record, ...prev].slice(0, 600));
    void recordInteraction(record);
  }, []);

  const profile = useMemo(() => {
    // Onboarding answers seed the profile so the first session is not cold.
    const seeded: InteractionEvent[] = prefs.favouriteSubjects.map((subjectId) => ({
      subjectId,
      type: 'bookmark' as const,
      at: prefs.updatedAt || Date.now(),
    }));
    return buildInterestProfile([...interactions, ...seeded]);
  }, [interactions, prefs.favouriteSubjects, prefs.updatedAt]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      prefs,
      t: dict(prefs.locale),
      subjects,
      subjectById: new Map(subjects.map((s) => [s.id, s])),
      profile,
      online,
      updatePrefs,
      track,
      refreshSubjects,
    }),
    [ready, prefs, subjects, profile, online, updatePrefs, track, refreshSubjects],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useApp must be used inside AppStateProvider');
  return value;
}

/** Convenience: the Georgian dictionary for the active locale. */
export function useT(): Dictionary {
  return useApp().t;
}
