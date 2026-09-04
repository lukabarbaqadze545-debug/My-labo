import { CONVERSATION_SIGNALS, type ConversationSignalKind } from '@/language/ka';
import type { ConversationState, IntentCandidate, IntentKind, NormalizedMessage } from './types';

/**
 * Stage 3 — intent detection.
 *
 * Reads *what the user wants done* from conversational signals, independently
 * of what they want it done to. That separation is the reason a message with
 * no subject („უფრო მარტივად") is still fully understood: the intent is
 * complete, and only the topic has to come from state.
 */

const SIGNAL_TO_INTENT: Record<ConversationSignalKind, IntentKind> = {
  simplify: 'simplify',
  expand: 'expand',
  deeper: 'expand',
  example: 'example',
  another: 'another_example',
  why: 'why',
  how: 'how',
  when_to_use: 'when_to_use',
  limitations: 'limitations',
  compare: 'compare',
  define: 'define',
  summarize: 'summarize',
  continue: 'continue',
  repeat: 'continue',
  back: 'go_back',
  correction: 'correction',
  agree: 'agree',
  disagree: 'disagree',
  counterargument: 'counterargument',
  argue_for: 'argue_for',
  quiz: 'quiz',
  stop: 'stop',
  thanks: 'thanks',
  greeting: 'greeting',
  meta: 'meta',
  opinion: 'opinion',
  defer_choice: 'defer_choice',
};

/** Strip punctuation from an authored phrase so matching is stable. */
const clean = (s: string) =>
  s.normalize('NFC').toLowerCase().replace(/[,.;:!?]/gu, ' ').replace(/\s+/gu, ' ').trim();

const RULES = CONVERSATION_SIGNALS.map((rule) => ({
  ...rule,
  phrases: rule.phrases.map(clean).filter(Boolean),
}));

/**
 * Short single words must match a whole token. Without this, „კი" (yes) hits
 * inside „კიდევ" (again) and every follow-up reads as agreement.
 */
function phraseHit(phrase: string, flat: string, tokens: readonly string[]): boolean {
  if (!phrase.includes(' ') && phrase.length <= 4) return tokens.includes(phrase);
  return flat.includes(phrase);
}

export function detectIntents(
  message: NormalizedMessage,
  state: ConversationState,
): IntentCandidate[] {
  const flat = message.tokens.join(' ');
  const found = new Map<IntentKind, IntentCandidate>();

  const bump = (kind: IntentKind, score: number, evidence: string) => {
    const existing = found.get(kind);
    if (existing) {
      existing.score = Math.max(existing.score, score);
      if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence);
    } else found.set(kind, { kind, score, evidence: [evidence] });
  };

  for (const rule of RULES) {
    const intent = SIGNAL_TO_INTENT[rule.kind];
    for (const phrase of rule.phrases) {
      if (phraseHit(phrase, flat, message.tokens)) {
        // A signal that is the entire message is a much stronger reading than
        // the same word buried in a longer sentence.
        const standaloneBonus = rule.standalone && message.tokens.length <= 3 ? 2 : 0;
        // A longer phrase is a more specific match than a short one it
        // happens to contain — „არ გეთანხმები" (disagree) must outscore the
        // bare „გეთანხმები" (agree) it contains, or negation gets lost.
        const specificity = (phrase.split(' ').length - 1) * 0.6;
        bump(intent, rule.weight + standaloneBonus + specificity, phrase);
        break;
      }
    }
    for (const sig of rule.stems ?? []) {
      if (message.stems.some((s) => s.includes(sig))) bump(intent, rule.weight - 0.5, `stem:${sig}`);
    }
  }

  // A declarative sentence with substance is the user taking a position — the
  // entry point to argument and Socratic handling.
  if (!message.isQuestion && message.contentStems.length >= 2 && !found.has('correction')) {
    bump('state_position', 2.5, 'declarative');
  }

  // Anything with a subject and no other reading is a request to explain it.
  if (found.size === 0 && message.contentStems.length > 0) {
    bump('explain', 2, 'default');
  }

  // A bare follow-up right after we spoke continues whatever we were doing.
  if (found.size === 0 && message.isBareFollowUp && state.currentConcept) {
    bump('continue', 1.5, 'bare-follow-up');
  }

  if (found.size === 0) bump('unknown', 0.5, 'no-signal');

  return [...found.values()].sort((a, b) => b.score - a.score);
}

export function topIntent(candidates: readonly IntentCandidate[]): IntentCandidate {
  return candidates[0] ?? { kind: 'unknown', score: 0, evidence: [] };
}

/** Intents that operate on whatever is already under discussion. */
export const CONTEXTUAL_INTENTS = new Set<IntentKind>([
  'simplify',
  'expand',
  'example',
  'another_example',
  'why',
  'how',
  'when_to_use',
  'limitations',
  'summarize',
  'continue',
  'counterargument',
  'argue_for',
  'compare',
  'agree',
  'disagree',
  'quiz',
  'opinion',
]);
