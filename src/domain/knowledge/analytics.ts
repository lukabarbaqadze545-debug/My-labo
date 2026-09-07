import { connectedComponents, degree, isolatedNodes } from './engine';
import { findPrerequisiteGaps, type PrerequisiteGap } from './prerequisites';
import { WEAK_MASTERY } from './mastery';
import type { KnowledgeGraph, KnowledgeNode } from './types';

/**
 * Compact, deterministic graph statistics.
 *
 * Kept small on purpose. The useful question is "where is my knowledge thin?",
 * not "how many edges of each type exist" — a dashboard of every countable
 * number would bury the two or three findings that would actually change what
 * the user studies next.
 */

export interface GraphAnalytics {
  totalNodes: number;
  totalEdges: number;
  derivedEdges: number;
  manualEdges: number;
  manualNodes: number;
  /** Nodes with no connection at all. */
  isolated: KnowledgeNode[];
  /** Highest-degree nodes — the hubs the map is organised around. */
  mostConnected: { node: KnowledgeNode; degree: number }[];
  /** subjectId → how many nodes hang off it. */
  bySubject: { subjectId: string; title: string; count: number }[];
  gaps: PrerequisiteGap[];
  recentlyAdded: KnowledgeNode[];
  /** Started but weakly held. */
  weakMastery: KnowledgeNode[];
  /** Topics carrying no note, document or book — knowledge with no evidence. */
  unsupported: KnowledgeNode[];
  /** More than one means the map has disconnected islands. */
  components: number;
}

const SUPPORTING_TYPES = new Set(['document', 'note', 'book']);

export function analyseGraph(graph: KnowledgeGraph, limit = 5): GraphAnalytics {
  const subjectCounts = new Map<string, number>();
  for (const node of graph.nodes) {
    if (!node.subjectId) continue;
    subjectCounts.set(node.subjectId, (subjectCounts.get(node.subjectId) ?? 0) + 1);
  }

  const mostConnected = graph.nodes
    .map((node) => ({ node, degree: degree(graph, node.id) }))
    .filter((entry) => entry.degree > 0)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, limit);

  const bySubject = [...subjectCounts.entries()]
    .map(([subjectId, count]) => ({
      subjectId,
      title: graph.nodeById.get(`subject:${subjectId}`)?.title ?? subjectId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const recentlyAdded = graph.nodes
    .filter((node) => node.origin === 'manual')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);

  const weakMastery = graph.nodes
    .filter((node) => node.masteryLevel !== undefined && node.masteryLevel < WEAK_MASTERY)
    .sort((a, b) => (a.masteryLevel ?? 0) - (b.masteryLevel ?? 0))
    .slice(0, limit);

  // "No supporting material" only means something for things you could study.
  const unsupported = graph.nodes
    .filter((node) => node.type === 'topic' || node.type === 'concept')
    .filter((node) => {
      const linked = graph.incident.get(node.id) ?? [];
      return !linked.some((edge) => {
        const other = edge.sourceNodeId === node.id ? edge.targetNodeId : edge.sourceNodeId;
        return SUPPORTING_TYPES.has(graph.nodeById.get(other)?.type ?? '');
      });
    })
    .slice(0, limit);

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    derivedEdges: graph.edges.filter((e) => e.origin === 'derived').length,
    manualEdges: graph.edges.filter((e) => e.origin === 'manual').length,
    manualNodes: graph.nodes.filter((n) => n.origin === 'manual').length,
    isolated: isolatedNodes(graph).slice(0, limit),
    mostConnected,
    bySubject,
    gaps: findPrerequisiteGaps(graph).slice(0, limit),
    recentlyAdded,
    weakMastery,
    unsupported,
    components: connectedComponents(graph).length,
  };
}
