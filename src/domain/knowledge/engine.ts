import type { IncidentEdge, KnowledgeEdge, KnowledgeGraph, KnowledgeNode, KnowledgeNodeType, RelationType } from './types';

/**
 * The graph engine.
 *
 * Every function here is pure and takes a `KnowledgeGraph`, so nothing in the
 * UI ever has to walk edges itself. Traversal treats the graph as *undirected*
 * for reachability — "how are these two things connected?" does not care which
 * way an arrow points — while every returned edge keeps its real direction so
 * the answer can still be read correctly.
 */

/* ------------------------------ neighbours ------------------------------- */

export function incidentEdges(graph: KnowledgeGraph, id: string): IncidentEdge[] {
  return (graph.incident.get(id) ?? []).map((edge) => ({
    edge,
    otherId: edge.sourceNodeId === id ? edge.targetNodeId : edge.sourceNodeId,
    inverse: edge.targetNodeId === id,
  }));
}

/** Edges pointing away from this node. */
export function outgoing(graph: KnowledgeGraph, id: string): KnowledgeEdge[] {
  return (graph.incident.get(id) ?? []).filter((e) => e.sourceNodeId === id);
}

/** Edges pointing at this node. */
export function incoming(graph: KnowledgeGraph, id: string): KnowledgeEdge[] {
  return (graph.incident.get(id) ?? []).filter((e) => e.targetNodeId === id);
}

export function neighbours(graph: KnowledgeGraph, id: string): KnowledgeNode[] {
  const out: KnowledgeNode[] = [];
  const seen = new Set<string>();
  for (const { otherId } of incidentEdges(graph, id)) {
    if (seen.has(otherId)) continue;
    seen.add(otherId);
    const node = graph.nodeById.get(otherId);
    if (node) out.push(node);
  }
  return out;
}

export function degree(graph: KnowledgeGraph, id: string): number {
  return (graph.incident.get(id) ?? []).length;
}

/* ------------------------------- traversal ------------------------------- */

/**
 * Breadth-first neighbourhood around one or more roots.
 *
 * `limit` stops the walk rather than truncating afterwards, which matters on a
 * hub node: expanding "Mathematics" would otherwise pull in a third of the
 * graph before anything got a chance to cap it.
 */
export function neighbourhood(
  graph: KnowledgeGraph,
  roots: readonly string[],
  { depth = 1, limit = 60 }: { depth?: number; limit?: number } = {},
): Set<string> {
  const seen = new Set<string>(roots.filter((id) => graph.nodeById.has(id)));
  let frontier = [...seen];

  for (let step = 0; step < depth && frontier.length > 0 && seen.size < limit; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const { otherId } of incidentEdges(graph, id)) {
        if (seen.has(otherId) || seen.size >= limit) continue;
        seen.add(otherId);
        next.push(otherId);
      }
      if (seen.size >= limit) break;
    }
    frontier = next;
  }
  return seen;
}

/* ------------------------------ path finding ----------------------------- */

export interface GraphPath {
  /** Node ids from start to end, inclusive. */
  nodes: string[];
  /** The edge traversed at each hop; `edges[i]` joins `nodes[i]` to `nodes[i+1]`. */
  edges: KnowledgeEdge[];
}

/**
 * All shortest paths between two nodes, capped.
 *
 * Plain BFS gives one path; a knowledge map is more useful when it can show
 * that two ideas are connected *both* through a subject and through a shared
 * prerequisite. So BFS records every predecessor at the shortest distance and
 * the paths are reconstructed from that layer graph.
 *
 * Cycles are handled by the distance map: a node is only ever expanded from
 * the layer above it, so a loop can never re-enter a completed layer and the
 * reconstruction always terminates.
 */
export function shortestPaths(
  graph: KnowledgeGraph,
  fromId: string,
  toId: string,
  { maxPaths = 3, maxDepth = 8 }: { maxPaths?: number; maxDepth?: number } = {},
): GraphPath[] {
  if (!graph.nodeById.has(fromId) || !graph.nodeById.has(toId)) return [];
  if (fromId === toId) return [{ nodes: [fromId], edges: [] }];

  const distance = new Map<string, number>([[fromId, 0]]);
  /** node → the edges that first reached it at its shortest distance. */
  const backlinks = new Map<string, { from: string; edge: KnowledgeEdge }[]>();
  let frontier = [fromId];
  let found = false;

  for (let depth = 0; depth < maxDepth && frontier.length > 0 && !found; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const { edge, otherId } of incidentEdges(graph, id)) {
        const known = distance.get(otherId);
        if (known === undefined) {
          distance.set(otherId, depth + 1);
          backlinks.set(otherId, [{ from: id, edge }]);
          next.push(otherId);
          if (otherId === toId) found = true;
        } else if (known === depth + 1) {
          // Another equally short way in — keep it, that is the whole point.
          backlinks.get(otherId)?.push({ from: id, edge });
        }
      }
    }
    frontier = next;
  }

  if (!distance.has(toId)) return [];

  const paths: GraphPath[] = [];
  const walk = (id: string, nodes: string[], edges: KnowledgeEdge[]) => {
    if (paths.length >= maxPaths) return;
    if (id === fromId) {
      paths.push({ nodes: [id, ...nodes], edges: [...edges] });
      return;
    }
    for (const link of backlinks.get(id) ?? []) {
      walk(link.from, [id, ...nodes], [link.edge, ...edges]);
      if (paths.length >= maxPaths) return;
    }
  };
  walk(toId, [], []);

  return paths;
}

/* --------------------------- connected components ------------------------ */

/** Every maximal set of mutually reachable nodes, largest first. */
export function connectedComponents(graph: KnowledgeGraph): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];

  for (const node of graph.nodes) {
    if (seen.has(node.id)) continue;
    const component: string[] = [];
    const queue = [node.id];
    seen.add(node.id);
    while (queue.length > 0) {
      const id = queue.shift()!;
      component.push(id);
      for (const { otherId } of incidentEdges(graph, id)) {
        if (seen.has(otherId)) continue;
        seen.add(otherId);
        queue.push(otherId);
      }
    }
    components.push(component);
  }

  return components.sort((a, b) => b.length - a.length);
}

export function isolatedNodes(graph: KnowledgeGraph): KnowledgeNode[] {
  return graph.nodes.filter((node) => degree(graph, node.id) === 0);
}

/* -------------------------------- filtering ------------------------------ */

export interface GraphFilter {
  types?: readonly KnowledgeNodeType[];
  subjectIds?: readonly string[];
  tags?: readonly string[];
  relationTypes?: readonly RelationType[];
  origin?: 'derived' | 'manual';
  /** Case-insensitive match against title and description. */
  search?: string;
  /** Keep only this neighbourhood, after the other filters. */
  focus?: { rootIds: readonly string[]; depth: number; limit?: number };
}

/**
 * Narrow the graph. Node filters run first and edges follow their endpoints,
 * so a filtered graph is always internally consistent and every engine
 * function works on it unchanged.
 */
export function filterGraph(graph: KnowledgeGraph, filter: GraphFilter): KnowledgeGraph {
  const types = filter.types ? new Set(filter.types) : null;
  const subjects = filter.subjectIds?.length ? new Set(filter.subjectIds) : null;
  const tags = filter.tags?.length ? new Set(filter.tags) : null;
  const needle = filter.search?.trim().toLowerCase();

  let kept = graph.nodes.filter((node) => {
    if (types && !types.has(node.type)) return false;
    if (subjects && !(node.subjectId && subjects.has(node.subjectId))) return false;
    if (tags && !node.tags.some((tag) => tags.has(tag))) return false;
    if (filter.origin && node.origin !== filter.origin) return false;
    if (needle) {
      const hay = `${node.title} ${node.description ?? ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  let allowed = new Set(kept.map((node) => node.id));

  if (filter.focus && filter.focus.rootIds.length > 0) {
    // The focus walk runs on the *filtered* graph, so "only this subject" plus
    // "only neighbours of X" compose the way the toolbar implies they do.
    const scoped = subgraph(graph, allowed);
    const near = neighbourhood(scoped, filter.focus.rootIds, {
      depth: filter.focus.depth,
      ...(filter.focus.limit ? { limit: filter.focus.limit } : {}),
    });
    allowed = near;
    kept = kept.filter((node) => near.has(node.id));
  }

  return subgraph(graph, allowed, kept);
}

/** Restrict a graph to a set of node ids, keeping only edges fully inside it. */
export function subgraph(
  graph: KnowledgeGraph,
  ids: ReadonlySet<string>,
  nodes?: KnowledgeNode[],
): KnowledgeGraph {
  const keptNodes = nodes ?? graph.nodes.filter((node) => ids.has(node.id));
  const edges = graph.edges.filter((e) => ids.has(e.sourceNodeId) && ids.has(e.targetNodeId));

  const nodeById = new Map(keptNodes.map((node) => [node.id, node]));
  const incident = new Map<string, KnowledgeEdge[]>();
  const push = (id: string, edge: KnowledgeEdge) => {
    const list = incident.get(id);
    if (list) list.push(edge);
    else incident.set(id, [edge]);
  };
  for (const edge of edges) {
    push(edge.sourceNodeId, edge);
    push(edge.targetNodeId, edge);
  }

  return { nodes: keptNodes, edges, nodeById, incident };
}
