import { incidentEdges } from './engine';
import { WEAK_MASTERY } from './mastery';
import { PREREQUISITE_RELATIONS, type KnowledgeGraph, type KnowledgeNode } from './types';

/**
 * Prerequisite-gap analysis.
 *
 * Strictly deterministic and strictly explicit: a prerequisite exists only
 * where a stored edge says so — `DEPENDS_ON` or `PREREQUISITE_OF`, whether
 * authored in `relations.ts` as `requires` or drawn by hand. Nothing is
 * inferred from titles, subjects or co-occurrence, because a guessed
 * prerequisite would send the user to study something they never needed.
 */

/** Prerequisites of a node, resolved in whichever direction they were stored. */
export function prerequisitesOf(graph: KnowledgeGraph, id: string): KnowledgeNode[] {
  const out: KnowledgeNode[] = [];
  const seen = new Set<string>();

  for (const { edge, otherId } of incidentEdges(graph, id)) {
    if (!PREREQUISITE_RELATIONS.has(edge.relationType)) continue;

    // "A DEPENDS_ON B" and "B PREREQUISITE_OF A" say the same thing from
    // opposite ends, so the direction test differs per relation type.
    const isPrerequisite =
      edge.relationType === 'DEPENDS_ON' ? edge.sourceNodeId === id : edge.targetNodeId === id;
    if (!isPrerequisite || seen.has(otherId)) continue;

    seen.add(otherId);
    const node = graph.nodeById.get(otherId);
    if (node) out.push(node);
  }
  return out;
}

/** Nodes that depend on this one — what becomes reachable by learning it. */
export function dependentsOf(graph: KnowledgeGraph, id: string): KnowledgeNode[] {
  const out: KnowledgeNode[] = [];
  const seen = new Set<string>();

  for (const { edge, otherId } of incidentEdges(graph, id)) {
    if (!PREREQUISITE_RELATIONS.has(edge.relationType)) continue;
    const isDependent =
      edge.relationType === 'DEPENDS_ON' ? edge.targetNodeId === id : edge.sourceNodeId === id;
    if (!isDependent || seen.has(otherId)) continue;

    seen.add(otherId);
    const node = graph.nodeById.get(otherId);
    if (node) out.push(node);
  }
  return out;
}

export interface PrerequisiteGap {
  /** What is being studied. */
  node: KnowledgeNode;
  /** Its prerequisites that are not yet in place. */
  missing: KnowledgeNode[];
}

export interface GapOptions {
  /** Below this mastery a prerequisite counts as missing. */
  weakBelow?: number;
  /**
   * A node counts as "being studied" at or above this. Zero would report a gap
   * for every untouched topic in the library, which is noise, not insight.
   */
  studyingAbove?: number;
}

/**
 * Gaps worth showing: things the user has actually started, whose stored
 * prerequisites are weak or untouched.
 */
export function findPrerequisiteGaps(
  graph: KnowledgeGraph,
  options: GapOptions = {},
): PrerequisiteGap[] {
  const weakBelow = options.weakBelow ?? WEAK_MASTERY;
  const studyingAbove = options.studyingAbove ?? 0;

  const gaps: PrerequisiteGap[] = [];
  for (const node of graph.nodes) {
    const level = node.masteryLevel ?? 0;
    if (level <= studyingAbove) continue;

    const missing = prerequisitesOf(graph, node.id).filter(
      (prerequisite) => (prerequisite.masteryLevel ?? 0) < weakBelow,
    );
    if (missing.length > 0) gaps.push({ node, missing });
  }

  // Most-blocked first: the topic missing three foundations needs attention
  // before the one missing a single easy prerequisite.
  return gaps.sort((a, b) => b.missing.length - a.missing.length);
}

/**
 * A study order for one target: its prerequisites, deepest first.
 *
 * Depth-first post-order over prerequisite edges only, with a visiting set so a
 * cyclic prerequisite chain — which a user can absolutely draw by hand —
 * terminates instead of hanging the page.
 */
export function learningPath(graph: KnowledgeGraph, targetId: string): KnowledgeNode[] {
  const order: KnowledgeNode[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (done.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const prerequisite of prerequisitesOf(graph, id)) visit(prerequisite.id);
    visiting.delete(id);
    done.add(id);
    const node = graph.nodeById.get(id);
    if (node && id !== targetId) order.push(node);
  };

  visit(targetId);
  return order;
}
