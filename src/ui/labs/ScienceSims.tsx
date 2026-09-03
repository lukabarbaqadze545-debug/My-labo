import { useEffect, useMemo, useRef, useState } from 'react';
import { ELEMENT_CATEGORY_LABELS, ELEMENT_NOTES, ELEMENTS, type ChemElement } from '@/content/elements';
import { fetchRecentQuakes, cachedFetch, describeAge, type QuakeEvent } from '@/sources';
import { prepareCanvas, Readout, Slider, themeColors } from './controls';
import { EmptyState, Skeleton } from '../components/primitives';

/* ============================ Periodic table ============================ */

export function PeriodicTable() {
  const [selected, setSelected] = useState<ChemElement | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  return (
    <div className="sim">
      <div className="ptable-wrap">
        <div className="ptable" role="grid" aria-label="პერიოდული სისტემა">
          {ELEMENTS.map((element) => {
            const dim = filter !== null && element.category !== filter;
            return (
              <button
                key={element.z}
                className={`pcell${selected?.z === element.z ? ' pcell--selected' : ''}`}
                style={{
                  gridColumn: element.col,
                  gridRow: element.row,
                  ['--cat-h' as string]: String(ELEMENT_CATEGORY_LABELS[element.category].hue),
                  opacity: dim ? 0.22 : 1,
                }}
                onClick={() => setSelected(element)}
                aria-label={`${element.ka} (${element.symbol}), ატომური ნომერი ${element.z}`}
              >
                <span className="pcell__num">{element.z}</span>
                <span className="pcell__sym">{element.symbol}</span>
                <span className="pcell__mass">{element.mass}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ptable-legend">
        {Object.entries(ELEMENT_CATEGORY_LABELS).map(([key, meta]) => (
          <button
            key={key}
            className="ptable-legend__item"
            onClick={() => setFilter((f) => (f === key ? null : key))}
            style={{ opacity: filter && filter !== key ? 0.45 : 1 }}
            aria-pressed={filter === key}
          >
            <span className="ptable-legend__swatch" style={{ ['--cat-h' as string]: String(meta.hue) }} />
            {meta.ka}
          </button>
        ))}
      </div>

      {selected ? (
        <div
          className="panel rise"
          key={selected.z}
          style={{ ['--accent-h' as string]: String(ELEMENT_CATEGORY_LABELS[selected.category].hue) }}
        >
          <div className="panel__head">
            <span className="mono" style={{ fontSize: '1.6rem', color: 'var(--accent-ink)' }}>
              {selected.symbol}
            </span>
            <div>
              <p style={{ fontWeight: 600 }}>{selected.ka}</p>
              <p className="xsmall muted">{selected.en}</p>
            </div>
            <button
              className="btn btn--quiet"
              style={{ marginInlineStart: 'auto' }}
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          <div className="panel__body stack">
            <Readout
              items={[
                { label: 'ატომური ნომერი', value: selected.z },
                { label: 'ატომური მასა', value: selected.mass },
                { label: 'ჯგუფი', value: selected.row > 8 ? '—' : selected.col },
                { label: 'პერიოდი', value: selected.row > 8 ? (selected.row === 9 ? 6 : 7) : selected.row },
              ]}
            />
            <p className="small">
              <strong>{ELEMENT_CATEGORY_LABELS[selected.category].ka}</strong>
            </p>
            {ELEMENT_NOTES[selected.symbol] ? (
              <p className="small" style={{ color: 'var(--ink-2)' }}>
                {ELEMENT_NOTES[selected.symbol]}
              </p>
            ) : null}
            <p className="xsmall muted">
              ატომური მასები: IUPAC-ის სტანდარტული ატომური წონები. კვადრატულ ფრჩხილებში მოცემულია
              ყველაზე მდგრადი ცნობილი იზოტოპის მასური რიცხვი.
            </p>
          </div>
        </div>
      ) : (
        <p className="xsmall muted">
          დააჭირე ნებისმიერ ელემენტს. ლეგენდაზე დაჭერით მხოლოდ ერთი ჯგუფი გამოიყოფა — სცადე
          „კეთილშობილი აირები" და დააკვირდი, რომ ისინი ერთ სვეტშია.
        </p>
      )}
    </div>
  );
}

/* ============================== Codon lab ============================== */

const CODON_TABLE: Record<string, string> = {
  UUU: 'Phe', UUC: 'Phe', UUA: 'Leu', UUG: 'Leu',
  CUU: 'Leu', CUC: 'Leu', CUA: 'Leu', CUG: 'Leu',
  AUU: 'Ile', AUC: 'Ile', AUA: 'Ile', AUG: 'Met',
  GUU: 'Val', GUC: 'Val', GUA: 'Val', GUG: 'Val',
  UCU: 'Ser', UCC: 'Ser', UCA: 'Ser', UCG: 'Ser',
  CCU: 'Pro', CCC: 'Pro', CCA: 'Pro', CCG: 'Pro',
  ACU: 'Thr', ACC: 'Thr', ACA: 'Thr', ACG: 'Thr',
  GCU: 'Ala', GCC: 'Ala', GCA: 'Ala', GCG: 'Ala',
  UAU: 'Tyr', UAC: 'Tyr', UAA: 'STOP', UAG: 'STOP',
  CAU: 'His', CAC: 'His', CAA: 'Gln', CAG: 'Gln',
  AAU: 'Asn', AAC: 'Asn', AAA: 'Lys', AAG: 'Lys',
  GAU: 'Asp', GAC: 'Asp', GAA: 'Glu', GAG: 'Glu',
  UGU: 'Cys', UGC: 'Cys', UGA: 'STOP', UGG: 'Trp',
  CGU: 'Arg', CGC: 'Arg', CGA: 'Arg', CGG: 'Arg',
  AGU: 'Ser', AGC: 'Ser', AGA: 'Arg', AGG: 'Arg',
  GGU: 'Gly', GGC: 'Gly', GGA: 'Gly', GGG: 'Gly',
};

const AMINO_KA: Record<string, string> = {
  Phe: 'ფენილალანინი', Leu: 'ლეიცინი', Ile: 'იზოლეიცინი', Met: 'მეთიონინი (დაწყება)',
  Val: 'ვალინი', Ser: 'სერინი', Pro: 'პროლინი', Thr: 'თრეონინი', Ala: 'ალანინი',
  Tyr: 'ტიროზინი', His: 'ჰისტიდინი', Gln: 'გლუტამინი', Asn: 'ასპარაგინი', Lys: 'ლიზინი',
  Asp: 'ასპარაგინის მჟავა', Glu: 'გლუტამინის მჟავა', Cys: 'ცისტეინი', Trp: 'ტრიპტოფანი',
  Arg: 'არგინინი', Gly: 'გლიცინი', STOP: 'გაჩერება',
};

export function CodonLab() {
  const [dna, setDna] = useState('ATGGCATTAGGCTAA');

  const clean = dna.toUpperCase().replace(/[^ATGC]/g, '');
  const rna = clean.replace(/T/g, 'U');
  const codons = useMemo(() => {
    const out: { codon: string; amino: string }[] = [];
    for (let i = 0; i + 3 <= rna.length; i += 3) {
      const codon = rna.slice(i, i + 3);
      out.push({ codon, amino: CODON_TABLE[codon] ?? '?' });
      if (CODON_TABLE[codon] === 'STOP') break;
    }
    return out;
  }, [rna]);

  return (
    <div className="sim">
      <div className="field">
        <label className="field__label" htmlFor="dna-input">
          დნმ-ის თანმიმდევრობა (A, T, G, C)
        </label>
        <input
          id="dna-input"
          className="input mono"
          value={dna}
          onChange={(e) => setDna(e.target.value)}
          spellCheck={false}
          maxLength={60}
        />
      </div>

      <div className="stack">
        <div>
          <p className="formula__label">დნმ</p>
          <p className="mono small" style={{ letterSpacing: '0.12em', wordBreak: 'break-all' }}>
            {clean || '—'}
          </p>
        </div>
        <div>
          <p className="formula__label">რნმ (T → U)</p>
          <p className="mono small" style={{ letterSpacing: '0.12em', color: 'var(--accent-ink)', wordBreak: 'break-all' }}>
            {rna || '—'}
          </p>
        </div>
      </div>

      {codons.length > 0 ? (
        <div className="stack">
          <p className="formula__label">ამინომჟავების ჯაჭვი</p>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            {codons.map((item, i) => (
              <span
                key={i}
                className={item.amino === 'STOP' ? 'chip chip--caution' : 'chip chip--accent'}
                title={AMINO_KA[item.amino] ?? item.amino}
              >
                <span className="mono">{item.codon}</span> → {AMINO_KA[item.amino] ?? item.amino}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="small muted">შეიყვანე მინიმუმ სამი ასო, რომ პირველი კოდონი გამოჩნდეს.</p>
      )}

      <div className="row">
        <button className="btn btn--ghost" onClick={() => setDna('ATGGCATTAGGCTAA')}>
          საწყისი მაგალითი
        </button>
        <button className="btn btn--ghost" onClick={() => setDna('ATGGCATTAGGCTAG')}>
          შეცვალე ბოლო ასო
        </button>
      </div>
      <p className="xsmall muted">
        სცადე ერთი ასოს შეცვლა და დააკვირდი, შეიცვალა თუ არა ამინომჟავა. ხშირად არ იცვლება — გენეტიკური
        კოდი „ზედმეტია" (გადაფარულია), რაც მუტაციებისგან ერთგვარი დაცვაა.
      </p>
    </div>
  );
}

/* ========================= Sorting visualiser ========================= */

type SortStep = { array: number[]; comparing: [number, number] | null };

function bubbleSteps(input: number[]): SortStep[] {
  const arr = [...input];
  const steps: SortStep[] = [{ array: [...arr], comparing: null }];
  let comparisons = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      comparisons++;
      steps.push({ array: [...arr], comparing: [j, j + 1] });
      const a = arr[j] as number;
      const b = arr[j + 1] as number;
      if (a > b) {
        arr[j] = b;
        arr[j + 1] = a;
      }
      if (comparisons > 2200) return steps;
    }
  }
  steps.push({ array: [...arr], comparing: null });
  return steps;
}

function mergeSteps(input: number[]): SortStep[] {
  const arr = [...input];
  const steps: SortStep[] = [{ array: [...arr], comparing: null }];
  const work = [...arr];

  const merge = (lo: number, mid: number, hi: number) => {
    const left = work.slice(lo, mid + 1);
    const right = work.slice(mid + 1, hi + 1);
    let i = 0;
    let j = 0;
    let k = lo;
    while (i < left.length && j < right.length) {
      steps.push({ array: [...work], comparing: [lo + i, mid + 1 + j] });
      const l = left[i] as number;
      const r = right[j] as number;
      work[k++] = l <= r ? ((i++, l)) : ((j++, r));
    }
    while (i < left.length) work[k++] = left[i++] as number;
    while (j < right.length) work[k++] = right[j++] as number;
    steps.push({ array: [...work], comparing: null });
  };

  const sort = (lo: number, hi: number) => {
    if (lo >= hi) return;
    const mid = Math.floor((lo + hi) / 2);
    sort(lo, mid);
    sort(mid + 1, hi);
    merge(lo, mid, hi);
  };

  sort(0, work.length - 1);
  return steps;
}

export function SortVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(24);
  const [algorithm, setAlgorithm] = useState<'bubble' | 'merge'>('bubble');
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [seed, setSeed] = useState(1);

  const initial = useMemo(() => {
    // Deterministic per (size, seed) so switching algorithms compares fairly.
    const out: number[] = [];
    let s = seed * 7919;
    for (let i = 0; i < size; i++) {
      s = (s * 1103515245 + 12345) % 2147483648;
      out.push(5 + (s % 95));
    }
    return out;
  }, [size, seed]);

  const steps = useMemo(
    () => (algorithm === 'bubble' ? bubbleSteps(initial) : mergeSteps(initial)),
    [algorithm, initial],
  );

  useEffect(() => setTick(0), [steps]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTick((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 24);
    return () => window.clearInterval(id);
  }, [playing, steps.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = 640;
    const h = 240;
    const ctx = prepareCanvas(canvas, w, h);
    if (!ctx) return;
    const col = themeColors();
    const step = steps[Math.min(tick, steps.length - 1)];
    if (!step) return;

    const barW = w / step.array.length;
    step.array.forEach((value, i) => {
      const isComparing = step.comparing?.includes(i);
      ctx.fillStyle = isComparing ? col.accent : col.ink3;
      ctx.globalAlpha = isComparing ? 1 : 0.55;
      const barH = (value / 100) * (h - 16);
      ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
    });
    ctx.globalAlpha = 1;
  }, [steps, tick]);

  const comparisons = steps.filter((s) => s.comparing).length;

  return (
    <div className="sim">
      <div className="sim__stage">
        <canvas ref={canvasRef} role="img" aria-label="დალაგების ვიზუალიზაცია" />
      </div>
      <div className="row">
        <button
          className="chip chip--toggle"
          aria-pressed={algorithm === 'bubble'}
          onClick={() => setAlgorithm('bubble')}
        >
          ბუშტულა — O(n²)
        </button>
        <button
          className="chip chip--toggle"
          aria-pressed={algorithm === 'merge'}
          onClick={() => setAlgorithm('merge')}
        >
          შერწყმით — O(n log n)
        </button>
        <button className="btn btn--primary" onClick={() => setPlaying((p) => !p)}>
          {playing ? '⏸ პაუზა' : '▶ გაუშვი'}
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setTick(0);
            setPlaying(false);
            setSeed((s) => s + 1);
          }}
        >
          ↻ ახალი მონაცემები
        </button>
      </div>
      <div className="sim__controls">
        <Slider label="ელემენტების რაოდენობა" value={size} min={8} max={60} onChange={setSize} />
      </div>
      <Readout
        items={[
          { label: 'შედარებები', value: comparisons },
          { label: 'ნაბიჯი', value: `${Math.min(tick, steps.length - 1)} / ${steps.length - 1}` },
          { label: 'n', value: size },
        ]}
      />
      <p className="xsmall muted">
        გაუშვი ორივე ერთი და იმავე n-ზე, შემდეგ გაზარდე ელემენტების რაოდენობა და ისევ შეადარე
        შედარებების რიცხვი. სწორედ ეს სხვაობა იმალება ჩანაწერში O(n²) და O(n log n).
      </p>
    </div>
  );
}

/* ============================ Live quakes ============================ */

export function QuakeInspect() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ok'; events: QuakeEvent[]; stale: boolean; fetchedAt: number } | { status: 'error'; reason: string }
  >({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const outcome = await cachedFetch('usgs:quakes', () => fetchRecentQuakes({ signal: controller.signal }), {
        maxAgeMs: 30 * 60 * 1000,
      });
      if (controller.signal.aborted) return;
      if (outcome.status === 'unavailable') setState({ status: 'error', reason: outcome.reason });
      else
        setState({
          status: 'ok',
          events: outcome.data.slice(0, 12),
          stale: outcome.status === 'stale',
          fetchedAt: outcome.fetchedAt,
        });
    })();
    return () => controller.abort();
  }, []);

  if (state.status === 'loading') return <Skeleton count={3} height={56} />;
  if (state.status === 'error') {
    return (
      <EmptyState
        glyph="📡"
        title="ცოცხალი მონაცემები ვერ ჩამოიტვირთა"
        hint={`${state.reason}. ეს ჩვეულებრივ ქსელს ნიშნავს — თემის დანარჩენი ნაწილი ოფლაინშიც მუშაობს.`}
      />
    );
  }

  return (
    <div className="sim">
      {state.stale ? (
        <p className="xsmall muted">ნაჩვენებია {describeAge(state.fetchedAt)} შენახული ვერსია</p>
      ) : null}
      <div className="list-stack">
        {state.events.map((quake) => (
          <a
            key={quake.id}
            className="radar-item"
            href={quake.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <div className="radar-item__head">
              <span
                className="mono"
                style={{
                  fontSize: '1.05rem',
                  color: quake.magnitude >= 5 ? 'var(--caution)' : 'var(--accent-ink)',
                }}
              >
                M {quake.magnitude.toFixed(1)}
              </span>
              <span className="radar-item__title">{quake.place}</span>
            </div>
            <div className="radar-item__meta">
              <span>სიღრმე {quake.depthKm.toFixed(0)} კმ</span>
              <span>{new Date(quake.time).toLocaleString('ka-GE')}</span>
            </div>
          </a>
        ))}
      </div>
      <p className="xsmall muted">
        წყარო: USGS Earthquake Hazards Program — ბოლო 24 საათი, მაგნიტუდა 2.5 და მეტი. მაგნიტუდის
        სკალა ლოგარითმულია: M6 დაახლოებით 32-ჯერ მეტ ენერგიას ათავისუფლებს, ვიდრე M5.
      </p>
    </div>
  );
}
