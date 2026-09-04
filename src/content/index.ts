import type {
  Activity,
  Fact,
  Formula,
  HistoricalEvent,
  L10n,
  LocaleCode,
  Person,
  Relationship,
  SeedQuestion,
  Subject,
  Topic,
} from './schema';

import { SUBJECTS, SUBJECT_GROUP_LABELS } from './subjects';
import { FORMULAS, FORMULA_CATEGORY_LABELS } from './formulas';
import { FACTS } from './facts';
import { PEOPLE } from './people';
import { EVENTS } from './events';
import { ACTIVITIES } from './activities';
import { SEED_QUESTIONS } from './questions';
import { RELATIONSHIPS } from './relations';

import { ASTRONOMY_TOPICS } from './topics/astronomy';
import { PHYSICS_TOPICS } from './topics/physics';
import { CHEMISTRY_TOPICS } from './topics/chemistry';
import { BIOLOGY_TOPICS } from './topics/biology';
import { MATH_TOPICS } from './topics/math';
import { PROBABILITY_TOPICS } from './topics/probability';
import { CS_TOPICS } from './topics/cs';
import { PROGRAMMING_TOPICS } from './topics/programming';
import { ALGORITHMS_TOPICS } from './topics/algorithms';
import { AI_TOPICS } from './topics/ai';
import { HUMANITIES_TOPICS } from './topics/humanities';
import { HISTORY_TOPICS } from './topics/history';
import { SOCIETY_TOPICS } from './topics/society';
import { CULTURE_TOPICS } from './topics/culture';
import { EXTRA_TOPICS } from './topics/extras';

export * from './schema';
export { SUBJECT_GROUP_LABELS, FORMULA_CATEGORY_LABELS };

const TOPICS: Topic[] = [
  ...ASTRONOMY_TOPICS,
  ...PHYSICS_TOPICS,
  ...CHEMISTRY_TOPICS,
  ...BIOLOGY_TOPICS,
  ...MATH_TOPICS,
  ...PROBABILITY_TOPICS,
  ...CS_TOPICS,
  ...PROGRAMMING_TOPICS,
  ...ALGORITHMS_TOPICS,
  ...AI_TOPICS,
  ...HUMANITIES_TOPICS,
  ...HISTORY_TOPICS,
  ...SOCIETY_TOPICS,
  ...CULTURE_TOPICS,
  ...EXTRA_TOPICS,
];

/** Resolve a localized string, falling back to Georgian (the source locale). */
export function t(value: L10n | undefined, locale: LocaleCode = 'ka'): string {
  if (!value) return '';
  if (locale === 'ka') return value.ka;
  return value.en ?? value.ka;
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

function groupBy<T>(items: readonly T[], key: (item: T) => string | undefined): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * The read-only, bundled content library. User-created subjects and topics live
 * in IndexedDB and are merged on top of this at the store layer — this module
 * stays pure so it can be imported by tests and workers without a browser.
 */
export interface ContentLibrary {
  subjects: Subject[];
  topics: Topic[];
  formulas: Formula[];
  facts: Fact[];
  people: Person[];
  events: HistoricalEvent[];
  activities: Activity[];
  questions: SeedQuestion[];
  relationships: Relationship[];

  subjectById: Map<string, Subject>;
  topicById: Map<string, Topic>;
  formulaById: Map<string, Formula>;
  factById: Map<string, Fact>;
  personById: Map<string, Person>;
  eventById: Map<string, HistoricalEvent>;
  activityById: Map<string, Activity>;

  topicsBySubject: Map<string, Topic[]>;
  formulasBySubject: Map<string, Formula[]>;
  factsBySubject: Map<string, Fact[]>;
  peopleBySubject: Map<string, Person[]>;
  eventsBySubject: Map<string, HistoricalEvent[]>;
  activitiesBySubject: Map<string, Activity[]>;
  activitiesByTopic: Map<string, Activity[]>;
}

function build(): ContentLibrary {
  const subjects = [...SUBJECTS].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return {
    subjects,
    topics: TOPICS,
    formulas: FORMULAS,
    facts: FACTS,
    people: PEOPLE,
    events: EVENTS,
    activities: ACTIVITIES,
    questions: SEED_QUESTIONS,
    relationships: RELATIONSHIPS,

    subjectById: byId(subjects),
    topicById: byId(TOPICS),
    formulaById: byId(FORMULAS),
    factById: byId(FACTS),
    personById: byId(PEOPLE),
    eventById: byId(EVENTS),
    activityById: byId(ACTIVITIES),

    topicsBySubject: groupBy(TOPICS, (x) => x.subjectId),
    formulasBySubject: groupBy(FORMULAS, (x) => x.subjectId),
    factsBySubject: groupBy(FACTS, (x) => x.subjectId),
    peopleBySubject: groupBy(PEOPLE, (x) => x.subjectId),
    eventsBySubject: groupBy(EVENTS, (x) => x.subjectId),
    activitiesBySubject: groupBy(ACTIVITIES, (x) => x.subjectId),
    activitiesByTopic: groupBy(ACTIVITIES, (x) => x.topicId),
  };
}

export const library: ContentLibrary = build();

/* ------------------------------------------------------------------ *
 * Cross-reference helpers used across the UI.
 * ------------------------------------------------------------------ */

export function topicsForSubject(subjectId: string): Topic[] {
  return library.topicsBySubject.get(subjectId) ?? [];
}

export function factsForTopic(topicId: string): Fact[] {
  const topic = library.topicById.get(topicId);
  const explicit = (topic?.factIds ?? [])
    .map((id) => library.factById.get(id))
    .filter((f): f is Fact => Boolean(f));
  const tagged = library.facts.filter((f) => f.topicIds?.includes(topicId));
  return dedupeById([...explicit, ...tagged]);
}

export function formulasForTopic(topicId: string): Formula[] {
  const topic = library.topicById.get(topicId);
  const explicit = (topic?.formulaIds ?? [])
    .map((id) => library.formulaById.get(id))
    .filter((f): f is Formula => Boolean(f));
  const tagged = library.formulas.filter((f) => f.topicIds?.includes(topicId));
  return dedupeById([...explicit, ...tagged]);
}

export function peopleForTopic(topicId: string): Person[] {
  const topic = library.topicById.get(topicId);
  const explicit = (topic?.personIds ?? [])
    .map((id) => library.personById.get(id))
    .filter((p): p is Person => Boolean(p));
  const tagged = library.people.filter((p) => p.topicIds?.includes(topicId));
  return dedupeById([...explicit, ...tagged]);
}

export function eventsForTopic(topicId: string): HistoricalEvent[] {
  const topic = library.topicById.get(topicId);
  const explicit = (topic?.eventIds ?? [])
    .map((id) => library.eventById.get(id))
    .filter((e): e is HistoricalEvent => Boolean(e));
  const tagged = library.events.filter((e) => e.topicIds?.includes(topicId));
  return dedupeById([...explicit, ...tagged]);
}

export function activitiesForTopic(topicId: string): Activity[] {
  const topic = library.topicById.get(topicId);
  const explicit = (topic?.activityIds ?? [])
    .map((id) => library.activityById.get(id))
    .filter((a): a is Activity => Boolean(a));
  const tagged = library.activitiesByTopic.get(topicId) ?? [];
  return dedupeById([...explicit, ...tagged]);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Integrity check used by the test suite: every cross-reference in the content
 * must resolve. Content is authored by hand, so a dangling id is a real bug
 * that would surface as an empty section in the UI.
 */
export function findBrokenReferences(): string[] {
  const problems: string[] = [];
  const check = (present: boolean, message: string) => {
    if (!present) problems.push(message);
  };

  for (const topic of library.topics) {
    check(library.subjectById.has(topic.subjectId), `topic ${topic.id} → unknown subject ${topic.subjectId}`);
    for (const id of topic.factIds ?? []) check(library.factById.has(id), `topic ${topic.id} → fact ${id}`);
    for (const id of topic.formulaIds ?? []) check(library.formulaById.has(id), `topic ${topic.id} → formula ${id}`);
    for (const id of topic.personIds ?? []) check(library.personById.has(id), `topic ${topic.id} → person ${id}`);
    for (const id of topic.eventIds ?? []) check(library.eventById.has(id), `topic ${topic.id} → event ${id}`);
    for (const id of topic.activityIds ?? []) check(library.activityById.has(id), `topic ${topic.id} → activity ${id}`);
    for (const section of topic.sections) {
      for (const block of section.blocks) {
        if (block.type === 'formulaRef') {
          check(library.formulaById.has(block.formulaId), `topic ${topic.id} → formulaRef ${block.formulaId}`);
        }
      }
    }
  }

  for (const formula of library.formulas) {
    check(library.subjectById.has(formula.subjectId), `formula ${formula.id} → unknown subject ${formula.subjectId}`);
    for (const id of formula.relatedFormulaIds ?? []) {
      check(library.formulaById.has(id), `formula ${formula.id} → related ${id}`);
    }
    for (const id of formula.topicIds ?? []) check(library.topicById.has(id), `formula ${formula.id} → topic ${id}`);
  }

  for (const fact of library.facts) {
    check(library.subjectById.has(fact.subjectId), `fact ${fact.id} → unknown subject ${fact.subjectId}`);
    for (const id of fact.topicIds ?? []) check(library.topicById.has(id), `fact ${fact.id} → topic ${id}`);
  }

  for (const person of library.people) {
    for (const id of person.topicIds ?? []) check(library.topicById.has(id), `person ${person.id} → topic ${id}`);
  }

  for (const event of library.events) {
    for (const id of event.topicIds ?? []) check(library.eventById.has(id) || library.topicById.has(id), `event ${event.id} → topic ${id}`);
  }

  for (const activity of library.activities) {
    check(library.subjectById.has(activity.subjectId), `activity ${activity.id} → unknown subject ${activity.subjectId}`);
    if (activity.topicId) check(library.topicById.has(activity.topicId), `activity ${activity.id} → topic ${activity.topicId}`);
  }

  for (const question of library.questions) {
    for (const id of question.topicIds ?? []) check(library.topicById.has(id), `question ${question.id} → topic ${id}`);
  }

  const known = new Set<string>([
    ...library.topicById.keys(),
    ...library.personById.keys(),
    ...library.formulaById.keys(),
    ...library.factById.keys(),
    ...library.eventById.keys(),
    ...library.subjectById.keys(),
  ]);
  for (const rel of library.relationships) {
    check(known.has(rel.from), `relationship from unknown id ${rel.from}`);
    check(known.has(rel.to), `relationship to unknown id ${rel.to}`);
  }

  return problems;
}
