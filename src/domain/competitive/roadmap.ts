import {
  CT_CATEGORY_ORDER,
  ctTopicById,
  ctTopicsByCategory,
  isAuthored,
  type CtCategory,
  type CtPriority,
  type CtTopic,
} from '@/content/competitive';
import { CT_STATUS_RANK, emptyProgress, type CtStatus, type CtTopicProgress } from './types';

/**
 * The roadmap engine — deterministic, no React, no model.
 *
 * "What can I study now" and "what should I study next" are graph questions
 * over the prerequisite edges plus the student's progress. Keeping them here
 * means the page renders the answer rather than computing it.
 */

export interface CtTopicView {
  topic: CtTopic;
  progress: CtTopicProgress;
  authored: boolean;
  /** Every prerequisite is at least Practicing (or the topic has none). */
  unlocked: boolean;
  /** Prerequisites not yet at Practicing — what blocks this topic. */
  missingPrereqs: CtTopic[];
}

const PRIORITY_RANK: Record<CtPriority, number> = { essential: 0, important: 1, advanced: 2 };

/** Is a status at least as advanced as `floor`? Review counts as practicing. */
export function statusAtLeast(status: CtStatus, floor: CtStatus): boolean {
  return CT_STATUS_RANK[status] >= CT_STATUS_RANK[floor];
}

export function buildTopicView(
  topic: CtTopic,
  progressById: ReadonlyMap<string, CtTopicProgress>,
): CtTopicView {
  const progress = progressById.get(topic.id) ?? emptyProgress(topic.id);
  const missingPrereqs = topic.prerequisites
    .map((id) => ({ id, p: progressById.get(id) }))
    .filter(({ p }) => !p || !statusAtLeast(p.status, 'practicing'))
    .map(({ id }) => ctTopicById.get(id))
    .filter((t): t is CtTopic => Boolean(t));

  return {
    topic,
    progress,
    authored: isAuthored(topic),
    unlocked: missingPrereqs.length === 0,
    missingPrereqs,
  };
}

export interface RoadmapCategory {
  category: CtCategory;
  topics: CtTopicView[];
}

export function buildRoadmap(
  progressById: ReadonlyMap<string, CtTopicProgress>,
): RoadmapCategory[] {
  return CT_CATEGORY_ORDER.map((category) => ({
    category,
    topics: (ctTopicsByCategory.get(category) ?? []).map((t) => buildTopicView(t, progressById)),
  }));
}

/* -------------------------------- stats -------------------------------- */

export interface CtStats {
  total: number;
  authored: number;
  byStatus: Record<CtStatus, number>;
  solved: number;
  /** Fraction 0–1 of authored topics that are Mastered. */
  mastery: number;
  reviewCount: number;
}

export function computeStats(views: CtTopicView[]): CtStats {
  const byStatus: Record<CtStatus, number> = {
    'not-started': 0,
    learning: 0,
    practicing: 0,
    mastered: 0,
    review: 0,
  };
  let solved = 0;
  let reviewCount = 0;
  let authored = 0;
  let masteredAuthored = 0;

  for (const v of views) {
    byStatus[v.progress.status]++;
    solved += v.progress.solved;
    if (v.progress.reviewFlag) reviewCount++;
    if (v.authored) {
      authored++;
      if (v.progress.status === 'mastered') masteredAuthored++;
    }
  }

  return {
    total: views.length,
    authored,
    byStatus,
    solved,
    mastery: authored === 0 ? 0 : masteredAuthored / authored,
    reviewCount,
  };
}

/* ---------------------------- recommendation --------------------------- */

/**
 * The single topic the student should open next. Deterministic priority order:
 *
 *   1. A topic already Learning — finish what you started.
 *   2. A review-flagged topic that has gone stale (oldest last-studied first).
 *   3. The most essential unlocked, authored, not-started topic, earliest in
 *      the syllabus.
 *   4. Failing all that, the first authored topic that is not yet Mastered.
 *
 * Returns `null` only when every authored topic is Mastered and nothing is
 * flagged — i.e. the student is done with the current content.
 */
export function recommendNext(views: CtTopicView[]): CtTopicView | null {
  const authored = views.filter((v) => v.authored);

  const learning = authored
    .filter((v) => v.progress.status === 'learning')
    .sort((a, b) => (a.progress.lastStudiedAt ?? 0) - (b.progress.lastStudiedAt ?? 0));
  if (learning[0]) return learning[0];

  const stale = authored
    .filter((v) => v.progress.reviewFlag)
    .sort((a, b) => (a.progress.lastStudiedAt ?? 0) - (b.progress.lastStudiedAt ?? 0));
  if (stale[0]) return stale[0];

  const fresh = authored
    .filter((v) => v.progress.status === 'not-started' && v.unlocked)
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.topic.priority] - PRIORITY_RANK[b.topic.priority] ||
        CT_CATEGORY_ORDER.indexOf(a.topic.category) - CT_CATEGORY_ORDER.indexOf(b.topic.category) ||
        a.topic.order - b.topic.order,
    );
  if (fresh[0]) return fresh[0];

  const anyUnfinished = authored.find((v) => v.progress.status !== 'mastered');
  return anyUnfinished ?? null;
}

/* ------------------------------ filtering ----------------------------- */

export interface CtFilter {
  query?: string;
  category?: CtCategory | 'all';
  priority?: CtPriority | 'all';
  status?: CtStatus | 'all';
}

export function filterTopics(views: CtTopicView[], filter: CtFilter): CtTopicView[] {
  const q = filter.query?.trim().toLowerCase();
  return views.filter((v) => {
    if (filter.category && filter.category !== 'all' && v.topic.category !== filter.category)
      return false;
    if (filter.priority && filter.priority !== 'all' && v.topic.priority !== filter.priority)
      return false;
    if (filter.status && filter.status !== 'all' && v.progress.status !== filter.status)
      return false;
    if (q) {
      const hay = `${v.topic.title} ${v.topic.titleKa ?? ''} ${v.topic.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Resolve a relationship field to real topic objects, silently dropping unknowns. */
export function relatedTopics(ids: readonly string[]): CtTopic[] {
  return ids.map((id) => ctTopicById.get(id)).filter((t): t is CtTopic => Boolean(t));
}
