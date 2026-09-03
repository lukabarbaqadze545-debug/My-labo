import { lazy, Suspense, type ComponentType } from 'react';
import { Skeleton } from '../components/primitives';

/**
 * Simulation registry.
 *
 * Sims are keyed by the string used in content data, so an author can add
 * `{ kind: 'sim', sim: 'waveSim' }` without touching component code. Unknown
 * names render an honest placeholder rather than crashing the topic page.
 */

const LOADERS: Record<string, () => Promise<{ default: ComponentType }>> = {
  projectileSim: () => import('./PhysicsSims').then((m) => ({ default: m.ProjectileSim })),
  timeDilation: () => import('./PhysicsSims').then((m) => ({ default: m.TimeDilationSim })),
  ohmLab: () => import('./PhysicsSims').then((m) => ({ default: m.OhmLab })),
  waveSim: () => import('./PhysicsSims').then((m) => ({ default: m.WaveSim })),
  quadraticExplorer: () => import('./MathSims').then((m) => ({ default: m.QuadraticExplorer })),
  montyHall: () => import('./MathSims').then((m) => ({ default: m.MontyHall })),
  statsInspect: () => import('./MathSims').then((m) => ({ default: m.StatsInspect })),
  periodicTable: () => import('./ScienceSims').then((m) => ({ default: m.PeriodicTable })),
  codonLab: () => import('./ScienceSims').then((m) => ({ default: m.CodonLab })),
  sortVisualizer: () => import('./ScienceSims').then((m) => ({ default: m.SortVisualizer })),
  quakeInspect: () => import('./ScienceSims').then((m) => ({ default: m.QuakeInspect })),
};

const cache = new Map<string, ComponentType>();

export function Simulation({ name }: { name: string }) {
  const loader = LOADERS[name];
  if (!loader) {
    return (
      <p className="notice">
        <span className="notice__glyph" aria-hidden="true">
          ⚗
        </span>
        <span>ეს ინტერაქტიული მოდული ჯერ არ არის დამატებული.</span>
      </p>
    );
  }

  let Component = cache.get(name);
  if (!Component) {
    Component = lazy(loader);
    cache.set(name, Component);
  }

  return (
    <Suspense fallback={<Skeleton height={260} />}>
      <Component />
    </Suspense>
  );
}
