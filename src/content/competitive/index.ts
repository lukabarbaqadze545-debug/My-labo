/**
 * Competitive Tournament — the assembled topic set.
 *
 * Content lives in `topics/*.ts` grouped by category. This module assembles it,
 * builds lookup indexes, and validates the relationship graph at load time so a
 * dangling prerequisite id is a test failure, not a broken page.
 */

import type { CtCategory, CtTopic } from './types';
import { FOUNDATION_TOPICS } from './topics/foundation';
import {
  CORE_TOPICS,
  DP_TOPICS,
  DS_TOPICS,
  GRAPH_TOPICS,
  GREEDY_SEARCH_TOPICS,
  MATH_TOPICS,
} from './topics/rest';

export * from './types';

export const CT_CATEGORY_LABELS: Record<CtCategory, { en: string; ka: string }> = {
  foundation: { en: 'Foundation', ka: 'საფუძვლები' },
  core: { en: 'Core Olympiad', ka: 'ბირთვი' },
  'greedy-search': { en: 'Greedy / Search / Optimisation', ka: 'ხარბი და ძებნა' },
  graphs: { en: 'Graphs', ka: 'გრაფები' },
  dp: { en: 'Dynamic Programming', ka: 'დინამიური დაპროგრამება' },
  'data-structures': { en: 'Data Structures', ka: 'მონაცემთა სტრუქტურები' },
  math: { en: 'Contest Math', ka: 'ოლიმპიადური მათემატიკა' },
};

/** Category display order, matching the syllabus. */
export const CT_CATEGORY_ORDER: CtCategory[] = [
  'foundation',
  'core',
  'greedy-search',
  'graphs',
  'dp',
  'data-structures',
  'math',
];

const ALL: CtTopic[] = [
  ...FOUNDATION_TOPICS,
  ...CORE_TOPICS,
  ...GREEDY_SEARCH_TOPICS,
  ...GRAPH_TOPICS,
  ...DP_TOPICS,
  ...DS_TOPICS,
  ...MATH_TOPICS,
];

export const CT_TOPICS: readonly CtTopic[] = ALL;

export const ctTopicById: ReadonlyMap<string, CtTopic> = new Map(ALL.map((t) => [t.id, t]));

export const ctTopicsByCategory: ReadonlyMap<CtCategory, CtTopic[]> = (() => {
  const m = new Map<CtCategory, CtTopic[]>();
  for (const cat of CT_CATEGORY_ORDER) m.set(cat, []);
  for (const topic of ALL) m.get(topic.category)!.push(topic);
  for (const list of m.values()) list.sort((a, b) => a.order - b.order);
  return m;
})();

/**
 * Every relationship id that does not resolve to a real topic. Empty in a
 * healthy build; asserted empty by the test suite.
 */
export function ctBrokenReferences(): string[] {
  const bad: string[] = [];
  for (const topic of ALL) {
    for (const field of ['prerequisites', 'related', 'combinesWith', 'next'] as const) {
      for (const id of topic[field]) {
        if (!ctTopicById.has(id)) bad.push(`${topic.id}.${field} → ${id}`);
      }
    }
  }
  return bad;
}
