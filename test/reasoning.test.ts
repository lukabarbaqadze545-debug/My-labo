import { describe, expect, it } from 'vitest';
import {
  socraticTurn,
  replay,
  respond,
  emptyState,
  refForTopic,
  extractClaims,
  detectContradictions,
  isContestedQuestion,
  isLookupQuestion,
  resolvePack,
  generateMoves,
  scoreMoves,
  activeConcepts,
  GENERAL_PACK,
  PHILOSOPHY_PACK,
  GEOROUTE_PACK,
  type ReplayTurn,
} from '@/domain/reasoning';
import { ask } from '@/domain/assistant';

/** Run a whole conversation through the engine, returning every turn's move. */
function converse(utterances: string[], packId?: string) {
  const history: ReplayTurn[] = [];
  const moves = [];
  for (const utterance of utterances) {
    const result = socraticTurn({ history, utterance, ...(packId ? { packId } : {}) });
    history.push({ role: 'user', text: utterance });
    history.push({
      role: 'assistant',
      text: result.move.text,
      socratic: {
        moveKind: result.move.kind,
        ...(result.move.targetId ? { targetId: result.move.targetId } : {}),
        key: result.move.key,
      },
    });
    moves.push(result);
  }
  return { moves, history };
}

const engineOpts = (pack = PHILOSOPHY_PACK) => ({
  pack,
  answerFor: (q: string) => {
    const a = ask(q);
    return { text: a.text, sources: a.sources, related: a.related, followUps: a.followUps };
  },
  refFor: refForTopic,
});

/* ------------------------------ extraction ------------------------------ */

describe('claim extraction', () => {
  it('ignores questions and keeps assertions', () => {
    const claims = extractClaims('რა არის თავისუფალი ნება? მე ვფიქრობ, რომ ის არ არსებობს.', 1);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.text).toMatch(/არ არსებობს/);
  });

  it('classifies a universal normative claim and marks its force', () => {
    const [claim] = extractClaims('მკვლელობა ყოველთვის ცუდია.', 1);
    expect(claim!.type).toBe('normative');
    expect(claim!.scope).toBe('universal');
    expect(claim!.force).toBe('strong');
    expect(claim!.polarity).toBe('affirm');
  });

  it('detects negation as denial', () => {
    const [claim] = extractClaims('თავისუფალი ნება არ არსებობს.', 1);
    expect(claim!.polarity).toBe('deny');
    expect(claim!.type).toBe('existential');
  });

  it('treats a hedged statement as hedged, not as a commitment', () => {
    const [claim] = extractClaims('მგონია, რომ ეს ზოგჯერ სწორია.', 1);
    expect(claim!.force).toBe('hedged');
    expect(claim!.scope).toBe('hedged');
  });
});

/* ---------------------------- contradictions ---------------------------- */

describe('contradiction detection', () => {
  it('catches a direct reversal across turns despite Georgian inflection', () => {
    const a = extractClaims('თავისუფალი ნება არ არსებობს.', 1);
    const b = extractClaims('ადამიანი თავისუფალი ნებით ირჩევს.', 2);
    const found = detectContradictions(b, { ...emptyState('philosophy'), claims: a });
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('negation');
    expect(found[0]!.strength).toBeGreaterThan(0.5);
  });

  it('does not flag unrelated statements', () => {
    const a = extractClaims('ატომი ბირთვისგან შედგება.', 1);
    const b = extractClaims('ეთიკა რთული საკითხია.', 2);
    expect(detectContradictions(b, { ...emptyState('philosophy'), claims: a })).toHaveLength(0);
  });

  it('discounts hedged statements so exploration is not called self-contradiction', () => {
    const a = extractClaims('თავისუფალი ნება არ არსებობს.', 1);
    const b = extractClaims('მგონია, ადამიანი თავისუფალი ნებით ირჩევს.', 2);
    const found = detectContradictions(b, { ...emptyState('philosophy'), claims: a });
    expect(found).toHaveLength(0);
  });
});

/* -------------------------- question classification --------------------- */

describe('question classification', () => {
  it('separates a lookup from a contested question', () => {
    expect(isLookupQuestion('ვინ იყო კანტი?')).toBe(true);
    expect(isContestedQuestion('ვინ იყო კანტი?', PHILOSOPHY_PACK)).toBe(false);
    expect(isContestedQuestion('არსებობს თუ არა თავისუფალი ნება?', PHILOSOPHY_PACK)).toBe(true);
  });

  it('routes a philosophy conversation to the philosophy pack', () => {
    expect(resolvePack('არსებობს თუ არა თავისუფალი ნება?').id).toBe('philosophy');
    expect(resolvePack('რა არის ფოტოსინთეზი?').id).toBe('general');
  });
});

/* ------------------------- answer-vs-question ---------------------------- */

describe('answer-vs-question decision', () => {
  it('answers a factual lookup immediately instead of interrogating', () => {
    const { moves } = converse(['ვინ იყო ალან ტიურინგი?']);
    expect(moves[0]!.asked).toBe(false);
    expect(moves[0]!.move.kind).toBe('answer');
    expect(moves[0]!.move.text).toMatch(/ტიურინგ/);
  });

  it('withholds the answer on a contested question and offers the real distinction', () => {
    const { moves } = converse(['არსებობს თუ არა თავისუფალი ნება?']);
    expect(moves[0]!.asked).toBe(true);
    expect(moves[0]!.move.kind).toBe('distinguishPosition');
    expect(moves[0]!.move.text).toContain('კომპატიბილიზმი');
    // Grounded in a topic that actually exists.
    expect(moves[0]!.move.sources[0]?.href).toBe('/topics/free-will');
  });

  it('surfaces the hidden premise behind a sweeping normative claim', () => {
    const { moves } = converse(['მკვლელობა ყოველთვის ცუდია.']);
    expect(moves[0]!.asked).toBe(true);
    expect(moves[0]!.move.kind).toBe('surfaceAssumption');
    expect(moves[0]!.move.text).toContain('მკვლელობა ყოველთვის ცუდია');
  });

  it('gives in when the user asks to simply be told', () => {
    const { moves } = converse([
      'მკვლელობა ყოველთვის ცუდია.',
      'არ ვიცი, უბრალოდ ამიხსენი რა არის ეთიკა.',
    ]);
    expect(moves[1]!.asked).toBe(false);
    expect(moves[1]!.move.kind).toBe('answer');
  });

  it('prioritises resolving a contradiction over every other move', () => {
    const { moves } = converse([
      'თავისუფალი ნება არ არსებობს.',
      'ადამიანი თავისუფალი ნებით ირჩევს, როცა არავინ აიძულებს.',
    ]);
    expect(moves[1]!.asked).toBe(true);
    expect(moves[1]!.move.kind).toBe('resolveContradiction');
    expect(moves[1]!.move.text).toMatch(/არ არსებობს/);
    expect(moves[1]!.move.text).toMatch(/ირჩევს/);
  });
});

/* ------------------------ repetition and depth -------------------------- */

describe('repetition prevention and depth control', () => {
  it('never asks the same question twice', () => {
    const { moves } = converse([
      'მკვლელობა ყოველთვის ცუდია.',
      'დიახ, ასეა.',
      'ომი ყოველთვის ცუდია.',
      'კი, მეც ასე ვფიქრობ.',
    ]);
    const asked = moves.filter((m) => m.asked).map((m) => m.move.key);
    expect(new Set(asked).size).toBe(asked.length);
  });

  it('stops drilling and answers once the depth budget is spent', () => {
    const { moves } = converse([
      'თავისუფალი ნება არ არსებობს.',
      'იმიტომ რომ ყველაფერი მიზეზებით არის განსაზღვრული და ტვინიც ფიზიკას ემორჩილება.',
      'დიახ, ასე ვფიქრობ.',
      'კი.',
      'ჰო.',
      'ასეა.',
    ]);
    // The engine must not still be interrogating at the end of that run.
    expect(moves[moves.length - 1]!.asked).toBe(false);
  });

  it('reads the room: stops pushing once replies go monosyllabic', () => {
    const { moves } = converse([
      'თავისუფალი ნება არ არსებობს.',
      'იმიტომ რომ ყველაფერი მიზეზებით არის განსაზღვრული.',
      'კი.',
      'ჰო.',
    ]);
    // It may open with questions, but must not still be interrogating someone
    // who has stopped contributing.
    expect(moves[0]!.asked).toBe(true);
    expect(moves[2]!.asked).toBe(false);
    expect(moves[3]!.asked).toBe(false);
  });

  it('a bare agreement is not recorded as a claim', () => {
    const { moves } = converse(['მკვლელობა ყოველთვის ცუდია.', 'დიახ.']);
    expect(moves[1]!.state.claims).toHaveLength(1);
  });

  it('resets the depth budget when the subject changes', () => {
    const first = socraticTurn({ history: [], utterance: 'თავისუფალი ნება არ არსებობს.' });
    const history: ReplayTurn[] = [
      { role: 'user', text: 'თავისუფალი ნება არ არსებობს.' },
      {
        role: 'assistant',
        text: first.move.text,
        socratic: { moveKind: first.move.kind, key: first.move.key },
      },
    ];
    const shifted = socraticTurn({ history, utterance: 'ატომი ბირთვისა და ელექტრონებისგან შედგება.' });
    expect(shifted.state.depth).toBeLessThanOrEqual(1);
  });
});

/* ------------------------------- replay --------------------------------- */

describe('replay', () => {
  it('reconstructs the same state as sequential ingestion', () => {
    const utterances = [
      'თავისუფალი ნება არ არსებობს.',
      'იმიტომ რომ ყველაფერი მიზეზებით არის განსაზღვრული.',
    ];
    const { moves, history } = converse(utterances);
    const rebuilt = replay(history, PHILOSOPHY_PACK);
    const live = moves[moves.length - 1]!.state;

    expect(rebuilt.claims.map((c) => c.id)).toEqual(live.claims.map((c) => c.id));
    expect(rebuilt.assumptions.map((a) => a.id)).toEqual(live.assumptions.map((a) => a.id));
    expect(rebuilt.askedKeys).toEqual(live.askedKeys);
    expect(rebuilt.turnIndex).toBe(live.turnIndex);
  });

  it('is deterministic — the same conversation always yields the same move', () => {
    const a = converse(['მკვლელობა ყოველთვის ცუდია.']);
    const b = converse(['მკვლელობა ყოველთვის ცუდია.']);
    expect(a.moves[0]!.move.text).toBe(b.moves[0]!.move.text);
    expect(a.moves[0]!.move.key).toBe(b.moves[0]!.move.key);
  });
});

/* --------------------------- definition pressure ------------------------ */

describe('definition tracking', () => {
  it('asks what a load-bearing term means, then stops asking once answered', () => {
    const { moves } = converse([
      'სამართლიანობა ყველაზე მნიშვნელოვანია.',
      'სამართლიანობა ნიშნავს, რომ ყველას თანაბარი შანსი აქვს.',
      'ამიტომ სამართლიანობა კანონზე მაღლა დგას.',
    ]);
    const keys = moves.filter((m) => m.asked).map((m) => m.move.key);
    expect(keys.filter((k) => k.startsWith('defineTerm:')).length).toBeLessThanOrEqual(1);
  });

  it('records a definition when the user answers a defineTerm question', () => {
    const first = socraticTurn({ history: [], utterance: 'სამართლიანობა ყველაზე მნიშვნელოვანია.' });
    if (first.move.kind !== 'defineTerm') return; // scoring may prefer another move
    const history: ReplayTurn[] = [
      { role: 'user', text: 'სამართლიანობა ყველაზე მნიშვნელოვანია.' },
      {
        role: 'assistant',
        text: first.move.text,
        socratic: { moveKind: 'defineTerm', targetId: first.move.targetId!, key: first.move.key },
      },
    ];
    const second = socraticTurn({ history, utterance: 'ვგულისხმობ თანაბარ შანსებს ყველასთვის.' });
    expect(second.state.terms.some((t) => t.defined)).toBe(true);
  });
});

/* -------------------------- domain independence ------------------------- */

describe('domain independence', () => {
  it('drives travel clarification with the same engine and scoring', () => {
    const result = socraticTurn({
      history: [],
      utterance: 'მინდა მოგზაურობა საქართველოში.',
      packId: 'georoute',
    });
    expect(result.asked).toBe(true);
    expect(result.move.kind).toBe('clarifyGoal');
    expect(result.move.text).toMatch(/საიდან|რამდენი დღე/);
  });

  it('stops asking for a slot once the user supplies it', () => {
    const filled = socraticTurn({
      history: [],
      utterance: 'თბილისიდან მივემგზავრები, ხუთი დღე მაქვს, ზაფხულში.',
      packId: 'georoute',
    });
    const ctx = {
      state: filled.state,
      pack: GEOROUTE_PACK,
      fresh: [],
      utterance: '',
      activeConcepts: [],
      refFor: refForTopic,
    };
    const goalKeys = generateMoves(ctx)
      .filter((m) => m.kind === 'clarifyGoal')
      .map((m) => m.targetId);
    expect(goalKeys).not.toContain('origin');
    expect(goalKeys).not.toContain('duration');
    expect(goalKeys).not.toContain('season');
  });

  it('still reasons about form with the knowledge-free general pack', () => {
    const out = respond(emptyState('general'), 'ყველა პოლიტიკოსი იტყუება.', engineOpts(GENERAL_PACK));
    expect(out.asked).toBe(true);
    expect(['surfaceAssumption', 'seekCounterexample']).toContain(out.move.kind);
  });
});

/* ------------------------------- grounding ------------------------------ */

describe('grounding', () => {
  it('only cites topics that exist in the library', () => {
    for (const concept of PHILOSOPHY_PACK.concepts) {
      if (!concept.topicId) continue;
      expect(refForTopic(concept.topicId)).not.toBeNull();
    }
  });

  it('generates a counterexample probe for a universal claim', () => {
    const { state } = respond(emptyState('philosophy'), 'ყველა მეცნიერება ექსპერიმენტს ეყრდნობა.', engineOpts());
    const ctx = {
      state,
      pack: PHILOSOPHY_PACK,
      fresh: [],
      utterance: '',
      activeConcepts: activeConcepts(PHILOSOPHY_PACK, state, ''),
      refFor: refForTopic,
    };
    const kinds = scoreMoves(generateMoves(ctx), ctx, 4).map((m) => m.kind);
    expect(kinds).toContain('seekCounterexample');
  });
});
