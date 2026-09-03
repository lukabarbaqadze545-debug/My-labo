import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_POMODORO_SETTINGS, type PomodoroPhase, type PomodoroSettings } from '@/persistence/db';
import { recordPomodoroSession, savePomodoroSettings } from '@/persistence/repositories';
import { dateKeyOf, formatClock, nextPhase, phaseDurationMs } from '@/domain/pomodoro';

/**
 * The pomodoro engine.
 *
 * Time is tracked against the wall clock (`Date.now()`), never by counting
 * ticks — so a throttled or slept tab resumes at the right moment, and a
 * completed interval that finished while you were away is still recorded at its
 * scheduled time. The 1-second interval only drives the display.
 *
 * The whole run state is persisted to localStorage, so a reload mid-session
 * picks up exactly where it left off.
 */

interface ActiveRun {
  phase: PomodoroPhase;
  /** Epoch ms of the (re)start of this interval. */
  startedAt: number;
  durationMs: number;
  /** Accumulated paused time within this interval. */
  pausedTotalMs: number;
  /** Epoch ms when paused, or null while running. */
  pausedAt: number | null;
  label?: string;
  subjectId?: string;
  topicId?: string;
}

interface Task {
  label?: string;
  subjectId?: string;
  topicId?: string;
}

interface PersistState {
  run: ActiveRun | null;
  /** A phase that has been armed but not started (auto-start off). */
  pending: PomodoroPhase | null;
  /** Completed focus intervals since the last long break. */
  cycleFocusDone: number;
  task: Task;
}

const STORAGE_KEY = 'labo:pomodoro:v1';
const EMPTY_STATE: PersistState = { run: null, pending: null, cycleFocusDone: 0, task: {} };

function loadState(): PersistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as PersistState;
    return { ...EMPTY_STATE, ...parsed, task: parsed.task ?? {} };
  } catch {
    return EMPTY_STATE;
  }
}

function elapsedOf(run: ActiveRun, now: number): number {
  const paused = run.pausedAt ? now - run.pausedAt : 0;
  return Math.max(0, now - run.startedAt - run.pausedTotalMs - paused);
}

function remainingOf(run: ActiveRun, now: number): number {
  return Math.max(0, run.durationMs - elapsedOf(run, now));
}

function buildRun(phase: PomodoroPhase, settings: PomodoroSettings, startedAt: number, task: Task): ActiveRun {
  return {
    phase,
    startedAt,
    durationMs: phaseDurationMs(phase, settings),
    pausedTotalMs: 0,
    pausedAt: null,
    ...(phase === 'focus'
      ? { label: task.label, subjectId: task.subjectId, topicId: task.topicId }
      : {}),
  };
}

/* --------------------------------- audio -------------------------------- */

let audioCtx: AudioContext | null = null;

function playChime(focusEnded: boolean): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime;
    const notes = focusEnded ? [660, 880] : [880, 660];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = start + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // Audio is a nicety; never let it throw into the engine.
  }
}

function fireNotification(from: PomodoroPhase, to: PomodoroPhase, settings: PomodoroSettings): void {
  if (settings.sound) playChime(from === 'focus');
  if (
    settings.notifications &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    const title = from === 'focus' ? 'ფოკუსი დასრულდა' : 'შესვენება დასრულდა';
    const body =
      to === 'focus' ? 'დროა კვლავ ფოკუსის' : to === 'long' ? 'დიდი შესვენება' : 'მოკლე შესვენება';
    try {
      new Notification(title, { body, tag: 'labo-pomodoro', silent: !settings.sound });
    } catch {
      // Some platforms throw for non-persistent notifications; ignore.
    }
  }
}

/* ------------------------------- context ------------------------------- */

export type PomodoroStatus = 'idle' | 'running' | 'paused' | 'pending';

interface PomodoroContextValue {
  settings: PomodoroSettings;
  phase: PomodoroPhase;
  status: PomodoroStatus;
  remainingMs: number;
  durationMs: number;
  progress: number;
  cycleFocusDone: number;
  cycleLength: number;
  task: Task;
  todayCount: number;
  todayFocusMs: number;
  start: (opts?: { phase?: PomodoroPhase }) => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  reset: () => void;
  stop: () => void;
  setTask: (patch: Task) => void;
  updateSettings: (patch: Partial<Omit<PomodoroSettings, 'key' | 'updatedAt'>>) => void;
  requestNotifications: () => Promise<void>;
}

const PomodoroContext = createContext<PomodoroContextValue | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistState>(loadState);
  const [now, setNow] = useState(() => Date.now());

  const settingsRow = useLiveQuery(() => db.pomodoroSettings.get('main'), []);
  const settings = useMemo<PomodoroSettings>(
    () => ({ ...DEFAULT_POMODORO_SETTINGS, ...settingsRow, key: 'main' }),
    [settingsRow],
  );
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const recent = useLiveQuery(
    () => db.pomodoroSessions.where('startedAt').above(Date.now() - 3 * 86_400_000).toArray(),
    [],
  );

  // Display tick + immediate re-check when the tab regains focus.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
  }, []);

  // Persist the whole run state so a reload resumes exactly.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode / storage disabled — the timer still works this session.
    }
  }, [state]);

  // Advance through any interval(s) that have elapsed.
  useEffect(() => {
    const run = state.run;
    if (!run || run.pausedAt) return;
    if (remainingOf(run, now) > 0) return;

    let working: PersistState = state;
    let transitionFrom: PomodoroPhase | null = null;
    let transitionTo: PomodoroPhase | null = null;

    for (let guard = 0; guard < 100; guard++) {
      const current = working.run;
      if (!current || current.pausedAt) break;
      if (remainingOf(current, now) > 0) break;

      const scheduledEnd = current.startedAt + current.durationMs + current.pausedTotalMs;
      let cycleFocusDone = working.cycleFocusDone;

      if (current.phase === 'focus') {
        cycleFocusDone += 1;
        void recordPomodoroSession({
          startedAt: current.startedAt,
          endedAt: scheduledEnd,
          plannedMs: current.durationMs,
          actualMs: current.durationMs,
          completed: true,
          dateKey: dateKeyOf(current.startedAt),
          ...(current.subjectId ? { subjectId: current.subjectId } : {}),
          ...(current.topicId ? { topicId: current.topicId } : {}),
          ...(current.label ? { label: current.label } : {}),
        });
      }
      if (current.phase === 'long') cycleFocusDone = 0;

      const np = nextPhase(current.phase, cycleFocusDone, settingsRef.current);
      transitionFrom = transitionFrom ?? current.phase;
      transitionTo = np;

      const auto =
        np === 'focus' ? settingsRef.current.autoStartFocus : settingsRef.current.autoStartBreaks;

      if (auto) {
        working = {
          ...working,
          cycleFocusDone,
          pending: null,
          run: buildRun(np, settingsRef.current, scheduledEnd, working.task),
        };
      } else {
        working = { ...working, cycleFocusDone, pending: np, run: null };
        break;
      }
    }

    if (transitionFrom && transitionTo) fireNotification(transitionFrom, transitionTo, settingsRef.current);
    setState(working);
  }, [now, state]);

  // Reflect the countdown in the tab title.
  useEffect(() => {
    const base = "Luka's Labo";
    const run = state.run;
    if (run && !run.pausedAt) {
      const glyph = run.phase === 'focus' ? '◉' : '☕';
      document.title = `${formatClock(remainingOf(run, now))} ${glyph} · ${base}`;
    } else if (run?.pausedAt) {
      document.title = `⏸ ${formatClock(remainingOf(run, now))} · ${base}`;
    } else {
      document.title = base;
    }
    return () => {
      document.title = base;
    };
  }, [state.run, now]);

  /* ------------------------------ actions ------------------------------ */

  const start = useCallback((opts?: { phase?: PomodoroPhase }) => {
    setState((s) => {
      if (s.run && !s.run.pausedAt) return s;
      if (s.run?.pausedAt) {
        return {
          ...s,
          run: { ...s.run, pausedTotalMs: s.run.pausedTotalMs + (Date.now() - s.run.pausedAt), pausedAt: null },
        };
      }
      const phase = opts?.phase ?? s.pending ?? 'focus';
      return { ...s, pending: null, run: buildRun(phase, settingsRef.current, Date.now(), s.task) };
    });
  }, []);

  const pause = useCallback(() => {
    setState((s) => (s.run && !s.run.pausedAt ? { ...s, run: { ...s.run, pausedAt: Date.now() } } : s));
  }, []);

  const resume = useCallback(() => {
    setState((s) => {
      if (!s.run?.pausedAt) return s;
      return {
        ...s,
        run: { ...s.run, pausedTotalMs: s.run.pausedTotalMs + (Date.now() - s.run.pausedAt), pausedAt: null },
      };
    });
  }, []);

  const recordPartialFocus = (run: ActiveRun, endedAt: number) => {
    const elapsed = elapsedOf(run, endedAt);
    if (run.phase !== 'focus' || elapsed < 60_000) return;
    void recordPomodoroSession({
      startedAt: run.startedAt,
      endedAt,
      plannedMs: run.durationMs,
      actualMs: Math.min(elapsed, run.durationMs),
      completed: false,
      dateKey: dateKeyOf(run.startedAt),
      ...(run.subjectId ? { subjectId: run.subjectId } : {}),
      ...(run.topicId ? { topicId: run.topicId } : {}),
      ...(run.label ? { label: run.label } : {}),
    });
  };

  const skip = useCallback(() => {
    setState((s) => {
      const cfg = settingsRef.current;
      if (!s.run) {
        const np = s.pending ?? 'focus';
        return { ...s, pending: null, run: buildRun(np, cfg, Date.now(), s.task) };
      }
      const endedAt = Date.now();
      recordPartialFocus(s.run, endedAt);
      let cycleFocusDone = s.cycleFocusDone;
      if (s.run.phase === 'long') cycleFocusDone = 0;
      const np = nextPhase(s.run.phase, cycleFocusDone, cfg);
      fireNotification(s.run.phase, np, cfg);
      const auto = np === 'focus' ? cfg.autoStartFocus : cfg.autoStartBreaks;
      return auto
        ? { ...s, cycleFocusDone, pending: null, run: buildRun(np, cfg, endedAt, s.task) }
        : { ...s, cycleFocusDone, pending: np, run: null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setState((s) => {
      if (!s.run) return s;
      return { ...s, run: buildRun(s.run.phase, settingsRef.current, Date.now(), s.task) };
    });
  }, []);

  const stop = useCallback(() => {
    setState((s) => {
      if (s.run) recordPartialFocus(s.run, Date.now());
      return { ...s, run: null, pending: null, cycleFocusDone: 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTask = useCallback((patch: Task) => {
    setState((s) => {
      const task = { ...s.task, ...patch };
      const run =
        s.run && s.run.phase === 'focus'
          ? { ...s.run, label: task.label, subjectId: task.subjectId, topicId: task.topicId }
          : s.run;
      return { ...s, task, run };
    });
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Omit<PomodoroSettings, 'key' | 'updatedAt'>>) => {
      void savePomodoroSettings(patch);
    },
    [],
  );

  const requestNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    void savePomodoroSettings({ notifications: result === 'granted' });
  }, []);

  /* ----------------------------- derived ----------------------------- */

  const value = useMemo<PomodoroContextValue>(() => {
    const run = state.run;
    const status: PomodoroStatus = run
      ? run.pausedAt
        ? 'paused'
        : 'running'
      : state.pending
        ? 'pending'
        : 'idle';
    const phase = run?.phase ?? state.pending ?? 'focus';
    const durationMs = run ? run.durationMs : phaseDurationMs(phase, settings);
    const remainingMs = run ? remainingOf(run, now) : durationMs;
    const progress = durationMs > 0 ? 1 - remainingMs / durationMs : 0;

    const todayKey = dateKeyOf(now);
    const todays = (recent ?? []).filter((sn) => sn.dateKey === todayKey);

    return {
      settings,
      phase,
      status,
      remainingMs,
      durationMs,
      progress: Math.min(1, Math.max(0, progress)),
      cycleFocusDone: state.cycleFocusDone,
      cycleLength: Math.max(1, Math.round(settings.cycleLength)),
      task: state.task,
      todayCount: todays.filter((sn) => sn.completed).length,
      todayFocusMs: todays.reduce((sum, sn) => sum + sn.actualMs, 0),
      start,
      pause,
      resume,
      skip,
      reset,
      stop,
      setTask,
      updateSettings,
      requestNotifications,
    };
  }, [
    state,
    now,
    settings,
    recent,
    start,
    pause,
    resume,
    skip,
    reset,
    stop,
    setTask,
    updateSettings,
    requestNotifications,
  ]);

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro(): PomodoroContextValue {
  const value = useContext(PomodoroContext);
  if (!value) throw new Error('usePomodoro must be used inside PomodoroProvider');
  return value;
}
