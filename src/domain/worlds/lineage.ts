import type { ParallelWorld, ResolvedWorld, WorldTreeNode } from './types';

/**
 * Branch lineage.
 *
 * Every function here is defensive about cycles. A `parentId` chain can be
 * corrupted by a bad import or by a delete that ran halfway, and a thought
 * experiment hanging the page is a much worse failure than one that renders a
 * broken lineage — so each walk carries a seen-set and stops rather than
 * trusting the data.
 */

export function worldsById(worlds: readonly ParallelWorld[]): Map<string, ParallelWorld> {
  return new Map(worlds.map((world) => [world.id, world]));
}

/** Root → … → world. The world itself is always last. */
export function lineageOf(
  worldId: string,
  byId: ReadonlyMap<string, ParallelWorld>,
): ParallelWorld[] {
  const chain: ParallelWorld[] = [];
  const seen = new Set<string>();
  let current = byId.get(worldId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** Direct children of a world, oldest first. */
export function childrenOf(
  worldId: string,
  worlds: readonly ParallelWorld[],
): ParallelWorld[] {
  return worlds
    .filter((world) => world.parentId === worldId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Every world below this one, at any depth. */
export function descendantsOf(
  worldId: string,
  worlds: readonly ParallelWorld[],
): ParallelWorld[] {
  const out: ParallelWorld[] = [];
  const seen = new Set<string>([worldId]);
  const queue = [worldId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of childrenOf(id, worlds)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/**
 * The forest of branch trees.
 *
 * A world whose parent is missing — deleted, or never imported — is treated as
 * a root rather than being dropped. Losing a branch because its parent went
 * away would silently destroy the user's work.
 */
export function buildForest(worlds: readonly ParallelWorld[]): WorldTreeNode[] {
  const byId = worldsById(worlds);
  const roots = worlds.filter((world) => !world.parentId || !byId.has(world.parentId));

  const build = (world: ParallelWorld, depth: number, seen: Set<string>): WorldTreeNode => {
    seen.add(world.id);
    return {
      world,
      depth,
      children: childrenOf(world.id, worlds)
        .filter((child) => !seen.has(child.id))
        .map((child) => build(child, depth + 1, seen)),
    };
  };

  const seen = new Set<string>();
  return roots
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((root) => build(root, 0, seen));
}

/** The nearest world both share, if any. */
export function commonAncestor(
  a: string,
  b: string,
  byId: ReadonlyMap<string, ParallelWorld>,
): ParallelWorld | undefined {
  const ids = new Set(lineageOf(a, byId).map((world) => world.id));
  return lineageOf(b, byId)
    .reverse()
    .find((world) => ids.has(world.id));
}

/* ------------------------------ inheritance ------------------------------ */

/**
 * Fill a branch's empty context from the nearest ancestor that has it.
 *
 * A branch is a divergence, not a copy: it stores its own changed rule and
 * nothing else it did not deliberately alter. Resolving at read time means
 * editing a parent's base reality updates every branch that never overrode it,
 * which is the behaviour a lineage implies.
 */
export function resolveWorld(
  world: ParallelWorld,
  byId: ReadonlyMap<string, ParallelWorld>,
): ResolvedWorld {
  const chain = lineageOf(world.id, byId).slice(0, -1).reverse();
  const inherited: ResolvedWorld['inherited'] = {};

  let baseRule = world.baseRule;
  let subjectId = world.subjectId;
  let topicIds = world.topicIds;

  for (const ancestor of chain) {
    if (!baseRule.trim() && ancestor.baseRule.trim()) {
      baseRule = ancestor.baseRule;
      inherited.baseRule = ancestor.id;
    }
    if (!subjectId && ancestor.subjectId) {
      subjectId = ancestor.subjectId;
      inherited.subjectId = ancestor.id;
    }
    if (topicIds.length === 0 && ancestor.topicIds.length > 0) {
      topicIds = ancestor.topicIds;
      inherited.topicIds = ancestor.id;
    }
  }

  return {
    ...world,
    baseRule,
    ...(subjectId ? { subjectId } : {}),
    topicIds,
    inherited,
  };
}
