/**
 * Competitive Tournament — the topic model.
 *
 * A competitive-programming topic is *data*, like everything else in the
 * library, but its shape is fixed rather than free-form: every topic answers
 * the same eighteen questions, so the detail page is a renderer over this
 * struct, never bespoke JSX per topic.
 *
 * Most fields are optional. A topic that is only a roadmap placeholder carries
 * just `id`, `title`, `category`, `priority`, `order` and its relationships;
 * authoring it later means filling fields in, never touching a component.
 *
 * Content here is English-first — competitive programming is an English-native
 * discipline and the standard terms (prefix sum, two pointers) are what a
 * student will search for and see in editorials. `titleKa` carries a Georgian
 * gloss for the roadmap.
 */

export const CT_CATEGORIES = [
  'foundation',
  'core',
  'greedy-search',
  'graphs',
  'dp',
  'data-structures',
  'math',
] as const;
export type CtCategory = (typeof CT_CATEGORIES)[number];

/**
 * Study priority, independent of category. `essential` topics appear in almost
 * every contest; `advanced` topics are worth knowing but rarely decisive early.
 * Drives the priority filter and the "what to learn next" recommendation.
 */
export const CT_PRIORITIES = ['essential', 'important', 'advanced'] as const;
export type CtPriority = (typeof CT_PRIORITIES)[number];

/** One C++ snippet. Contest-style: terse, `#include`-light, correct. */
export interface CtCode {
  code: string;
  caption?: string;
}

/** An external practice problem on a judge. */
export interface CtPractice {
  name: string;
  url?: string;
  /** e.g. "CF 1200", "USACO Bronze". */
  tag?: string;
}

export interface CtTopic {
  id: string;
  /** English canonical name. */
  title: string;
  /** Georgian gloss for the roadmap. */
  titleKa?: string;
  category: CtCategory;
  priority: CtPriority;
  /** Position within the category, for roadmap ordering. */
  order: number;

  /* ---- the eighteen sections (17 and 18 are runtime, not content) ---- */

  /** 1. What it is. */
  whatIs?: string;
  /** 2. Core intuition — the one-sentence mental model. */
  intuition?: string;
  /** 3. Why it works. */
  whyItWorks?: string;
  /** 4. When to use it. */
  whenToUse?: string[];
  /** 5. Problem-statement signals — phrases that should trigger the technique. */
  signals?: string[];
  /**
   * The problem-solving core: what the naive solution is, why it is too slow,
   * and what changes when the technique is applied.
   */
  naive?: string;
  /** 6. Step-by-step worked example. */
  walkthrough?: string[];
  /** 7. C++ implementation(s). */
  cpp?: CtCode[];
  /** 8. Time complexity. */
  time?: string;
  /** 9. Space complexity. */
  space?: string;
  /** 10. Common mistakes. */
  mistakes?: string[];
  /** 11. Edge cases. */
  edgeCases?: string[];
  /** 15. Mini exercises — quick self-checks, no judge needed. */
  exercises?: string[];
  /** 16. Practice tasks on real judges. */
  practice?: CtPractice[];
  /** 14. How this composes with other techniques (prose). */
  combineNote?: string;

  /* ---- relationships: ids into this same topic set ---- */

  /** 12. Prerequisites — learn these first. */
  prerequisites: string[];
  /** 13. Related techniques. */
  related: string[];
  /** 14. Techniques commonly combined with this one. */
  combinesWith: string[];
  /** What usually comes next after this. */
  next: string[];
}

/** A topic is "authored" once it has real teaching content, not just a slot. */
export function isAuthored(topic: CtTopic): boolean {
  return Boolean(topic.whatIs && topic.cpp && topic.cpp.length > 0);
}
