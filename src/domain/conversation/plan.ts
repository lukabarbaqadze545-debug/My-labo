import { library } from '@/content';
import { hasFacet } from '@/content/knowledge';
import { philosophyById } from '@/content/philosophy';
import type {
  ConversationState,
  IntentKind,
  NextAction,
  NextActionKind,
  UnderstandingVerdict,
} from './types';
import { topicForConcept } from './retrieve';

/** Marks a reply composed after the user deferred the choice to the assistant. */
export const AUTO_PICK_MARKER = 'ავირჩიე თემა თავად';

/**
 * Deterministically pick one topic from a subject when the user hands the
 * choice over. Spotlighted topics are the ones authored as good entry points.
 */
function autoPickTopic(subjectId: string, seed: number): string | undefined {
  const topics = library.topicsBySubject.get(subjectId) ?? [];
  if (topics.length === 0) return undefined;
  const spotlight = topics.filter((t) => t.spotlight);
  const pool = spotlight.length > 0 ? spotlight : topics;
  return pool[seed % pool.length]!.id;
}

/**
 * Stage 7 — next best conversational action.
 *
 * Intent says what the user asked for. This stage decides what the assistant
 * should actually *do*, which is not always the same thing: a request for an
 * example when no example exists degrades to an explanation with a note, and a
 * stated position in a philosophical domain is better met with a question than
 * with a lecture.
 */

const DIRECT: Partial<Record<IntentKind, NextActionKind>> = {
  simplify: 'simplify',
  expand: 'expand',
  example: 'give_example',
  another_example: 'give_another_example',
  why: 'explain_why',
  how: 'explain',
  when_to_use: 'when_to_use',
  limitations: 'limitations',
  compare: 'compare',
  define: 'define_term',
  summarize: 'summarize',
  continue: 'expand',
  counterargument: 'give_counterargument',
  argue_for: 'give_supporting_argument',
  quiz: 'quiz',
  explain: 'explain',
};

export interface PlanInput {
  intent: IntentKind;
  verdict: UnderstandingVerdict;
  concept?: string | undefined;
  state: ConversationState;
  /** Socratic mode is on for this conversation. */
  socratic: boolean;
  /** True when the message named the concept rather than inheriting it. */
  explicitTopic: boolean;
}

function philosophical(concept: string | undefined): boolean {
  if (!concept) return false;
  if (philosophyById.has(concept)) return true;
  const topic = topicForConcept(concept);
  return topic?.subjectId === 'philosophy';
}

/** Does the library hold what this action needs? */
function available(action: NextActionKind, concept: string | undefined): boolean {
  if (!concept) return false;
  const phil = philosophyById.get(concept);
  const topic = topicForConcept(concept);
  const topicId = topic?.id;

  switch (action) {
    case 'give_example':
    case 'give_another_example':
      return Boolean((topicId && hasFacet(topicId, 'example')) || (phil?.examples.length ?? 0) > 0);
    case 'simplify':
      return Boolean((topicId && hasFacet(topicId, 'simple')) || phil?.simple);
    case 'limitations':
      return Boolean((topicId && hasFacet(topicId, 'limitation')) || (phil?.objections.length ?? 0) > 0);
    case 'when_to_use':
      return Boolean(topicId && hasFacet(topicId, 'whenToUse'));
    case 'explain_why':
      // Always performable: falls back to the topic's own "why interesting".
      return Boolean(topicId || phil);
    case 'compare':
      return Boolean((topicId && hasFacet(topicId, 'compare')) || (phil?.positions.length ?? 0) >= 2);
    case 'give_counterargument':
      return Boolean((phil?.argumentsAgainst.length ?? 0) > 0 || (phil?.objections.length ?? 0) > 0);
    case 'give_supporting_argument':
      return Boolean((phil?.argumentsFor.length ?? 0) > 0);
    case 'ask_socratic_question':
      return (phil?.socraticQuestions.length ?? 0) > 0;
    default:
      return true;
  }
}

export function planAction(input: PlanInput): NextAction {
  const { intent, verdict, concept, state, socratic, explicitTopic } = input;
  const topic = concept ? topicForConcept(concept) : undefined;
  const base = {
    ...(concept ? { concept } : {}),
    ...(topic ? { topicId: topic.id } : {}),
  };

  /* ---- conversational bookkeeping — complete regardless of verdict ----- */
  /*
   * A greeting carries no concept to resolve, which used to mean it fell
   * through to the verdict machinery below and came back as a clarification
   * request ("ერთი დაზუსტება: რომელ თემაზეა საუბარი?") — technically honest,
   * but nobody says "hello" expecting to be asked what they meant. These
   * intents are complete requests on their own, so they are handled before
   * verdict is even consulted.
   */
  if (intent === 'greeting' || intent === 'thanks' || intent === 'meta' || intent === 'stop') {
    return { kind: 'smalltalk', ...base, rationale: 'სასაუბრო რეპლიკა.', score: 8 };
  }

  // Likewise, "შენ აირჩიე" names no concept for retrieval to resolve — it
  // reaches for the domain a prior introduction set, which lives outside the
  // normal concept ladder entirely. Handled here for the same reason.
  if (intent === 'defer_choice' && state.currentDomain) {
    const picked = autoPickTopic(state.currentDomain, state.turnIndex);
    if (picked) {
      return { kind: 'explain', concept: picked, topicId: picked, rationale: AUTO_PICK_MARKER, score: 9 };
    }
  }

  /* ---- outcomes that override intent entirely ------------------------- */

  if (verdict === 'need_clarification') {
    return { kind: 'clarify', ...base, rationale: 'ორაზროვნება — ერთი დაზუსტება სჯობს გამოცნობას.', score: 10 };
  }
  if (verdict === 'unparsed') {
    return {
      kind: state.currentConcept ? 'clarify' : 'admit_not_understood',
      ...base,
      rationale: 'ფორმულირება ვერ წავიკითხე.',
      score: 9,
    };
  }
  if (verdict === 'known_but_missing') {
    return {
      kind: 'admit_missing_knowledge',
      ...base,
      rationale: 'მოთხოვნა გასაგებია, მასალა არ არსებობს — გამოგონება დაუშვებელია.',
      score: 10,
    };
  }

  /* ---- conversational bookkeeping --------------------------------------- */

  if (intent === 'correction') {
    return { kind: 'acknowledge_correction', ...base, rationale: 'მომხმარებელმა შემასწორა.', score: 10 };
  }
  if (intent === 'go_back') {
    return {
      kind: 'switch_topic',
      concept: state.previousConcept ?? concept,
      ...(state.previousTopicId ? { topicId: state.previousTopicId } : {}),
      rationale: 'წინა თემაზე დაბრუნების თხოვნა.',
      score: 9,
    };
  }

  /* ---- honest, non-mechanical replies to a stance ---------------------- */

  if (intent === 'opinion') {
    return { kind: 'state_opinion', ...base, rationale: 'პირადი აზრი კი არა, არსებული მასალა მჭირდება ვაჩვენო.', score: 8 };
  }

  if (intent === 'disagree') {
    if (philosophical(concept) && available('give_counterargument', concept)) {
      return {
        kind: 'give_counterargument',
        ...base,
        rationale: 'მომხმარებელი არ ეთანხმება — შენახული საწინააღმდეგო არგუმენტი უფრო გამოსადეგია, ვიდრე გამეორება.',
        score: 8.5,
      };
    }
    if (available('explain_why', concept)) {
      return {
        kind: 'explain_why',
        ...base,
        rationale: 'მომხმარებელი არ ეთანხმება — მიზეზებს დეტალურად ვხსნი, არა თავიდან ვიმეორებ.',
        score: 7,
      };
    }
  }

  /* ---- philosophy: prefer thinking over telling ----------------------- */

  if (philosophical(concept)) {
    if (intent === 'counterargument' && available('give_counterargument', concept)) {
      return { kind: 'give_counterargument', ...base, rationale: 'კონტრარგუმენტი მოთხოვნილია და შენახულია.', score: 9 };
    }
    if (intent === 'argue_for' && available('give_supporting_argument', concept)) {
      return { kind: 'give_supporting_argument', ...base, rationale: 'მხარდამჭერი არგუმენტი მოთხოვნილია.', score: 9 };
    }
    // A stated position earns a thoughtful question — but not two in a row.
    // Without this gate, a run of declarative claims is met with a question
    // every single time, which is exactly the "annoying Socrates" failure
    // mode: the assistant never actually engages with what was said.
    const questionDue = state.consecutiveQuestions === 0;
    if (
      ((intent === 'state_position' && questionDue) || (socratic && intent === 'explain' && !explicitTopic)) &&
      available('ask_socratic_question', concept)
    ) {
      return {
        kind: 'ask_socratic_question',
        ...base,
        rationale: 'მომხმარებელმა პოზიცია დააფიქსირა — კითხვა უფრო შორს წაიყვანს, ვიდრე პასუხი.',
        score: 8.5,
      };
    }
    if (socratic && available('ask_socratic_question', concept) && state.depth <= 0) {
      return {
        kind: 'ask_socratic_question',
        ...base,
        rationale: 'სოკრატესებური რეჟიმი: ჯერ კითხვა.',
        score: 8,
      };
    }
  }

  if (intent === 'state_position') {
    return { kind: 'explain', ...base, rationale: 'პოზიცია დაფიქსირდა; ვპასუხობ არსებული მასალით.', score: 6 };
  }

  /* ---- the requested action, if we can actually perform it ------------ */

  const wanted = DIRECT[intent] ?? 'explain';

  if (wanted === 'give_example' && (state.examplesGiven[concept ?? ''] ?? 0) > 0) {
    // Asking for "an example" when one was already given means another one.
    if (available('give_another_example', concept)) {
      return { kind: 'give_another_example', ...base, rationale: 'მაგალითი უკვე იყო — შემდეგი მოდის.', score: 8 };
    }
  }

  if (available(wanted, concept)) {
    return { kind: wanted, ...base, rationale: `მოთხოვნილი მოქმედება შესრულებადია.`, score: 7 };
  }

  // Graceful degradation: say what is missing, then give what exists.
  return {
    kind: 'explain',
    ...base,
    rationale: `„${wanted}" ამ თემაზე არ მაქვს — ვაბრუნებ იმას, რაც არსებობს.`,
    score: 5,
  };
}
