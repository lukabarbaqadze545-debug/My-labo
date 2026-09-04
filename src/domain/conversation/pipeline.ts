import type { AliasEntry } from '@/language/ka';
import { isBookExclusive, type BookCorpus, type BookScope } from '@/domain/books';
import { mentionsBook, runBookTurn } from './books';
import type {
  ConversationResult,
  ConversationState,
  KnowledgeCandidate,
  MatchLayer,
  PipelineTrace,
} from './types';
import { normalize } from './normalize';
import { detectIntents, topIntent, CONTEXTUAL_INTENTS } from './intent';
import { resolveReference } from './resolve';
import { retrieve } from './retrieve';
import { assessConfidence, decideVerdict } from './confidence';
import { planAction } from './plan';
import { buildClarification, generate } from './respond';
import { updateConversationState } from './state';
import { detectDomainIntro, buildDomainIntro } from './domainIntro';

/**
 * The conversational pipeline.
 *
 *   normalize → intent → reference → retrieve → resolve concept →
 *   confidence → verdict → plan → generate → update state
 *
 * Every stage is a pure function with its own module and its own tests. The
 * orchestrator's only job is ordering and the concept-resolution policy in the
 * middle, which is where "never get stuck on wording" is actually enforced:
 * the message is given five chances to yield a subject before the engine
 * concludes it has none.
 */

export interface ConverseOptions {
  /** Socratic mode for this conversation. */
  socratic?: boolean;
  /** User-taught aliases, applied without a rebuild. */
  extraAliases?: readonly AliasEntry[];
  /** How imported books participate. Omitted or 'off' keeps them out entirely. */
  bookScope?: BookScope;
  /** Book data, loaded once by the caller and passed in. */
  bookCorpus?: BookCorpus;
  /** General Georgian learned from imported sources; used by every subject. */
  languageCorpus?: import('@/domain/language').LanguageCorpus | null;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Is this candidate strong enough to override conversation context?
 *
 * Coverage alone is not enough: a one-word message has coverage 1.0 against
 * any topic whose body happens to contain that word, so „რატომ არის სწრაფი?"
 * would hijack the conversation to an unrelated topic. A lexical hit must
 * also clear an absolute score, which title and tag matches do and incidental
 * body mentions do not.
 */
function isStrong(c: KnowledgeCandidate): boolean {
  if (c.layer === 'exact' || c.layer === 'phrase' || c.layer === 'alias') return true;
  return c.layer === 'token' && ((c.coverage >= 0.5 && c.score >= 10) || c.score >= 16);
}

export function converse(
  state: ConversationState,
  rawMessage: string,
  options: ConverseOptions = {},
): ConversationResult {
  const timings: Record<string, number> = {};
  const mark = (label: string, from: number) => {
    timings[label] = Math.round((now() - from) * 100) / 100;
  };

  let t0 = now();
  const message = normalize(rawMessage);
  mark('normalize', t0);

  t0 = now();
  const intents = detectIntents(message, state);
  const intent = topIntent(intents);
  mark('intent', t0);

  t0 = now();
  const reference = resolveReference(message, state);
  mark('reference', t0);

  t0 = now();
  const { candidates, layer } = retrieve(message, state, options.extraAliases ?? []);
  mark('retrieve', t0);

  /* ---------------------------- domain intro ---------------------------- */
  /*
   * A message naming a whole field ("ფილოსოფიაზე რას მეტყვი?") is not a
   * request for one topic's article — it wants orientation. This is checked
   * before books and before concept resolution so a broad question can never
   * be narrowed onto whatever single topic or chunk happened to score
   * highest, in either mode.
   */
  const domainMatch = detectDomainIntro(message);
  if (domainMatch) {
    t0 = now();
    const built = buildDomainIntro(domainMatch, state, state.turnIndex + 1, options.bookScope, options.bookCorpus);
    mark('domain-intro', t0);

    const introAction = {
      kind: 'domain_intro' as const,
      rationale: 'ფართო კითხვა დარგზე — ჯერ ორიენტირება საჭიროა, არა ერთი სტატიის დაბეჭდვა.',
      score: 9,
    };

    const nextState = updateConversationState(state, {
      userText: rawMessage,
      assistantText: built.text,
      intent: intent.kind,
      action: introAction,
      servedKeys: [],
      domainId: built.domainId,
      openerUsed: built.openerUsed,
      endedInQuestion: true,
    });

    return {
      reply: {
        text: built.text,
        sources: built.sources,
        related: built.related,
        suggestions: built.suggestions,
        action: 'domain_intro',
        verdict: 'answer',
      },
      state: nextState,
      trace: {
        raw: rawMessage,
        normalized: message,
        intents,
        candidates: [],
        ...(reference ? { reference } : {}),
        layerUsed: 'exact',
        confidence: {
          language: 1,
          intent: 1,
          topic: 1,
          retrieval: 1,
          context: state.currentDomain ? 0.6 : 0,
          knowledge: 1,
        },
        verdict: 'answer',
        action: introAction,
        timings,
      },
    };
  }

  /* -------------------------------- books ------------------------------ */
  /*
   * Books are consulted here, between retrieval and concept resolution.
   *
   * In an exclusive mode the book branch always returns — including when the
   * book has nothing, which is the whole point: "answer only from this book"
   * has to mean the assistant will say it does not know rather than quietly
   * fall back on Labo's own material.
   *
   * In `with_labo` books are tried first and only win when they are actually
   * grounded, so ordinary follow-ups still flow through the normal pipeline.
   */
  const scope = options.bookScope;
  const corpus = options.bookCorpus;

  if (scope && scope.mode !== 'off' && corpus && corpus.books.length > 0) {
    const exclusive = isBookExclusive(scope);
    const shouldTry = exclusive || mentionsBook(rawMessage) || !message.isBareFollowUp;

    if (shouldTry) {
      t0 = now();
      const book = runBookTurn({ message, state, scope, corpus, socratic: options.socratic ?? false });
      mark('books', t0);

      if (exclusive || book.grounded) {
        const bookConfidence = {
          ...assessConfidence(message, intents, candidates, layer, reference, state, undefined),
          retrieval: book.confidence.retrieval,
          knowledge: book.confidence.knowledge,
        };

        const nextBookState = updateConversationState(state, {
          userText: rawMessage,
          assistantText: book.reply.text,
          intent: intent.kind,
          action: book.action,
          servedKeys: [],
        });

        return {
          reply: book.reply,
          state: nextBookState,
          trace: {
            raw: rawMessage,
            normalized: message,
            intents,
            candidates: [],
            ...(reference ? { reference } : {}),
            layerUsed: book.grounded ? 'exact' : 'none',
            confidence: bookConfidence,
            verdict: book.verdict,
            action: book.action,
            ...(book.grounded
              ? {}
              : { unknownReason: book.action.rationale }),
            books: book.debug,
            timings,
          },
        };
      }
    }
  }

  /* ------------------------ concept resolution ------------------------- */

  t0 = now();
  let concept: string | undefined;
  let fromContext = false;
  let explicitTopic = false;
  let usedLayer: MatchLayer = layer;

  const strong = candidates.find(isStrong);
  const pending = state.pendingClarification;

  // 1. Answering a clarification we asked.
  const picked = pending?.options.find(
    (o) =>
      message.text.includes(o.label.toLowerCase()) ||
      candidates.some((c) => c.concept === o.concept),
  );

  if (pending && picked) {
    concept = picked.concept;
    explicitTopic = true;
    usedLayer = 'exact';
  } else if (intent.kind === 'correction') {
    // A correction names what was actually meant; context is what was wrong.
    const named = candidates.find((c) => c.concept !== state.currentConcept);
    if (named) {
      concept = named.concept;
      explicitTopic = true;
      usedLayer = named.layer;
    }
  } else if (intent.kind === 'go_back') {
    concept = state.previousConcept ?? state.currentConcept;
    fromContext = true;
    usedLayer = 'context';
  } else if (strong) {
    // 2. The message named a subject clearly.
    concept = strong.concept;
    explicitTopic = true;
    usedLayer = strong.layer;
  } else if (reference?.concept && reference.confidence >= 0.7) {
    // 3. A pronoun we can attach with confidence.
    concept = reference.concept;
    fromContext = true;
    usedLayer = 'context';
  } else if (CONTEXTUAL_INTENTS.has(intent.kind) && state.currentConcept) {
    // 4. „უფრო მარტივად" — complete intent, subject inherited.
    concept = state.currentConcept;
    fromContext = true;
    usedLayer = 'context';
  } else if (candidates[0]) {
    // 5. Weak evidence beats nothing; the verdict will mark it partial.
    concept = candidates[0].concept;
    explicitTopic = true;
    usedLayer = candidates[0].layer;
  } else if (message.isBareFollowUp && state.currentConcept) {
    // 6. Nothing in the message at all — carry on with what we were doing.
    concept = state.currentConcept;
    fromContext = true;
    usedLayer = 'context';
  }
  mark('resolve-concept', t0);

  /* ---------------------------- confidence ----------------------------- */

  t0 = now();
  const confidence = assessConfidence(
    message,
    intents,
    candidates,
    usedLayer,
    reference,
    state,
    concept,
  );
  const { verdict, reason } = decideVerdict({
    confidence,
    candidates,
    resolvedConcept: concept,
    fromContext,
    message,
    reference,
    state,
    intent: intent.kind,
  });
  mark('confidence', t0);

  /* ------------------------------- plan -------------------------------- */

  t0 = now();
  const action = planAction({
    intent: intent.kind,
    verdict,
    ...(concept ? { concept } : {}),
    state,
    socratic: options.socratic ?? false,
    explicitTopic,
  });
  mark('plan', t0);

  /* ----------------------------- generate ------------------------------ */

  t0 = now();
  const clarification =
    action.kind === 'clarify'
      ? buildClarification(candidates, state, reference?.surface)
      : undefined;

  const generated = generate({
    action,
    verdict,
    state,
    candidates,
    intent: intent.kind,
    rawText: rawMessage,
    ...(reference?.surface ? { referenceSurface: reference.surface } : {}),
    fromContext,
    ...(clarification ? { clarification } : {}),
    ...(options.languageCorpus ? { languageCorpus: options.languageCorpus } : {}),
  });
  mark('generate', t0);

  /* ------------------------------ commit ------------------------------- */

  const nextState = updateConversationState(state, {
    userText: rawMessage,
    assistantText: generated.text,
    intent: intent.kind,
    action,
    ...(concept ? { concept } : {}),
    servedKeys: generated.servedKeys,
    ...(generated.clarification ? { clarification: generated.clarification } : {}),
    ...(generated.openerUsed ? { openerUsed: generated.openerUsed } : {}),
    ...(generated.connectivesUsed?.length ? { connectivesUsed: generated.connectivesUsed } : {}),
  });

  // A resolved clarification must not linger.
  if (pending && picked) delete (nextState as { pendingClarification?: unknown }).pendingClarification;

  const trace: PipelineTrace = {
    raw: rawMessage,
    normalized: message,
    intents,
    candidates: candidates.slice(0, 5),
    ...(reference ? { reference } : {}),
    layerUsed: usedLayer,
    confidence,
    verdict,
    action,
    ...(verdict === 'answer' ? {} : { unknownReason: reason }),
    timings,
  };

  return {
    reply: {
      text: generated.text,
      sources: generated.sources,
      related: generated.related,
      suggestions: generated.suggestions,
      action: generated.action,
      verdict: generated.verdict,
    },
    state: nextState,
    trace,
  };
}
