import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/persistence/db';
import {
  buildRoadmap,
  computeStats,
  recommendNext,
  type CtStats,
  type CtTopicView,
  type RoadmapCategory,
} from '@/domain/competitive';
import { emptyProgress, type CtTopicProgress } from '@/domain/competitive/types';

/**
 * Everything the Tournament pages read. The hook gathers the progress rows and
 * the topic notes; every derivation (roadmap, stats, recommendation) is a pure
 * call into `@/domain/competitive`.
 */

export interface CompetitiveState {
  roadmap: RoadmapCategory[];
  /** Flat list, syllabus order. */
  views: CtTopicView[];
  progressById: Map<string, CtTopicProgress>;
  stats: CtStats;
  recommended: CtTopicView | null;
  loading: boolean;
  viewOf: (topicId: string) => CtTopicView | undefined;
  progressOf: (topicId: string) => CtTopicProgress;
}

export function useCompetitive(): CompetitiveState {
  const rows = useLiveQuery(() => db.ctProgress.toArray(), []);

  return useMemo(() => {
    const progressById = new Map<string, CtTopicProgress>(
      (rows ?? []).map((r) => [r.topicId, r]),
    );
    const roadmap = buildRoadmap(progressById);
    const views = roadmap.flatMap((c) => c.topics);
    const byId = new Map(views.map((v) => [v.topic.id, v]));

    return {
      roadmap,
      views,
      progressById,
      stats: computeStats(views),
      recommended: recommendNext(views),
      loading: rows === undefined,
      viewOf: (id: string) => byId.get(id),
      progressOf: (id: string) => progressById.get(id) ?? emptyProgress(id),
    };
  }, [rows]);
}

/** Notes for one topic, live. Reuses the shared notes table. */
export function useTopicNotes(topicId: string) {
  return useLiveQuery(
    () => db.notes.where('topicId').equals(topicId).sortBy('createdAt'),
    [topicId],
  );
}
