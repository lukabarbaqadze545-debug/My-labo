import { library, type EntityKind, type GraphRef, type RelationKind, type Relationship } from '@/content';

/**
 * Knowledge graph traversal.
 *
 * Edges are authored one-way in relations.ts; here we build the bidirectional
 * adjacency so a topic page can show both "leads to" and "came from" without
 * the content author having to write every edge twice.
 */

export interface GraphEdge {
  to: string;
  kind: RelationKind;
  /** True when we are following the authored edge backwards. */
  inverse: boolean;
  note?: Relationship['note'];
}

export type Adjacency = Map<string, GraphEdge[]>;

export function buildAdjacency(relationships: readonly Relationship[] = library.relationships): Adjacency {
  const adjacency: Adjacency = new Map();
  const push = (from: string, edge: GraphEdge) => {
    const list = adjacency.get(from);
    if (list) list.push(edge);
    else adjacency.set(from, [edge]);
  };

  for (const rel of relationships) {
    push(rel.from, { to: rel.to, kind: rel.kind, inverse: false, ...(rel.note ? { note: rel.note } : {}) });
    push(rel.to, { to: rel.from, kind: rel.kind, inverse: true, ...(rel.note ? { note: rel.note } : {}) });
  }
  return adjacency;
}

const adjacencyCache: Adjacency = buildAdjacency();

/** Identify what kind of entity an id refers to, across the whole library. */
export function classifyId(id: string): EntityKind | undefined {
  if (library.topicById.has(id)) return 'topic';
  if (library.personById.has(id)) return 'person';
  if (library.formulaById.has(id)) return 'formula';
  if (library.factById.has(id)) return 'fact';
  if (library.eventById.has(id)) return 'event';
  if (library.subjectById.has(id)) return 'subject';
  return undefined;
}

export function neighbours(id: string, adjacency: Adjacency = adjacencyCache): GraphEdge[] {
  return adjacency.get(id) ?? [];
}

export interface RelatedNode extends GraphRef {
  edge: GraphEdge;
  /** Hops from the origin; 1 = directly connected. */
  distance: number;
}

/**
 * Breadth-first walk outward from a node. Depth 2 is the useful default for a
 * topic page: direct links plus "you might not realise these connect".
 */
export function explore(
  originId: string,
  { depth = 2, limit = 12, adjacency = adjacencyCache }: { depth?: number; limit?: number; adjacency?: Adjacency } = {},
): RelatedNode[] {
  const seen = new Set<string>([originId]);
  const out: RelatedNode[] = [];
  let frontier: { id: string; distance: number }[] = [{ id: originId, distance: 0 }];

  while (frontier.length > 0 && out.length < limit) {
    const next: { id: string; distance: number }[] = [];
    for (const node of frontier) {
      if (node.distance >= depth) continue;
      for (const edge of neighbours(node.id, adjacency)) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        const kind = classifyId(edge.to);
        if (!kind) continue;
        out.push({ id: edge.to, kind, edge, distance: node.distance + 1 });
        next.push({ id: edge.to, distance: node.distance + 1 });
        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }
    frontier = next;
  }

  // Closest first, then topics before other kinds — a topic is usually the more
  // interesting next click.
  const kindRank: Record<string, number> = { topic: 0, person: 1, event: 2, formula: 3, fact: 4, subject: 5 };
  return out.sort(
    (a, b) => a.distance - b.distance || (kindRank[a.kind] ?? 9) - (kindRank[b.kind] ?? 9),
  );
}

/** Shortest path between two nodes — used by the graph view to show a chain. */
export function findPath(fromId: string, toId: string, adjacency: Adjacency = adjacencyCache): string[] {
  if (fromId === toId) return [fromId];
  const previous = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of neighbours(current, adjacency)) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      previous.set(edge.to, current);
      if (edge.to === toId) {
        const path = [toId];
        let step = toId;
        while (previous.has(step)) {
          step = previous.get(step) as string;
          path.unshift(step);
        }
        return path;
      }
      queue.push(edge.to);
    }
  }
  return [];
}

export const RELATION_LABELS: Record<RelationKind, { forward: string; inverse: string }> = {
  leadsTo: { forward: 'მიგვიყვანს', inverse: 'გამომდინარეობს' },
  explains: { forward: 'ხსნის', inverse: 'აიხსნება' },
  requires: { forward: 'ეყრდნობა', inverse: 'საჭიროა' },
  contrasts: { forward: 'ეპასუხება', inverse: 'ეპასუხება' },
  discoveredBy: { forward: 'დაკავშირებულია', inverse: 'იკვლევდა' },
  appliesTo: { forward: 'გამოიყენება', inverse: 'იყენებს' },
  partOf: { forward: 'ნაწილია', inverse: 'მოიცავს' },
};
