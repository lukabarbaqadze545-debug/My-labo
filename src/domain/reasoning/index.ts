import { library, t } from '@/content';
import { ask, type AnswerRef } from '../assistant';
import type { DomainPack, Outcome, ReasoningState } from './types';
import { replay, respond, summarize, type ReplayTurn } from './state';
import { packById, resolvePack, PACKS } from './packs';

export * from './types';
export { replay, respond, summarize, emptyState, ingest, commit, DEFAULT_MAX_DEPTH } from './state';
export type { ReplayTurn } from './state';
export { extractClaims, updateTerms, engagementOf } from './claims';
export { detectContradictions, inferAssumptions, undefinedLoadBearing, BASE_SCHEMAS } from './analysis';
export { generateMoves, scoreMoves, activeConcepts } from './moves';
export { answerPressure, decide, isContestedQuestion, isLookupQuestion } from './decide';
export { PACKS, ALL_PACKS, GENERAL_PACK, PHILOSOPHY_PACK, GEOROUTE_PACK, packById, resolvePack } from './packs';

/**
 * Wiring between the domain-independent engine and Luka's Labo content.
 *
 * The engine decides *whether* and *what* to ask. Whenever it needs a fact —
 * to ground a distinction, or because it decided an answer is due — it goes
 * through the existing retrieval assistant, which only ever returns sentences
 * that were authored for the library. The reasoning layer adds no factual
 * claims of its own.
 */

export function refForTopic(topicId: string): AnswerRef | null {
  const topic = library.topicById.get(topicId);
  return topic ? { label: t(topic.title), href: `/topics/${topicId}` } : null;
}

export interface SocraticInput {
  /** Prior turns, oldest first. */
  history: readonly ReplayTurn[];
  utterance: string;
  /** Pin a pack; omitted means auto-route from the conversation. */
  packId?: string;
  maxDepth?: number;
}

export interface SocraticResult extends Outcome {
  pack: DomainPack;
  /** State before this turn — useful for showing what changed. */
  previous: ReasoningState;
}

/**
 * One Socratic turn over a stored conversation. Pure: given the same history
 * and utterance it always produces the same move, which is what makes the
 * behaviour testable and the reasoning panel trustworthy.
 */
export function socraticTurn(input: SocraticInput): SocraticResult {
  const conversationText = [...input.history.map((h) => h.text), input.utterance].join(' ');
  const pack = input.packId ? packById(input.packId) : resolvePack(conversationText, PACKS);

  const previous = replay(input.history, pack);
  const outcome = respond(previous, input.utterance, {
    pack,
    answerFor: (query) => {
      const answer = ask(query);
      return {
        text: answer.text,
        sources: answer.sources,
        related: answer.related,
        followUps: answer.followUps,
      };
    },
    refFor: refForTopic,
    ...(input.maxDepth === undefined ? {} : { maxDepth: input.maxDepth }),
  });

  return { ...outcome, pack, previous };
}

/**
 * The reasoning state rendered for a language model. When the real AI is
 * enabled it phrases the engine's chosen move — it does not choose it, and it
 * is told exactly which one operation to perform.
 */
export function socraticPrompt(result: SocraticResult): string {
  const { move, state } = result;
  const snapshot = summarize(state);
  const lines = [
    'შენ სოკრატესებურ რეჟიმში ხარ. მსჯელობის ძრავამ უკვე გადაწყვიტა, რა ნაბიჯია საჭირო.',
    '',
    snapshot ? `--- საუბრის მდგომარეობა ---\n${snapshot}` : '',
    '',
    `--- შენი ერთადერთი დავალება ---`,
  ];

  if (move.kind === 'answer') {
    lines.push(
      'ახლა პასუხის დროა. უპასუხე ქვემოთ მოცემულ ბიბლიოთეკის მასალაზე დაყრდნობით, ბუნებრივი ქართულით.',
      'დაუკავშირე პასუხი იმას, რაც მოსაუბრემ თვითონ ააგო. ახალ ფაქტს ნუ მოიგონებ.',
      '',
      move.text,
    );
  } else {
    lines.push(
      `ოპერაცია: ${move.kind}. მიზეზი: ${move.rationale}`,
      'დასვი ზუსტად ერთი კითხვა — ის, რაც ქვემოთაა. შეგიძლია ბუნებრივად გადააფრაზო და ერთი მოკლე',
      'დამაკავშირებელი წინადადება დაუმატო, მაგრამ არ უპასუხო თავად და არ დასვა მეორე კითხვა.',
      'არ ახსნა პასუხი — მიზანი ისაა, რომ მოსაუბრემ თვითონ იფიქროს.',
      '',
      move.text,
    );
  }
  return lines.filter((x) => x !== '').join('\n');
}
