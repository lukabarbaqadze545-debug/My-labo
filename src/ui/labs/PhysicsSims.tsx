import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareCanvas, Readout, Slider, themeColors } from './controls';

const W = 640;
const H = 320;

/**
 * Projectile motion with an optional drag term.
 *
 * The point of the module is the *comparison*: without drag the optimum launch
 * angle is exactly 45°, with drag it drops well below — which is a result
 * students usually only ever read about.
 */
export function ProjectileSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(28);
  const [drag, setDrag] = useState(false);

  const trajectory = useMemo(() => {
    const g = 9.81;
    const rad = (angle * Math.PI) / 180;
    const points: { x: number; y: number }[] = [];
    let x = 0;
    let y = 0;
    let vx = speed * Math.cos(rad);
    let vy = speed * Math.sin(rad);
    const dt = 0.02;
    const k = drag ? 0.02 : 0;
    for (let i = 0; i < 4000; i++) {
      const v = Math.hypot(vx, vy);
      const ax = -k * v * vx;
      const ay = -g - k * v * vy;
      vx += ax * dt;
      vy += ay * dt;
      x += vx * dt;
      y += vy * dt;
      if (y < 0) {
        points.push({ x, y: 0 });
        break;
      }
      points.push({ x, y });
    }
    return points;
  }, [angle, speed, drag]);

  const range = trajectory.length > 0 ? (trajectory[trajectory.length - 1]?.x ?? 0) : 0;
  const peak = trajectory.reduce((max, p) => Math.max(max, p.y), 0);
  const flightTime = trajectory.length * 0.02;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, W, H);
    if (!ctx) return;
    const c = themeColors();

    const maxX = Math.max(range * 1.15, 40);
    const maxY = Math.max(peak * 1.5, 20);
    const px = (x: number) => 40 + (x / maxX) * (W - 60);
    const py = (y: number) => H - 40 - (y / maxY) * (H - 70);

    // ground + axes
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(36, H - 40);
    ctx.lineTo(W - 12, H - 40);
    ctx.moveTo(40, 14);
    ctx.lineTo(40, H - 36);
    ctx.stroke();

    ctx.fillStyle = c.ink3;
    ctx.font = '11px ui-monospace, monospace';
    for (let m = 0; m <= maxX; m += Math.max(10, Math.round(maxX / 6 / 10) * 10)) {
      ctx.fillText(String(Math.round(m)), px(m) - 6, H - 24);
    }

    // launch angle marker
    ctx.strokeStyle = c.line;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    ctx.lineTo(px(0) + 46 * Math.cos((angle * Math.PI) / 180), py(0) - 46 * Math.sin((angle * Math.PI) / 180));
    ctx.stroke();
    ctx.setLineDash([]);

    // trajectory
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    trajectory.forEach((point, i) => {
      const X = px(point.x);
      const Y = py(point.y);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.stroke();

    // projectile
    const last = trajectory[trajectory.length - 1];
    if (last) {
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(px(last.x), py(last.y), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [trajectory, range, peak, angle]);

  return (
    <div className="sim">
      <div className="sim__stage">
        <canvas ref={canvasRef} role="img" aria-label={`ტრაექტორია ${angle} გრადუსზე`} />
      </div>
      <div className="sim__controls">
        <Slider label="კუთხე" value={angle} min={5} max={85} onChange={setAngle} unit="°" />
        <Slider label="საწყისი სიჩქარე" value={speed} min={5} max={60} onChange={setSpeed} unit="მ/წმ" />
        <div className="slider">
          <div className="slider__head">
            <label htmlFor="drag-toggle">ჰაერის წინააღმდეგობა</label>
          </div>
          <button
            id="drag-toggle"
            className="chip chip--toggle"
            aria-pressed={drag}
            onClick={() => setDrag((d) => !d)}
          >
            {drag ? 'ჩართულია' : 'გამორთულია'}
          </button>
        </div>
      </div>
      <Readout
        items={[
          { label: 'სიშორე', value: `${range.toFixed(1)} მ` },
          { label: 'მაქს. სიმაღლე', value: `${peak.toFixed(1)} მ` },
          { label: 'ფრენის დრო', value: `${flightTime.toFixed(2)} წმ` },
        ]}
      />
      <p className="xsmall muted">
        ვაკუუმში ყველაზე დიდ სიშორეს ზუსტად 45° იძლევა. ჩართე ჰაერის წინააღმდეგობა და სცადე ისევ იპოვო
        საუკეთესო კუთხე — ის შესამჩნევად ნაკლები აღმოჩნდება.
      </p>
    </div>
  );
}

/** Lorentz factor made tangible: the curve is flat until it suddenly is not. */
export function TimeDilationSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fraction, setFraction] = useState(50);
  const beta = fraction / 100;
  const gamma = 1 / Math.sqrt(Math.max(1 - beta * beta, 1e-9));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, W, 260);
    if (!ctx) return;
    const c = themeColors();

    const px = (b: number) => 44 + b * (W - 70);
    const py = (g: number) => 220 - (Math.min(g, 8) / 8) * 190;

    ctx.strokeStyle = c.line;
    ctx.beginPath();
    ctx.moveTo(40, 220);
    ctx.lineTo(W - 14, 220);
    ctx.moveTo(44, 20);
    ctx.lineTo(44, 224);
    ctx.stroke();

    ctx.fillStyle = c.ink3;
    ctx.font = '11px ui-monospace, monospace';
    [0, 0.25, 0.5, 0.75, 0.9, 0.99].forEach((b) => ctx.fillText(String(b), px(b) - 8, 238));
    [1, 2, 4, 8].forEach((g) => ctx.fillText(`${g}×`, 12, py(g) + 4));

    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let b = 0; b <= 0.995; b += 0.002) {
      const g = 1 / Math.sqrt(1 - b * b);
      const X = px(b);
      const Y = py(g);
      if (b === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();

    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(px(beta), py(gamma), 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = c.line;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px(beta), py(gamma));
    ctx.lineTo(px(beta), 220);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [beta, gamma]);

  const earthYear = 365 * gamma;

  return (
    <div className="sim">
      <div className="sim__stage">
        <canvas ref={canvasRef} role="img" aria-label="ლორენცის ფაქტორის გრაფიკი" />
      </div>
      <div className="sim__controls">
        <Slider
          label="სიჩქარე სინათლის სიჩქარის წილად"
          value={fraction}
          min={0}
          max={99}
          onChange={setFraction}
          unit="% c"
        />
      </div>
      <Readout
        items={[
          { label: 'ლორენცის ფაქტორი γ', value: gamma.toFixed(3) },
          { label: 'ხომალდზე 1 წელი =', value: `${(earthYear / 365).toFixed(2)} წელი დედამიწაზე` },
          { label: 'დღეში სხვაობა', value: `${((gamma - 1) * 86400).toFixed(3)} წმ` },
        ]}
      />
      <p className="xsmall muted">
        დააკვირდი, რომ 50%-მდე მრუდი თითქმის ბრტყელია. სწორედ ამიტომ არ ვამჩნევთ ეფექტს ყოველდღიურ
        ცხოვრებაში — ის მხოლოდ სინათლის სიჩქარესთან ახლოს ხდება მკვეთრი.
      </p>
    </div>
  );
}

/** Ohm's law with a live circuit readout. */
export function OhmLab() {
  const [voltage, setVoltage] = useState(12);
  const [resistance, setResistance] = useState(4);
  const current = voltage / Math.max(resistance, 0.1);
  const power = voltage * current;

  return (
    <div className="sim">
      <div className="sim__controls">
        <Slider label="ძაბვა V" value={voltage} min={1} max={48} onChange={setVoltage} unit="ვ" />
        <Slider label="წინაღობა R" value={resistance} min={1} max={100} onChange={setResistance} unit="Ω" />
      </div>
      <div className="sim__stage" style={{ padding: 'var(--space-5)' }}>
        <div
          aria-hidden="true"
          style={{
            height: 10,
            borderRadius: 999,
            background: 'var(--line)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, (current / 12) * 100)}%`,
              background: 'var(--accent)',
              transition: 'width 200ms var(--ease-out)',
            }}
          />
        </div>
        <p className="xsmall muted mt-4">ზოლი დენის ძალას ასახავს</p>
      </div>
      <Readout
        items={[
          { label: 'დენი I = V/R', value: `${current.toFixed(2)} ა` },
          { label: 'სიმძლავრე P = VI', value: `${power.toFixed(1)} ვტ` },
          { label: 'წინაღობა', value: `${resistance} Ω` },
        ]}
      />
      <p className="xsmall muted">
        გაანახევრე წინაღობა და დააკვირდი დენს: ის ორმაგდება. სიმძლავრე კი ოთხჯერ იზრდება, რადგან
        P = V²/R.
      </p>
    </div>
  );
}

/** Two-wave interference — constructive and destructive in one picture. */
export function WaveSim() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [freq, setFreq] = useState(2);
  const [amp, setAmp] = useState(40);
  const [phase, setPhase] = useState(0);
  const [second, setSecond] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, W, 280);
    if (!ctx) return;
    const c = themeColors();
    const mid = 140;

    ctx.strokeStyle = c.line;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();

    const wave = (f: number, a: number, ph: number) => (x: number) =>
      mid - a * Math.sin(((x / W) * Math.PI * 2 * f) + ph);

    const w1 = wave(freq, amp, 0);
    const w2 = wave(freq, amp, (phase * Math.PI) / 180);

    const draw = (fn: (x: number) => number, color: string, width: number, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const y = fn(x);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    draw(w1, c.ink3, 1.4, [4, 4]);
    if (second) {
      draw(w2, c.ink3, 1.4, [4, 4]);
      draw((x) => mid + (w1(x) - mid) + (w2(x) - mid), c.accent, 2.4);
    } else {
      draw(w1, c.accent, 2.4);
    }
  }, [freq, amp, phase, second]);

  const interference = phase < 30 || phase > 330 ? 'გაძლიერება' : phase > 150 && phase < 210 ? 'ჩახშობა' : 'ნაწილობრივი';

  return (
    <div className="sim">
      <div className="sim__stage">
        <canvas ref={canvasRef} role="img" aria-label="ტალღების ინტერფერენცია" />
      </div>
      <div className="sim__controls">
        <Slider label="სიხშირე" value={freq} min={1} max={8} onChange={setFreq} />
        <Slider label="ამპლიტუდა" value={amp} min={10} max={60} onChange={setAmp} />
        <Slider label="ფაზის სხვაობა" value={phase} min={0} max={360} step={5} onChange={setPhase} unit="°" />
        <div className="slider">
          <div className="slider__head">
            <label htmlFor="second-wave">მეორე ტალღა</label>
          </div>
          <button id="second-wave" className="chip chip--toggle" aria-pressed={second} onClick={() => setSecond((s) => !s)}>
            {second ? 'ჩართულია' : 'გამორთულია'}
          </button>
        </div>
      </div>
      {second ? (
        <Readout
          items={[
            { label: 'შედეგი', value: interference },
            { label: 'ფაზა', value: `${phase}°` },
          ]}
        />
      ) : null}
      <p className="xsmall muted">
        დააყენე ფაზის სხვაობა 180°-ზე: ორი ტალღა ერთმანეთს თითქმის მთლიანად აქრობს. ხმის აქტიური
        ჩახშობა ზუსტად ამ პრინციპზე მუშაობს.
      </p>
    </div>
  );
}
