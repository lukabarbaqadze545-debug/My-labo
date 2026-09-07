import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { library } from '@/content';
import { db } from '@/persistence/db';
import { buildKnowledgeGraph, estimateMastery, type KnowledgeGraph } from '@/domain/knowledge';

/**
 * Assemble the whole graph from the library plus everything stored locally.
 *
 * The build is a pure function, so this hook only gathers inputs and memoises
 * the result. Live queries mean importing a book, writing a note or drawing an
 * edge updates the map without any explicit refresh — and because derived
 * edges are recomputed rather than stored, they cannot fall behind.
 */

/** activityId → topicId, so a completed activity credits the right topic. */
const ACTIVITY_TOPIC = new Map(
  library.activities
    .filter((a): a is typeof a & { topicId: string } => Boolean(a.topicId))
    .map((a) => [a.id, a.topicId]),
);

export interface KnowledgeGraphState {
  graph: KnowledgeGraph;
  loading: boolean;
}

export function useKnowledgeGraph(): KnowledgeGraphState {
  const rows = useLiveQuery(
    () =>
      Promise.all([
        db.knowledgeNodes.toArray(),
        db.knowledgeEdges.toArray(),
        db.documents.toArray(),
        db.notes.toArray(),
        db.books.toArray(),
        db.userTopics.toArray(),
        db.interactions.toArray(),
        db.activityProgress.toArray(),
      ]),
    [],
  );

  const graph = useMemo(() => {
    const [manualNodes, manualEdges, documents, notes, books, userTopics, interactions, activityProgress] =
      rows ?? [];

    const mastery = estimateMastery({
      interactions: interactions ?? [],
      activityProgress: activityProgress ?? [],
      notes: notes ?? [],
      activityTopic: ACTIVITY_TOPIC,
    });

    return buildKnowledgeGraph({
      manualNodes: manualNodes ?? [],
      manualEdges: manualEdges ?? [],
      documents: documents ?? [],
      notes: notes ?? [],
      books: books ?? [],
      userTopics: userTopics ?? [],
      mastery,
    });
  }, [rows]);

  return { graph, loading: rows === undefined };
}
