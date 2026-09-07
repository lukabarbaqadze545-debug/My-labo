/**
 * The reasoning layer.
 *
 * Retrieval, provenance and fallback stay deterministic; understanding,
 * inference, argument and phrasing are the model's. `reason()` is the only
 * entry point the UI needs.
 */
export * from './types';
export { anthropicProvider, isAbort, type LlmProvider, type LlmRequest } from './provider';
export { buildContext, summariseHistory, type ContextInput } from './context';
export { buildSystemPrompt, META_OPEN, META_CLOSE } from './prompt';
export { parseEnvelope, visibleText } from './envelope';
export { validateClaims, usedEvidence, type ValidationResult } from './grounding';
export { reason, type ReasonInput } from './orchestrate';
