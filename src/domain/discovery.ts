import {
  library,
  type Fact,
  type Formula,
  type HistoricalEvent,
  type Person,
  type Topic,
  type Activity,
} from '@/content';
import { hashSeed, makeRng, seededPick } from './random';
import type { InterestProfile } from './personalization';

/**
 * „გამაოცე" — discovery mode.
 *
 * Not a shuffle. Two rules shape it:
 *  1. Weighted toward subjects the user actually explores, so results feel
 *     relevant rather than arbitrary.
 *  2. A guaranteed minority of results comes from *outside* those subjects —
 *     the surprise is the point, and a bubble would defeat it.
 * It also avoids repeating anything from the recent history it is given.
 */

export type DiscoveryKind = 'topic' | 'fact' | 'formula' | 'event' | 'person' | 'activity';

export type DiscoveryResult =
  | { kind: 'topic'; item: Topic; reason: DiscoveryReason }
  | { kind: 'fact'; item: Fact; reason: DiscoveryReason }
  | { kind: 'formula'; item: Formula; reason: DiscoveryReason }
  | { kind: 'event'; item: HistoricalEvent; reason: DiscoveryReason }
  | { kind: 'person'; item: Person; reason: DiscoveryReason }
  | { kind: 'activity'; item: Activity; reason: DiscoveryReason };

/** Why this was surfaced — shown to the user, so discovery never feels random. */
export type DiscoveryReason = 'favourite' | 'newTerritory' | 'connected' | 'classic';

export interface DiscoveryOptions {
  profile?: InterestProfile;
  /** Ids seen recently; excluded so repeated presses keep giving new things. */
  recentIds?: readonly string[];
  /** Seed for deterministic tests; omit in production for real variety. */
  seed?: string;
  /** Probability that the pick comes from outside the user's subjects. */
  explorationChance?: number;
}

const KIND_WEIGHTS: [DiscoveryKind, number][] = [
  ['topic', 0.3],
  ['fact', 0.22],
  ['activity', 0.16],
  ['formula', 0.12],
  ['person', 0.1],
  ['event', 0.1],
];

function pickKind(rng: () => number): DiscoveryKind {
  const roll = rng();
  let cumulative = 0;
  for (const [kind, weight] of KIND_WEIGHTS) {
    cumulative += weight;
    if (roll <= cumulative) return kind;
  }
  return 'topic';
}

export function discover(options: DiscoveryOptions = {}): DiscoveryResult | undefined {
  const { profile, recentIds = [], seed, explorationChance = 0.35 } = options;
  const rng = makeRng(seed ? hashSeed(seed) : Math.floor(Math.random() * 2 ** 32));
  const recent = new Set(recentIds);

  const favourites = profile?.topSubjects ?? [];
  const hasProfile = favourites.length > 0;
  const exploring = !hasProfile || rng() < explorationChance;

  const subjectFilter = (subjectId: string): boolean => {
    if (!hasProfile) return true;
    return exploring ? !favourites.includes(subjectId) : favourites.includes(subjectId);
  };

  const reason: DiscoveryReason = !hasProfile ? 'classic' : exploring ? 'newTerritory' : 'favourite';

  // Try the preferred kind, then fall back through the rest so a press always
  // returns something even when filters are tight.
  const order: DiscoveryKind[] = [pickKind(rng), 'topic', 'fact', 'activity', 'formula', 'person', 'event'];

  for (const kind of order) {
    const result = pickOfKind(kind, subjectFilter, recent, rng, reason);
    if (result) return result;
  }
  // Last resort: ignore the subject filter entirely.
  for (const kind of order) {
    const result = pickOfKind(kind, () => true, recent, rng, 'classic');
    if (result) return result;
  }
  return undefined;
}

function pickOfKind(
  kind: DiscoveryKind,
  subjectFilter: (subjectId: string) => boolean,
  recent: ReadonlySet<string>,
  rng: () => number,
  reason: DiscoveryReason,
): DiscoveryResult | undefined {
  const usable = <T extends { id: string; subjectId: string }>(items: readonly T[]) =>
    items.filter((item) => !recent.has(item.id) && subjectFilter(item.subjectId));

  switch (kind) {
    case 'topic': {
      const item = seededPick(usable(library.topics), rng);
      return item ? { kind: 'topic', item, reason } : undefined;
    }
    case 'fact': {
      const item = seededPick(usable(library.facts), rng);
      return item ? { kind: 'fact', item, reason } : undefined;
    }
    case 'formula': {
      const item = seededPick(usable(library.formulas), rng);
      return item ? { kind: 'formula', item, reason } : undefined;
    }
    case 'person': {
      const item = seededPick(usable(library.people), rng);
      return item ? { kind: 'person', item, reason } : undefined;
    }
    case 'event': {
      const item = seededPick(usable(library.events), rng);
      return item ? { kind: 'event', item, reason } : undefined;
    }
    case 'activity': {
      const item = seededPick(usable(library.activities), rng);
      return item ? { kind: 'activity', item, reason } : undefined;
    }
  }
}

export function discoveryHref(result: DiscoveryResult): string {
  switch (result.kind) {
    case 'topic':
      return `/topics/${result.item.id}`;
    case 'fact':
      return `/facts?open=${result.item.id}`;
    case 'formula':
      return `/formulas?open=${result.item.id}`;
    case 'person':
      return `/people/${result.item.id}`;
    case 'event':
      return `/timeline?open=${result.item.id}`;
    case 'activity':
      return result.item.topicId
        ? `/topics/${result.item.topicId}#activity-${result.item.id}`
        : `/labs/${result.item.subjectId}`;
  }
}

export const DISCOVERY_REASON_LABELS: Record<DiscoveryReason, string> = {
  favourite: 'შენი ინტერესებიდან',
  newTerritory: 'სრულიად ახალი მიმართულება',
  connected: 'დაკავშირებულია იმასთან, რასაც ათვალიერებდი',
  classic: 'ლაბორატორიის კლასიკა',
};
