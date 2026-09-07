import { describe, expect, it } from 'vitest';
import {
  META_CLOSE,
  META_OPEN,
  buildContext,
  buildSystemPrompt,
  parseEnvelope,
  reason,
  usedEvidence,
  validateClaims,
  visibleText,
  type Evidence,
  type LlmProvider,
  type ReasoningEnvelope,
} from '@/domain/llm';
import { emptyConversationState } from '@/domain/conversation';
import { buildKnowledgeGraph } from '@/domain/knowledge';
import { buildPreview, previewToBook, type BookCorpus, type ImportPreview } from '@/domain/books';
import type { ChatTurn } from '@/lib/claude';
import { GEORGIAN_BOOK } from './helpers/sampleBooks';

/**
 * The reasoning layer is tested against a fake provider.
 *
 * That is deliberate and is not a stand-in for the model: what needs proving
 * here is the machinery *around* the model — that retrieval feeds it, that its
 * claims are checked against the evidence, that citations survive, and that
 * every failure path still produces an answer. Those are exactly the things a
 * live API call would make untestable.
 */

interface Fake extends LlmProvider {
  calls: { system: string; messages: ChatTurn[] }[];
}

function fakeProvider(
  script: string | ((system: string) => string),
  options: { available?: boolean; error?: Error } = {},
): Fake {
  const calls: Fake['calls'] = [];
  return {
    id: 'fake',
    calls,
    available: () => options.available !== false,
    async stream(request, onText) {
      calls.push({ system: request.system, messages: request.messages });
      if (options.error) throw options.error;
      const text = typeof script === 'function' ? script(request.system) : script;
      // Deliver in small pieces, the way a real stream arrives.
      for (let i = 0; i < text.length; i += 7) onText(text.slice(i, i + 7));
      return text;
    },
  };
}

function withMeta(prose: string, meta: Record<string, unknown>): string {
  return `${prose}\n${META_OPEN}\n${JSON.stringify(meta)}\n${META_CLOSE}`;
}

const evidence = (id: string, text: string, extra: Partial<Evidence> = {}): Evidence => ({
  id,
  kind: 'topic',
  title: `მასალა ${id}`,
  text,
  ...extra,
});

const envelopeOf = (
  claims: ReasoningEnvelope['claims'],
  prose = 'პასუხი.',
): ReasoningEnvelope => ({ prose, claims, structured: true });

/* A real ingested Georgian book, through the real pipeline. */
const georgian = buildPreview(GEORGIAN_BOOK, { bookId: 'b_geo', importedAt: 1000 });
function corpusOf(preview: ImportPreview, id: string): BookCorpus {
  return {
    books: [previewToBook(preview, id, 1000)],
    chunks: preview.chunks,
    sections: preview.sections,
    knowledge: preview.knowledge,
  };
}
const bookCorpus = corpusOf(georgian, 'b_geo');

/* ========================= streaming and parsing ========================= */

describe('streaming safety', () => {
  it('never shows the metadata block, even half-arrived', () => {
    expect(visibleText('გამარჯობა')).toBe('გამარჯობა');
    expect(visibleText(`პასუხი\n${META_OPEN}\n{"claims":[]}`)).toBe('პასუხი');
    // A partial delimiter must be hidden until it is resolved either way.
    expect(visibleText('პასუხი\n<<<LABO')).toBe('პასუხი');
    expect(visibleText('პასუხი<<')).toBe('პასუხი');
  });

  it('emits progressively growing text and never leaks the block', async () => {
    const seen: string[] = [];
    const provider = fakeProvider(
      withMeta('ორმაგი ძებნა ნახევრად ჰყოფს დიაპაზონს.', { claims: [], confidence: 0.9 }),
    );
    await reason({
      message: 'რა არის შავი ხვრელი?',
      state: emptyConversationState(),
      mode: 'labo_llm',
      provider,
      onText: (text) => seen.push(text),
    });

    expect(seen.length).toBeGreaterThan(1);
    for (const step of seen) {
      expect(step).not.toContain(META_OPEN);
      expect(step).not.toContain('claims');
    }
    // Monotonic growth: the user never sees text shrink.
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!.length).toBeGreaterThanOrEqual(seen[i - 1]!.length - 1);
    }
  });
});

describe('envelope parsing', () => {
  it('reads claims, follow-up and confidence', () => {
    const parsed = parseEnvelope(
      withMeta('ტექსტი.', {
        claims: [{ text: 'ა', status: 'grounded', evidence: ['E1'] }],
        followUp: 'და შენ რას ფიქრობ?',
        confidence: 0.7,
      }),
    );
    expect(parsed.prose).toBe('ტექსტი.');
    expect(parsed.structured).toBe(true);
    expect(parsed.claims[0]).toEqual({ text: 'ა', status: 'grounded', evidenceIds: ['E1'] });
    expect(parsed.followUp).toBe('და შენ რას ფიქრობ?');
    expect(parsed.confidence).toBe(0.7);
  });

  it('keeps the answer when the model returns no metadata at all', () => {
    const parsed = parseEnvelope('უბრალოდ პასუხი, ბლოკის გარეშე.');
    expect(parsed.prose).toBe('უბრალოდ პასუხი, ბლოკის გარეშე.');
    expect(parsed.structured).toBe(false);
    expect(parsed.claims).toEqual([]);
  });

  it('keeps the answer when the metadata is malformed', () => {
    const parsed = parseEnvelope(`პასუხი.\n${META_OPEN}\n{"claims": [broken\n${META_CLOSE}`);
    expect(parsed.prose).toBe('პასუხი.');
    expect(parsed.structured).toBe(false);
  });

  it('survives a truncated block that never closes', () => {
    const parsed = parseEnvelope(
      `პასუხი.\n${META_OPEN}\n{"claims":[{"text":"ა","status":"grounded","evidence":[]}]}`,
    );
    expect(parsed.claims).toHaveLength(1);
  });

  it('defaults an unknown status to uncertain rather than trusting it', () => {
    const parsed = parseEnvelope(
      withMeta('ტ.', { claims: [{ text: 'ა', status: 'definitely-true', evidence: [] }] }),
    );
    expect(parsed.claims[0]!.status).toBe('uncertain');
  });
});

/* ============================== grounding =============================== */

describe('claim validation', () => {
  const material = [
    evidence('E1', 'დეტერმინიზმი ნიშნავს, რომ ყოველი მოვლენა წინა მიზეზებით არის განსაზღვრული.'),
    evidence('E2', 'თავისუფალი ნება არსებობს, თუ მას იძულების არარსებობად გავიგებთ.'),
  ];

  it('accepts a paraphrase that shares the evidence content words', () => {
    const result = validateClaims(
      envelopeOf([
        {
          text: 'დეტერმინიზმის მიხედვით ყოველი მოვლენა წინა მიზეზებით არის განსაზღვრული.',
          status: 'grounded',
          evidenceIds: ['E1'],
        },
      ]),
      material,
      'labo_llm',
    );
    expect(result.claims[0]!.status).toBe('grounded');
    expect(result.grounded).toBe(true);
    expect(result.note).toBeUndefined();
  });

  it('marks an invention unsupported and says so', () => {
    const result = validateClaims(
      envelopeOf([
        {
          text: 'კანტმა ეს წიგნი კიონიგსბერგში დაწერა და ბოლოს დაწვა.',
          status: 'grounded',
          evidenceIds: ['E1'],
        },
      ]),
      material,
      'labo_llm',
    );
    expect(result.claims[0]!.status).toBe('unsupported');
    expect(result.grounded).toBe(false);
    expect(result.note).toBeTruthy();
  });

  it('repairs a citation when the claim matches other evidence', () => {
    const result = validateClaims(
      envelopeOf([
        {
          text: 'თავისუფალი ნება არსებობს, თუ იძულება არ არის.',
          status: 'grounded',
          // Cites the wrong passage; the words belong to E2.
          evidenceIds: ['E1'],
        },
      ]),
      material,
      'labo_llm',
    );
    expect(result.claims[0]!.status).toBe('grounded');
    expect(result.claims[0]!.evidenceIds).toContain('E2');
  });

  it('rejects a figure that appears nowhere in the evidence', () => {
    const result = validateClaims(
      envelopeOf([
        {
          text: 'დეტერმინიზმი ნიშნავს, რომ ყოველი მოვლენა 1785 წელს არის განსაზღვრული.',
          status: 'grounded',
          evidenceIds: ['E1'],
        },
      ]),
      material,
      'labo_llm',
    );
    expect(result.claims[0]!.status).toBe('unsupported');
  });

  it('holds an inference to a lower bar than a stated fact', () => {
    const claim = {
      text: 'მაშასადამე, პასუხისმგებლობის ცნება გადასინჯვას საჭიროებს.',
      evidenceIds: ['E1'],
    };
    const asFact = validateClaims(
      envelopeOf([{ ...claim, status: 'grounded' }]),
      material,
      'labo_llm',
    );
    const asInference = validateClaims(
      envelopeOf([{ ...claim, status: 'inferred' }]),
      material,
      'labo_llm',
    );
    expect(asFact.claims[0]!.status).toBe('unsupported');
    expect(asInference.claims[0]!.status).toBe('inferred');
  });

  it('downgrades rather than rejects in free mode, where outside knowledge is allowed', () => {
    const claim = {
      text: 'ჰიუმი ამ საკითხს სხვაგვარად უდგებოდა.',
      status: 'inferred' as const,
      evidenceIds: [],
    };
    expect(validateClaims(envelopeOf([claim]), material, 'labo_llm').claims[0]!.status).toBe(
      'unsupported',
    );
    expect(validateClaims(envelopeOf([claim]), material, 'free_ai').claims[0]!.status).toBe(
      'uncertain',
    );
  });

  it('still flags a free-mode claim asserted as grounded that nothing backs', () => {
    const result = validateClaims(
      envelopeOf([{ text: 'ჰიუმი ამას აშკარად წერს აქ.', status: 'grounded', evidenceIds: ['E1'] }]),
      material,
      'free_ai',
    );
    expect(result.claims[0]!.status).toBe('unsupported');
  });

  it('lists used evidence once, in order, skipping unsupported claims', () => {
    const claims = [
      { text: 'ა', status: 'grounded' as const, evidenceIds: ['E2'], support: 1 },
      { text: 'ბ', status: 'unsupported' as const, evidenceIds: ['E1'], support: 0 },
      { text: 'გ', status: 'inferred' as const, evidenceIds: ['E2'], support: 0.5 },
    ];
    expect(usedEvidence(claims, material).map((e) => e.id)).toEqual(['E2']);
  });
});

/* =============================== context ================================ */

describe('reasoning context', () => {
  it('retrieves Labo material for an ordinary library question', () => {
    const context = buildContext({ query: 'რა არის შავი ხვრელი?', state: emptyConversationState() });
    expect(context.evidence.length).toBeGreaterThan(0);
    expect(context.evidence.every((e) => e.kind === 'topic')).toBe(true);
    expect(context.evidence.map((e) => e.id)).toEqual(
      context.evidence.map((_, i) => `E${i + 1}`),
    );
  });

  it('works the same for subjects that are not philosophy', () => {
    for (const query of ['რა არის დნმ?', 'ვინ იყო ალან ტიურინგი?']) {
      expect(buildContext({ query, state: emptyConversationState() }).evidence.length).toBeGreaterThan(0);
    }
  });

  it('stays inside the character budget', () => {
    const context = buildContext({
      query: 'თავისუფალი ნება და დეტერმინიზმი',
      state: emptyConversationState(),
      bookScope: { mode: 'with_labo', bookIds: [] },
      bookCorpus,
    });
    expect(context.charsUsed).toBeLessThanOrEqual(6000);
  });

  it('excludes Labo knowledge entirely in a book-only scope', () => {
    const context = buildContext({
      query: 'დეტერმინიზმი',
      state: emptyConversationState(),
      bookScope: { mode: 'book', bookIds: ['b_geo'] },
      bookCorpus,
    });
    expect(context.evidence.length).toBeGreaterThan(0);
    expect(context.evidence.some((e) => e.kind === 'topic')).toBe(false);
    expect(context.evidence.every((e) => Boolean(e.pages))).toBe(true);
  });

  it('carries page provenance on book evidence', () => {
    const context = buildContext({
      query: 'დეტერმინიზმი',
      state: emptyConversationState(),
      bookScope: { mode: 'book', bookIds: ['b_geo'] },
      bookCorpus,
    });
    const pages = context.evidence[0]!.pages!;
    expect(pages.bookTitle).toBeTruthy();
    expect(pages.pageStart).toBeGreaterThan(0);
  });

  it('summarises old turns and keeps recent ones verbatim', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `რეპლიკა ნომერი ${i} რომელიც საკმაოდ გრძელია იმისთვის რომ შეჯამებაში მოხვდეს`,
    }));
    const context = buildContext({
      query: 'და რატომ?',
      state: emptyConversationState(),
      history,
    });
    expect(context.recentTurns).toHaveLength(8);
    expect(context.summary).toContain('შეჯამდა');
  });
});

/* ================================ prompt ================================ */

describe('system prompt', () => {
  const context = buildContext({ query: 'რა არის შავი ხვრელი?', state: emptyConversationState() });

  it('binds the grounded mode to the evidence and free mode does not', () => {
    const grounded = buildSystemPrompt('labo_llm', context);
    const free = buildSystemPrompt('free_ai', context);
    expect(grounded).toContain('მკაცრი წესი');
    expect(free).toContain('თავისუფალი');
    expect(free).not.toContain('მკაცრი წესი');
  });

  it('gives every evidence item a citable id', () => {
    const prompt = buildSystemPrompt('labo_llm', context);
    for (const item of context.evidence) expect(prompt).toContain(`[${item.id}]`);
  });

  it('asks for reasoning, not retrieval', () => {
    const prompt = buildSystemPrompt('labo_llm', context);
    expect(prompt).toContain('არ ხარ საძიებო სისტემა');
    expect(prompt).toContain(META_OPEN);
  });

  it('adds the Socratic licence only when the mode is on', () => {
    expect(buildSystemPrompt('labo_llm', context, { socratic: true })).toContain('სოკრატესებური');
    expect(buildSystemPrompt('labo_llm', context, { socratic: false })).not.toContain('სოკრატესებური');
  });

  it('tells the model to admit an empty library rather than improvise', () => {
    const empty = buildContext({ query: 'zzzzz qqqq', state: emptyConversationState() });
    expect(empty.evidence).toHaveLength(0);
    expect(buildSystemPrompt('labo_llm', empty)).toContain('ფაქტს ნუ გამოიგონებ');
  });
});

/* ============================== orchestration =========================== */

describe('orchestration', () => {
  const ask = (provider: LlmProvider | null, mode: 'strict_labo' | 'labo_llm' | 'free_ai') =>
    reason({
      message: 'რა არის შავი ხვრელი?',
      state: emptyConversationState(),
      mode,
      provider,
    });

  it('never calls the model in strict mode', async () => {
    const provider = fakeProvider('არ უნდა გამოიძახოს');
    const result = await ask(provider, 'strict_labo');
    expect(provider.calls).toHaveLength(0);
    expect(result.fellBack).toBe(false);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('falls back to the engine when no provider is configured', async () => {
    const result = await ask(null, 'labo_llm');
    expect(result.fellBack).toBe(true);
    expect(result.fallbackReason).toBe('no_provider');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('falls back when the provider is present but switched off', async () => {
    const result = await ask(fakeProvider('x', { available: false }), 'labo_llm');
    expect(result.fallbackReason).toBe('no_provider');
  });

  it('falls back, with an answer, when the call fails', async () => {
    const result = await ask(fakeProvider('', { error: new Error('boom') }), 'labo_llm');
    expect(result.fallbackReason).toBe('provider_error');
    expect(result.fellBack).toBe(true);
    expect(result.text.trim().length).toBeGreaterThan(0);
  });

  it('falls back when the model returns nothing usable', async () => {
    const result = await ask(fakeProvider('   '), 'labo_llm');
    expect(result.fallbackReason).toBe('empty_response');
  });

  it('shows the model answer, without the metadata or evidence markers', async () => {
    const provider = fakeProvider(
      withMeta('შავი ხვრელი ისეთი ობიექტია, საიდანაც სინათლე ვერ გამოდის.', {
        claims: [],
        followUp: 'გინდა უფრო ღრმად?',
      }),
    );
    const result = await ask(provider, 'labo_llm');
    expect(result.fellBack).toBe(false);
    expect(result.text).toContain('შავი ხვრელი');
    expect(result.text).not.toContain(META_OPEN);
    expect(result.text).not.toMatch(/\[E\d+\]/);
    expect(result.suggestions[0]).toBe('გინდა უფრო ღრმად?');
  });

  it('sends the evidence to the model, not the engine’s finished answer', async () => {
    const provider = fakeProvider(withMeta('პასუხი.', { claims: [] }));
    await ask(provider, 'labo_llm');
    const system = provider.calls[0]!.system;
    expect(system).toContain('--- მასალა');
    // The whole point of the refactor: the model is not handed prose to reword.
    expect(system).not.toContain('--- ლაბოს პასუხი ---');
  });

  it('discloses, rather than hides, a claim it could not verify', async () => {
    const provider = fakeProvider(
      withMeta('შავი ხვრელი 1492 წელს კოლუმბმა აღმოაჩინა.', {
        claims: [
          { text: 'შავი ხვრელი 1492 წელს კოლუმბმა აღმოაჩინა.', status: 'grounded', evidence: ['E1'] },
        ],
      }),
    );
    const result = await ask(provider, 'labo_llm');
    expect(result.grounded).toBe(false);
    expect(result.claims[0]!.status).toBe('unsupported');
    expect(result.text).toMatch(/დასაყრდენი/);
  });

  it('advances conversation state with what the model actually said', async () => {
    const provider = fakeProvider(withMeta('შავი ხვრელი მასიური ობიექტია.', { claims: [] }));
    const result = await reason({
      message: 'რა არის შავი ხვრელი?',
      state: emptyConversationState(),
      mode: 'labo_llm',
      provider,
    });
    const lastAssistant = [...result.state.turns].reverse().find((t) => t.role === 'assistant');
    expect(lastAssistant?.text).toContain('შავი ხვრელი მასიური ობიექტია');
    expect(result.state.turnIndex).toBeGreaterThan(0);
  });

  it('keeps page citations from book evidence the answer used', async () => {
    const context = buildContext({
      query: 'დეტერმინიზმი',
      state: emptyConversationState(),
      bookScope: { mode: 'book', bookIds: ['b_geo'] },
      bookCorpus,
    });
    const first = context.evidence[0]!;
    const provider = fakeProvider(
      withMeta(first.text.slice(0, 120), {
        claims: [{ text: first.text.slice(0, 120), status: 'grounded', evidence: [first.id] }],
      }),
    );

    const result = await reason({
      message: 'დეტერმინიზმი',
      state: emptyConversationState(),
      mode: 'labo_llm',
      provider,
      bookScope: { mode: 'book', bookIds: ['b_geo'] },
      bookCorpus,
    });

    expect(result.grounded).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]).toMatch(/გვ\./);
  });

  it('passes conversation history to the model in API order', async () => {
    const provider = fakeProvider(withMeta('კარგი.', { claims: [] }));
    await reason({
      message: 'და რატომ?',
      state: emptyConversationState(),
      mode: 'labo_llm',
      provider,
      history: [
        { role: 'assistant', content: 'გამარჯობა' },
        { role: 'user', content: 'რა არის შავი ხვრელი?' },
        { role: 'assistant', content: 'ობიექტი, საიდანაც სინათლე ვერ გამოდის.' },
      ],
    });
    const messages = provider.calls[0]!.messages;
    expect(messages[0]!.role).toBe('user');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'და რატომ?' });
  });
});

/* ===================== knowledge graph as context ====================== */

describe('knowledge graph in the reasoning context', () => {
  const graph = buildKnowledgeGraph();

  it('renders relationships as structure, kept out of the evidence array', () => {
    const context = buildContext({
      query: 'შავი ხვრელი',
      state: emptyConversationState(),
      graph,
    });

    expect(context.structure.length).toBeGreaterThan(0);
    // The guarantee: nothing in `evidence` is a relationship statement, because
    // claim validation scores only against `evidence`.
    for (const item of context.evidence) {
      expect(item.text).not.toBe(context.structure);
    }
    expect(context.evidence.some((e) => context.structure.includes(e.text))).toBe(false);
  });

  it('puts structure in the prompt, labelled as not being a source', () => {
    const context = buildContext({
      query: 'შავი ხვრელი',
      state: emptyConversationState(),
      graph,
    });
    const prompt = buildSystemPrompt('labo_llm', context);

    expect(prompt).toContain('ცოდნის რუკის სტრუქტურა');
    expect(prompt).toContain('ფაქტს ნუ იტყვი');
  });

  it('never lets a relationship alone ground a factual claim', () => {
    /*
     * Two hand-made nodes with invented names, so their words appear in no
     * library passage anywhere. The graph therefore contributes structure and
     * no content — which is exactly the case that must not be groundable.
     */
    const invented = buildKnowledgeGraph({
      manualNodes: [
        {
          id: 'kn_a',
          type: 'concept',
          title: 'ზოგრილი',
          tags: [],
          origin: 'manual',
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: 'kn_b',
          type: 'concept',
          title: 'ვანტრიუმი',
          tags: [],
          origin: 'manual',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      manualEdges: [
        {
          id: 'ke_1',
          sourceNodeId: 'kn_a',
          targetNodeId: 'kn_b',
          relationType: 'DEPENDS_ON',
          origin: 'manual',
        },
      ],
    });

    const context = buildContext({
      query: 'ზოგრილი',
      state: emptyConversationState(),
      graph: invented,
    });

    // The relationship is available to the model as structure…
    expect(context.structure).toContain('ზოგრილი');
    expect(context.structure).toContain('ვანტრიუმი');
    // …and contributes no evidence at all, because neither node has content.
    expect(context.evidence.some((e) => e.text.includes('ვანტრიუმი'))).toBe(false);

    // A claim asserting the relationship as fact therefore cannot be grounded.
    const claim = 'ზოგრილი ეყრდნობა ვანტრიუმს';
    const result = validateClaims(
      { prose: claim, claims: [{ text: claim, status: 'grounded', evidenceIds: [] }], structured: true },
      context.evidence,
      'labo_llm',
    );
    expect(result.claims[0]!.status).toBe('unsupported');
    expect(result.grounded).toBe(false);
  });

  it('adds no structure when the graph matches nothing', () => {
    const context = buildContext({
      query: 'zzzz qqqq wwww',
      state: emptyConversationState(),
      graph,
    });
    expect(context.structure).toBe('');
  });
});
