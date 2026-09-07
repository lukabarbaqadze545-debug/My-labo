import type { AliasEntry } from '@/language/ka';
import type { BookCorpus, BookScope } from '@/domain/books';
import { formatCitation } from '@/domain/books';
import { converse, type ConversationResult, type ConversationState } from '@/domain/conversation';
import type { LanguageCorpus } from '@/domain/language';
import type { KnowledgeGraph } from '@/domain/knowledge';
import { buildContext } from './context';
import { parseEnvelope, visibleText } from './envelope';
import { usedEvidence, validateClaims } from './grounding';
import { buildSystemPrompt } from './prompt';
import { isAbort, type ChatTurn, type LlmProvider } from './provider';
import type {
  Evidence,
  FallbackReason,
  ReasoningMode,
  ReasoningResult,
  ReasoningTrace,
} from './types';

/**
 * The orchestrator.
 *
 *   understand → retrieve → reason → validate → respond
 *
 * The deterministic pipeline runs first on every turn, in every mode. It is no
 * longer the intelligence — it is the substrate: it tracks conversation state,
 * applies book scoping, and produces an answer that is already correct. The
 * model is then given the *evidence* that pipeline found, never the pipeline's
 * finished prose.
 *
 * That distinction is the entire architecture. Handing the model a composed
 * answer and asking for nicer wording produces a rephraser; handing it the
 * source material and asking it to think produces reasoning. The finished
 * answer is only ever used as the fallback.
 */

export interface ReasonInput {
  message: string;
  state: ConversationState;
  mode: ReasoningMode;
  /** Omitted or unavailable ⇒ deterministic answer, cleanly. */
  provider?: LlmProvider | null | undefined;
  socratic?: boolean;
  extraAliases?: readonly AliasEntry[];
  bookScope?: BookScope | undefined;
  bookCorpus?: BookCorpus | undefined;
  languageCorpus?: LanguageCorpus | null | undefined;
  /** Knowledge graph, for relationship-aware retrieval and structural context. */
  graph?: KnowledgeGraph | undefined;
  memories?: readonly string[];
  /** Prior turns, oldest first, excluding the message being sent. */
  history?: readonly { role: 'user' | 'assistant'; content: string }[];
  signal?: AbortSignal | undefined;
  /** Receives the full visible answer each time it grows. */
  onText?: ((text: string) => void) | undefined;
  maxTokens?: number;
}

/** Turns the model is allowed to see verbatim. */
const HISTORY_LIMIT = 8;

/**
 * The conversation state records what the assistant said. When the model
 * answers, that is the text the next turn must refer back to — otherwise
 * "why?" resolves against a reply the user never saw.
 */
function withAssistantText(state: ConversationState, text: string): ConversationState {
  const turns = [...state.turns];
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]!.role === 'assistant') {
      turns[i] = { ...turns[i]!, text };
      break;
    }
  }
  return { ...state, turns };
}

function toRefs(evidence: readonly Evidence[]): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  const seen = new Set<string>();
  for (const item of evidence) {
    if (!item.ref || seen.has(item.ref.href)) continue;
    seen.add(item.ref.href);
    out.push(item.ref);
  }
  return out;
}

/** Page-accurate citations for whichever book passages the answer relied on. */
function toCitations(evidence: readonly Evidence[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of evidence) {
    if (!item.pages) continue;
    const line = formatCitation({
      bookId: '',
      bookTitle: item.pages.bookTitle,
      ...(item.pages.chapter ? { chapter: item.pages.chapter } : {}),
      pageStart: item.pages.pageStart,
      pageEnd: item.pages.pageEnd,
      chunkId: '',
    });
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

/** The deterministic answer, packaged as a result. */
function deterministic(
  run: ConversationResult,
  mode: ReasoningMode,
  reason: FallbackReason,
): ReasoningResult {
  const fellBack = reason !== 'strict_mode';
  return {
    text: run.reply.text,
    mode,
    claims: [],
    sources: run.reply.sources,
    related: run.reply.related,
    citations: [],
    suggestions: run.reply.suggestions,
    grounded: run.reply.verdict === 'answer',
    fellBack,
    ...(fellBack ? { fallbackReason: reason } : {}),
    state: run.state,
    trace: {
      mode,
      pipeline: run.trace,
      evidence: [],
      charsUsed: 0,
      summaryUsed: false,
      historyTurns: 0,
      structured: false,
      claims: [],
      unsupported: 0,
      ...(fellBack ? { fallbackReason: reason } : {}),
    },
  };
}

export async function reason(input: ReasonInput): Promise<ReasoningResult> {
  const { message, state, mode } = input;

  /* ---------------------- deterministic substrate ---------------------- */

  const run = converse(state, message, {
    socratic: input.socratic ?? false,
    extraAliases: input.extraAliases ?? [],
    ...(input.bookScope ? { bookScope: input.bookScope } : {}),
    ...(input.bookCorpus ? { bookCorpus: input.bookCorpus } : {}),
    ...(input.languageCorpus !== undefined ? { languageCorpus: input.languageCorpus } : {}),
  });

  if (mode === 'strict_labo') return deterministic(run, mode, 'strict_mode');

  const provider = input.provider;
  if (!provider || !provider.available()) return deterministic(run, mode, 'no_provider');

  /* ------------------------------ context ------------------------------ */

  const context = buildContext({
    query: message,
    state,
    ...(input.bookScope ? { bookScope: input.bookScope } : {}),
    ...(input.bookCorpus ? { bookCorpus: input.bookCorpus } : {}),
    ...(input.memories ? { memories: input.memories } : {}),
    ...(input.history ? { history: input.history } : {}),
    ...(input.graph ? { graph: input.graph } : {}),
  });

  const system = buildSystemPrompt(mode, context, { socratic: input.socratic ?? false });

  const turns: ChatTurn[] = context.recentTurns
    .filter((turn) => turn.content.trim())
    .slice(-HISTORY_LIMIT)
    .map((turn) => ({ role: turn.role, content: turn.content }));
  // The API requires the first message to come from the user.
  while (turns.length > 0 && turns[0]!.role !== 'user') turns.shift();
  turns.push({ role: 'user', content: message });

  /* ------------------------------- model ------------------------------- */

  const startedAt = Date.now();
  let raw = '';
  try {
    raw = await provider.stream(
      {
        system,
        messages: turns,
        maxTokens: input.maxTokens ?? 1400,
        ...(input.signal ? { signal: input.signal } : {}),
      },
      (delta) => {
        raw += delta;
        input.onText?.(visibleText(raw));
      },
    );
  } catch (err) {
    return deterministic(run, mode, isAbort(err) ? 'aborted' : 'provider_error');
  }
  const modelMs = Date.now() - startedAt;

  /* ---------------------- parse, validate, compose --------------------- */

  const envelope = parseEnvelope(raw);
  if (!envelope.prose.trim()) return deterministic(run, mode, 'empty_response');

  const validation = validateClaims(envelope, context.evidence, mode);
  const used = usedEvidence(validation.claims, context.evidence);

  // Disclosure, never deletion: the answer stands, and the part that could not
  // be tied to the material is named.
  const text = validation.note ? `${envelope.prose}\n\n(${validation.note})` : envelope.prose;

  const suggestions = [
    ...(envelope.followUp ? [envelope.followUp] : []),
    ...run.reply.suggestions,
  ].slice(0, 3);

  const trace: ReasoningTrace = {
    mode,
    pipeline: run.trace,
    evidence: context.evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      chars: item.text.length,
    })),
    charsUsed: context.charsUsed,
    summaryUsed: Boolean(context.summary),
    historyTurns: turns.length,
    structured: envelope.structured,
    claims: validation.claims,
    unsupported: validation.unsupported,
    modelMs,
  };

  return {
    text,
    mode,
    claims: validation.claims,
    // Labo topic links the answer leaned on, plus whatever the engine resolved.
    sources: toRefs(used).length > 0 ? toRefs(used) : run.reply.sources,
    related: run.reply.related,
    citations: toCitations(used),
    suggestions,
    grounded: validation.grounded,
    fellBack: false,
    state: withAssistantText(run.state, text),
    trace,
  };
}
