import { library } from '@/content';

/**
 * Interest modelling.
 *
 * Deliberately simple and deliberately leaky: scores decay, and consumers are
 * expected to reserve part of every surface for subjects the user has *not*
 * shown interest in. A recommendation system that only reflects you back is a
 * failure mode for a learning product, not a feature.
 */

export interface InteractionEvent {
  subjectId?: string;
  topicId?: string;
  /** Heavier signals mean more deliberate engagement. */
  type: 'view' | 'activity' | 'bookmark' | 'note' | 'search';
  at: number;
}

const WEIGHTS: Record<InteractionEvent['type'], number> = {
  view: 1,
  search: 1.5,
  activity: 3,
  bookmark: 4,
  note: 5,
};

/** Half-life in days: a subject you stopped exploring fades over ~3 weeks. */
const HALF_LIFE_DAYS = 21;

export interface InterestProfile {
  /** subjectId → normalised score in [0, 1]. */
  subjects: Map<string, number>;
  topSubjects: string[];
  /** Subjects with essentially no signal — the exploration pool. */
  unexplored: string[];
  totalSignal: number;
}

export function buildInterestProfile(
  events: readonly InteractionEvent[],
  now: number = Date.now(),
): InterestProfile {
  const raw = new Map<string, number>();
  const msPerDay = 86_400_000;

  for (const event of events) {
    if (!event.subjectId) continue;
    const ageDays = Math.max(0, (now - event.at) / msPerDay);
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const weight = WEIGHTS[event.type] * decay;
    raw.set(event.subjectId, (raw.get(event.subjectId) ?? 0) + weight);
  }

  const total = [...raw.values()].reduce((sum, v) => sum + v, 0);
  const max = Math.max(1, ...raw.values());
  const subjects = new Map<string, number>();
  for (const [id, value] of raw) subjects.set(id, value / max);

  const topSubjects = [...subjects.entries()]
    .filter(([, score]) => score > 0.15)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const unexplored = library.subjects
    .filter((subject) => (subjects.get(subject.id) ?? 0) < 0.05)
    .map((subject) => subject.id);

  return { subjects, topSubjects, unexplored, totalSignal: total };
}

/**
 * Blend familiar and unfamiliar subjects.
 * `explorationRatio` is the share of slots reserved for the unexplored pool —
 * it never drops to zero, however strong the profile is.
 */
export function mixWithExploration(
  profile: InterestProfile,
  count: number,
  explorationRatio = 0.3,
): string[] {
  const exploreSlots = Math.max(1, Math.round(count * explorationRatio));
  const familiarSlots = Math.max(0, count - exploreSlots);
  const familiar = profile.topSubjects.slice(0, familiarSlots);
  const pool = profile.unexplored.length > 0 ? profile.unexplored : library.subjects.map((s) => s.id);
  const explore: string[] = [];
  for (const id of pool) {
    if (explore.length >= exploreSlots) break;
    if (!familiar.includes(id)) explore.push(id);
  }
  return [...familiar, ...explore];
}

/** Whether the home screen should still look "fresh out of the box". */
export function isProfileCold(profile: InterestProfile): boolean {
  return profile.totalSignal < 5;
}
