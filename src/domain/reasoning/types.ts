import type { AnswerRef } from '../assistant';

/**
 * Types for the conversational reasoning engine.
 *
 * The engine's job is *not* to answer. It is to decide, on every turn, whether
 * answering is the most useful thing it can do — and when it is not, to pick
 * the single question that will move the user's own thinking furthest.
 *
 * Everything here is domain-independent. Domain knowledge (which terms are
 * load-bearing, which hidden premises a claim carries, which real distinctions
 * exist) arrives through a `DomainPack`, so the same engine can drive a
 * philosophy tutorial here and travel clarification in another product.
 */

/* ------------------------------- claims -------------------------------- */

export type ClaimType =
  | 'definition'
  | 'universal'
  | 'existential'
  | 'causal'
  | 'normative'
  | 'comparative'
  | 'conditional'
  | 'factual';

export type ClaimScope = 'universal' | 'particular' | 'hedged';
export type ClaimForce = 'strong' | 'moderate' | 'hedged';

export interface Claim {
  id: string;
  turnIndex: number;
  /** The user's sentence, verbatim. Questions quote this, never a reparse. */
  text: string;
  type: ClaimType;
  /** Best-effort subject phrase — used for matching, never shown raw. */
  subject: string;
  /** Best-effort predicate phrase — used for matching, never shown raw. */
  predicate: string;
  polarity: 'affirm' | 'deny';
  scope: ClaimScope;
  force: ClaimForce;
  /** Stemmed content words of the whole sentence. */
  terms: string[];
  /** Stemmed content words of the subject / predicate halves. */
  subjectTerms: string[];
  predicateTerms: string[];
  /** True once the user has defended, revised or exemplified it. */
  examined: boolean;
}

/* ----------------------------- assumptions ------------------------------ */

export type AssumptionStatus = 'inferred' | 'surfaced' | 'accepted' | 'rejected';

export interface Assumption {
  id: string;
  claimId: string;
  /** The hidden premise, stated plainly in Georgian. */
  text: string;
  /** Which schema produced it — dedupe + scoring key. */
  schema: string;
  /** 0..1: how much the claim collapses if this premise fails. */
  load: number;
  status: AssumptionStatus;
}

/* ------------------------------- terms ---------------------------------- */

export interface TermUsage {
  /** Stem used for matching. */
  stem: string;
  /** Surface form as the user last wrote it. */
  surface: string;
  /** How many turns have leaned on it. */
  uses: number;
  /** Definitions the user has offered. */
  senses: { turnIndex: number; text: string }[];
  /** True when the user has given the engine a working definition. */
  defined: boolean;
  /** Domain packs mark terms that arguments cannot proceed without. */
  loadBearing: boolean;
}

/* --------------------------- contradictions ----------------------------- */

export type ContradictionKind = 'negation' | 'scope' | 'definitional' | 'normative';

export interface Contradiction {
  id: string;
  kind: ContradictionKind;
  aClaimId: string;
  bClaimId: string;
  /** Plain-language statement of the tension. */
  note: string;
  /** 0..1 confidence that this really is a conflict. */
  strength: number;
  resolved: boolean;
}

/* -------------------------------- moves --------------------------------- */

export type MoveKind =
  | 'resolveContradiction'
  | 'surfaceAssumption'
  | 'defineTerm'
  | 'seekCounterexample'
  | 'probeConsequence'
  | 'askEvidence'
  | 'distinguishPosition'
  | 'applyToCase'
  | 'clarifyGoal'
  | 'synthesize'
  | 'answer';

export interface Move {
  kind: MoveKind;
  /** Claim / assumption / term / contradiction the move acts on. */
  targetId?: string;
  /** The question (or answer) text, in Georgian. */
  text: string;
  /** Why the engine picked this — surfaced in the reasoning panel. */
  rationale: string;
  score: number;
  /** Library references the move leaned on. Never invented. */
  sources: AnswerRef[];
  /** Stable identity for repetition prevention. */
  key: string;
}

/* ------------------------------- questions ------------------------------ */

export interface OpenQuestion {
  id: string;
  turnIndex: number;
  text: string;
  moveKind: MoveKind;
  targetId?: string;
  answered: boolean;
}

/* --------------------------------- state -------------------------------- */

export interface ReasoningState {
  packId: string;
  /** Number of user turns processed. */
  turnIndex: number;
  claims: Claim[];
  assumptions: Assumption[];
  terms: TermUsage[];
  contradictions: Contradiction[];
  openQuestions: OpenQuestion[];
  /** Move keys already used — a question is never asked twice. */
  askedKeys: string[];
  /** Verbatim questions asked, for near-duplicate detection. */
  askedTexts: string[];
  /** Stems the current line of inquiry is about. */
  focus: string[];
  /** Consecutive questions on the current focus. */
  depth: number;
  /** Consecutive engine turns that were questions rather than answers. */
  consecutiveQuestions: number;
  /** 0..1 rolling estimate of how much reasoning the user is contributing. */
  engagement: number;
  /** Rises when the user asks to just be told; forces an answer. */
  answerDebt: number;
}

/* ------------------------------ domain pack ----------------------------- */

export interface DomainConcept {
  /** Stems that signal this concept is in play. */
  cues: string[];
  /** Canonical label shown to the user. */
  label: string;
  /**
   * Real, library-backed positions this concept splits into. Used by
   * `distinguishPosition` — the highest-value move, because it turns a vague
   * dispute into a choice between named alternatives.
   */
  positions?: { label: string; gloss: string }[];
  /** Concrete case the library actually documents, for `applyToCase`. */
  testCase?: { label: string; prompt: string };
  /** Topic id in the content library, for grounding + sources. */
  topicId?: string;
}

export interface AssumptionSchema {
  id: string;
  /** Runs against every new claim. */
  when: (claim: Claim, state: ReasoningState) => boolean;
  /** Produces the hidden premise, or null to skip. */
  build: (claim: Claim) => { text: string; load: number } | null;
}

/**
 * A parameter the system needs before an answer can be useful. Philosophy has
 * none; a travel planner has several ("leaving from where?", "how long?").
 * Same engine, same scoring — this is the seam that makes the decision layer
 * reusable outside a tutoring context.
 */
export interface GoalSlot {
  id: string;
  /** Asked when the slot is still empty. */
  question: string;
  /** Stems whose appearance means the user has supplied this already. */
  filledBy: string[];
  /** Higher is asked earlier. */
  priority: number;
}

export interface DomainPack {
  id: string;
  label: string;
  /** Stems that route a conversation to this pack. */
  cues: string[];
  concepts: DomainConcept[];
  assumptionSchemas: AssumptionSchema[];
  /** Terms an argument in this domain cannot proceed without defining. */
  loadBearingTerms: string[];
  /**
   * Cues that mark a *question* as contested rather than factual. A contested
   * question is answered with a question; a factual one is simply answered.
   */
  contestedCues: string[];
  /** Missing parameters to clarify before answering. Optional. */
  goalSlots?: GoalSlot[];
}

/* ------------------------------- outcome -------------------------------- */

export interface RespondOptions {
  pack: DomainPack;
  /** Grounded answer generator — the engine never writes facts itself. */
  answerFor: (query: string) => { text: string; sources: AnswerRef[]; related: AnswerRef[]; followUps: string[] };
  /** Maximum consecutive questions on one focus before the engine must give. */
  maxDepth?: number;
}

export interface Outcome {
  move: Move;
  /** All candidates with their scores — the reasoning panel shows the runner-ups. */
  considered: Move[];
  state: ReasoningState;
  /** True when the engine chose to withhold the answer and ask instead. */
  asked: boolean;
}
