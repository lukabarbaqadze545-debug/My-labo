import type { PomodoroPhase, PomodoroSession, PomodoroSettings } from '@/persistence/db';

/**
 * Pure pomodoro logic: phase transitions and analytics. No React, no Dexie —
 * so the timer engine and the dashboard share one tested source of truth, and
 * so a session partially recorded on one device reads the same on another.
 */

const MINUTE = 60_000;
const DAY = 86_400_000;

export function phaseDurationMs(phase: PomodoroPhase, s: PomodoroSettings): number {
  const min = phase === 'focus' ? s.focusMin : phase === 'short' ? s.shortBreakMin : s.longBreakMin;
  return Math.max(1, Math.round(min)) * MINUTE;
}

/**
 * Which phase follows the one that just ended. `focusDoneInCycle` is the count
 * of completed focus intervals since the last long break, *including* the one
 * that just finished.
 */
export function nextPhase(
  ended: PomodoroPhase,
  focusDoneInCycle: number,
  s: PomodoroSettings,
): PomodoroPhase {
  if (ended !== 'focus') return 'focus';
  const per = Math.max(1, Math.round(s.cycleLength));
  return focusDoneInCycle % per === 0 ? 'long' : 'short';
}

/** Local calendar day as `YYYY-MM-DD` — grouping key that never drifts by tz. */
export function dateKeyOf(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / MINUTE);
  if (totalMin < 60) return `${totalMin} წთ`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} სთ` : `${h} სთ ${m} წთ`;
}

/* ------------------------------ analytics ------------------------------- */

export interface DayBucket {
  dateKey: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  focusMs: number;
  count: number;
}

export interface SubjectBucket {
  subjectId: string;
  focusMs: number;
  count: number;
}

export interface PomodoroStats {
  today: {
    focusMs: number;
    count: number;
    completed: number;
    goal: number;
    goalPct: number;
  };
  streakDays: number;
  weekFocusMs: number;
  totals: {
    focusMs: number;
    count: number;
    completed: number;
    activeDays: number;
    bestDay: DayBucket | null;
    avgActiveDayMs: number;
    completionRate: number;
  };
  /** Most recent `days` calendar days, oldest first, gaps filled with zeros. */
  recentDays: DayBucket[];
  bySubject: SubjectBucket[];
  /** Focus ms started in each hour of the day, index 0–23. */
  byHour: number[];
  byWeekday: number[];
}

function emptyDay(ts: number): DayBucket {
  return { dateKey: dateKeyOf(ts), weekday: new Date(ts).getDay(), focusMs: 0, count: 0 };
}

export function summarize(
  sessions: PomodoroSession[],
  settings: PomodoroSettings,
  now: number = Date.now(),
  recentDayCount = 14,
): PomodoroStats {
  const todayKey = dateKeyOf(now);
  const byDay = new Map<string, DayBucket>();
  const subjectMs = new Map<string, SubjectBucket>();
  const byHour = new Array<number>(24).fill(0);
  const byWeekday = new Array<number>(7).fill(0);

  let totalFocusMs = 0;
  let totalCount = 0;
  let totalCompleted = 0;

  for (const s of sessions) {
    totalFocusMs += s.actualMs;
    totalCount += 1;
    if (s.completed) totalCompleted += 1;

    const day = byDay.get(s.dateKey) ?? {
      dateKey: s.dateKey,
      weekday: new Date(s.startedAt).getDay(),
      focusMs: 0,
      count: 0,
    };
    day.focusMs += s.actualMs;
    day.count += 1;
    byDay.set(s.dateKey, day);

    const hour = new Date(s.startedAt).getHours();
    const wd = new Date(s.startedAt).getDay();
    byHour[hour] = (byHour[hour] ?? 0) + s.actualMs;
    byWeekday[wd] = (byWeekday[wd] ?? 0) + s.actualMs;

    if (s.subjectId) {
      const sub = subjectMs.get(s.subjectId) ?? { subjectId: s.subjectId, focusMs: 0, count: 0 };
      sub.focusMs += s.actualMs;
      sub.count += 1;
      subjectMs.set(s.subjectId, sub);
    }
  }

  const todayBucket = byDay.get(todayKey);
  const todayCompleted = sessions.filter((s) => s.dateKey === todayKey && s.completed).length;
  const goal = Math.max(1, Math.round(settings.dailyGoal));

  // Streak: consecutive days with ≥1 completed focus, ending today or yesterday.
  const completedDays = new Set(sessions.filter((s) => s.completed).map((s) => s.dateKey));
  let streak = 0;
  let cursor = now;
  if (!completedDays.has(dateKeyOf(cursor))) cursor -= DAY; // today not done yet is fine
  while (completedDays.has(dateKeyOf(cursor))) {
    streak += 1;
    cursor -= DAY;
  }

  const recentDays: DayBucket[] = [];
  for (let i = recentDayCount - 1; i >= 0; i--) {
    const ts = now - i * DAY;
    recentDays.push(byDay.get(dateKeyOf(ts)) ?? emptyDay(ts));
  }

  const weekFocusMs = recentDays.slice(-7).reduce((sum, d) => sum + d.focusMs, 0);

  const days = [...byDay.values()];
  const bestDay = days.length ? days.reduce((a, b) => (b.focusMs > a.focusMs ? b : a)) : null;

  return {
    today: {
      focusMs: todayBucket?.focusMs ?? 0,
      count: todayBucket?.count ?? 0,
      completed: todayCompleted,
      goal,
      goalPct: Math.min(1, todayCompleted / goal),
    },
    streakDays: streak,
    weekFocusMs,
    totals: {
      focusMs: totalFocusMs,
      count: totalCount,
      completed: totalCompleted,
      activeDays: days.length,
      bestDay,
      avgActiveDayMs: days.length ? totalFocusMs / days.length : 0,
      completionRate: totalCount ? totalCompleted / totalCount : 0,
    },
    recentDays,
    bySubject: [...subjectMs.values()].sort((a, b) => b.focusMs - a.focusMs),
    byHour,
    byWeekday,
  };
}
