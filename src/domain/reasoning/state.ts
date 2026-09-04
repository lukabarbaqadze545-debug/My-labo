import type { AnswerRef } from '../assistant';
import type {
  Claim,
  DomainPack,
  Move,
  MoveKind,
  Outcome,
  ReasoningState,
  RespondOptions,
} from './types';
import { contentTerms, cues, quote } from './language';
import { engagementOf, extractClaims, recordDefinition, updateTerms } from './claims';
import { detectContradictions, inferAssumptions, readsAsAgreement, readsAsRejection } from './analysis';
import { activeConcepts, generateMoves, scoreMoves } from './moves';
import { answerPressure, decide, focusShifted, reflection } from './decide';

/**
 * Conversation state: construction, ingestion of a user turn, commitment of an
 * engine turn, and deterministic replay from a stored transcript.
 *
 * Replay matters: the state is never persisted separately, so it can never
 * drift from the messages the user can actually see. Reloading a conversation
 * reconstructs exactly the state the engine had when it last spoke.
 */

export const DEFAULT_MAX_DEPTH = 4;

export function emptyState(packId: string): ReasoningState {
  return {
    packId,
    turnIndex: 0,
    claims: [],
    assumptions: [],
    terms: [],
    contradictions: [],
    openQuestions: [],
    askedKeys: [],
    askedTexts: [],
    focus: [],
    depth: 0,
    consecutiveQuestions: 0,
    engagement: 0.5,
    answerDebt: 0,
  };
}

/* ------------------------------- ingestion ------------------------------ */

/**
 * Fold a user turn into the state. This is the whole "understanding" pass:
 * close whatever the engine asked last, read new claims, track vocabulary,
 * infer premises, and look for conflicts with everything said earlier.
 */
export function ingest(
  state: ReasoningState,
  utterance: string,
  pack: DomainPack,
): { state: ReasoningState; fresh: Claim[] } {
  const turnIndex = state.turnIndex + 1;
  let claims = [...state.claims];
  let assumptions = [...state.assumptions];
  let terms = [...state.terms];
  let contradictions = [...state.contradictions];

  const agreed = readsAsAgreement(utterance);
  const rejected = readsAsRejection(utterance);

  // 1. Close whatever was open — the user has now had their turn on it.
  for (const q of state.openQuestions.filter((x) => !x.answered)) {
    switch (q.moveKind) {
      case 'surfaceAssumption':
        assumptions = assumptions.map((a) =>
          a.id === q.targetId
            ? { ...a, status: agreed ? 'accepted' : rejected ? 'rejected' : 'surfaced' }
            : a,
        );
        claims = claims.map((c) =>
          c.id === assumptions.find((a) => a.id === q.targetId)?.claimId ? { ...c, examined: true } : c,
        );
        break;
      case 'defineTerm':
        if (q.targetId) terms = recordDefinition(terms, q.targetId, utterance, turnIndex);
        break;
      case 'resolveContradiction':
        // Only a substantive reply counts as picking a side.
        if (contentTerms(utterance).length >= 3) {
          contradictions = contradictions.map((c) => (c.id === q.targetId ? { ...c, resolved: true } : c));
        }
        break;
      case 'seekCounterexample':
      case 'probeConsequence':
      case 'askEvidence':
      case 'applyToCase':
        claims = claims.map((c) => (c.id === q.targetId ? { ...c, examined: true } : c));
        break;
      default:
        break;
    }
  }

  // 2. Read the turn.
  const fresh = extractClaims(utterance, turnIndex);
  terms = updateTerms(terms, utterance, pack);

  // 3. Conflicts are found against the *prior* claims only.
  const newContradictions = detectContradictions(fresh, { ...state, claims, contradictions });
  contradictions = [...contradictions, ...newContradictions];

  // 4. Premises carried by the new claims.
  let working: ReasoningState = { ...state, turnIndex, claims, assumptions, terms, contradictions };
  for (const claim of fresh) {
    const inferred = inferAssumptions(claim, working, pack);
    assumptions = [...assumptions, ...inferred];
    working = { ...working, assumptions };
  }

  claims = [...claims, ...fresh];

  // 5. Attention and effort.
  const nextFocus = contentTerms(utterance).slice(0, 4);
  // A contentless reply („კი.", „ჰო.") is not a change of subject. Treating it
  // as one would refund the depth budget on every monosyllable and let the
  // engine interrogate forever.
  const shifted = nextFocus.length > 0 && focusShifted(state.focus, nextFocus);
  const engagement = state.engagement * 0.4 + engagementOf(utterance, fresh) * 0.6;
  const answerDebt = cues.wantsAnswer(utterance)
    ? Math.min(3, state.answerDebt + 1)
    : Math.max(0, state.answerDebt - 1);

  return {
    state: {
      ...state,
      turnIndex,
      claims,
      assumptions,
      terms,
      contradictions,
      openQuestions: state.openQuestions.map((q) => ({ ...q, answered: true })),
      focus: nextFocus.length ? nextFocus : state.focus,
      depth: shifted ? 0 : state.depth,
      engagement,
      answerDebt,
    },
    fresh,
  };
}

/* ------------------------------ commitment ------------------------------ */

/** Record an engine turn so the next turn will not repeat or over-drill it. */
export function commit(state: ReasoningState, move: Move): ReasoningState {
  const asked = move.kind !== 'answer';
  return {
    ...state,
    askedKeys: asked ? [...state.askedKeys, move.key] : state.askedKeys,
    askedTexts: asked ? [...state.askedTexts, move.text].slice(-12) : state.askedTexts,
    openQuestions: asked
      ? [
          ...state.openQuestions,
          {
            id: `q${state.turnIndex}`,
            turnIndex: state.turnIndex,
            text: move.text,
            moveKind: move.kind,
            ...(move.targetId ? { targetId: move.targetId } : {}),
            answered: false,
          },
        ]
      : state.openQuestions,
    depth: asked ? state.depth + 1 : 0,
    consecutiveQuestions: asked ? state.consecutiveQuestions + 1 : 0,
    answerDebt: asked ? state.answerDebt : 0,
  };
}

/* -------------------------------- respond ------------------------------- */

/**
 * One full engine turn: understand, weigh, decide.
 *
 * The returned move is either a question chosen from generated candidates or a
 * grounded answer produced by `answerFor`. The engine never writes factual
 * content itself — questions come from conversation state, answers come from
 * the library.
 */
export function respond(
  previous: ReasoningState,
  utterance: string,
  opts: RespondOptions & { refFor: (topicId: string) => AnswerRef | null },
): Outcome {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const { state: ingested, fresh } = ingest(previous, utterance, opts.pack);

  const ctx = {
    state: ingested,
    pack: opts.pack,
    fresh,
    utterance,
    activeConcepts: activeConcepts(opts.pack, ingested, utterance),
    refFor: opts.refFor,
  };

  const ranked = scoreMoves(generateMoves(ctx), ctx, maxDepth);

  // The grounded answer is built lazily — only if the engine decides to give it.
  const grounded = opts.answerFor(utterance);
  const hasGrounded = grounded.sources.length > 0 && grounded.text.length > 40;
  const pressure = answerPressure(ingested, utterance, fresh, opts.pack, hasGrounded);

  const decision = decide(ranked, pressure, () => ({
    text: `${reflection(ingested)}${grounded.text}`,
    sources: grounded.sources,
  }));

  const move: Move = {
    ...decision.move,
    rationale: `${decision.move.rationale} [წნევა პასუხზე ${pressure.total.toFixed(1)}]`,
  };

  return {
    move,
    considered: decision.runnerUps,
    state: commit(ingested, move),
    asked: decision.ask,
  };
}

/* --------------------------------- replay ------------------------------- */

export interface ReplayTurn {
  role: 'user' | 'assistant';
  text: string;
  /** Present on engine turns produced in Socratic mode. */
  socratic?: { moveKind: MoveKind; targetId?: string; key: string };
}

/**
 * Rebuild state from a stored transcript. Pure and deterministic, so a
 * reloaded conversation resumes with exactly the state it had.
 */
export function replay(turns: readonly ReplayTurn[], pack: DomainPack): ReasoningState {
  let state = emptyState(pack.id);
  for (const turn of turns) {
    if (turn.role === 'user') {
      state = ingest(state, turn.text, pack).state;
      continue;
    }
    if (!turn.socratic) continue;
    state = commit(state, {
      kind: turn.socratic.moveKind,
      ...(turn.socratic.targetId ? { targetId: turn.socratic.targetId } : {}),
      text: turn.text,
      rationale: '',
      score: 0,
      sources: [],
      key: turn.socratic.key,
    });
  }
  return state;
}

/** Compact, human-readable snapshot for the reasoning panel and AI prompt. */
export function summarize(state: ReasoningState): string {
  const lines: string[] = [];
  const claims = state.claims.slice(-4);
  if (claims.length) {
    lines.push('მოსაუბრის მტკიცებები:');
    for (const c of claims) lines.push(`• ${quote(c.text, 90)}${c.examined ? ' [შემოწმებული]' : ''}`);
  }
  const open = state.assumptions.filter((a) => a.status === 'inferred' || a.status === 'surfaced');
  if (open.length) {
    lines.push('გამოუთქმელი წანამძღვრები:');
    for (const a of open.slice(0, 3)) lines.push(`• ${a.text}`);
  }
  const undefinedTerms = state.terms.filter((t) => !t.defined && t.loadBearing);
  if (undefinedTerms.length) {
    lines.push(`განუსაზღვრელი ტერმინები: ${undefinedTerms.map((t) => t.surface).join(', ')}`);
  }
  const conflicts = state.contradictions.filter((c) => !c.resolved);
  if (conflicts.length) {
    lines.push('წინააღმდეგობები:');
    for (const c of conflicts) lines.push(`• ${c.note}`);
  }
  return lines.join('\n');
}
