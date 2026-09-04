/**
 * The conversational core's vocabulary.
 *
 * These types are deliberately free of anything Labo-specific: no topic
 * schema, no subject list, no philosophy. A knowledge candidate is an id, a
 * label and a score; where it came from is the retriever's business. That is
 * what lets the same pipeline drive a tutor here and a trip planner later.
 */

/* ------------------------------ normalization --------------------------- */

export interface NormalizedMessage {
  /** Exactly what the user typed. */
  raw: string;
  /** NFC, lowercased, punctuation-normalised, typos repaired. */
  text: string;
  /** Whitespace tokens of `text`. */
  tokens: string[];
  /** Morphologically reduced tokens, stop-words removed. */
  stems: string[];
  /** Content stems only — what the message is *about*. */
  contentStems: string[];
  script: 'ka' | 'en' | 'mixed';
  isQuestion: boolean;
  /** True when the message carries no subject of its own. */
  isBareFollowUp: boolean;
  /** Repairs applied, for the inspector. */
  repairs: { from: string; to: string }[];
}

/* --------------------------------- intent ------------------------------- */

export type IntentKind =
  | 'explain'
  | 'simplify'
  | 'expand'
  | 'example'
  | 'another_example'
  | 'why'
  | 'how'
  | 'when_to_use'
  | 'limitations'
  | 'compare'
  | 'define'
  | 'summarize'
  | 'continue'
  | 'go_back'
  | 'correction'
  | 'counterargument'
  | 'argue_for'
  | 'state_position'
  | 'agree'
  | 'disagree'
  | 'quiz'
  | 'greeting'
  | 'thanks'
  | 'meta'
  | 'stop'
  | 'opinion'
  | 'defer_choice'
  | 'unknown';

export interface IntentCandidate {
  kind: IntentKind;
  score: number;
  /** What matched, for the inspector. */
  evidence: string[];
}

/* -------------------------------- entities ------------------------------ */

export interface EntityRef {
  /** Concept key; equals a topic id when the library covers it. */
  concept: string;
  label: string;
  /** Library topic, absent when the concept is recognised but uncovered. */
  topicId?: string;
  /** Turn index at which this entity was last in play. */
  lastSeen: number;
}

/** Which understanding layer produced a candidate. Ordered best to worst. */
export type MatchLayer =
  | 'exact'
  | 'alias'
  | 'phrase'
  | 'token'
  | 'fuzzy'
  | 'related'
  | 'context'
  | 'none';

export interface KnowledgeCandidate {
  concept: string;
  label: string;
  topicId?: string;
  score: number;
  layer: MatchLayer;
  /** Fraction of the message's content stems this candidate accounts for. */
  coverage: number;
  evidence: string[];
}

/* ------------------------------- references ----------------------------- */

export interface ReferenceResolution {
  /** The pronoun or deictic that needed resolving. */
  surface: string;
  /** What it was resolved to, if anything. */
  concept?: string;
  label?: string;
  confidence: number;
  /** Competing readings, when the reference is ambiguous. */
  alternatives: { concept: string; label: string }[];
}

/* ------------------------------- confidence ----------------------------- */

/**
 * Separate signals, never collapsed into one number before the decision is
 * made. The whole point is that "I could not read your words" and "I have no
 * material on this" are different outcomes with different replies.
 */
export interface ConfidenceBreakdown {
  /** Did we parse the message at all? */
  language: number;
  /** Do we know what is being asked for? */
  intent: number;
  /** Do we know what it is about? */
  topic: number;
  /** Did retrieval find something solid? */
  retrieval: number;
  /** Could conversation state supply what the message left out? */
  context: number;
  /** Does the library actually hold material for this? */
  knowledge: number;
}

export type UnderstandingVerdict =
  | 'answer'
  | 'continue_from_context'
  | 'partial'
  | 'need_clarification'
  | 'known_but_missing'
  | 'unparsed';

/* --------------------------------- actions ------------------------------ */

export type NextActionKind =
  | 'answer'
  | 'explain'
  | 'explain_why'
  | 'simplify'
  | 'expand'
  | 'give_example'
  | 'give_another_example'
  | 'compare'
  | 'define_term'
  | 'when_to_use'
  | 'limitations'
  | 'summarize'
  | 'clarify'
  | 'ask_socratic_question'
  | 'challenge_assumption'
  | 'give_counterargument'
  | 'give_supporting_argument'
  | 'switch_topic'
  | 'switch_domain'
  | 'acknowledge_correction'
  | 'admit_missing_knowledge'
  | 'admit_not_understood'
  | 'smalltalk'
  | 'quiz'
  | 'answer_from_book'
  | 'compare_books'
  | 'domain_intro'
  | 'state_opinion';

export interface NextAction {
  kind: NextActionKind;
  /** Concept the action operates on. */
  concept?: string;
  topicId?: string;
  /** Why this action, in plain language. */
  rationale: string;
  score: number;
}

export interface ClarificationQuestion {
  text: string;
  options: { label: string; concept: string }[];
  /** Stable key so the same clarification is not asked twice. */
  key: string;
}

/* ---------------------------------- state ------------------------------- */

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  intent?: IntentKind;
  action?: NextActionKind;
  concept?: string;
}

export interface ConversationState {
  turnIndex: number;
  /** Bounded recent history. */
  turns: ConversationTurn[];
  currentDomain?: string;
  currentConcept?: string;
  currentTopicId?: string;
  previousConcept?: string;
  previousTopicId?: string;
  lastIntent?: IntentKind;
  lastAction?: NextActionKind;
  /** Bounded, most-recent-first. */
  recentEntities: EntityRef[];
  /** How many examples of each concept have been given, for „კიდევ ერთი". */
  examplesGiven: Record<string, number>;
  /** Explanation level: 0 default, negative simpler, positive deeper. */
  depth: number;
  /** Clarification keys already used. */
  askedClarifications: string[];
  /** Set while waiting for an answer to a clarification. */
  pendingClarification?: ClarificationQuestion;
  /** Response keys already emitted, to avoid repeating the same paragraph. */
  servedKeys: string[];
  /**
   * Bounded, most-recent-first. Opening lines and closing questions are
   * checked against this before being reused, which is what keeps three
   * greetings in a row from reading identically.
   */
  recentOpeners: string[];
  /** Connective surfaces used recently, fed back into the language layer. */
  recentConnectives: string[];
  /**
   * How many assistant turns in a row ended in a question. Gates the
   * automatic Socratic nudge on a stated position: the first strong claim in
   * a conversation earns a thoughtful question, a third in a row does not.
   */
  consecutiveQuestions: number;
}

/* --------------------------------- result ------------------------------- */

export interface PipelineTrace {
  raw: string;
  normalized: NormalizedMessage;
  intents: IntentCandidate[];
  candidates: KnowledgeCandidate[];
  reference?: ReferenceResolution;
  layerUsed: MatchLayer;
  confidence: ConfidenceBreakdown;
  verdict: UnderstandingVerdict;
  action: NextAction;
  /** Populated when the engine declined to answer. */
  unknownReason?: string;
  /** Stage-by-stage timing, milliseconds. */
  timings: Record<string, number>;
  /**
   * Present when imported books took part. This is the anti-hallucination
   * surface: it shows exactly which passages, pages and scores produced the
   * answer, so a wrong citation is traceable rather than mysterious.
   */
  books?: {
    mode: string;
    searched: string[];
    hits: { book: string; pages: string; score: number; chunkId: string }[];
    knowledgeUsed: { type: string; pages: string; confidence: string; book: string }[];
    citations: number;
  };
}

export interface ConversationReply {
  text: string;
  /** Links into the library backing the reply. Empty when none was used. */
  sources: { label: string; href: string }[];
  related: { label: string; href: string }[];
  suggestions: string[];
  action: NextActionKind;
  verdict: UnderstandingVerdict;
}

export interface ConversationResult {
  reply: ConversationReply;
  state: ConversationState;
  trace: PipelineTrace;
}
