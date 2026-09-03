import { NavLink } from 'react-router-dom';
import { usePomodoro } from '../state/PomodoroProvider';
import { formatClock } from '@/domain/pomodoro';

/**
 * Compact timer shown in the top bar on every page while a session is live, so
 * the countdown is never more than a glance away.
 */
export function MiniTimer() {
  const { status, phase, remainingMs, progress, start, pause } = usePomodoro();

  if (status === 'idle') return null;

  const isBreak = phase !== 'focus';
  const glyph = phase === 'focus' ? '◉' : '☕';
  const label =
    status === 'pending'
      ? phase === 'focus'
        ? 'ფოკუსი მზადაა'
        : 'შესვენება მზადაა'
      : formatClock(remainingMs);

  return (
    <div className={`minitimer${isBreak ? ' minitimer--break' : ''}`}>
      <NavLink to="/focus" className="minitimer__face" title="ფოკუსის ოთახი">
        <span
          className="minitimer__ring"
          style={{ ['--p' as string]: String(Math.round(progress * 100)) }}
          aria-hidden="true"
        >
          <span className="minitimer__glyph">{glyph}</span>
        </span>
        <span className="minitimer__time">{label}</span>
      </NavLink>
      {status === 'running' ? (
        <button className="minitimer__btn" onClick={pause} aria-label="დაპაუზება">
          ⏸
        </button>
      ) : (
        <button className="minitimer__btn" onClick={() => start()} aria-label="გაშვება">
          ▶
        </button>
      )}
    </div>
  );
}
