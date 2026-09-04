import type { AnswerRef } from '../assistant';
import type {
  Claim,
  DomainConcept,
  DomainPack,
  Move,
  MoveKind,
  ReasoningState,
} from './types';
import { hash, jaccard, quote } from './language';
import { undefinedLoadBearing } from './analysis';

/**
 * Candidate moves, their phrasing, and their scores.
 *
 * Every question the engine can ask is bound to a *reasoning operation* and is
 * only generated when the conversation state actually supports it: there is no
 * pool of generic prompts to draw from. The wording frames below interpolate
 * the user's own sentences, the detected premise, or the two conflicting
 * claims, so the same frame produces a different question in every
 * conversation — and produces none at all when nothing warrants it.
 */

export interface MoveContext {
  state: ReasoningState;
  pack: DomainPack;
  /** Claims made in the turn being responded to. */
  fresh: Claim[];
  utterance: string;
  activeConcepts: DomainConcept[];
  /** Resolves a library reference for grounding, if the topic exists. */
  refFor: (topicId: string) => AnswerRef | null;
}

/** Baseline worth of each operation, before state-sensitive adjustment. */
const BASE: Record<MoveKind, number> = {
  resolveContradiction: 10,
  distinguishPosition: 7.6,
  surfaceAssumption: 7,
  defineTerm: 6.5,
  seekCounterexample: 6,
  applyToCase: 5.6,
  probeConsequence: 5,
  askEvidence: 4.4,
  clarifyGoal: 8,
  synthesize: 3,
  answer: 0,
};

/** Pick one of several frames deterministically, keyed on the target. */
function frame(frames: string[], key: string): string {
  return frames[hash(key) % frames.length]!;
}

/* --------------------------- move generators ---------------------------- */

function contradictionMoves(ctx: MoveContext): Move[] {
  const { state } = ctx;
  const byClaim = new Map(state.claims.map((c) => [c.id, c]));
  return state.contradictions
    .filter((x) => !x.resolved)
    .map((x): Move | null => {
      const a = byClaim.get(x.aClaimId);
      const b = byClaim.get(x.bClaimId);
      if (!a || !b) return null;
      const text = frame(
        [
          `ადრე თქვი: „${quote(a.text)}". ახლა კი — „${quote(b.text)}". ორივე ერთდროულად ვერ დგას. რომელს დაუთმობდი, და რატომ?`,
          `აქ დაძაბულობაა. „${quote(a.text)}" და „${quote(b.text)}" — ${x.note} როგორ ათავსებ ამ ორს?`,
          `შევჩერდეთ: „${quote(a.text)}" გამორიცხავს „${quote(b.text)}"-ს. რომელია შენი ნამდვილი პოზიცია?`,
        ],
        x.id,
      );
      return {
        kind: 'resolveContradiction' as const,
        targetId: x.id,
        text,
        rationale: `ორი მტკიცება ერთმანეთს ეწინააღმდეგება (${x.kind}, სიმტკიცე ${x.strength.toFixed(2)}).`,
        score: BASE.resolveContradiction + x.strength * 3,
        sources: [],
        key: `resolveContradiction:${x.id}`,
      };
    })
    .filter((m): m is Move => m !== null);
}

function assumptionMoves(ctx: MoveContext): Move[] {
  const { state } = ctx;
  const byClaim = new Map(state.claims.map((c) => [c.id, c]));
  return state.assumptions
    .filter((a) => a.status === 'inferred')
    .map((a): Move | null => {
      const claim = byClaim.get(a.claimId);
      if (!claim) return null;
      const text = frame(
        [
          `შენს ნათქვამში — „${quote(claim.text)}" — ერთი რამ უსიტყვოდ იგულისხმება: ${a.text} ეს ნამდვილად ასეა?`,
          `„${quote(claim.text)}" მხოლოდ მაშინ დგას, თუ ეს მართალია: ${a.text} დგება?`,
          `აქ ფარული წანამძღვარია: ${a.text} თუ ის მოიშალა, „${quote(claim.text)}"-ს რა დარჩება?`,
        ],
        a.id,
      );
      const recency = claim.turnIndex === state.turnIndex ? 1.5 : Math.max(0, 1.5 - (state.turnIndex - claim.turnIndex) * 0.5);
      return {
        kind: 'surfaceAssumption' as const,
        targetId: a.id,
        text,
        rationale: `მტკიცება ეყრდნობა გამოუთქმელ წანამძღვარს (წონა ${a.load.toFixed(2)}).`,
        score: BASE.surfaceAssumption + a.load * 2 + recency,
        sources: [],
        key: `surfaceAssumption:${a.id}`,
      };
    })
    .filter((m): m is Move => m !== null);
}

function definitionMoves(ctx: MoveContext): Move[] {
  const { state } = ctx;
  return undefinedLoadBearing(state.terms)
    .slice(0, 3)
    .map((term) => {
      const text = frame(
        [
          `სანამ გავაგრძელებთ: „${term.surface}"-ში ზუსტად რას დებ? მომეცი ერთი შემთხვევა, სადაც ეს სიტყვა ზუსტად ჯდება — და ერთიც, სადაც აღარ.`,
          `„${term.surface}" აქ ბევრ სამუშაოს ასრულებს, მაგრამ ჯერ არ განგვისაზღვრავს. შენი განმარტებით, რა შედის მასში და რა რჩება გარეთ?`,
          `როცა ამბობ „${term.surface}", ამას ყველა ერთნაირად გაიგებდა? სცადე ისე ჩამოაყალიბო, რომ ვერავინ ვერ გაუგოს სხვანაირად.`,
        ],
        term.stem,
      );
      return {
        kind: 'defineTerm' as const,
        targetId: term.stem,
        text,
        rationale: `საკვანძო ტერმინი „${term.surface}" ${term.uses}-ჯერ გამოიყენა და არასდროს განუმარტავს.`,
        score: BASE.defineTerm + (term.loadBearing ? 1.5 : 0) + Math.min(1.5, term.uses * 0.4),
        sources: [],
        key: `defineTerm:${term.stem}`,
      };
    });
}

function counterexampleMoves(ctx: MoveContext): Move[] {
  return ctx.state.claims
    .filter((c) => c.scope === 'universal' && !c.examined)
    .map((c) => {
      const text = frame(
        [
          `ამბობ: „${quote(c.text)}". სცადე თავად იპოვო ერთი შემთხვევა, სადაც ეს არ იმუშავებდა. თუ ვერ პოულობ — რატომ არა?`,
          `„${quote(c.text)}" ყველა შემთხვევაზე ვრცელდება. ერთი კონტრმაგალითიც კმარა მის დასამხობად — შენ რომელს ეძებდი პირველად?`,
          `ეს მკაცრი წესია: „${quote(c.text)}". რა უნდა მომხდარიყო იმისთვის, რომ შენ თვითონ უარი გეთქვა მასზე?`,
        ],
        c.id,
      );
      return {
        kind: 'seekCounterexample' as const,
        targetId: c.id,
        text,
        rationale: 'უნივერსალური მტკიცება ჯერ არ შემოწმებულა კონტრმაგალითზე.',
        score: BASE.seekCounterexample + (c.force === 'strong' ? 1.2 : 0),
        sources: [],
        key: `seekCounterexample:${c.id}`,
      };
    });
}

function consequenceMoves(ctx: MoveContext): Move[] {
  const recent = ctx.fresh.filter((c) => c.force !== 'hedged');
  return recent.map((c) => {
    const text = frame(
      [
        `დავუშვათ, „${quote(c.text)}" მართალია. მაშინ რა გამომდინარეობს იმ შემთხვევებისთვის, რომლებზეც ჯერ არ გვისაუბრია?`,
        `თუ ეს ასეა, სად მიგვიყვანს? დაასახელე ერთი დასკვნა, რომელიც „${quote(c.text)}"-იდან აუცილებლად გამომდინარეობს — და რომელიც შენთვის მოულოდნელია.`,
        `„${quote(c.text)}" — მიჰყევი ბოლომდე. რას იტყოდი ამის მიხედვით ისეთ შემთხვევაზე, სადაც პასუხი უკვე გაქვს ინტუიციით?`,
      ],
      c.id,
    );
    return {
      kind: 'probeConsequence' as const,
      targetId: c.id,
      text,
      rationale: 'პოზიციის შედეგები ჯერ არ გამოუტანია.',
      score: BASE.probeConsequence,
      sources: [],
      key: `probeConsequence:${c.id}`,
    };
  });
}

function evidenceMoves(ctx: MoveContext): Move[] {
  return ctx.fresh
    .filter((c) => (c.type === 'factual' || c.type === 'causal') && c.force === 'strong')
    .map((c) => ({
      kind: 'askEvidence' as const,
      targetId: c.id,
      text: frame(
        [
          `„${quote(c.text)}" — რაზე ეყრდნობა? რა დაგარწმუნა ამაში?`,
          `რა უნდა გენახა, რომ „${quote(c.text)}"-ში დაგერწმუნებინა? და რა — რომ გადაგერწმუნებინა?`,
        ],
        c.id,
      ),
      rationale: 'ძლიერი მტკიცება დასაბუთების გარეშე.',
      score: BASE.askEvidence,
      sources: [],
      key: `askEvidence:${c.id}`,
    }));
}

/**
 * The highest-value move available: replace a vague dispute with a choice
 * between named positions the library actually documents. Grounded, so it
 * carries a source the user can go and read.
 */
function distinguishMoves(ctx: MoveContext): Move[] {
  const out: Move[] = [];
  for (const concept of ctx.activeConcepts) {
    if (!concept.positions || concept.positions.length < 2) continue;
    const listed = concept.positions.map((p) => `„${p.label}" (${p.gloss})`).join('; ');
    const ref = concept.topicId ? ctx.refFor(concept.topicId) : null;
    out.push({
      kind: 'distinguishPosition',
      targetId: concept.label,
      text: `„${concept.label}"-ზე საუბრისას სულ მცირე ორი სხვადასხვა რამ ერევა ერთმანეთში: ${listed}. შენ რომელს გულისხმობ? პასუხი ამაზეა დამოკიდებული.`,
      rationale: `ცნება „${concept.label}" ბიბლიოთეკაში რამდენიმე პოზიციად იშლება; არჩევანი ჯერ არ გაუკეთებია.`,
      score: BASE.distinguishPosition,
      sources: ref ? [ref] : [],
      key: `distinguishPosition:${concept.label}`,
    });
  }
  return out;
}

function caseMoves(ctx: MoveContext): Move[] {
  const out: Move[] = [];
  for (const concept of ctx.activeConcepts) {
    if (!concept.testCase) continue;
    const ref = concept.topicId ? ctx.refFor(concept.topicId) : null;
    out.push({
      kind: 'applyToCase',
      targetId: concept.testCase.label,
      text: `ერთი კონკრეტული შემთხვევა — ${concept.testCase.label}: ${concept.testCase.prompt}`,
      rationale: `ბიბლიოთეკაში აღწერილი შემთხვევა „${concept.testCase.label}" პირდაპირ ამოწმებს ამ პოზიციას.`,
      score: BASE.applyToCase,
      sources: ref ? [ref] : [],
      key: `applyToCase:${concept.testCase.label}`,
    });
  }
  return out;
}

/**
 * Under-specified requests. Philosophy declares no slots; a travel planner
 * declares origin, dates and pace, and this generator becomes the main driver.
 */
function goalMoves(ctx: MoveContext): Move[] {
  const slots = ctx.pack.goalSlots ?? [];
  if (slots.length === 0) return [];
  const said = new Set(ctx.state.terms.map((t) => t.stem));
  return slots
    .filter((slot) => !slot.filledBy.some((cue) => [...said].some((s) => s.startsWith(cue) || cue.startsWith(s))))
    .map((slot) => ({
      kind: 'clarifyGoal' as const,
      targetId: slot.id,
      text: slot.question,
      rationale: `პასუხისთვის საჭირო პარამეტრი „${slot.id}" ჯერ არ არის ცნობილი.`,
      score: BASE.clarifyGoal + slot.priority,
      sources: [],
      key: `clarifyGoal:${slot.id}`,
    }));
}

/**
 * Not a question: a mirror. Offered when the line of inquiry has gone deep
 * enough that another question would grind rather than open.
 */
function synthesisMove(ctx: MoveContext): Move[] {
  const { state } = ctx;
  const examined = state.claims.filter((c) => c.examined || c.turnIndex < state.turnIndex);
  if (examined.length < 2) return [];
  const bullets = examined
    .slice(-3)
    .map((c) => `• ${quote(c.text, 70)}`)
    .join('\n');
  const openItems = state.assumptions.filter((a) => a.status === 'inferred').slice(0, 1);
  const tail = openItems[0]
    ? `\n\nღიად რჩება: ${openItems[0].text}`
    : '';
  return [
    {
      kind: 'synthesize',
      text: `შევაჯამოთ, სად ვართ. შენ ამ საუბარში ააგე:\n${bullets}${tail}\n\nრომელი ნაწილი გინდა რომ უფრო გავამაგროთ?`,
      rationale: 'კითხვების სიღრმე ამოიწურა — ჯობს დაფიქსირდეს, რა აშენდა.',
      score: BASE.synthesize,
      sources: [],
      key: `synthesize:${state.turnIndex}`,
    },
  ];
}

/* ------------------------------ scoring -------------------------------- */

const NEAR_DUPLICATE = 0.72;

/**
 * State-sensitive adjustment. This is where "don't repeat yourself", "don't
 * drill forever" and "read the room" live.
 */
export function scoreMoves(candidates: readonly Move[], ctx: MoveContext, maxDepth: number): Move[] {
  const { state } = ctx;
  const asked = new Set(state.askedKeys);
  const scored: Move[] = [];

  for (const move of candidates) {
    // Hard block: the exact operation on the exact target, already used.
    if (asked.has(move.key)) continue;
    // Soft block: a near-identical question in different words.
    if (state.askedTexts.some((t) => jaccard(t.split(/\s+/), move.text.split(/\s+/)) >= NEAR_DUPLICATE)) continue;

    let score = move.score;

    // Same operation on a different target is repetitive but not forbidden.
    const kindUses = state.askedKeys.filter((k) => k.startsWith(`${move.kind}:`)).length;
    score -= kindUses * 1.8;

    // Depth control: past the budget, drilling loses to consolidating.
    if (state.depth >= maxDepth && move.kind !== 'synthesize') score -= 3 + (state.depth - maxDepth) * 1.5;

    // Pressure release: a run of unanswered questions makes another one worse.
    score -= state.consecutiveQuestions * 1.2;

    // Read the room: a disengaged user needs help, not another challenge.
    // Nobody can disengage on their first turn, so the signal only counts once
    // there is a conversation to withdraw from.
    if (state.turnIndex > 1 && state.engagement < 0.3) score -= 2.5;
    else if (state.engagement > 0.7) score += 1;

    // Grounded moves are preferred — the user can go and check them.
    if (move.sources.length > 0) score += 1;

    scored.push({ ...move, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function generateMoves(ctx: MoveContext): Move[] {
  return [
    ...contradictionMoves(ctx),
    ...goalMoves(ctx),
    ...distinguishMoves(ctx),
    ...assumptionMoves(ctx),
    ...definitionMoves(ctx),
    ...counterexampleMoves(ctx),
    ...caseMoves(ctx),
    ...consequenceMoves(ctx),
    ...evidenceMoves(ctx),
    ...synthesisMove(ctx),
  ];
}

/** Concepts whose cues appear in the conversation's recent language. */
export function activeConcepts(pack: DomainPack, state: ReasoningState, utterance: string): DomainConcept[] {
  const pool = new Set<string>([
    ...state.terms.map((t) => t.stem),
    ...utterance
      .normalize('NFC')
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')),
  ]);
  return pack.concepts.filter((c) =>
    c.cues.some((cue) => [...pool].some((word) => word.length >= 3 && (word.startsWith(cue) || cue.startsWith(word)))),
  );
}
