import type { ReactElement } from 'react';
import { Simulation } from './Simulation';

/**
 * Named figures embedded in topic prose. Some are interactive simulations,
 * others are static explanatory diagrams drawn as inline SVG so they scale,
 * theme correctly and need no assets.
 */
export function Figure({ name, caption }: { name: string; caption?: string }) {
  const diagram = DIAGRAMS[name];
  const content = diagram ? diagram() : <Simulation name={name} />;

  return (
    <figure style={{ margin: 'var(--space-5) 0' }}>
      {content}
      {caption ? (
        <figcaption className="xsmall muted" style={{ marginTop: 'var(--space-2)' }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

const DIAGRAMS: Record<string, () => ReactElement> = {
  blackHoleScale: () => <BlackHoleScale />,
  starLifecycle: () => <StarLifecycle />,
  solarSystemScale: () => <SolarSystemScale />,
  causeChain: () => <CauseChain />,
};

/** Mass → Schwarzschild radius, on a log scale, with familiar anchors. */
function BlackHoleScale() {
  const rows = [
    { label: 'დედამიწა', mass: '6 × 10²⁴ კგ', radius: '9 მმ', width: 4 },
    { label: 'მზე', mass: '2 × 10³⁰ კგ', radius: '3 კმ', width: 18 },
    { label: 'Cygnus X-1', mass: '≈ 21 მზის მასა', radius: '≈ 62 კმ', width: 34 },
    { label: 'Sagittarius A*', mass: '≈ 4 მლნ მზის მასა', radius: '≈ 12 მლნ კმ', width: 68 },
    { label: 'M87*', mass: '≈ 6.5 მლრდ მზის მასა', radius: '≈ 19 მლრდ კმ', width: 100 },
  ];
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="small" style={{ fontWeight: 600 }}>
          მასა და მოვლენათა ჰორიზონტის რადიუსი
        </span>
      </div>
      <div className="panel__body stack">
        {rows.map((row) => (
          <div key={row.label} className="stack" style={{ gap: 4 }}>
            <div className="row row--between">
              <span className="small">{row.label}</span>
              <span className="xsmall muted mono">
                {row.mass} → {row.radius}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'var(--line)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${row.width}%`,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, var(--accent), hsl(var(--accent-h) 70% 45%))',
                }}
              />
            </div>
          </div>
        ))}
        <p className="xsmall muted">
          რადიუსი მასის პირდაპირპროპორციულია: მასის გაორმაგება ჰორიზონტსაც აორმაგებს. ზოლები
          ლოგარითმულ სკალაზეა — რეალური სხვაობა გაცილებით დიდია.
        </p>
      </div>
    </div>
  );
}

function StarLifecycle() {
  const paths = [
    { mass: '< 0.5 მზის მასა', steps: ['წითელი ჯუჯა', 'ნელი გაცივება', '(ჯერ არცერთს არ დაუსრულებია)'], hue: 8 },
    { mass: '≈ 1 მზის მასა', steps: ['მთავარი მიმდევრობა', 'წითელი გიგანტი', 'პლანეტარული ნისლეული', 'თეთრი ჯუჯა'], hue: 42 },
    { mass: '> 8 მზის მასა', steps: ['მთავარი მიმდევრობა', 'ზეგიგანტი', 'ზეახალი', 'ნეიტრონული ვარსკვლავი ან შავი ხვრელი'], hue: 220 },
  ];
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="small" style={{ fontWeight: 600 }}>
          ვარსკვლავის გზა მასის მიხედვით
        </span>
      </div>
      <div className="panel__body stack">
        {paths.map((path) => (
          <div key={path.mass} className="stack" style={{ gap: 6 }}>
            <span className="xsmall muted">{path.mass}</span>
            <div className="row" style={{ gap: 6 }}>
              {path.steps.map((step, i) => (
                <span key={step} className="row" style={{ gap: 6 }}>
                  <span
                    className="chip"
                    style={{
                      borderColor: `hsl(${path.hue} 60% 55% / 0.4)`,
                      background: `hsl(${path.hue} 60% 55% / 0.12)`,
                    }}
                  >
                    {step}
                  </span>
                  {i < path.steps.length - 1 ? (
                    <span aria-hidden="true" className="muted">
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="xsmall muted">
          ერთადერთი პარამეტრი, რომელიც ამ გზას განსაზღვრავს, მასაა. წითელი ჯუჯები იმდენად დიდხანს
          ცოცხლობენ, რომ სამყაროს ასაკში ჯერ არცერთს არ დაუსრულებია ცხოვრება.
        </p>
      </div>
    </div>
  );
}

function SolarSystemScale() {
  const planets = [
    { name: 'მერკური', au: 0.39, size: 4, hue: 30 },
    { name: 'ვენერა', au: 0.72, size: 7, hue: 45 },
    { name: 'დედამიწა', au: 1, size: 7.5, hue: 205 },
    { name: 'მარსი', au: 1.52, size: 5, hue: 14 },
    { name: 'იუპიტერი', au: 5.2, size: 20, hue: 32 },
    { name: 'სატურნი', au: 9.54, size: 17, hue: 48 },
    { name: 'ურანი', au: 19.2, size: 11, hue: 185 },
    { name: 'ნეპტუნი', au: 30.06, size: 11, hue: 225 },
  ];
  const maxAu = 30.06;
  return (
    <div className="panel">
      <div className="panel__head">
        <span className="small" style={{ fontWeight: 600 }}>
          მანძილები მზიდან (ასტრონომიულ ერთეულებში)
        </span>
      </div>
      <div className="panel__body">
        <div style={{ position: 'relative', height: 130 }}>
          <div
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              top: 52,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffd68a, #f59a1e)',
              boxShadow: '0 0 18px 4px rgba(245,154,30,0.45)',
            }}
            aria-hidden="true"
          />
          <div
            style={{
              position: 'absolute',
              insetInline: 20,
              top: 58,
              height: 1,
              background: 'var(--line)',
            }}
            aria-hidden="true"
          />
          {planets.map((planet, i) => (
            <div
              key={planet.name}
              style={{
                position: 'absolute',
                insetInlineStart: `calc(22px + ${(planet.au / maxAu) * 92}%)`,
                top: 58 - planet.size / 2,
              }}
            >
              <div
                title={`${planet.name} — ${planet.au} ა.ე.`}
                style={{
                  width: planet.size,
                  height: planet.size,
                  borderRadius: '50%',
                  background: `hsl(${planet.hue} 60% 58%)`,
                }}
              />
              <span
                className="xsmall muted"
                style={{
                  position: 'absolute',
                  top: i % 2 === 0 ? 22 : -22,
                  insetInlineStart: -10,
                  whiteSpace: 'nowrap',
                  fontSize: '0.6rem',
                }}
              >
                {planet.name}
              </span>
            </div>
          ))}
        </div>
        <p className="xsmall muted">
          მანძილები რეალურ მასშტაბშია, პლანეტების ზომები კი — არა. თუ დედამიწა აქ ნაჩვენები ზომისა
          იქნებოდა, მზე დაახლოებით 80 სანტიმეტრის დიამეტრის სფერო იქნებოდა.
        </p>
      </div>
    </div>
  );
}

function CauseChain() {
  const links = [
    { label: 'მიზეზი', text: 'ხელით გადაწერა ნელი და ძვირია' },
    { label: 'მოვლენა', text: 'ინერგება ასოთამწყობი ბეჭდვა' },
    { label: 'შედეგი', text: 'წიგნი იაფდება, წიგნიერება იზრდება' },
    { label: 'შედეგი', text: 'იდეები სწრაფად ვრცელდება — რეფორმაცია, სამეცნიერო რევოლუცია' },
  ];
  return (
    <div className="chain">
      {links.map((link, i) => (
        <div key={i} className="chain__row">
          <span className="chain__label">{link.label}</span>
          <span className="chain__text">{link.text}</span>
        </div>
      ))}
    </div>
  );
}
