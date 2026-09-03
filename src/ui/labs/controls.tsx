import type { ReactNode } from 'react';

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = `slider-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="slider">
      <div className="slider__head">
        <label htmlFor={id}>{label}</label>
        <span className="slider__value">
          {format ? format(value) : value}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Readout({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="readout">
      {items.map((item, i) => (
        <div key={i} className="readout__item">
          <span className="readout__label">{item.label}</span>
          <span className="readout__value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Reads a CSS custom property so canvases match the active theme. */
export function themeColors(): {
  ink: string;
  ink3: string;
  accent: string;
  line: string;
  surface: string;
} {
  if (typeof window === 'undefined') {
    return { ink: '#222', ink3: '#777', accent: '#4477dd', line: '#ccc', surface: '#fff' };
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    ink: read('--ink', '#222'),
    ink3: read('--ink-3', '#777'),
    accent: read('--accent', '#4477dd'),
    line: read('--line-strong', '#ccc'),
    surface: read('--surface-sunken', '#fff'),
  };
}

/** Sets up a HiDPI canvas and returns the 2D context in CSS pixels. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.aspectRatio = `${width} / ${height}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}
