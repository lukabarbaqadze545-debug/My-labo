import { REFERENCE_WORDS } from '@/language/ka';
import type {
  ConversationState,
  NormalizedMessage,
  ReferenceResolution,
} from './types';
import { labelForConcept } from './retrieve';

/**
 * Stage 4 — reference resolution.
 *
 * „ხო და ეგ როდის არ გამოდგება?" carries no subject at all. Every content
 * word in it is a particle or a pronoun. Without resolving „ეგ" against
 * conversation state the message is unanswerable; with it, the message is
 * completely ordinary.
 *
 * The rule is deliberately conservative: resolve confidently when one
 * candidate dominates, and hand back alternatives when it does not, so the
 * caller can ask one short clarification instead of guessing.
 */

interface ReferenceHit {
  surface: string;
  kind: 'near' | 'far' | 'previous';
}

function findReference(message: NormalizedMessage): ReferenceHit | null {
  for (const group of REFERENCE_WORDS) {
    for (const surface of group.surface) {
      if (message.tokens.includes(surface)) return { surface, kind: group.kind };
    }
  }
  return null;
}

/**
 * Candidates the reference could point at, most recent first. The current
 * concept is included explicitly because it may have been set by an assistant
 * turn rather than by the user naming it.
 */
function candidatePool(state: ConversationState): { concept: string; label: string; recency: number }[] {
  const pool: { concept: string; label: string; recency: number }[] = [];
  const seen = new Set<string>();

  const add = (concept: string | undefined, recency: number) => {
    if (!concept || seen.has(concept)) return;
    seen.add(concept);
    pool.push({ concept, label: labelForConcept(concept), recency });
  };

  add(state.currentConcept, state.turnIndex);
  for (const entity of state.recentEntities) add(entity.concept, entity.lastSeen);
  add(state.previousConcept, 0);

  return pool.sort((a, b) => b.recency - a.recency);
}

export function resolveReference(
  message: NormalizedMessage,
  state: ConversationState,
): ReferenceResolution | null {
  const hit = findReference(message);
  if (!hit) return null;

  const pool = candidatePool(state);
  if (pool.length === 0) {
    return { surface: hit.surface, confidence: 0, alternatives: [] };
  }

  // „წინა" explicitly means the one before the current one.
  if (hit.kind === 'previous') {
    const prior = pool.find((c) => c.concept !== state.currentConcept) ?? pool[0]!;
    return {
      surface: hit.surface,
      concept: prior.concept,
      label: prior.label,
      confidence: state.previousConcept ? 0.85 : 0.5,
      alternatives: pool.filter((c) => c.concept !== prior.concept).slice(0, 2),
    };
  }

  const [first, second] = pool;
  if (!first) return { surface: hit.surface, confidence: 0, alternatives: [] };

  // One clear front-runner: the thing we were just talking about.
  const dominant = !second || first.recency - second.recency >= 1;
  const confidence = dominant ? 0.9 : 0.55;

  return {
    surface: hit.surface,
    concept: first.concept,
    label: first.label,
    confidence,
    alternatives: pool.slice(1, 3).map(({ concept, label }) => ({ concept, label })),
  };
}

/**
 * A correction („არა, arrays ვიგულისხმე") names what the user actually meant.
 * The named concept is whatever the message mentions besides the correction
 * marker; when it names nothing, the correction is a request for a
 * clarification rather than a switch.
 */
export function correctionTarget(
  candidates: readonly { concept: string; label: string }[],
  state: ConversationState,
): { concept: string; label: string } | null {
  const fresh = candidates.find((c) => c.concept !== state.currentConcept);
  return fresh ?? null;
}
