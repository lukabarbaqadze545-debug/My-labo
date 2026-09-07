/**
 * Parallel Worlds — counterfactual reasoning as a first-class object.
 *
 * Pure domain logic only: lineage, consequence depth, the local causal map,
 * comparison and serialisation. No React, no storage, no model.
 */
export * from './types';
export {
  worldsById,
  lineageOf,
  childrenOf,
  descendantsOf,
  buildForest,
  commonAncestor,
  resolveWorld,
} from './lineage';
export {
  consequencesOf,
  byDepthThenOrder,
  byLevel,
  byKind,
  causalRoots,
  causalChildren,
  causalChains,
  wouldCycle,
  reasoningDepth,
  type CausalChain,
} from './consequences';
export {
  compareWorlds,
  type WorldComparison,
  type ComparedField,
  type ComparedConsequences,
} from './compare';
export {
  exportWorlds,
  parseWorldsImport,
  WORLDS_EXPORT_VERSION,
  type WorldsExport,
  type WorldsImportResult,
} from './serialize';
