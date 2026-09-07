/**
 * The knowledge graph.
 *
 * Layering, outermost last:
 *
 *   normalize  existing Labo data → nodes and derived edges
 *   engine     neighbours, traversal, paths, components, filtering
 *   prerequisites / analytics   deterministic readings of the graph
 *   evidence   a compact neighbourhood for the reasoning layer
 *
 * No React anywhere. The UI composes these; it never walks an edge itself.
 */
export * from './types';
export * from './labels';
export { buildKnowledgeGraph, nodeId, sourceIdOf, type NormalizeInput } from './normalize';
export { estimateMastery, WEAK_MASTERY, type MasteryInput } from './mastery';
export {
  incidentEdges,
  incoming,
  outgoing,
  neighbours,
  neighbourhood,
  degree,
  shortestPaths,
  connectedComponents,
  isolatedNodes,
  filterGraph,
  subgraph,
  type GraphFilter,
  type GraphPath,
} from './engine';
export {
  prerequisitesOf,
  dependentsOf,
  findPrerequisiteGaps,
  learningPath,
  type PrerequisiteGap,
} from './prerequisites';
export { analyseGraph, type GraphAnalytics } from './analytics';
export { graphContext, entityOf, type GraphContext, type GraphContextSource } from './evidence';
export {
  exportGraphData,
  parseGraphImport,
  GRAPH_EXPORT_VERSION,
  type GraphExport,
  type GraphImportResult,
} from './serialize';
