import type {
  ClarificationQuestion,
  ConversationState,
  IntentKind,
  NextAction,
} from './types';
import { labelForConcept, topicForConcept } from './retrieve';

/**
 * Stage 10 — conversation state.
 *
 * Bounded on purpose. The engine needs recent context, not a transcript: an
 * unbounded memory makes reference resolution *worse*, because a pronoun
 * starts competing with things said twenty turns ago.
 */

const MAX_TURNS = 12;
const MAX_ENTITIES = 8;
const MAX_SERVED = 60;
const MAX_CLARIFICATIONS = 10;
const MIN_DEPTH = -2;
const MAX_DEPTH = 3;

export function emptyConversationState(): ConversationState {
  return {
    turnIndex: 0,
    turns: [],
    recentEntities: [],
    examplesGiven: {},
    depth: 0,
    askedClarifications: [],
    servedKeys: [],
    recentOpeners: [],
    recentConnectives: [],
    consecutiveQuestions: 0,
  };
}

const MAX_RECENT = 6;

/** Action kinds whose reply ends in a question the user is meant to answer. */
const QUESTION_ACTIONS = new Set<NextAction['kind']>([
  'ask_socratic_question',
  'clarify',
  'quiz',
]);

export interface StateUpdate {
  userText: string;
  assistantText: string;
  intent: IntentKind;
  action: NextAction;
  concept?: string | undefined;
  servedKeys: readonly string[];
  clarification?: ClarificationQuestion | undefined;
  /** Set when a domain (subject) was introduced without naming one topic. */
  domainId?: string | undefined;
  /** The opening line or closing question actually used, if any. */
  openerUsed?: string | undefined;
  /** Connective surfaces actually used composing this reply. */
  connectivesUsed?: readonly string[];
  /** Overrides the question-action heuristic when a reply ends in a question. */
  endedInQuestion?: boolean;
}

function clampDepth(depth: number, action: NextAction['kind']): number {
  let next = depth;
  if (action === 'simplify') next -= 1;
  if (action === 'expand') next += 1;
  return Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, next));
}

export function updateConversationState(
  state: ConversationState,
  update: StateUpdate,
): ConversationState {
  const turnIndex = state.turnIndex + 1;
  const { concept, action } = update;

  // A different concept demotes the current one rather than erasing it — that
  // demoted value is what „წინა თემას დავუბრუნდეთ" reaches for.
  const switching = Boolean(concept && concept !== state.currentConcept);
  const previousConcept = switching ? state.currentConcept : state.previousConcept;
  const previousTopicId = switching ? state.currentTopicId : state.previousTopicId;

  const topic = concept ? topicForConcept(concept) : undefined;

  const recentEntities = concept
    ? [
        { concept, label: labelForConcept(concept), ...(topic ? { topicId: topic.id } : {}), lastSeen: turnIndex },
        ...state.recentEntities.filter((e) => e.concept !== concept),
      ].slice(0, MAX_ENTITIES)
    : state.recentEntities;

  const examplesGiven = { ...state.examplesGiven };
  if ((action.kind === 'give_example' || action.kind === 'give_another_example') && concept) {
    examplesGiven[concept] = (examplesGiven[concept] ?? 0) + 1;
  }
  // A new subject resets its own example counter only when we leave and return
  // much later; within a conversation the count is what makes „კიდევ" work.

  const turns = [
    ...state.turns,
    { role: 'user' as const, text: update.userText, intent: update.intent, ...(concept ? { concept } : {}) },
    { role: 'assistant' as const, text: update.assistantText, action: action.kind, ...(concept ? { concept } : {}) },
  ].slice(-MAX_TURNS);

  // A domain introduction sets the working subject without naming a topic —
  // that domain is what „შენ აირჩიე თემა" later resolves against.
  const domainFromTopic = topic?.subjectId;
  const nextDomain = domainFromTopic ?? update.domainId ?? state.currentDomain;

  const endedInQuestion = update.endedInQuestion ?? QUESTION_ACTIONS.has(action.kind);

  return {
    turnIndex,
    turns,
    ...(nextDomain ? { currentDomain: nextDomain } : {}),
    ...(concept ? { currentConcept: concept } : state.currentConcept ? { currentConcept: state.currentConcept } : {}),
    ...(topic ? { currentTopicId: topic.id } : state.currentTopicId && !switching ? { currentTopicId: state.currentTopicId } : {}),
    ...(previousConcept ? { previousConcept } : {}),
    ...(previousTopicId ? { previousTopicId } : {}),
    lastIntent: update.intent,
    lastAction: action.kind,
    recentEntities,
    examplesGiven,
    depth: clampDepth(state.depth, action.kind),
    askedClarifications: update.clarification
      ? [...state.askedClarifications, update.clarification.key].slice(-MAX_CLARIFICATIONS)
      : state.askedClarifications,
    ...(update.clarification ? { pendingClarification: update.clarification } : {}),
    servedKeys: [...state.servedKeys, ...update.servedKeys].slice(-MAX_SERVED),
    recentOpeners: update.openerUsed
      ? [update.openerUsed, ...state.recentOpeners].slice(0, MAX_RECENT)
      : state.recentOpeners,
    recentConnectives: update.connectivesUsed?.length
      ? [...update.connectivesUsed, ...state.recentConnectives].slice(0, MAX_RECENT)
      : state.recentConnectives,
    consecutiveQuestions: endedInQuestion ? state.consecutiveQuestions + 1 : 0,
  };
}

/**
 * Rebuild state by replaying a stored transcript. Only user turns carry
 * information the pipeline needs; assistant turns contribute their action and
 * concept, which are stored alongside the message.
 */
export interface StoredTurn {
  role: 'user' | 'assistant';
  text: string;
  concept?: string;
  action?: NextAction['kind'];
  intent?: IntentKind;
  servedKeys?: string[];
}
