import { kaStemDeep, PARTICLES, isTypoOf, aliasIndex, CONVERSATION_SIGNALS } from '@/language/ka';
import type { NormalizedMessage } from './types';

/**
 * Stage 1 — message normalization.
 *
 * Turns whatever the user typed into a stable shape the rest of the pipeline
 * can rely on: consistent Unicode, repaired obvious typos, morphologically
 * reduced tokens, and an explicit flag for "this message has no subject of its
 * own". That last flag is what makes „უფრო მარტივად" routable at all.
 */

/** Filler that never names a subject. Distinct from the reasoning stop list. */
const STOPWORDS = new Set([
  'და', 'ან', 'თუ', 'რომ', 'როგორც', 'ის', 'ეს', 'ეგ', 'იმ', 'ამ', 'მაგ',
  'მე', 'შენ', 'ჩვენ', 'თქვენ', 'მან', 'მათ', 'ვინც', 'რომელიც',
  'არის', 'არაა', 'იყო', 'იქნება', 'ვარ', 'ხარ', 'არიან', 'აქვს', 'მაქვს',
  'მინდა', 'მითხარი', 'ამიხსენი', 'ახსენი', 'გამაგებინე', 'გთხოვ', 'შეგიძლია',
  'ძალიან', 'ცოტა', 'უფრო', 'კიდევ', 'ისევ', 'უკვე', 'ჯერ', 'მხოლოდ', 'ასევე',
  'ხო', 'ხომ', 'აბა', 'კი', 'ჰო', 'მაშ', 'მაშინ', 'ანუ', 'მაინც', 'რა', 'რას',
  'the', 'a', 'an', 'is', 'are', 'of', 'to', 'me', 'my', 'i', 'you', 'it',
  'explain', 'tell', 'please', 'what', 'how', 'why', 'when',
]);

/** Frequent misspellings worth repairing before anything else looks at them. */
const TYPO_MAP: Record<string, string> = {
  ალგორთმი: 'ალგორითმი',
  ალგორითმბი: 'ალგორითმები',
  ფილოსოფა: 'ფილოსოფია',
  მათემატიკია: 'მათემატიკა',
  binarry: 'binary',
  serach: 'search',
  serch: 'search',
  algoritm: 'algorithm',
  algorythm: 'algorithm',
  recursivee: 'recursive',
  probabilty: 'probability',
  philosphy: 'philosophy',
};

/**
 * Words that carry a conversational signal rather than a subject.
 *
 * This distinction is load-bearing. „მარტივად" (simply) means *simplify*, but
 * „მარტივი რიცხვი" (prime number) is a topic — and both stem to „მარტივ".
 * Without this set, asking for a simpler explanation retrieves prime numbers.
 *
 * Only `contentStems` is filtered. Alias matching still sees the full stem
 * list, so multi-word topics containing a signal word keep working.
 */
const SIGNAL_STEMS = new Set<string>(
  CONVERSATION_SIGNALS.flatMap((rule) => [
    ...rule.phrases.flatMap((phrase) =>
      phrase
        .normalize('NFC')
        .toLowerCase()
        .split(/[\s,]+/u)
        .filter(Boolean)
        .flatMap((word) => [word, kaStemDeep(word)]),
    ),
    ...(rule.stems ?? []),
  ]),
);

const GEORGIAN = /[Ⴀ-ჿ]/;
const LATIN = /[a-z]/i;

function detectScript(text: string): NormalizedMessage['script'] {
  const ka = GEORGIAN.test(text);
  const en = LATIN.test(text);
  if (ka && en) return 'mixed';
  return ka ? 'ka' : 'en';
}

const QUESTION_OPENERS =
  /^(რა|რას|რის|რატომ|როგორ|ვინ|სად|როდის|რომელ|რამდენ|განა|ხომ|შეიძლება|what|why|how|who|when|where|which|can|does|is|are)\b/;

export function isQuestionText(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.endsWith('?') || /(^|\s)თუ არა(\s|$)/.test(t) || QUESTION_OPENERS.test(t);
}

/**
 * Repair a token against the alias vocabulary. Only applied to tokens that are
 * not already known, so correct spellings are never "fixed" into something
 * else.
 */
function repairToken(token: string, vocabulary: readonly string[]): string | null {
  if (TYPO_MAP[token]) return TYPO_MAP[token]!;
  if (token.length < 5) return null;
  const stemmed = kaStemDeep(token);
  if (vocabulary.includes(stemmed)) return null;
  let best: { word: string; score: number } | null = null;
  for (const candidate of vocabulary) {
    if (Math.abs(candidate.length - stemmed.length) > 2) continue;
    if (!isTypoOf(stemmed, candidate)) continue;
    const score = candidate.length;
    if (!best || score > best.score) best = { word: candidate, score };
  }
  return best ? best.word : null;
}

export function normalize(raw: string): NormalizedMessage {
  const repairs: { from: string; to: string }[] = [];

  const text = raw
    .normalize('NFC')
    .toLowerCase()
    // Keep the question mark: it is the strongest signal a message carries.
    .replace(/[„""''`]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

  // Hyphens split too: „BFS-ზე" must yield „bfs", and multi-word aliases are
  // indexed on the same separators so „p-vs-np" still reassembles.
  const rawTokens = text
    .split(/[\s,.;:!?()[\]{}/\\\-_—–]+/u)
    .filter(Boolean);

  const vocabulary = aliasIndex().vocabulary;
  const tokens = rawTokens.map((token) => {
    const repaired = repairToken(token, vocabulary);
    if (repaired && repaired !== token) {
      repairs.push({ from: token, to: repaired });
      return repaired;
    }
    return token;
  });

  const stems = tokens.map(kaStemDeep);
  const contentStems = stems.filter(
    (s, i) =>
      s.length >= 2 &&
      !STOPWORDS.has(tokens[i]!) &&
      !STOPWORDS.has(s) &&
      !PARTICLES.has(tokens[i]!) &&
      !SIGNAL_STEMS.has(tokens[i]!) &&
      !SIGNAL_STEMS.has(s),
  );

  // A message with no content of its own must lean entirely on state.
  const isBareFollowUp = contentStems.length === 0;

  return {
    raw,
    text,
    tokens,
    stems,
    contentStems: [...new Set(contentStems)],
    script: detectScript(text),
    isQuestion: isQuestionText(raw),
    isBareFollowUp,
    repairs,
  };
}

export { STOPWORDS };
