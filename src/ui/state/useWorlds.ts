import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/persistence/db';
import {
  buildForest,
  consequencesOf,
  resolveWorld,
  worldsById,
  type Consequence,
  type ParallelWorld,
  type ResolvedWorld,
  type WorldTreeNode,
} from '@/domain/worlds';

/**
 * Everything the Parallel Worlds page reads, in one place.
 *
 * The hook only gathers rows and memoises pure domain calls — lineage,
 * inheritance and grouping all live in `@/domain/worlds` and are tested
 * without React.
 */

export interface WorldsState {
  worlds: ParallelWorld[];
  consequences: Consequence[];
  byId: Map<string, ParallelWorld>;
  forest: WorldTreeNode[];
  loading: boolean;
  /** A world with inherited context filled in from its ancestors. */
  resolve: (id: string) => ResolvedWorld | undefined;
  /** That world's consequences, ordered by depth then by hand. */
  consequencesFor: (id: string) => Consequence[];
}

export function useWorlds(): WorldsState {
  const rows = useLiveQuery(
    () => Promise.all([db.worlds.toArray(), db.worldConsequences.toArray()]),
    [],
  );

  return useMemo(() => {
    const worlds = rows?.[0] ?? [];
    const consequences = rows?.[1] ?? [];
    const byId = worldsById(worlds);

    return {
      worlds,
      consequences,
      byId,
      forest: buildForest(worlds),
      loading: rows === undefined,
      resolve: (id: string) => {
        const world = byId.get(id);
        return world ? resolveWorld(world, byId) : undefined;
      },
      consequencesFor: (id: string) => consequencesOf(id, consequences),
    };
  }, [rows]);
}
