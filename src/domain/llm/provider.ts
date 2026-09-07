import type { AiSettings } from '@/persistence/db';
import { AiError, streamChat, type ChatTurn } from '@/lib/claude';

/**
 * The model boundary.
 *
 * Everything above this line reasons about evidence, claims and citations;
 * everything below it is one vendor's HTTP API. The orchestrator only ever
 * sees `LlmProvider`, which is what makes the layer testable without a network
 * and swappable without touching a single reasoning rule.
 */

export interface LlmRequest {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmProvider {
  /** Stable id for traces and settings. */
  readonly id: string;
  /** False when the provider cannot run at all (no key, no module). */
  available(): boolean;
  /**
   * Stream a completion. `onText` receives deltas as they arrive; the resolved
   * value is the complete text. Throws `AiError` on failure.
   */
  stream(request: LlmRequest, onText: (delta: string) => void): Promise<string>;
}

/** Anthropic, called straight from the browser with the user's own key. */
export function anthropicProvider(settings: AiSettings): LlmProvider {
  return {
    id: `anthropic:${settings.model}`,
    available: () => Boolean(settings.enabled && settings.apiKey),
    async stream(request, onText) {
      let acc = '';
      await streamChat(settings, {
        system: request.system,
        messages: request.messages,
        ...(request.maxTokens ? { maxTokens: request.maxTokens } : {}),
        ...(request.signal ? { signal: request.signal } : {}),
        onText: (delta) => {
          acc += delta;
          onText(delta);
        },
      });
      return acc;
    },
  };
}

/**
 * Classify a thrown provider error into the reason the orchestrator records.
 * An aborted request is a user action, not a failure, and must not be reported
 * as "the model broke".
 */
export function isAbort(err: unknown): boolean {
  if (err instanceof AiError) return err.kind === 'network' && /გაჩერდა/.test(err.message);
  return (err as { name?: string })?.name === 'AbortError';
}

export { AiError, type ChatTurn };
