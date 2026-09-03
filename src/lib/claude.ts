import type { AiSettings } from '@/persistence/db';

/**
 * Thin wrapper over the Anthropic SDK for the "bring your own key" AI.
 *
 * The SDK is dynamically imported so it lands in its own chunk and never
 * weighs down the initial load for the people who don't use it. Calls go
 * straight from the browser to Anthropic (`dangerouslyAllowBrowser`) — there is
 * no server in the middle, and the key stays on the device.
 */

export type AiErrorKind = 'no-key' | 'auth' | 'rate-limit' | 'network' | 'refusal' | 'unknown';

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = 'AiError';
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface StreamOptions {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  signal?: AbortSignal;
  onText: (delta: string) => void;
}

async function makeClient(settings: AiSettings) {
  if (!settings.apiKey) throw new AiError('no-key');
  const mod = await import('@anthropic-ai/sdk').catch(() => {
    throw new AiError('network', 'ვერ ჩაიტვირთა AI მოდული');
  });
  const Anthropic = mod.default;
  return new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true });
}

function classify(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const e = err as { name?: string; status?: number; message?: string };
  if (e?.name === 'AbortError') return new AiError('network', 'გაჩერდა');
  if (e?.status === 401 || e?.status === 403) return new AiError('auth');
  if (e?.status === 429) return new AiError('rate-limit');
  if (e?.name === 'APIConnectionError' || e?.message?.includes('fetch')) return new AiError('network');
  return new AiError('unknown', e?.message);
}

export async function streamChat(settings: AiSettings, opts: StreamOptions): Promise<void> {
  try {
    const client = await makeClient(settings);
    // Haiku 4.5 rejects `effort` / adaptive thinking; the Opus and Sonnet 5
    // models take both. Keep effort low — this is chat, not agentic work.
    const tuned =
      settings.model === 'claude-haiku-4-5'
        ? {}
        : { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };
    const stream = client.messages.stream(
      {
        model: settings.model,
        max_tokens: opts.maxTokens ?? 2048,
        ...tuned,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
      } as Parameters<typeof client.messages.stream>[0],
      opts.signal ? { signal: opts.signal } : undefined,
    );

    stream.on('text', opts.onText);
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new AiError('refusal');
  } catch (err) {
    throw classify(err);
  }
}

/** A one-shot, non-streaming call — used for the settings "test key" button. */
export async function testKey(settings: AiSettings): Promise<void> {
  try {
    const client = await makeClient(settings);
    await client.messages.create({
      model: settings.model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'ping' }],
    });
  } catch (err) {
    throw classify(err);
  }
}
