import type { ActivityProgress, InteractionRecord, UserNote } from '@/persistence/db';

/**
 * A mastery estimate, built only from signals Luka's Labo already records.
 *
 * There is no self-assessment field in the app, so this is deliberately an
 * *estimate* and is labelled as one everywhere it surfaces. Doing real work on
 * a topic — finishing an activity, writing a note about it — counts for far
 * more than opening its page, because opening a page is not learning.
 *
 * A user who wants to overrule it can set a declared level on the node; the
 * declared value always wins. Presenting a guess as a measurement would make
 * the whole prerequisite-gap feature untrustworthy.
 */

const WEIGHTS = { activity: 4, note: 3, bookmark: 2, view: 0.5, search: 0.25 } as const;

/** Signal total at which a topic counts as fully mastered by these measures. */
const SATURATION = 12;

export interface MasteryInput {
  interactions?: readonly InteractionRecord[];
  activityProgress?: readonly ActivityProgress[];
  notes?: readonly UserNote[];
  /** activityId → topicId, so a finished activity credits its topic. */
  activityTopic?: ReadonlyMap<string, string>;
}

/** topicId → 0..1. Topics with no signal at all are simply absent. */
export function estimateMastery(input: MasteryInput): Map<string, number> {
  const score = new Map<string, number>();
  const add = (topicId: string | undefined, weight: number) => {
    if (!topicId) return;
    score.set(topicId, (score.get(topicId) ?? 0) + weight);
  };

  for (const event of input.interactions ?? []) {
    add(event.topicId, WEIGHTS[event.type] ?? 0);
  }

  // A completed activity is the strongest signal available: it is the only one
  // that requires the user to have actually done something correctly.
  for (const progress of input.activityProgress ?? []) {
    if (!progress.completedAt) continue;
    add(input.activityTopic?.get(progress.activityId), WEIGHTS.activity);
  }

  for (const note of input.notes ?? []) add(note.topicId, WEIGHTS.note);

  const out = new Map<string, number>();
  for (const [topicId, raw] of score) {
    out.set(topicId, Math.min(1, Math.round((raw / SATURATION) * 100) / 100));
  }
  return out;
}

/** Below this, a prerequisite counts as not yet in place. */
export const WEAK_MASTERY = 0.34;
