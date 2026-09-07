/**
 * The knowledge graph's vocabulary.
 *
 * Two rules shape everything here:
 *
 *   1. A node usually *points at* something Luka's Labo already stores. It
 *      carries a title and a type so the graph can be drawn, and a
 *      `sourceEntityId` so the real thing stays the single source of truth.
 *      Content is never copied into the graph.
 *
 *   2. An edge is either derived from structure that already exists (a topic
 *      belongs to a subject; `relations.ts` says gravity requires Newton's
 *      laws) or drawn by hand. Derived edges are recomputed, never stored, so
 *      they cannot drift from the library they came from.
 */

/* --------------------------------- nodes -------------------------------- */

/**
 * Node types, mapped onto what Luka's Labo actually holds. The last four have
 * no library counterpart — they exist only as hand-made nodes, which is what
 * lets the graph hold a project or a goal the library has no concept of.
 */
export const NODE_TYPES = [
  'subject',
  'topic',
  'concept',
  'document',
  'note',
  'book',
  'person',
  'formula',
  'fact',
  'event',
  'project',
  'technology',
  'goal',
  'idea',
] as const;
export type KnowledgeNodeType = (typeof NODE_TYPES)[number];

/** Types a user may create by hand; the rest are mirrors of stored entities. */
export const MANUAL_NODE_TYPES: readonly KnowledgeNodeType[] = [
  'concept',
  'project',
  'technology',
  'goal',
  'idea',
  'person',
  'book',
];

export type NodeOrigin = 'derived' | 'manual';

export interface KnowledgeNode {
  /** Namespaced: "topic:dna", "doc:ab12", or "kn_..." for a hand-made node. */
  id: string;
  type: KnowledgeNodeType;
  title: string;
  description?: string;
  subjectId?: string;
  tags: string[];
  origin: NodeOrigin;
  /** The Labo id this mirrors. Absent on hand-made nodes. */
  sourceEntityId?: string;
  /** Where to open the original. Absent when there is nothing to open. */
  href?: string;
  /**
   * 0..1. Either declared by the user or estimated from engagement — never
   * both silently: `masterySource` says which, because a guess presented as a
   * measurement is worse than no number.
   */
  masteryLevel?: number;
  masterySource?: 'declared' | 'estimated';
  createdAt: number;
  updatedAt: number;
}

/* --------------------------------- edges -------------------------------- */

/**
 * Directed, typed relationships.
 *
 * The first block mirrors the authored `RelationKind` values in
 * `content/relations.ts` so nothing is lost in translation; the rest are the
 * vocabulary for hand-drawn edges.
 */
export const RELATION_TYPES = [
  'PART_OF',
  'DEPENDS_ON',
  'PREREQUISITE_OF',
  'LEADS_TO',
  'EXPLAINS',
  'CONTRASTS',
  'DISCOVERED_BY',
  'APPLIES_TO',
  'RELATED_TO',
  'USED_BY',
  'LEARNED_FROM',
  'INSPIRED_BY',
  'SIMILAR_TO',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/**
 * Relations whose direction is meaningless — drawing them twice would double
 * every edge for no gain. Used by the renderer and by duplicate detection.
 */
export const SYMMETRIC_RELATIONS: ReadonlySet<RelationType> = new Set<RelationType>([
  'RELATED_TO',
  'SIMILAR_TO',
  'CONTRASTS',
]);

/**
 * The two relations that carry prerequisite meaning, and nothing else does.
 * Gap analysis reads only these, which is what keeps it from guessing.
 *
 *   A DEPENDS_ON B      — A needs B first
 *   A PREREQUISITE_OF B — B needs A first
 */
export const PREREQUISITE_RELATIONS: ReadonlySet<RelationType> = new Set<RelationType>([
  'DEPENDS_ON',
  'PREREQUISITE_OF',
]);

export interface KnowledgeEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  note?: string;
  origin: NodeOrigin;
  createdAt?: number;
}

/* -------------------------------- snapshot ------------------------------- */

/**
 * One immutable view of the whole graph: everything derived from the library
 * and storage, merged with everything drawn by hand. Every engine function
 * takes this, so nothing has to re-derive the graph to answer a question.
 */
export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  nodeById: Map<string, KnowledgeNode>;
  /** nodeId → edges touching it, in both directions. */
  incident: Map<string, KnowledgeEdge[]>;
}

/** An edge seen from one endpoint, with direction resolved. */
export interface IncidentEdge {
  edge: KnowledgeEdge;
  /** The node at the other end. */
  otherId: string;
  /** True when traversing against the arrow. */
  inverse: boolean;
}
