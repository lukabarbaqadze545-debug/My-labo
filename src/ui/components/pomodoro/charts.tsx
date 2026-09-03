import { useId, useState, type ReactNode } from 'react';
import type { DayBucket } from '@/domain/pomodoro';
import { formatDuration } from '@/domain/pomodoro';

/**
 * Small, self-contained SVG charts for the focus dashboard.
 *
 * Every chart is a single series (magnitude), so there is no legend and no
 * categorical palette — one accent hue, identity carried by the axis labels and
 * selective direct labels. Marks are thin with rounded, baseline-anchored ends;
 * grid and axes stay recessive; hovering a mark shows its exact value.
 */

function Tooltip({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <div className="pchart__tip" style={{ left: x, top: y }} role="status">
      {text}
    </div>
  );
}

/* ------------------------------ progress ring ------------------------------ */

export function TimerRing({
  progress,
  size = 260,
  stroke = 12,
  children,
  tone = 'accent',
}: {
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  tone?: 'accent' | 'break';
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-faint)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'break' ? 'var(--success)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>
      <div className="ring__inner">{children}</div>
    </div>
  );
}

/* --------------------------- days: vertical bars --------------------------- */

export function DayBars({ days }: { days: DayBucket[] }) {
  const clipId = useId();
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const W = 640;
  const H = 180;
  const padB = 22;
  const padT = 10;
  const max = Math.max(1, ...days.map((d) => d.focusMs));
  let maxIdx = -1;
  let maxVal = 0;
  days.forEach((d, i) => {
    if (d.focusMs > maxVal) {
      maxVal = d.focusMs;
      maxIdx = i;
    }
  });
  const slot = W / days.length;
  const bw = Math.min(26, slot - 6);
  const plotH = H - padB - padT;

  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ბოლო დღეების ფოკუსი">
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={W} height={H - padB} />
          </clipPath>
        </defs>
        <line x1={0} y1={H - padB} x2={W} y2={H - padB} stroke="var(--line)" strokeWidth={1} />
        {[0.5].map((f) => (
          <line
            key={f}
            x1={0}
            y1={padT + plotH * (1 - f)}
            x2={W}
            y2={padT + plotH * (1 - f)}
            stroke="var(--line-faint)"
            strokeWidth={1}
          />
        ))}
        <g clipPath={`url(#${clipId})`}>
          {days.map((d, i) => {
            const h = d.focusMs > 0 ? Math.max(3, (d.focusMs / max) * plotH) : 0;
            const x = i * slot + (slot - bw) / 2;
            const y = padT + plotH - h;
            return (
              <rect
                key={d.dateKey}
                x={x}
                y={y}
                width={bw}
                height={h + 6}
                rx={4}
                fill={d.focusMs > 0 ? 'var(--accent)' : 'transparent'}
                opacity={i === maxIdx ? 1 : 0.82}
                onMouseEnter={(e) =>
                  setTip({
                    text: `${d.dateKey.slice(5)} · ${formatDuration(d.focusMs)} · ${d.count} სესია`,
                    x: e.nativeEvent.offsetX,
                    y: e.nativeEvent.offsetY,
                  })
                }
                onMouseLeave={() => setTip(null)}
              >
                <title>{`${d.dateKey} — ${formatDuration(d.focusMs)}`}</title>
              </rect>
            );
          })}
        </g>
        {days.map((d, i) =>
          i % 2 === 0 ? (
            <text
              key={d.dateKey}
              x={i * slot + slot / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize={10}
              fill="var(--ink-4)"
            >
              {d.dateKey.slice(8)}
            </text>
          ) : null,
        )}
        {maxIdx >= 0 && maxVal > 0 ? (
          <text
            x={maxIdx * slot + slot / 2}
            y={padT + plotH - (maxVal / max) * plotH - 5}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="var(--ink-2)"
          >
            {Math.round(maxVal / 60000)}
          </text>
        ) : null}
      </svg>
      {tip ? <Tooltip {...tip} /> : null}
    </div>
  );
}

/* --------------------------- hours: 24 thin bars -------------------------- */

export function HourBars({ byHour }: { byHour: number[] }) {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const W = 640;
  const H = 120;
  const padB = 18;
  const max = Math.max(1, ...byHour);
  const slot = W / 24;
  const bw = slot - 4;
  const plotH = H - padB - 6;
  const peak = byHour.indexOf(Math.max(...byHour));

  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="ფოკუსი დღის საათების მიხედვით">
        <line x1={0} y1={H - padB} x2={W} y2={H - padB} stroke="var(--line)" strokeWidth={1} />
        {byHour.map((ms, h) => {
          const bh = ms > 0 ? Math.max(3, (ms / max) * plotH) : 0;
          const x = h * slot + 2;
          return (
            <rect
              key={h}
              x={x}
              y={H - padB - bh}
              width={bw}
              height={bh}
              rx={3}
              fill="var(--accent)"
              opacity={ms > 0 ? (h === peak ? 1 : 0.75) : 0}
              onMouseEnter={(e) =>
                setTip({
                  text: `${String(h).padStart(2, '0')}:00 · ${formatDuration(ms)}`,
                  x: e.nativeEvent.offsetX,
                  y: e.nativeEvent.offsetY,
                })
              }
              onMouseLeave={() => setTip(null)}
            >
              <title>{`${h}:00 — ${formatDuration(ms)}`}</title>
            </rect>
          );
        })}
        {[0, 6, 12, 18].map((h) => (
          <text key={h} x={h * slot + slot / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--ink-4)">
            {String(h).padStart(2, '0')}
          </text>
        ))}
      </svg>
      {tip ? <Tooltip {...tip} /> : null}
    </div>
  );
}

/* ----------------------------- meter (goal) ----------------------------- */

export function Meter({ value, label, met = false }: { value: number; label: string; met?: boolean }) {
  const pct = Math.min(1, Math.max(0, value));
  return (
    <div className="meter">
      <div className="meter__track">
        <div
          className="meter__fill"
          style={{ width: `${pct * 100}%`, background: met ? 'var(--success)' : 'var(--accent)' }}
        />
      </div>
      <span className="meter__label">{label}</span>
    </div>
  );
}

/* ------------------------ subjects: horizontal bars ---------------------- */

export function SubjectBars({
  rows,
}: {
  rows: { label: string; focusMs: number; count: number }[];
}) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.focusMs));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.label} title={`${r.label} — ${formatDuration(r.focusMs)}`}>
          <span className="hbar__label">{r.label}</span>
          <span className="hbar__track">
            <span className="hbar__fill" style={{ width: `${Math.max(4, (r.focusMs / max) * 100)}%` }} />
          </span>
          <span className="hbar__value">{formatDuration(r.focusMs)}</span>
        </div>
      ))}
    </div>
  );
}
