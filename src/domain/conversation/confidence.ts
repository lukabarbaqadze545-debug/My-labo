import type {
  ConfidenceBreakdown,
  ConversationState,
  IntentCandidate,
  IntentKind,
  KnowledgeCandidate,
  MatchLayer,
  NormalizedMessage,
  ReferenceResolution,
  UnderstandingVerdict,
} from './types';
import { isKnownButUncovered, topicForConcept } from './retrieve';
import { knowledgeForTopic } from '@/content/knowledge';
import { philosophyById } from '@/content/philosophy';

/**
 * Stage 8 — confidence, kept as separate signals.
 *
 * A single number cannot express the difference between "I could not read
 * your words" and "I read them perfectly and have nothing on the subject".
 * Those two need opposite responses: one is a clarification, the other is an
 * honest admission. So the signals stay apart until the verdict is taken.
 */

/** How much a retrieval layer is worth believing. */
const LAYER_TRUST: Record<MatchLayer, number> = {
  exact: 1,
  alias: 0.92,
  phrase: 0.95,
  token: 0.78,
  fuzzy: 0.5,
  related: 0.35,
  context: 0.7,
  none: 0,
};

export function assessConfidence(
  message: NormalizedMessage,
  intents: readonly IntentCandidate[],
  candidates: readonly KnowledgeCandidate[],
  layer: MatchLayer,
  reference: ReferenceResolution | null,
  state: ConversationState,
  resolvedConcept: string | undefined,
): ConfidenceBreakdown {
  const best = candidates[0];

  /* --- language: could we read the message at all? ---------------------- */
  let languageScore = 1;
  if (message.repairs.length > 0) languageScore -= 0.1 * message.repairs.length;
  if (message.contentStems.length > 0 && layer === 'none') {
    // We saw real words and recognised none of them.
    languageScore = Math.min(languageScore, 0.35);
  }
  if (message.isBareFollowUp) {
    // Nothing to misread — but a bare message with no signal and no pronoun is
    // genuinely opaque.
    const hasHandle = intents.some((i) => i.kind !== 'unknown') || reference !== null;
    languageScore = hasHandle ? 1 : 0.4;
  }
  const language = Math.max(0, Math.min(1, languageScore));

  /* --- intent: do we know what is being asked for? ---------------------- */
  const topIntentScore = intents[0]?.score ?? 0;
  const intent =
    intents[0]?.kind === 'unknown' ? 0.2 : Math.max(0, Math.min(1, topIntentScore / 5));

  /* --- topic: do we know what it is about? ------------------------------ */
  let topic = 0;
  if (best) topic = Math.min(1, (best.coverage * 0.5 + LAYER_TRUST[best.layer] * 0.5));
  if (!best && resolvedConcept) topic = reference ? reference.confidence * 0.9 : 0.7;

  /* --- retrieval: how solid was the match itself? ----------------------- */
  const retrieval = best ? Math.min(1, LAYER_TRUST[best.layer] * Math.min(1, best.score / 18)) : 0;

  /* --- context: could state supply what the message left out? ----------- */
  let context = 0;
  if (state.currentConcept) context += 0.55;
  if (state.turns.length >= 2) context += 0.15;
  if (reference?.concept) context += reference.confidence * 0.3;
  if (message.isBareFollowUp && state.currentConcept) context += 0.2;
  context = Math.max(0, Math.min(1, context));

  /* --- knowledge: do we actually hold material? ------------------------- */
  let knowledge = 0;
  if (resolvedConcept) {
    if (isKnownButUncovered(resolvedConcept)) knowledge = 0;
    else {
      const topicEntity = topicForConcept(resolvedConcept);
      if (topicEntity) {
        knowledge = 0.7;
        if (knowledgeForTopic(topicEntity.id).length > 0) knowledge = 1;
      }
      if (philosophyById.has(resolvedConcept)) knowledge = 1;
    }
  }

  return { language, intent, topic, retrieval, context, knowledge };
}

export interface VerdictInput {
  confidence: ConfidenceBreakdown;
  candidates: readonly KnowledgeCandidate[];
  resolvedConcept?: string | undefined;
  /** True when the concept came from state rather than from this message. */
  fromContext: boolean;
  message: NormalizedMessage;
  reference: ReferenceResolution | null;
  state: ConversationState;
  intent: IntentKind;
}

/**
 * Turn the signals into one of five outcomes. The ordering matters: a wording
 * failure must be caught before a knowledge failure, or every unfamiliar
 * phrase gets reported as missing knowledge.
 */
export function decideVerdict(input: VerdictInput): { verdict: UnderstandingVerdict; reason: string } {
  const { confidence: c, candidates, resolvedConcept, fromContext, message, reference } = input;

  // Navigation is an instruction, not a query. „წინა თემას დავუბრუნდეთ" must
  // not be second-guessed because the surrounding words were ambiguous.
  if ((input.intent === 'go_back' || input.intent === 'correction') && resolvedConcept) {
    return { verdict: 'continue_from_context', reason: 'ცხადი სანავიგაციო მითითება.' };
  }

  // A pronoun we could not attach to anything is a clarification, not a failure.
  if (reference && !reference.concept) {
    return {
      verdict: 'need_clarification',
      reason: `მიმართვა „${reference.surface}" ვერ მივაბი კონკრეტულ თემას — საუბარში ჯერ არაფერია.`,
    };
  }

  // Ambiguity between two comparably strong readings *of the message*.
  // Graph-expansion candidates all score alike by construction, and the
  // concept is already settled when it came from context — neither is a
  // reason to interrupt the user with a question.
  const fromMessage = candidates.filter((c) => c.layer !== 'related');
  const [first, second] = fromMessage;
  if (!fromContext && first && second && second.score >= first.score * 0.82 && first.concept !== second.concept) {
    return {
      verdict: 'need_clarification',
      reason: `ორი თანაბრად სავარაუდო თემაა: ${first.label} და ${second.label}.`,
    };
  }

  // A low-confidence pronoun with real alternatives.
  if (reference && reference.confidence < 0.7 && reference.alternatives.length > 0) {
    return {
      verdict: 'need_clarification',
      reason: `„${reference.surface}" ორაზროვანია.`,
    };
  }

  if (!resolvedConcept) {
    if (c.language < 0.5) {
      return { verdict: 'unparsed', reason: 'ფორმულირება ვერ გავშიფრე და კონტექსტიც არ მაქვს.' };
    }
    return { verdict: 'need_clarification', reason: 'გავიგე ფორმულირება, მაგრამ თემა ვერ დავადგინე.' };
  }

  // Understood the request, hold nothing on it. This is the important branch:
  // language confidence stays high, knowledge confidence is zero.
  if (c.knowledge === 0) {
    return {
      verdict: 'known_but_missing',
      reason: 'თემა ამოვიცანი, ბიბლიოთეკაში მასალა არ მაქვს.',
    };
  }

  if (fromContext) {
    return { verdict: 'continue_from_context', reason: 'თემა საუბრის კონტექსტიდან აღვადგინე.' };
  }

  if (c.topic < 0.5 || (candidates[0] && candidates[0].layer === 'fuzzy')) {
    return { verdict: 'partial', reason: 'თემა სავარაუდოდ ამოვიცანი, სრული დარწმუნებით არა.' };
  }

  if (message.contentStems.length > 0 && (candidates[0]?.coverage ?? 0) < 0.34) {
    return { verdict: 'partial', reason: 'შეტყობინების მხოლოდ ნაწილს ვფარავ.' };
  }

  return { verdict: 'answer', reason: 'თემაც და მოთხოვნაც გასაგებია, მასალაც მაქვს.' };
}
