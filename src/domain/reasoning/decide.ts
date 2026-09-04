import type { AnswerRef } from '../assistant';
import type { Claim, DomainPack, Move, ReasoningState } from './types';
import { contentTerms, cues, isQuestion, jaccard, quote } from './language';

/**
 * The answer-vs-question decision.
 *
 * The engine's distinguishing behaviour is knowing when *not* to answer. That
 * judgement is made here, explicitly and inspectably: a numeric pressure to
 * answer is weighed against the score of the best available question. Nothing
 * about it is random, and every term in the sum is reported to the UI.
 */

/** Question forms that are genuinely contested rather than lookups. */
const GENERIC_CONTESTED =
  /(უნდა|სწორია|არასწორია|სამართლიან|ღირს|ნამდვილად არსებობს|არსებობს თუ არა|მართლა|რა აზრი აქვს|ჯობია|უკეთესია|დასაშვებია|შეიძლება თუ არა.*მორალურ)/;

/** Lookup forms: a single entity, a date, a definition of a named thing. */
const LOOKUP =
  /^(ვინ იყო|ვინ არის|როდის|რომელ წელს|რა არის ‌?[^?]{0,40}\?|სად არის|რამდენი|რას ნიშნავს სიტყვა)/;

export function isContestedQuestion(utterance: string, pack: DomainPack): boolean {
  if (!isQuestion(utterance)) return false;
  if (GENERIC_CONTESTED.test(utterance)) return true;
  const terms = contentTerms(utterance);
  return pack.contestedCues.some((cue) => terms.some((t) => t.startsWith(cue) || cue.startsWith(t)));
}

export function isLookupQuestion(utterance: string): boolean {
  return isQuestion(utterance) && LOOKUP.test(utterance.trim());
}

export interface PressureBreakdown {
  total: number;
  parts: { label: string; value: number }[];
}

/**
 * How strongly this turn calls for a straight answer. Every contribution is
 * labelled so the reasoning panel can show the arithmetic.
 */
export function answerPressure(
  state: ReasoningState,
  utterance: string,
  fresh: readonly Claim[],
  pack: DomainPack,
  hasGroundedAnswer: boolean,
): PressureBreakdown {
  const parts: { label: string; value: number }[] = [];
  const add = (label: string, value: number) => {
    if (value !== 0) parts.push({ label, value });
  };

  const hasContent = contentTerms(utterance).length > 0;

  add('საბაზისო', 4);

  if (cues.wantsAnswer(utterance)) add('პირდაპირ ითხოვს პასუხს', 6);
  if (state.answerDebt > 0) add('დაგროვილი მოთხოვნა პასუხზე', state.answerDebt * 2);
  if (state.consecutiveQuestions > 0) add('ზედიზედ დასმული კითხვები', state.consecutiveQuestions * 2);
  // Repeated one-word replies are the clearest possible sign to stop pushing.
  if (state.turnIndex > 1 && state.engagement < 0.3) {
    add('მოსაუბრე იკეტება', state.engagement < 0.15 ? 6 : 3);
  }
  if (fresh.length === 0 && isQuestion(utterance)) add('კითხვაა, არა მტკიცება', 3);
  if (isLookupQuestion(utterance) && hasGroundedAnswer) add('ფაქტობრივი ცნობა — უბრალოდ ვიცი', 5);
  if (isContestedQuestion(utterance, pack)) add('სადავო კითხვა — პასუხი ნაადრევია', -4);

  // With nothing in the library to say, "answering" degrades to admitting
  // ignorance, and a question built from the user's own words beats that.
  // This only applies when they actually raised a subject: a bare „კი." has no
  // grounded answer because it asked nothing, not because the library is thin.
  if (hasContent && !hasGroundedAnswer && !cues.wantsAnswer(utterance) && state.answerDebt === 0) {
    add('გასაცემი პასუხი არ არსებობს', -4);
  }

  const unresolved = state.contradictions.filter((c) => !c.resolved).length;
  if (unresolved > 0) add('გადაუწყვეტელი წინააღმდეგობა', -3 * unresolved);

  // Only recent claims hold back an answer. An old unexamined assertion must
  // not suppress answering for the rest of the conversation.
  const unexaminedStrong = [...state.claims, ...fresh].filter(
    (c) => !c.examined && c.force === 'strong' && state.turnIndex - c.turnIndex <= 2,
  ).length;
  if (unexaminedStrong > 0) add('შეუმოწმებელი კატეგორიული მტკიცება', -2);

  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return { total, parts };
}

export interface Decision {
  ask: boolean;
  move: Move;
  pressure: PressureBreakdown;
  runnerUps: Move[];
}

/**
 * Choose between the best question and answering. A question wins only when
 * it scores above the pressure to answer — so a user who says "just tell me"
 * is told, and a user making a sweeping unexamined claim is questioned.
 */
export function decide(
  ranked: readonly Move[],
  pressure: PressureBreakdown,
  buildAnswer: () => { text: string; sources: AnswerRef[] },
): Decision {
  const best = ranked[0];
  if (best && best.score > pressure.total) {
    return { ask: true, move: best, pressure, runnerUps: ranked.slice(1, 4) };
  }
  const answer = buildAnswer();
  return {
    ask: false,
    move: {
      kind: 'answer',
      text: answer.text,
      rationale: best
        ? `საუკეთესო კითხვის ღირებულება (${best.score.toFixed(1)}) ვერ სჯობს პასუხის საჭიროებას (${pressure.total.toFixed(1)}).`
        : 'პროდუქტიული კითხვა არ არსებობს — პასუხი ჯობს.',
      score: pressure.total,
      sources: answer.sources,
      key: `answer:${Date.now()}`,
    },
    pressure,
    runnerUps: ranked.slice(0, 3),
  };
}

/**
 * A short reflection prefixed to an answer once the user has built something,
 * so the answer lands on their reasoning rather than replacing it.
 */
export function reflection(state: ReasoningState): string {
  const examined = state.claims.filter((c) => c.examined);
  if (examined.length === 0) return '';
  const last = examined[examined.length - 1]!;
  const accepted = state.assumptions.filter((a) => a.status === 'accepted').length;
  const bits = [`შენ უკვე დაადგინე: „${quote(last.text, 70)}"`];
  if (accepted > 0) bits.push(`და ${accepted} წანამძღვარი მკაფიოდ დაასახელე`);
  return `${bits.join(' ')}. ამაზე დაშენებული პასუხი ასეთია:\n\n`;
}

/** Focus shift detection — a new subject resets the depth budget. */
export function focusShifted(previous: readonly string[], next: readonly string[]): boolean {
  if (previous.length === 0) return true;
  return jaccard(previous, next) < 0.3;
}
