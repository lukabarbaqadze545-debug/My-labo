import { describe, expect, it } from 'vitest';
import {
  converse,
  emptyConversationState,
  normalize,
  detectIntents,
  topIntent,
  retrieve,
  resolveReference,
  isKnownButUncovered,
  type ConversationState,
} from '@/domain/conversation';
import { kaStemDeep, aliasIndex } from '@/language/ka';
import { library } from '@/content';
import { KNOWLEDGE } from '@/content/knowledge';
import { PHILOSOPHY, ARGUMENT_RELATIONS, philosophyNodeIds } from '@/content/philosophy';

/** Drive a multi-turn conversation and keep every step's result. */
function chat(messages: string[], options: { socratic?: boolean } = {}) {
  let state = emptyConversationState();
  const steps = [];
  for (const message of messages) {
    const result = converse(state, message, options);
    state = result.state;
    steps.push(result);
  }
  return { steps, state };
}

const one = (message: string, state: ConversationState = emptyConversationState()) =>
  converse(state, message);

/* ========================= Georgian morphology ========================= */

describe('Georgian morphology', () => {
  it('reduces every case form of a noun to one stem', () => {
    const forms = ['ვექტორი', 'ვექტორის', 'ვექტორს', 'ვექტორები', 'ვექტორებში', 'ვექტორებით'];
    const stems = new Set(forms.map(kaStemDeep));
    expect(stems.size).toBe(1);
    expect([...stems][0]).toBe('ვექტორ');
  });

  it('reduces algorithm forms alike', () => {
    expect(kaStemDeep('ალგორითმი')).toBe(kaStemDeep('ალგორითმები'));
    expect(kaStemDeep('ალგორითმზე')).toBe(kaStemDeep('ალგორითმი'));
  });

  it('leaves Latin words alone', () => {
    expect(kaStemDeep('binary')).toBe('binary');
    expect(kaStemDeep('SEARCH')).toBe('search');
  });

  it('never strips a word down to nothing', () => {
    for (const w of ['ის', 'და', 'ხე', 'რა', 'ნება']) {
      expect(kaStemDeep(w).length).toBeGreaterThanOrEqual(2);
    }
  });
});

/* ============================ normalization ============================ */

describe('normalization', () => {
  it('detects a mixed-script message', () => {
    expect(normalize('binary search ამიხსენი').script).toBe('mixed');
  });

  it('repairs a typo against the alias vocabulary', () => {
    const n = normalize('serach ამიხსენი');
    expect(n.repairs.length).toBeGreaterThan(0);
    expect(n.tokens).toContain('search');
  });

  it('flags a message that carries no subject of its own', () => {
    expect(normalize('უფრო მარტივად').isBareFollowUp).toBe(true);
    expect(normalize('ხო და ეგ?').isBareFollowUp).toBe(true);
    expect(normalize('binary search ამიხსენი').isBareFollowUp).toBe(false);
  });
});

/* ============================ intent layer ============================ */

describe('intent detection', () => {
  const s = emptyConversationState();

  it('reads conversational shortcuts without a topic present', () => {
    expect(topIntent(detectIntents(normalize('უფრო მარტივად'), s)).kind).toBe('simplify');
    expect(topIntent(detectIntents(normalize('მაგალითი?'), s)).kind).toBe('example');
    expect(topIntent(detectIntents(normalize('კიდევ ერთი'), s)).kind).toBe('another_example');
    expect(topIntent(detectIntents(normalize('რატომ?'), s)).kind).toBe('why');
  });

  it('does not read „კიდევ" as agreement because it starts with „კი"', () => {
    expect(topIntent(detectIntents(normalize('კიდევ'), s)).kind).toBe('another_example');
  });

  it('detects a correction over the words it contains', () => {
    const intent = topIntent(detectIntents(normalize('არა, სხვა რაღაც ვიგულისხმე'), s));
    expect(intent.kind).toBe('correction');
  });

  it('reads limitations from a natural phrasing', () => {
    expect(topIntent(detectIntents(normalize('როდის არ გამოდგება?'), s)).kind).toBe('limitations');
  });
});

/* ============================== retrieval ============================== */

describe('layered retrieval', () => {
  const s = emptyConversationState();

  it('reaches a Georgian topic from an English technical term', () => {
    const { candidates } = retrieve(normalize('binary search'), s);
    expect(candidates[0]?.topicId).toBe('searching');
  });

  it('handles a mixed-script request', () => {
    const { candidates } = retrieve(normalize('binary search როდის ვიყენებ?'), s);
    expect(candidates[0]?.topicId).toBe('searching');
  });

  it('resolves an acronym', () => {
    expect(retrieve(normalize('DP'), s).candidates[0]?.topicId).toBe('dynamic-programming');
    expect(retrieve(normalize('BFS'), s).candidates[0]?.topicId).toBe('graphs-and-paths');
  });

  it('recovers from a typo via the fuzzy rung', () => {
    const { candidates, layer } = retrieve(normalize('რეკურსიაა'), s);
    expect(candidates.length).toBeGreaterThan(0);
    expect(['alias', 'phrase', 'exact', 'token', 'fuzzy']).toContain(layer);
  });

  it('every alias with a topicId points at a real topic', () => {
    for (const entry of aliasIndex().byConcept.values()) {
      if (!entry.topicId) continue;
      expect(library.topicById.has(entry.topicId), `alias ${entry.concept}`).toBe(true);
    }
  });
});

/* ======================== the headline scenario ======================== */

describe('multi-turn conversation without exact wording', () => {
  it('runs the whole binary-search dialogue from the brief', () => {
    const { steps } = chat([
      'binary search ამიხსენი',
      'უფრო მარტივად',
      'მაგალითი?',
      'კიდევ ერთი',
      'რატომ არის სწრაფი?',
      'ხო და ეგ როდის არ გამოდგება?',
    ]);

    // 1. explained the right topic
    expect(steps[0]!.trace.action.topicId).toBe('searching');

    // 2. simplify kept the topic and used the plain-language facet
    expect(steps[1]!.trace.action.kind).toBe('simplify');
    expect(steps[1]!.trace.action.topicId).toBe('searching');
    expect(steps[1]!.trace.verdict).toBe('continue_from_context');

    // 3. example, still the same topic
    expect(steps[2]!.trace.action.kind).toBe('give_example');
    expect(steps[2]!.trace.action.topicId).toBe('searching');

    // 4. a *different* example
    expect(steps[3]!.trace.action.kind).toBe('give_another_example');
    expect(steps[3]!.reply.text).not.toBe(steps[2]!.reply.text);

    // 5. why, from context
    expect(steps[4]!.trace.action.kind).toBe('explain_why');
    expect(steps[4]!.trace.action.topicId).toBe('searching');

    // 6. „ეგ" resolved to binary search, limitations returned
    expect(steps[5]!.trace.reference?.concept).toBe('searching');
    expect(steps[5]!.trace.action.kind).toBe('limitations');
    expect(steps[5]!.reply.text).toMatch(/დალაგებულ/);

    // Nothing along the way was a dead end.
    for (const step of steps) {
      expect(step.trace.verdict).not.toBe('unparsed');
      expect(step.reply.text.length).toBeGreaterThan(10);
    }
  });

  it('never repeats the same example twice in a row', () => {
    const { steps } = chat(['binary search ამიხსენი', 'მაგალითი?', 'კიდევ', 'კიდევ ერთი']);
    const examples = steps.slice(1).map((s) => s.reply.text);
    expect(new Set(examples).size).toBe(examples.length);
  });

  it('handles a bare follow-up with no subject at all', () => {
    const { steps } = chat(['რეკურსია ამიხსენი', 'უფრო მარტივად']);
    expect(steps[1]!.trace.action.topicId).toBe('recursion');
    expect(steps[1]!.reply.text.length).toBeGreaterThan(20);
  });
});

/* ========================= reference resolution ========================= */

describe('reference resolution', () => {
  it('resolves „ეგ" to the concept under discussion', () => {
    const first = one('binary search ამიხსენი');
    const ref = resolveReference(normalize('ხო და ეგ?'), first.state);
    expect(ref?.concept).toBe('searching');
    expect(ref!.confidence).toBeGreaterThan(0.7);
  });

  it('asks rather than guessing when nothing has been discussed', () => {
    const result = one('და ეგ რატომ?');
    expect(result.trace.action.kind).toBe('clarify');
    expect(result.reply.text).toMatch(/\?/);
    // Crucially, this is not reported as a failure to understand.
    expect(result.trace.verdict).toBe('need_clarification');
  });

  it('„წინა" reaches the topic before the current one', () => {
    const { steps } = chat(['binary search ამიხსენი', 'რეკურსია ამიხსენი', 'წინა თემას დავუბრუნდეთ']);
    expect(steps[2]!.trace.action.kind).toBe('switch_topic');
    expect(steps[2]!.trace.action.topicId).toBe('searching');
  });
});

/* ======================= unknown wording vs knowledge ================== */

describe('unknown wording is not unknown knowledge', () => {
  it('recognises a concept it does not cover and says so precisely', () => {
    const result = one('ვექტორის მაგალითი');
    expect(isKnownButUncovered('vector')).toBe(true);
    expect(result.trace.verdict).toBe('known_but_missing');
    expect(result.trace.action.kind).toBe('admit_missing_knowledge');
    // Language confidence stays high — we read the message perfectly.
    expect(result.trace.confidence.language).toBeGreaterThan(0.8);
    expect(result.trace.confidence.knowledge).toBe(0);
  });

  it('reports low language confidence only when the words are genuinely opaque', () => {
    const result = one('ჰსდფგ ქწერტყ ზხცვბ');
    expect(result.trace.confidence.language).toBeLessThan(0.6);
    expect(['unparsed', 'need_clarification']).toContain(result.trace.verdict);
  });

  it('does not fabricate when knowledge is missing', () => {
    const result = one('ვექტორის მაგალითი');
    expect(result.reply.sources).toHaveLength(0);
    expect(result.reply.text).toMatch(/არ მაქვს|არ ვფარავ/);
  });

  it('offers a clarification instead of dead-ending on a vague correction', () => {
    const { steps } = chat(['binary search ამიხსენი', 'არა, სხვა რაღაც ვიგულისხმე']);
    const last = steps[1]!;
    expect(['clarify', 'acknowledge_correction']).toContain(last.trace.action.kind);
    expect(last.reply.text.length).toBeGreaterThan(10);
    expect(last.trace.verdict).not.toBe('unparsed');
  });

  it('follows an explicit correction to the named concept', () => {
    const { steps } = chat(['binary search ამიხსენი', 'არა, რეკურსია ვიგულისხმე']);
    expect(steps[1]!.trace.action.concept).toBe('recursion');
  });
});

/* ============================== philosophy ============================= */

describe('philosophy domain', () => {
  it('switches domain on request', () => {
    const { steps } = chat(['binary search ამიხსენი', 'კარგი, ფილოსოფიაზე გადავიდეთ']);
    expect(steps[1]!.trace.action.topicId).toBe('free-will');
  });

  it('engages with a determinism question using stored positions', () => {
    const result = one('თუ ყველაფერი მიზეზებით ხდება, მაშინ არჩევანი თავისუფალია?');
    expect(result.trace.action.concept).toBe('free-will');
    expect(result.reply.text.length).toBeGreaterThan(60);
    expect(result.trace.verdict).not.toBe('unparsed');
  });

  it('produces a real counterargument from the stored corpus', () => {
    const { steps } = chat(['თავისუფალი ნება არ არსებობს.', 'კონტრარგუმენტი?']);
    const last = steps[1]!;
    expect(last.trace.action.kind).toBe('give_counterargument');
    expect(last.reply.text.length).toBeGreaterThan(40);
  });

  it('asks a Socratic question rather than lecturing, in Socratic mode', () => {
    const { steps } = chat(['თავისუფალი ნება არ არსებობს.'], { socratic: true });
    expect(steps[0]!.trace.action.kind).toBe('ask_socratic_question');
    expect(steps[0]!.reply.text).toMatch(/\?/);
  });

  it('does not repeat the same Socratic question', () => {
    const { steps } = chat(
      ['თავისუფალი ნება არ არსებობს.', 'ჰო, ასე ვფიქრობ.', 'და მაინც?'],
      { socratic: true },
    );
    const asked = steps.filter((s) => s.trace.action.kind === 'ask_socratic_question');
    expect(new Set(asked.map((s) => s.reply.text)).size).toBe(asked.length);
  });

  it('compares stored positions when asked', () => {
    const { steps } = chat(['თავისუფალი ნება', 'შეადარე']);
    expect(steps[1]!.reply.text).toMatch(/კომპატიბილიზმი/);
  });
});

/* ============================= teach labo ============================= */

describe('teach labo', () => {
  const taught = [
    {
      concept: 'searching',
      topicId: 'searching',
      label: 'ჩემი ტერმინი',
      forms: ['ჩხრეკვა', 'ნახევრად ჭრა'],
      weight: 1.4,
    },
  ];

  it('a taught word reaches the topic it was taught for', () => {
    const before = retrieve(normalize('ჩხრეკვა'), emptyConversationState());
    const after = retrieve(normalize('ჩხრეკვა'), emptyConversationState(), taught);
    expect(before.candidates[0]?.topicId).not.toBe('searching');
    expect(after.candidates[0]?.topicId).toBe('searching');
  });

  it('a taught word works end to end in a conversation', () => {
    const result = converse(emptyConversationState(), 'ნახევრად ჭრა ამიხსენი', {
      extraAliases: taught,
    });
    expect(result.trace.action.topicId).toBe('searching');
    expect(result.reply.text.length).toBeGreaterThan(30);
  });

  it('teaching does not leak into the default vocabulary', () => {
    const result = converse(emptyConversationState(), 'ჩხრეკვა ამიხსენი');
    expect(result.trace.action.topicId).not.toBe('searching');
  });
});

/* ========================= content integrity ========================== */

describe('knowledge integrity', () => {
  it('every knowledge facet anchors to a real topic', () => {
    for (const entry of KNOWLEDGE) {
      expect(library.topicById.has(entry.topicId), entry.id).toBe(true);
    }
  });

  it('every philosophy concept with a topicId points at a real topic', () => {
    for (const concept of PHILOSOPHY) {
      if (!concept.topicId) continue;
      expect(library.topicById.has(concept.topicId), concept.id).toBe(true);
    }
  });

  it('every argument relation references a declared node', () => {
    const ids = philosophyNodeIds();
    for (const rel of ARGUMENT_RELATIONS) {
      expect(ids.has(rel.from), `from ${rel.from}`).toBe(true);
      expect(ids.has(rel.to), `to ${rel.to}`).toBe(true);
    }
  });

  it('every philosophy concept carries sources and Socratic questions', () => {
    for (const concept of PHILOSOPHY) {
      expect(concept.sources.length, concept.id).toBeGreaterThan(0);
      expect(concept.socraticQuestions.length, concept.id).toBeGreaterThan(0);
      expect(concept.positions.length, concept.id).toBeGreaterThan(0);
    }
  });
});

/* ============================== inspector ============================= */

describe('debug trace', () => {
  it('reports every stage for a context-dependent message', () => {
    const { steps } = chat(['binary search ამიხსენი', 'ხო და ეგ როდის არ გამოდგება?']);
    const trace = steps[1]!.trace;
    expect(trace.normalized.tokens.length).toBeGreaterThan(0);
    expect(trace.intents.length).toBeGreaterThan(0);
    expect(trace.reference?.surface).toBe('ეგ');
    expect(trace.layerUsed).toBe('context');
    expect(trace.confidence.context).toBeGreaterThan(0.5);
    expect(trace.action.kind).toBe('limitations');
    expect(Object.keys(trace.timings).length).toBeGreaterThan(4);
  });

  it('states an unknown reason whenever it does not simply answer', () => {
    const result = one('და ეგ რატომ?');
    expect(result.trace.unknownReason).toBeTruthy();
  });
});

/* ============================= robustness ============================= */

describe('robustness', () => {
  it('handles every conversational shortcut from the brief without failing', () => {
    const shortcuts = [
      'მარტივად', 'რატომ?', 'მაგალითი?', 'კიდევ', 'სხვა მაგალითი', 'როდის ვიყენებ?',
      'და ეგ?', 'შეადარე', 'კონტრარგუმენტი?', 'უფრო ღრმად', 'შეაჯამე',
    ];
    for (const shortcut of shortcuts) {
      const { steps } = chat(['binary search ამიხსენი', shortcut]);
      const last = steps[1]!;
      expect(last.reply.text.length, shortcut).toBeGreaterThan(5);
      expect(last.trace.verdict, shortcut).not.toBe('unparsed');
    }
  });

  it('handles mixed Georgian-English phrasings from the brief', () => {
    const cases: [string, string][] = [
      ['binary search როდის ვიყენებ?', 'searching'],
      ['DP უფრო მარტივად ამიხსენი', 'dynamic-programming'],
      ['BFS-ზე კიდევ ერთი მაგალითი', 'graphs-and-paths'],
    ];
    for (const [text, expected] of cases) {
      const result = one(text);
      expect(result.trace.action.topicId, text).toBe(expected);
    }
  });

  it('stays fast enough to feel instant', () => {
    const started = Date.now();
    chat(['binary search ამიხსენი', 'უფრო მარტივად', 'მაგალითი?', 'კიდევ', 'რატომ?']);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('keeps conversation state bounded', () => {
    const { state } = chat(Array.from({ length: 30 }, (_, i) => `მაგალითი? ${i}`));
    expect(state.turns.length).toBeLessThanOrEqual(12);
    expect(state.recentEntities.length).toBeLessThanOrEqual(8);
    expect(state.servedKeys.length).toBeLessThanOrEqual(60);
  });
});

/* ===================== conversational naturalness (sonnet) ===================== */

describe('domain introduction', () => {
  it('orients across the field instead of dumping one topic', () => {
    const result = one('ფილოსოფიაზე რას მეტყვი?');
    expect(result.trace.action.kind).toBe('domain_intro');
    // Crucially, it must NOT have zoomed straight into one topic's article.
    expect(result.trace.action.topicId).toBeUndefined();
    expect(result.reply.text).not.toMatch(/^„?თავისუფალი ნება/);
    expect(result.reply.text).toMatch(/\?/);
    expect(result.reply.text.length).toBeLessThan(500);
  });

  it('recognises several natural phrasings of the same broad request', () => {
    for (const q of ['ფილოსოფიაზე რას მეტყვი?', 'ფილოსოფიაზე მინდა საუბარი', 'რა არის ფილოსოფია?', 'ფილოსოფია']) {
      const result = one(q);
      expect(result.trace.action.kind, q).toBe('domain_intro');
    }
  });

  it('does not treat a specific question about the field as a domain intro', () => {
    const result = one('ფილოსოფიაში კანტის კატეგორიული იმპერატივი რას ნიშნავს?');
    expect(result.trace.action.kind).not.toBe('domain_intro');
  });

  it('offers real topic names as sources and suggestions, not raw ids', () => {
    const result = one('ბიოლოგიაზე რას მეტყვი?');
    expect(result.trace.action.kind).toBe('domain_intro');
    for (const s of result.reply.sources) {
      expect(s.label).not.toMatch(/^[a-z-]+$/); // not a slug/id
    }
  });

  it('"შენ აირჩიე თემა" picks a real topic from the introduced domain', () => {
    const { steps } = chat(['ფილოსოფიაზე რას მეტყვი?', 'შენ აირჩიე თემა']);
    expect(steps[1]!.trace.action.kind).toBe('explain');
    expect(steps[1]!.trace.action.topicId).toBeTruthy();
    const topic = library.topicById.get(steps[1]!.trace.action.topicId!);
    expect(topic?.subjectId).toBe('philosophy');
  });
});

describe('greeting and repetition control', () => {
  it('never repeats the exact same greeting three times running', () => {
    const { steps } = chat(['გამარჯობა', 'გამარჯობა', 'გამარჯობა']);
    const texts = steps.map((s) => s.reply.text);
    expect(new Set(texts).size).toBeGreaterThan(1);
    for (const step of steps) expect(step.trace.action.kind).toBe('smalltalk');
  });

  it('answers a check-in before pivoting, distinctly from a bare hello', () => {
    const howAreYou = one('როგორ ხარ?');
    const hello = one('გამარჯობა');
    expect(howAreYou.trace.action.kind).toBe('smalltalk');
    expect(howAreYou.reply.text).not.toBe(hello.reply.text);
  });

  it('greeting never triggers book or topic retrieval', () => {
    const result = one('გამარჯობა');
    expect(result.trace.candidates).toHaveLength(0);
    expect(result.trace.action.topicId).toBeUndefined();
  });

  it('thanks and stop get their own distinct replies, not the greeting text', () => {
    const thanks = one('მადლობა');
    const stop = one('კმარა');
    const hello = one('გამარჯობა');
    expect(thanks.reply.text).not.toBe(hello.reply.text);
    expect(stop.reply.text).not.toBe(hello.reply.text);
    expect(thanks.reply.text).not.toBe(stop.reply.text);
  });
});

describe('opinion, disagreement and deferred choice', () => {
  it('is honest about not having a personal opinion, and shows real positions', () => {
    const { steps } = chat(['თავისუფალი ნება', 'შენ რას ფიქრობ?']);
    const opinion = steps[1]!;
    expect(opinion.trace.action.kind).toBe('state_opinion');
    expect(opinion.reply.text).toMatch(/აზრი არ მაქვს|შეხედულება არ მაქვს/);
    expect(opinion.reply.text).toMatch(/კომპატიბილიზმი|დეტერმინიზმი/);
  });

  it('responds to disagreement with a counterargument, not a repeated explanation', () => {
    const { steps } = chat(['თავისუფალი ნება არ არსებობს.', 'არ გეთანხმები']);
    const disagree = steps[1]!;
    expect(disagree.trace.action.kind).toBe('give_counterargument');
    expect(disagree.reply.text.length).toBeGreaterThan(20);
  });

  it('an explicit counterargument request after disagreeing gives a different one', () => {
    const { steps } = chat([
      'თავისუფალი ნება არ არსებობს.',
      'არ გეთანხმები',
      'კონტრარგუმენტი მომეცი',
    ]);
    expect(steps[1]!.reply.text).not.toBe(steps[2]!.reply.text);
  });

  it('an explicit request for a question gets an unused socratic question', () => {
    const { steps } = chat([
      'თავისუფალი ნება არ არსებობს.',
      'დამისვი კითხვა',
    ]);
    const quiz = steps[1]!;
    expect(quiz.trace.action.kind).toBe('quiz');
    expect(quiz.reply.text).toMatch(/\?/);
  });
});

describe('question cadence', () => {
  it('does not ask a socratic question after every single declarative claim', () => {
    const { steps } = chat([
      'მკვლელობა ყოველთვის ცუდია.',
      'ომი ყოველთვის ცუდია.',
      'სიცრუე ყოველთვის ცუდია.',
    ]);
    const questionTurns = steps.filter((s) => s.trace.action.kind === 'ask_socratic_question').length;
    // Some engagement is fine; a question on literally every turn is the bug.
    expect(questionTurns).toBeLessThan(steps.length);
  });
});

describe('language layer actually shapes replies', () => {
  it('a philosophical comparison reads as connected prose, not a bullet list', () => {
    const result = one('თავისუფალი ნება შეადარე');
    expect(result.reply.text).not.toContain('•');
  });

  it('a counterargument reads as connected prose, not a labelled bullet list', () => {
    const { steps } = chat(['თავისუფალი ნება არ არსებობს.', 'კონტრარგუმენტი?']);
    expect(steps[1]!.reply.text).not.toContain('•');
    expect(steps[1]!.reply.text).not.toMatch(/^თავი:/);
  });
});
