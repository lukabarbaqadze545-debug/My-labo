/**
 * The reasoning layer's vocabulary.
 *
 * Nothing here mentions philosophy, mathematics or any other subject. Evidence
 * is an id, a title, some text and an optional citation; where it came from is
 * the retriever's business. That is what lets the same orchestration drive a
 * philosophy discussion, a binary-search explanation and whatever subject is
 * added next without touching the core.
 */

import type { ConversationState, PipelineTrace } from '@/domain/conversation';

/* --------------------------------- modes -------------------------------- */

/**
 * How the assistant is allowed to answer.
 *
 *  strict_labo — deterministic pipeline only. No model, no network.
 *  labo_llm    — the model reasons, but *only* over retrieved Labo knowledge.
 *  free_ai     — the model may also use what it knows outside the library.
 *
 * `labo_llm` is the main mode. `strict_labo` is the floor everything falls
 * back to, which is why it must stay good on its own.
 */
export const REASONING_MODES = ['strict_labo', 'labo_llm', 'free_ai'] as const;
export type ReasoningMode = (typeof REASONING_MODES)[number];

/** True when the mode forbids stating anything the evidence does not carry. */
export function isGroundedMode(mode: ReasoningMode): boolean {
  return mode === 'labo_llm';
}

/* -------------------------------- evidence ------------------------------- */

export type EvidenceKind = 'topic' | 'book' | 'book_knowledge' | 'memory' | 'taught';

/**
 * One retrieved unit handed to the model.
 *
 * `id` is what the model cites ("E3"), which is what makes validation possible
 * afterwards: a claim that cites nothing, or cites evidence whose words it does
 * not share, is a claim the retrieval did not support.
 */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  title: string;
  text: string;
  /** Where the user can go to check it. */
  ref?: { label: string; href: string };
  /** Book provenance, when this came from an imported book. */
  pages?: { bookTitle: string; chapter?: string; pageStart: number; pageEnd: number };
  /** Extraction confidence, for book material. */
  confidence?: 'high' | 'medium' | 'low';
}

/**
 * What the model is given for one turn: the evidence, a compacted history and
 * the durable notes about the user. Deliberately small — the whole point of
 * retrieval is that the library never enters the prompt wholesale.
 */
export interface ReasoningContext {
  evidence: Evidence[];
  /** Structured summary of turns too old to send verbatim. */
  summary: string;
  /**
   * Knowledge-graph relationships around the matched nodes.
   *
   * Deliberately *not* part of `evidence`: an edge saying "A depends on B" is
   * organisational context, not a source, and must never be able to ground a
   * factual claim. Claim validation only ever sees `evidence`.
   */
  structure: string;
  /** Recent turns, verbatim. */
  recentTurns: { role: 'user' | 'assistant'; content: string }[];
  memories: string[];
  /** Characters of evidence text actually spent. */
  charsUsed: number;
  /** True when retrieval ran but found nothing in scope. */
  searchedButEmpty: boolean;
}

/* --------------------------------- claims -------------------------------- */

/**
 * What a sentence in the answer *is*.
 *
 *  grounded    — the evidence says it
 *  inferred    — the model derived it from the evidence
 *  uncertain   — the model flagged it as a guess
 *  unsupported — validation could not tie it to any cited evidence
 *
 * The distinction is the difference between a reasoning system and a system
 * that sounds confident. Only the validator may assign `unsupported`.
 */
export type ClaimStatus = 'grounded' | 'inferred' | 'uncertain' | 'unsupported';

export interface ReasonedClaim {
  text: string;
  status: ClaimStatus;
  /** Evidence ids the model cited for this claim. */
  evidenceIds: string[];
  /** Term overlap with the cited evidence, 0..1. Diagnostic only. */
  support: number;
}

/** The structured metadata the model is asked to emit after its prose. */
export interface ReasoningEnvelope {
  prose: string;
  claims: { text: string; status: Exclude<ClaimStatus, 'unsupported'>; evidenceIds: string[] }[];
  followUp?: string;
  /** The model's own confidence, 0..1. */
  confidence?: number;
  /** False when no metadata block was found and the prose stands alone. */
  structured: boolean;
}

/* --------------------------------- result -------------------------------- */

export type FallbackReason =
  | 'no_provider'
  | 'provider_error'
  | 'aborted'
  | 'empty_response'
  | 'strict_mode';

export interface ReasoningResult {
  text: string;
  mode: ReasoningMode;
  claims: ReasonedClaim[];
  sources: { label: string; href: string }[];
  /** Neighbouring material worth offering next. */
  related: { label: string; href: string }[];
  /** Book citations referenced by the answer, in citation order. */
  citations: string[];
  suggestions: string[];
  /** True when every factual claim tied back to evidence. */
  grounded: boolean;
  /** Set when the deterministic engine produced this text instead. */
  fellBack: boolean;
  fallbackReason?: FallbackReason;
  state: ConversationState;
  trace: ReasoningTrace;
}

/**
 * The inspector surface. Everything needed to answer "why did it say that?"
 * without re-running anything.
 */
export interface ReasoningTrace {
  mode: ReasoningMode;
  /** The deterministic pipeline's own reading of the turn. */
  pipeline: PipelineTrace;
  evidence: { id: string; kind: EvidenceKind; title: string; chars: number }[];
  charsUsed: number;
  summaryUsed: boolean;
  historyTurns: number;
  structured: boolean;
  claims: ReasonedClaim[];
  unsupported: number;
  modelMs?: number;
  fallbackReason?: FallbackReason;
}
