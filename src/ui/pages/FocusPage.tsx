import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/persistence/db';
import { t as tr } from '@/content';
import { formatClock, formatDuration, summarize } from '@/domain/pomodoro';
import { clearPomodoroSessions } from '@/persistence/repositories';
import { useApp, useT } from '../state/AppState';
import { usePomodoro } from '../state/PomodoroProvider';
import { SectionHead } from '../components/primitives';
import { DayBars, HourBars, Meter, SubjectBars, TimerRing } from '../components/pomodoro/charts';

type Tab = 'timer' | 'stats' | 'settings';

export function FocusPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('timer');

  return (
    <div className="page focus-page">
      <header className="hero">
        <h1 className="hero__title">{t.pomodoro.title}</h1>
        <p className="hero__sub">{t.pomodoro.subtitle}</p>
      </header>

      <div className="tabs" role="tablist">
        {(
          [
            ['timer', t.pomodoro.tabTimer],
            ['stats', t.pomodoro.tabStats],
            ['settings', t.pomodoro.tabSettings],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="tab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'timer' ? <TimerTab /> : tab === 'stats' ? <StatsTab /> : <SettingsTab />}
    </div>
  );
}

/* ------------------------------- timer tab ------------------------------- */

function TimerTab() {
  const t = useT();
  const { subjects } = useApp();
  const {
    phase,
    status,
    remainingMs,
    progress,
    cycleFocusDone,
    cycleLength,
    task,
    todayCount,
    todayFocusMs,
    settings,
    start,
    pause,
    resume,
    skip,
    reset,
    stop,
    setTask,
  } = usePomodoro();

  const phaseLabel =
    phase === 'focus' ? t.pomodoro.phaseFocus : phase === 'short' ? t.pomodoro.phaseShort : t.pomodoro.phaseLong;
  const goalMet = todayCount >= settings.dailyGoal;

  return (
    <div className="focus-timer">
      <div className={`focus-stage focus-stage--${phase === 'focus' ? 'focus' : 'break'}`}>
        <TimerRing progress={progress} tone={phase === 'focus' ? 'accent' : 'break'}>
          <span className="focus-stage__phase">{phaseLabel}</span>
          <span className="focus-stage__clock">{formatClock(remainingMs)}</span>
          <span className="focus-stage__status">
            {status === 'running'
              ? t.pomodoro.running
              : status === 'paused'
                ? t.pomodoro.paused
                : status === 'pending'
                  ? phase === 'focus'
                    ? t.pomodoro.startFocus
                    : t.pomodoro.startBreak
                  : t.pomodoro.idleHint}
          </span>
        </TimerRing>

        <div className="focus-cycle" aria-label={t.pomodoro.cycleProgress(cycleFocusDone, cycleLength)}>
          {Array.from({ length: cycleLength }, (_, i) => (
            <span key={i} className={`focus-cycle__dot${i < cycleFocusDone ? ' is-done' : ''}`} />
          ))}
        </div>

        <div className="focus-controls">
          {status === 'running' ? (
            <button className="btn btn--primary btn--wide" onClick={pause}>
              {t.pomodoro.pause}
            </button>
          ) : status === 'paused' ? (
            <button className="btn btn--primary btn--wide" onClick={resume}>
              {t.pomodoro.resume}
            </button>
          ) : (
            <button className="btn btn--primary btn--wide" onClick={() => start()}>
              {status === 'pending'
                ? phase === 'focus'
                  ? t.pomodoro.startFocus
                  : t.pomodoro.startBreak
                : t.pomodoro.start}
            </button>
          )}
          {status !== 'idle' ? (
            <>
              <button className="btn btn--ghost" onClick={skip}>
                {t.pomodoro.skip}
              </button>
              {status !== 'pending' ? (
                <button className="btn btn--ghost" onClick={reset}>
                  {t.pomodoro.reset}
                </button>
              ) : null}
              <button className="btn btn--ghost" onClick={stop}>
                {t.pomodoro.stop}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="focus-side">
        <label className="field">
          <span className="field__label">{t.pomodoro.taskLabel}</span>
          <input
            className="input"
            value={task.label ?? ''}
            placeholder={t.pomodoro.taskPlaceholder}
            onChange={(e) => setTask({ label: e.target.value || undefined })}
          />
        </label>
        <label className="field">
          <span className="field__label">{t.pomodoro.linkSubject}</span>
          <select
            className="input"
            value={task.subjectId ?? ''}
            onChange={(e) => setTask({ subjectId: e.target.value || undefined })}
          >
            <option value="">{t.pomodoro.noSubject}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {tr(s.name)}
              </option>
            ))}
          </select>
        </label>

        <div className="focus-today">
          <div className="stat">
            <span className="stat__value">{formatDuration(todayFocusMs)}</span>
            <span className="stat__label">{t.pomodoro.todayFocus}</span>
          </div>
          <div className="stat">
            <span className="stat__value">{t.pomodoro.todayCount(todayCount)}</span>
            <span className="stat__label">
              {goalMet ? `✓ ${t.pomodoro.goalReached}` : `${todayCount} / ${settings.dailyGoal}`}
            </span>
          </div>
          <Meter value={todayCount / Math.max(1, settings.dailyGoal)} label={`${t.pomodoro.dailyGoal}`} met={goalMet} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- stats tab ------------------------------- */

function StatsTab() {
  const t = useT();
  const { subjectById } = useApp();
  const { settings } = usePomodoro();
  const sessions = useLiveQuery(() => db.pomodoroSessions.orderBy('startedAt').toArray(), []);

  const stats = useMemo(
    () => (sessions ? summarize(sessions, settings, Date.now(), 14) : null),
    [sessions, settings],
  );

  if (!stats || sessions === undefined) {
    return <p className="muted">{t.common.loading}</p>;
  }
  if (sessions.length === 0) {
    return <p className="empty__hint" style={{ marginTop: 'var(--space-6)' }}>{t.pomodoro.noData}</p>;
  }

  const subjectRows = stats.bySubject.slice(0, 8).map((row) => ({
    label: tr(subjectById.get(row.subjectId)?.name) || row.subjectId,
    focusMs: row.focusMs,
    count: row.count,
  }));

  const recent = [...sessions].reverse().slice(0, 12);

  return (
    <div className="focus-stats">
      <div className="focus-tiles">
        <Tile value={Math.round(stats.today.focusMs / 60000)} label={t.pomodoro.statToday} />
        <Tile value={stats.streakDays} label={t.pomodoro.statStreak} />
        <Tile value={Math.round(stats.weekFocusMs / 60000)} label={t.pomodoro.statWeek} />
        <Tile value={stats.totals.completed} label={t.pomodoro.statAllTime} />
      </div>

      <section className="section">
        <SectionHead title={t.pomodoro.last14} />
        <DayBars days={stats.recentDays} />
      </section>

      <section className="section">
        <SectionHead title={t.pomodoro.byHour} />
        <HourBars byHour={stats.byHour} />
      </section>

      {subjectRows.length > 0 ? (
        <section className="section">
          <SectionHead title={t.pomodoro.bySubject} />
          <SubjectBars rows={subjectRows} />
        </section>
      ) : null}

      <section className="section">
        <SectionHead title={t.pomodoro.completionRate} />
        <Meter
          value={stats.totals.completionRate}
          label={`${Math.round(stats.totals.completionRate * 100)}% · ${stats.totals.completed}/${stats.totals.count}`}
        />
        <div className="focus-tiles focus-tiles--sm">
          <Tile
            value={stats.totals.bestDay ? Math.round(stats.totals.bestDay.focusMs / 60000) : 0}
            label={`${t.pomodoro.bestDay}${stats.totals.bestDay ? ` · ${stats.totals.bestDay.dateKey.slice(5)}` : ''}`}
          />
          <Tile value={Math.round(stats.totals.avgActiveDayMs / 60000)} label={t.pomodoro.avgDay} />
        </div>
      </section>

      <section className="section">
        <SectionHead title={t.pomodoro.recent} />
        <ul className="sessionlist">
          {recent.map((s) => {
            const d = new Date(s.startedAt);
            const time = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const subj = s.subjectId ? tr(subjectById.get(s.subjectId)?.name) : undefined;
            return (
              <li key={s.id} className="sessionlist__row">
                <span className="sessionlist__time">{time}</span>
                <span className="sessionlist__label">
                  {s.label || subj || t.pomodoro.phaseFocus}
                  {subj && s.label ? <span className="muted"> · {subj}</span> : null}
                </span>
                <span className="sessionlist__dur">
                  {Math.round(s.actualMs / 60000)} წთ
                  {!s.completed ? <span className="chip chip--caution"> {t.pomodoro.interrupted}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="focus-tile">
      <span className="focus-tile__value">{value}</span>
      <span className="focus-tile__label">{label}</span>
    </div>
  );
}

/* ----------------------------- settings tab ---------------------------- */

function NumField({
  label,
  value,
  min,
  max,
  onSet,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onSet: (v: number) => void;
}) {
  return (
    <label className="field field--row">
      <span className="field__label">{label}</span>
      <input
        className="input input--num"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onSet(Math.min(max, Math.max(min, Math.round(v))));
        }}
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onSet,
}: {
  label: string;
  checked: boolean;
  onSet: (v: boolean) => void;
}) {
  return (
    <label className="field field--row">
      <span className="field__label">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onSet(e.target.checked)} />
    </label>
  );
}

function SettingsTab() {
  const t = useT();
  const { settings, updateSettings, requestNotifications } = usePomodoro();

  const notifState =
    typeof Notification === 'undefined'
      ? 'unavailable'
      : Notification.permission === 'denied'
        ? 'denied'
        : Notification.permission === 'granted' && settings.notifications
          ? 'on'
          : 'off';

  return (
    <div className="focus-settings">
      <section className="section">
        <SectionHead title={t.pomodoro.tabSettings} subtitle={t.pomodoro.settingsNote} />
        <div className="fieldset">
          <NumField label={t.pomodoro.focusLen} value={settings.focusMin} min={1} max={180} onSet={(v) => updateSettings({ focusMin: v })} />
          <NumField label={t.pomodoro.shortLen} value={settings.shortBreakMin} min={1} max={60} onSet={(v) => updateSettings({ shortBreakMin: v })} />
          <NumField label={t.pomodoro.longLen} value={settings.longBreakMin} min={1} max={90} onSet={(v) => updateSettings({ longBreakMin: v })} />
          <NumField label={t.pomodoro.cycleLen} value={settings.cycleLength} min={2} max={12} onSet={(v) => updateSettings({ cycleLength: v })} />
          <NumField label={t.pomodoro.dailyGoal} value={settings.dailyGoal} min={1} max={40} onSet={(v) => updateSettings({ dailyGoal: v })} />
          <ToggleField label={t.pomodoro.autoBreaks} checked={settings.autoStartBreaks} onSet={(v) => updateSettings({ autoStartBreaks: v })} />
          <ToggleField label={t.pomodoro.autoFocus} checked={settings.autoStartFocus} onSet={(v) => updateSettings({ autoStartFocus: v })} />
          <ToggleField label={t.pomodoro.sound} checked={settings.sound} onSet={(v) => updateSettings({ sound: v })} />
          <div className="field field--row">
            <span className="field__label">{t.pomodoro.notifications}</span>
            {notifState === 'denied' ? (
              <span className="muted xsmall">{t.pomodoro.notificationsBlocked}</span>
            ) : notifState === 'on' ? (
              <button className="btn btn--ghost btn--sm" onClick={() => updateSettings({ notifications: false })}>
                ✓
              </button>
            ) : (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => void requestNotifications()}
                disabled={notifState === 'unavailable'}
              >
                {t.pomodoro.enableNotifications}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <button
          className="btn btn--ghost"
          onClick={() => {
            if (window.confirm(t.pomodoro.clearHistoryConfirm)) void clearPomodoroSessions();
          }}
        >
          {t.pomodoro.clearHistory}
        </button>
      </section>
    </div>
  );
}
