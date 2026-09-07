import { chunkTerms } from '@/domain/books';
import { incidentEdges, neighbourhood } from './engine';
import { RELATION_LABEL } from './labels';
import { sourceIdOf } from './normalize';
import type { KnowledgeGraph, KnowledgeNode, KnowledgeNodeType } from './types';

/**
 * Graph → reasoning context.
 *
 * This is where the knowledge graph meets the LLM layer, and the distinction it
 * enforces is the important part:
 *
 *   STRUCTURAL CONTEXT   "A depends on B", "C is part of D". Useful for
 *                        reasoning about *organisation*. It is never evidence
 *                        for a factual claim, so it is rendered separately and
 *                        deliberately kept out of the `Evidence` array that
 *                        claim validation scores against.
 *
 *   CONTENT SOURCES      the topics, documents and notes those nodes point at.
 *                        These are real material and are handed to the existing
 *                        retrieval/grounding path unchanged.
 *
 * An edge saying "Dijkstra depends on Graph Theory" does not license any claim
 * about what Dijkstra *is*. Treating it as evidence would let the graph launder
 * assertions past the validator, which is exactly what must not happen.
 *
 * The whole graph is never sent. A compact neighbourhood around the nodes the
 * query actually matched is selected here, deterministically.
 */

/** Types whose stored content can serve as real evidence. */
const CONTENT_TYPES: ReadonlySet<KnowledgeNodeType> = new Set<KnowledgeNodeType>([
  'topic',
  'document',
  'note',
  'book',
]);

export interface GraphContextOptions {
  /** How many matched roots to expand from. */
  roots?: number;
  depth?: number;
  /** Hard cap on neighbourhood size — the context budget's share for structure. */
  limit?: number;
  /** Maximum relationship lines rendered. */
  maxLines?: number;
}

export interface GraphContextSource {
  nodeId: string;
  type: KnowledgeNodeType;
  /** The Labo entity id, ready for the content retriever. */
  sourceEntityId: string;
  title: string;
}

export interface GraphContext {
  /** Nodes the query matched directly. */
  matched: KnowledgeNode[];
  /** The selected neighbourhood, matched roots included. */
  nodeIds: string[];
  /**
   * Rendered relationships, for the prompt's structure block. Prompt-only:
   * this must not be turned into `Evidence`.
   */
  structure: string;
  /** Underlying material, for the existing grounding path. */
  sources: GraphContextSource[];
}

const EMPTY: GraphContext = { matched: [], nodeIds: [], structure: '', sources: [] };

/** Deterministic lexical match of a query against node titles and tags. */
function matchNodes(graph: KnowledgeGraph, query: string, limit: number): KnowledgeNode[] {
  const terms = new Set(chunkTerms(query));
  if (terms.size === 0) return [];

  const scored: { node: KnowledgeNode; score: number }[] = [];
  for (const node of graph.nodes) {
    const haystack = chunkTerms(`${node.title} ${node.tags.join(' ')}`);
    if (haystack.length === 0) continue;
    const matches = new Set(haystack.filter((term) => terms.has(term)));
    if (matches.size === 0) continue;
    // Coverage of the node's own title, so a short precise title outranks a
    // long one that happens to contain the word.
    scored.push({ node, score: matches.size / new Set(haystack).size });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.node);
}

export function graphContext(
  graph: KnowledgeGraph,
  query: string,
  options: GraphContextOptions = {},
): GraphContext {
  const matched = matchNodes(graph, query, options.roots ?? 3);
  if (matched.length === 0) return EMPTY;

  const ids = neighbourhood(
    graph,
    matched.map((node) => node.id),
    { depth: options.depth ?? 1, limit: options.limit ?? 14 },
  );

  const lines: string[] = [];
  const maxLines = options.maxLines ?? 12;
  const seen = new Set<string>();

  for (const rootId of matched.map((n) => n.id)) {
    for (const { edge, otherId, inverse } of incidentEdges(graph, rootId)) {
      if (lines.length >= maxLines || !ids.has(otherId) || seen.has(edge.id)) continue;
      seen.add(edge.id);
      const from = graph.nodeById.get(edge.sourceNodeId);
      const to = graph.nodeById.get(edge.targetNodeId);
      if (!from || !to) continue;
      // Always rendered source → target, so the arrow's meaning survives even
      // when the walk reached it backwards.
      void inverse;
      lines.push(`„${from.title}" ${RELATION_LABEL[edge.relationType]} „${to.title}"`);
    }
  }

  const sources: GraphContextSource[] = [];
  for (const id of ids) {
    const node = graph.nodeById.get(id);
    if (!node || !CONTENT_TYPES.has(node.type) || !node.sourceEntityId) continue;
    sources.push({
      nodeId: node.id,
      type: node.type,
      sourceEntityId: node.sourceEntityId,
      title: node.title,
    });
  }

  return {
    matched,
    nodeIds: [...ids],
    structure: lines.join('\n'),
    sources,
  };
}

/** Resolve a node id back to its Labo entity, for callers holding only an id. */
export function entityOf(id: string): { type: KnowledgeNodeType; sourceId: string } | null {
  return sourceIdOf(id);
}
