import { META_CLOSE, META_OPEN } from './prompt';
import type { ClaimStatus, ReasoningEnvelope } from './types';

/**
 * Stage 3 — read the model's output.
 *
 * Two jobs. During streaming, `visibleText` keeps the metadata block off the
 * screen even while it is half-arrived. Afterwards, `parseEnvelope` recovers
 * the structured report — tolerantly, because a model that returns prose and
 * no metadata has still answered the question, and the layer must degrade to
 * "unverified but shown" rather than to an error.
 */

/**
 * What the user should see given everything received so far.
 *
 * The metadata delimiter arrives one token at a time, so a trailing *partial*
 * delimiter has to be hidden too — otherwise the answer visibly sprouts "<<<"
 * for a moment before the block completes.
 */
export function visibleText(raw: string): string {
  const idx = raw.indexOf(META_OPEN);
  if (idx !== -1) return raw.slice(0, idx).trimEnd();

  for (let n = Math.min(META_OPEN.length - 1, raw.length); n > 0; n--) {
    if (raw.endsWith(META_OPEN.slice(0, n))) return raw.slice(0, raw.length - n).trimEnd();
  }
  return raw;
}

const STATUSES = new Set<ClaimStatus>(['grounded', 'inferred', 'uncertain']);

/** Pull the JSON object out of the metadata block, whatever wrapping it has. */
function extractJson(raw: string): unknown {
  const open = raw.indexOf(META_OPEN);
  if (open === -1) return null;

  const after = raw.slice(open + META_OPEN.length);
  const close = after.indexOf(META_CLOSE);
  // A truncated response may never close the block; parse what is there.
  const body = close === -1 ? after : after.slice(0, close);

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export function parseEnvelope(raw: string): ReasoningEnvelope {
  const prose = visibleText(raw).trim();
  const parsed = extractJson(raw) as
    | { claims?: unknown; followUp?: unknown; confidence?: unknown }
    | null;

  if (!parsed || typeof parsed !== 'object') {
    return { prose, claims: [], structured: false };
  }

  const claims = (Array.isArray(parsed.claims) ? parsed.claims : [])
    .map((entry) => {
      const row = entry as { text?: unknown; status?: unknown; evidence?: unknown };
      const text = typeof row.text === 'string' ? row.text.trim() : '';
      if (!text) return null;
      const status = (
        typeof row.status === 'string' && STATUSES.has(row.status as ClaimStatus)
          ? row.status
          : 'uncertain'
      ) as Exclude<ClaimStatus, 'unsupported'>;
      return { text, status, evidenceIds: asStringArray(row.evidence) };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const followUp =
    typeof parsed.followUp === 'string' && parsed.followUp.trim() ? parsed.followUp.trim() : undefined;
  const confidence =
    typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : undefined;

  return {
    prose,
    claims,
    ...(followUp ? { followUp } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    // Prose with an unparseable or absent block is still an answer — it just
    // cannot be verified claim by claim, and the caller is told so.
    structured: claims.length > 0,
  };
}
