import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareCanvas, Readout, Slider, themeColors } from './controls';

const W = 640;

/** Quadratic explorer: the discriminant becomes visible, not just computed. */
export function QuadraticExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [a, setA] = useState(1);
  const [b, setB] = useState(-2);
  const [c, setC] = useState(-3);

  const analysis = useMemo(() => {
    const d = b * b - 4 * a * c;
    const roots =
      a === 0
        ? []
        : d > 0
          ? [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)]
          : d === 0
            ? [-b / (2 * a)]
            : [];
    const vertexX = a === 0 ? 0 : -b / (2 * a);
    const vertexY = a * vertexX * vertexX + b * vertexX + c;
    return { d, roots, vertexX, vertexY };
  }, [a, b, c]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const H = 340;
    const ctx = prepareCanvas(canvas, W, H);
    if (!ctx) return;
    const col = themeColors();

    const scaleX = 30;
    const scaleY = 18;
    const ox = W / 2;
    const oy = H / 2 + 40;
    const px = (x: number) => ox + x * scaleX;
    const py = (y: number) => oy - y * scaleY;

    // grid
    ctx.strokeStyle = col.line;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let x = -10; x <= 10; x++) {
      ctx.beginPath();
      ctx.moveTo(px(x), 0);
      ctx.lineTo(px(x), H);
      ctx.stroke();
    }
    for (let y = -16; y <= 16; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, py(y));
      ctx.lineTo(W, py(y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // axes
    ctx.strokeStyle = col.ink3;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, py(0));
    ctx.lineTo(W, py(0));
    ctx.moveTo(px(0), 0);
    ctx.lineTo(px(0), H);
    ctx.stroke();

    // parabola
    ctx.strokeStyle = col.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let started = false;
    for (let sx = 0; sx <= W; sx += 2) {
      const x = (sx - ox) / scaleX;
      const y = a * x * x + b * x + c;
      const sy = py(y);
      if (sy < -400 || sy > H + 400) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // roots
    ctx.fillStyle = col.accent;
    for (const root of analysis.roots) {
      ctx.beginPath();
      ctx.arc(px(root), py(0), 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // vertex
    ctx.strokeStyle = col.ink3;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(px(analysis.vertexX), py(analysis.vertexY), 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [a, b, c, analysis]);

  const rootsLabel =
    analysis.d > 0
      ? analysis.roots.map((r) => r.toFixed(2)).join(', ')
      : analysis.d === 0
        ? `${analysis.roots[0]?.toFixed(2)} (ორჯერადი)`
        : 'ნამდვილი ფესვები არ არსებობს';

  return (
    <div className="sim">
      <div className="sim__stage">
        <canvas ref={canvasRef} role="img" aria-label={`პარაბოლა y = ${a}x² + ${b}x + ${c}`} />
      </div>
      <div className="sim__controls">
        <Slider label="a" value={a} min={-4} max={4} step={0.25} onChange={setA} format={(v) => v.toFixed(2)} />
        <Slider label="b" value={b} min={-10} max={10} step={0.5} onChange={setB} format={(v) => v.toFixed(1)} />
        <Slider label="c" value={c} min={-10} max={10} step={0.5} onChange={setC} format={(v) => v.toFixed(1)} />
      </div>
      <Readout
        items={[
          { label: 'განტოლება', value: `${a}x² ${b >= 0 ? '+' : '−'} ${Math.abs(b)}x ${c >= 0 ? '+' : '−'} ${Math.abs(c)}` },
          { label: 'დისკრიმინანტი', value: analysis.d.toFixed(2) },
          { label: 'ფესვები', value: rootsLabel },
        ]}
      />
      <p className="xsmall muted">
        დააკვირდი: სანამ დისკრიმინანტი დადებითია, პარაბოლა ღერძს ორ წერტილში კვეთს. გადაიყვანე ის
        უარყოფითში და კვეთა ქრება — ზუსტად ამას ნიშნავს „ნამდვილი ფესვები არ არსებობს".
      </p>
    </div>
  );
}

/** Monty Hall: play it, then look at the aggregate. Intuition loses to data. */
export function MontyHall() {
  const [stats, setStats] = useState({ switchWins: 0, switchPlays: 0, stayWins: 0, stayPlays: 0 });
  const [phase, setPhase] = useState<'pick' | 'decide' | 'result'>('pick');
  const [prize, setPrize] = useState(0);
  const [picked, setPicked] = useState(0);
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<{ won: boolean; switched: boolean } | null>(null);

  const start = () => {
    setPrize(Math.floor(Math.random() * 3));
    setPhase('pick');
    setOutcome(null);
  };

  const pick = (door: number) => {
    setPicked(door);
    const options = [0, 1, 2].filter((d) => d !== door && d !== prize);
    const reveal = options[Math.floor(Math.random() * options.length)] ?? 0;
    setOpened(reveal);
    setPhase('decide');
  };

  const decide = (shouldSwitch: boolean) => {
    const finalDoor = shouldSwitch ? [0, 1, 2].find((d) => d !== picked && d !== opened) ?? picked : picked;
    const won = finalDoor === prize;
    setOutcome({ won, switched: shouldSwitch });
    setStats((s) => ({
      switchWins: s.switchWins + (shouldSwitch && won ? 1 : 0),
      switchPlays: s.switchPlays + (shouldSwitch ? 1 : 0),
      stayWins: s.stayWins + (!shouldSwitch && won ? 1 : 0),
      stayPlays: s.stayPlays + (!shouldSwitch ? 1 : 0),
    }));
    setPhase('result');
  };

  const rate = (wins: number, plays: number) => (plays === 0 ? '—' : `${Math.round((wins / plays) * 100)}%`);

  return (
    <div className="sim">
      <div className="row" style={{ justifyContent: 'center', gap: 'var(--space-4)' }}>
        {[0, 1, 2].map((door) => {
          const isOpen = phase !== 'pick' && door === opened;
          const isPicked = door === picked && phase !== 'pick';
          const showPrize = phase === 'result';
          return (
            <button
              key={door}
              className="card"
              style={{
                width: 96,
                height: 128,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isOpen ? 0.45 : 1,
                borderColor: isPicked ? 'var(--accent)' : undefined,
              }}
              disabled={phase !== 'pick'}
              onClick={() => pick(door)}
              aria-label={`კარი ${door + 1}`}
            >
              <span style={{ fontSize: '1.6rem' }} aria-hidden="true">
                {isOpen ? '🐐' : showPrize ? (door === prize ? '🎁' : '🐐') : '🚪'}
              </span>
              <span className="xsmall muted">კარი {door + 1}</span>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        {phase === 'pick' ? <p className="small muted">აირჩიე კარი</p> : null}
        {phase === 'decide' ? (
          <>
            <p className="small" style={{ width: '100%', textAlign: 'center' }}>
              წამყვანმა გახსნა კარი {opened + 1} და იქ თხაა. რას აკეთებ?
            </p>
            <button className="btn btn--ghost" onClick={() => decide(false)}>
              ვრჩები
            </button>
            <button className="btn btn--primary" onClick={() => decide(true)}>
              ვცვლი კარს
            </button>
          </>
        ) : null}
        {phase === 'result' && outcome ? (
          <>
            <p className="small">
              {outcome.won ? '🎁 მოიგე!' : '🐐 ამჯერად არა.'} ({outcome.switched ? 'შეცვალე' : 'დარჩი'})
            </p>
            <button className="btn btn--primary" onClick={start}>
              კიდევ
            </button>
          </>
        ) : null}
      </div>

      <Readout
        items={[
          { label: 'შეცვლისას მოგება', value: `${rate(stats.switchWins, stats.switchPlays)} (${stats.switchPlays})` },
          { label: 'დარჩენისას მოგება', value: `${rate(stats.stayWins, stats.stayPlays)} (${stats.stayPlays})` },
        ]}
      />
      <p className="xsmall muted">
        ითამაშე მინიმუმ 20-ჯერ ორივე სტრატეგიით. თეორიული პასუხია 2/3 შეცვლისას და 1/3 დარჩენისას —
        მცირე რაოდენობის თამაშებზე შემთხვევითობა ამას ჯერ კიდევ მალავს.
      </p>
    </div>
  );
}

/** The truncated-axis trick, made interactive. */
export function StatsInspect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zeroBased, setZeroBased] = useState(false);

  // Real series: NOAA Mauna Loa annual mean CO2 (ppm), selected years.
  const data = [
    { year: 1960, value: 316.9 },
    { year: 1970, value: 325.7 },
    { year: 1980, value: 338.8 },
    { year: 1990, value: 354.4 },
    { year: 2000, value: 369.6 },
    { year: 2010, value: 389.9 },
    { year: 2020, value: 414.2 },
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const H = 300;
    const ctx = prepareCanvas(canvas, W, H);
    if (!ctx) return;
    const col = themeColors();

    const values = data.map((d) => d.value);
    const min = zeroBased ? 0 : Math.min(...values) - 4;
    const max = Math.max(...values) + 4;
    const py = (v: number) => H - 40 - ((v - min) / (max - min)) * (H - 70);
    const barW = (W - 80) / data.length;

    ctx.strokeStyle = col.line;
    ctx.beginPath();
    ctx.moveTo(50, H - 40);
    ctx.lineTo(W - 16, H - 40);
    ctx.stroke();

    ctx.fillStyle = col.ink3;
    ctx.font = '11px ui-monospace, monospace';
    [min, (min + max) / 2, max].forEach((v) => ctx.fillText(v.toFixed(0), 10, py(v) + 4));

    data.forEach((d, i) => {
      const x = 56 + i * barW;
      const y = py(d.value);
      ctx.fillStyle = col.accent;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, barW - 12, H - 40 - y);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col.ink3;
      ctx.fillText(String(d.year), x - 2, H - 24);
    });
  }, [zeroBased, data]);

  return (
    <div className="sim">
      <div className="sim__stage">
        <canvas ref={canvasRef} role="img" aria-label="CO₂ კონცენტრაცია წლების მიხედვით" />
      </div>
      <div className="row">
        <button className="chip chip--toggle" aria-pressed={zeroBased} onClick={() => setZeroBased((z) => !z)}>
          y ღერძი ნულიდან
        </button>
        <span className="xsmall muted">ერთი და იგივე მონაცემები, ორი განსხვავებული შთაბეჭდილება</span>
      </div>
      <Readout
        items={[
          { label: 'ზრდა 1960→2020', value: '+97.3 ppm' },
          { label: 'ფარდობითი ზრდა', value: '+31%' },
        ]}
      />
      <p className="xsmall muted">
        მონაცემები: NOAA Global Monitoring Laboratory, Mauna Loa-ს წლიური საშუალო. ორივე გრაფიკი
        სიმართლეს ამბობს — მაგრამ ჩამოჭრილი ღერძი ცვლილებას გაცილებით დრამატულად აჩვენებს.
      </p>
    </div>
  );
}
