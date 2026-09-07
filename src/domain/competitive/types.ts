/**
 * Per-topic learning state. Content is in `@/content/competitive`; this is the
 * mutable half — where the student is with each topic.
 *
 * The five statuses are a deliberate progression, not tags: a topic moves
 * Not Started → Learning → Practicing → Mastered, and Needs Review is an
 * orthogonal flag the student (or a spaced-repetition nudge) can raise on any
 * topic that is at least Learning.
 */

export const CT_STATUSES = ['not-started', 'learning', 'practicing', 'mastered', 'review'] as const;
export type CtStatus = (typeof CT_STATUSES)[number];

export interface CtTopicProgress {
  /** Matches a `CtTopic.id`. */
  topicId: string;
  status: CtStatus;
  /** Problems solved on this topic — the student's own count. */
  solved: number;
  /** Self-rated confidence 0–5, independent of status. */
  confidence: number;
  /** Raised when the topic should resurface for review. */
  reviewFlag: boolean;
  lastStudiedAt?: number;
  updatedAt: number;
}

export function emptyProgress(topicId: string): CtTopicProgress {
  return {
    topicId,
    status: 'not-started',
    solved: 0,
    confidence: 0,
    reviewFlag: false,
    updatedAt: 0,
  };
}

/** Ordinal rank of a status, for "at least Practicing" style checks. */
export const CT_STATUS_RANK: Record<CtStatus, number> = {
  'not-started': 0,
  learning: 1,
  practicing: 2,
  mastered: 3,
  // Review sits alongside "practicing": the topic is known but flagged.
  review: 2,
};
