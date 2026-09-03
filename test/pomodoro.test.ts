import { describe, expect, it } from 'vitest';
import { DEFAULT_POMODORO_SETTINGS, type PomodoroSession } from '@/persistence/db';
import {
  dateKeyOf,
  formatClock,
  formatDuration,
  nextPhase,
  phaseDurationMs,
  summarize,
} from '@/domain/pomodoro';

const MIN = 60_000;
const DAY = 86_400_000;

function session(over: Partial<PomodoroSession> & Pick<PomodoroSession, 'startedAt'>): PomodoroSession {
  const { startedAt } = over;
  return {
    id: `pomo_${startedAt}`,
    endedAt: startedAt + 25 * MIN,
    plannedMs: 25 * MIN,
    actualMs: 25 * MIN,
    completed: true,
    dateKey: dateKeyOf(startedAt),
    ...over,
  };
}

describe('pomodoro phase logic', () => {
  const s = DEFAULT_POMODORO_SETTINGS;

  it('uses configured durations', () => {
    expect(phaseDurationMs('focus', s)).toBe(25 * MIN);
    expect(phaseDurationMs('short', s)).toBe(5 * MIN);
    expect(phaseDurationMs('long', s)).toBe(15 * MIN);
    expect(phaseDurationMs('focus', { ...s, focusMin: 50 })).toBe(50 * MIN);
  });

  it('cycles focus → short, and every Nth focus → long', () => {
    expect(nextPhase('focus', 1, s)).toBe('short');
    expect(nextPhase('focus', 2, s)).toBe('short');
    expect(nextPhase('focus', 3, s)).toBe('short');
    expect(nextPhase('focus', 4, s)).toBe('long'); // cycleLength 4
    expect(nextPhase('focus', 8, s)).toBe('long');
  });

  it('always returns to focus after a break', () => {
    expect(nextPhase('short', 2, s)).toBe('focus');
    expect(nextPhase('long', 0, s)).toBe('focus');
  });

  it('formats clocks and durations', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(-1)).toBe('00:00');
    expect(formatDuration(45 * MIN)).toBe('45 წთ');
    expect(formatDuration(90 * MIN)).toBe('1 სთ 30 წთ');
    expect(formatDuration(120 * MIN)).toBe('2 სთ');
  });
});

describe('pomodoro analytics', () => {
  const s = { ...DEFAULT_POMODORO_SETTINGS, dailyGoal: 4 };
  const now = new Date('2026-03-15T14:00:00').getTime();

  it('summarises an empty history without throwing', () => {
    const stats = summarize([], s, now);
    expect(stats.today.count).toBe(0);
    expect(stats.streakDays).toBe(0);
    expect(stats.totals.count).toBe(0);
    expect(stats.recentDays).toHaveLength(14);
    expect(stats.byHour).toHaveLength(24);
  });

  it('counts today and applies the daily goal', () => {
    const sessions = [
      session({ startedAt: now - 2 * MIN }),
      session({ startedAt: now - 40 * MIN }),
      session({ startedAt: now - 90 * MIN, completed: false, actualMs: 8 * MIN }),
    ];
    const stats = summarize(sessions, s, now);
    expect(stats.today.count).toBe(3);
    expect(stats.today.completed).toBe(2);
    expect(stats.today.goalPct).toBeCloseTo(0.5);
    expect(stats.totals.completionRate).toBeCloseTo(2 / 3);
  });

  it('computes a day streak that tolerates today not being done yet', () => {
    const sessions = [
      // nothing today, but yesterday and the day before
      session({ startedAt: now - 1 * DAY }),
      session({ startedAt: now - 2 * DAY }),
      // gap on day 3, then day 4 — not part of the streak
      session({ startedAt: now - 4 * DAY }),
    ];
    expect(summarize(sessions, s, now).streakDays).toBe(2);
  });

  it('extends the streak through today once a session lands', () => {
    const sessions = [
      session({ startedAt: now - 10 * MIN }),
      session({ startedAt: now - 1 * DAY }),
      session({ startedAt: now - 2 * DAY }),
    ];
    expect(summarize(sessions, s, now).streakDays).toBe(3);
  });

  it('buckets focus time by subject and by hour', () => {
    const sessions = [
      session({ startedAt: new Date('2026-03-15T09:30:00').getTime(), subjectId: 'math', actualMs: 25 * MIN }),
      session({ startedAt: new Date('2026-03-15T09:50:00').getTime(), subjectId: 'math', actualMs: 25 * MIN }),
      session({ startedAt: new Date('2026-03-15T21:00:00').getTime(), subjectId: 'physics', actualMs: 25 * MIN }),
    ];
    const stats = summarize(sessions, s, now);
    expect(stats.bySubject[0]).toEqual({ subjectId: 'math', focusMs: 50 * MIN, count: 2 });
    expect(stats.byHour[9]).toBe(50 * MIN);
    expect(stats.byHour[21]).toBe(25 * MIN);
  });
});
