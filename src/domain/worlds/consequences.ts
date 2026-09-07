import {
  CONSEQUENCE_KINDS,
  CONSEQUENCE_LEVELS,
  type Consequence,
  type ConsequenceKind,
  type ConsequenceLevel,
} from './types';

/**
 * Reading the consequence set.
 *
 * The depth levels are the point of the feature, so ordering and grouping are
 * defined here once rather than being re-sorted ad hoc by each view: a list
 * that shows systemic consequences before immediate ones reads as noise, not
 * as an argument.
 */

export function consequencesOf(
  worldId: string,
  all: readonly Consequence[],
): Consequence[] {
  return all.filter((c) => c.worldId === worldId).sort(byDepthThenOrder);
}

/** Level first, then the user's own ordering — never by creation time. */
export function byDepthThenOrder(a: Consequence, b: Consequence): number {
  return a.level - b.level || a.order - b.order || a.createdAt - b.createdAt;
}

/** level → consequences, always with all three levels present. */
export function byLevel(
  consequences: readonly Consequence[],
): Map<ConsequenceLevel, Consequence[]> {
  const out = new Map<ConsequenceLevel, Consequence[]>();
  for (const level of CONSEQUENCE_LEVELS) out.set(level, []);
  for (const c of [...consequences].sort(byDepthThenOrder)) {
    out.get(c.level)?.push(c);
  }
  return out;
}

/** kind → consequences, all kinds present. */
export function byKind(
  consequences: readonly Consequence[],
): Map<ConsequenceKind, Consequence[]> {
  const out = new Map<ConsequenceKind, Consequence[]>();
  for (const kind of CONSEQUENCE_KINDS) out.set(kind, []);
  for (const c of [...consequences].sort(byDepthThenOrder)) {
    out.get(c.kind)?.push(c);
  }
  return out;
}

/* ------------------------------ causal map ------------------------------- */

/**
 * The local causal map: which consequence follows from which, inside this one
 * world. It is not a claim about reality and has nothing to do with the app's
 * knowledge graph — it is the shape of an argument.
 */

/** Consequences with no stated cause — where the reasoning starts. */
export function causalRoots(consequences: readonly Consequence[]): Consequence[] {
  const ids = new Set(consequences.map((c) => c.id));
  return consequences
    .filter((c) => c.causedBy.filter((id) => ids.has(id)).length === 0)
    .sort(byDepthThenOrder);
}

export function causalChildren(
  id: string,
  consequences: readonly Consequence[],
): Consequence[] {
  return consequences.filter((c) => c.causedBy.includes(id)).sort(byDepthThenOrder);
}

export interface CausalChain {
  consequence: Consequence;
  depth: number;
}

/**
 * Depth-first walk of the causal map, for rendering it as an indented chain.
 *
 * A user can absolutely draw A → B → A, so the walk carries a path set and
 * refuses to re-enter a node already on the current path. Nodes reachable by
 * several routes appear once, at their first position.
 */
export function causalChains(consequences: readonly Consequence[]): CausalChain[] {
  const out: CausalChain[] = [];
  const emitted = new Set<string>();

  const walk = (node: Consequence, depth: number, path: Set<string>) => {
    if (path.has(node.id) || emitted.has(node.id)) return;
    emitted.add(node.id);
    out.push({ consequence: node, depth });

    const nextPath = new Set(path).add(node.id);
    for (const child of causalChildren(node.id, consequences)) {
      walk(child, depth + 1, nextPath);
    }
  };

  for (const root of causalRoots(consequences)) walk(root, 0, new Set());
  // Anything only reachable through a cycle still deserves to be shown.
  for (const orphan of [...consequences].sort(byDepthThenOrder)) {
    if (!emitted.has(orphan.id)) walk(orphan, 0, new Set());
  }
  return out;
}

/**
 * Would linking `child` to `parent` create a cycle? Checked before saving, so
 * the stored map stays a DAG and every reader can assume it.
 */
export function wouldCycle(
  childId: string,
  parentId: string,
  consequences: readonly Consequence[],
): boolean {
  if (childId === parentId) return true;
  const byId = new Map(consequences.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const stack = [parentId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === childId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const up of byId.get(id)?.causedBy ?? []) stack.push(up);
  }
  return false;
}

/** How deeply the reasoning actually goes — the honest measure of a world. */
export function reasoningDepth(consequences: readonly Consequence[]): number {
  return consequences.reduce((max, c) => Math.max(max, c.level), 0);
}
