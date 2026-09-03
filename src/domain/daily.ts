import {
  library,
  type Fact,
  type Formula,
  type HistoricalEvent,
  type SeedQuestion,
  type Topic,
  type Person,
} from '@/content';
import { dateKey, hashSeed, makeRng, seededPick, seededSample } from './random';

/**
 * „დღეს ლაბორატორიაში" — the daily edition.
 *
 * Everything here is deterministic for a given date so the home screen is
 * stable within a day, and it deliberately mixes entity *kinds* rather than
 * showing seven cards of the same shape.
 */

export type DailyCardKind =
  | 'discovery'
  | 'question'
  | 'onThisDay'
  | 'space'
  | 'formula'
  | 'research'
  | 'fact'
  | 'person';

/** How well an on-this-day event matches today — never claim more than we have. */
export type DateMatch = 'exactDay' | 'sameMonth' | 'anniversary';

export interface OnThisDayResult {
  event: HistoricalEvent;
  match: DateMatch;
}

export interface DailyEdition {
  key: string;
  discovery?: Topic;
  question?: SeedQuestion;
  onThisDay?: OnThisDayResult;
  spaceTopic?: Topic;
  formula?: Formula;
  fact?: Fact;
  person?: Person;
  /** Extra topics for the "keep exploring" strip. */
  extraTopics: Topic[];
}

function dayOfYear(month: number, day: number): number {
  const cumulative = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return (cumulative[month - 1] ?? 0) + day;
}

/**
 * Georgian Wikipedia has no `onthisday` feed (verified empty), so this runs
 * entirely on the local curated dataset. When no event matches today exactly we
 * say so via `match` instead of pretending.
 */
export function findOnThisDay(date: Date, events = library.events): OnThisDayResult | undefined {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dated = events.filter((e) => e.month && e.day);

  const exact = dated.filter((e) => e.month === month && e.day === day);
  if (exact.length > 0) {
    const rng = makeRng(hashSeed(`otd-${dateKey(date)}`));
    const picked = seededPick(exact, rng);
    if (picked) return { event: picked, match: 'exactDay' };
  }

  const sameMonth = dated.filter((e) => e.month === month);
  if (sameMonth.length > 0) {
    const rng = makeRng(hashSeed(`otd-month-${date.getFullYear()}-${month}-${day}`));
    const picked = seededPick(sameMonth, rng);
    if (picked) return { event: picked, match: 'sameMonth' };
  }

  // Nearest anniversary by circular day-of-year distance.
  const today = dayOfYear(month, day);
  let best: HistoricalEvent | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const e of dated) {
    const d = dayOfYear(e.month as number, e.day as number);
    const raw = Math.abs(d - today);
    const distance = Math.min(raw, 365 - raw);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = e;
    }
  }
  return best ? { event: best, match: 'anniversary' } : undefined;
}

/**
 * Build today's edition.
 *
 * `favouredSubjects` nudges — but never dictates — the selection: two of the
 * seven slots stay deliberately outside the user's usual subjects so the app
 * cannot collapse into a recommendation bubble.
 */
export function buildDailyEdition(
  date: Date = new Date(),
  favouredSubjects: readonly string[] = [],
): DailyEdition {
  const key = dateKey(date);
  const rng = makeRng(hashSeed(`daily-${key}`));
  const favoured = new Set(favouredSubjects);

  const spotlightTopics = library.topics.filter((topic) => topic.spotlight);
  const preferred = library.topics.filter((topic) => favoured.has(topic.subjectId));

  // Discovery leans toward what the user likes; the space slot never does.
  const discoveryPool = preferred.length >= 3 ? [...preferred, ...spotlightTopics] : library.topics;
  const discovery = seededPick(discoveryPool, rng);

  const astronomyTopics = library.topicsBySubject.get('astronomy') ?? [];
  const spaceTopic = seededPick(astronomyTopics, rng);

  const formula = seededPick(library.formulas, rng);
  const fact = seededPick(library.facts, rng);
  const person = seededPick(library.people, rng);
  const question = seededPick(library.questions, rng);
  const onThisDay = findOnThisDay(date);

  // The exploration strip: always includes at least one subject the user has
  // not favoured, so there is a way out of the bubble.
  const unfavoured = library.topics.filter((topic) => !favoured.has(topic.subjectId));
  const strip = seededSample(preferred.length > 0 ? preferred : library.topics, 3, rng);
  const outsider = seededPick(unfavoured, rng);
  const extraTopics = dedupe([...strip, ...(outsider ? [outsider] : [])], discovery?.id);

  return {
    key,
    ...(discovery ? { discovery } : {}),
    ...(question ? { question } : {}),
    ...(onThisDay ? { onThisDay } : {}),
    ...(spaceTopic ? { spaceTopic } : {}),
    ...(formula ? { formula } : {}),
    ...(fact ? { fact } : {}),
    ...(person ? { person } : {}),
    extraTopics,
  };
}

function dedupe(topics: Topic[], excludeId?: string): Topic[] {
  const seen = new Set<string>(excludeId ? [excludeId] : []);
  const out: Topic[] = [];
  for (const topic of topics) {
    if (seen.has(topic.id)) continue;
    seen.add(topic.id);
    out.push(topic);
  }
  return out;
}
