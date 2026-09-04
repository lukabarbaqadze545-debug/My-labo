import { library, t, type Topic } from '@/content';
import { aliasIndex, kaStemDeep, trigramSimilarity, isTypoOf, type AliasEntry } from '@/language/ka';
import { neighbours, classifyId } from '../graph';
import type {
  ConversationState,
  KnowledgeCandidate,
  MatchLayer,
  NormalizedMessage,
} from './types';

/**
 * Stage 5 — knowledge retrieval, as a ladder rather than a lookup.
 *
 * Each rung is tried in turn and the first one that produces a solid candidate
 * wins. Only when every rung fails does the engine consider itself unable to
 * read the message — and even then the caller prefers a clarification to a
 * dead end.
 *
 *   exact → alias phrase → alias token → lexical → fuzzy → related → context
 *
 * The rung that fired is reported, because "found via fuzzy match" and "found
 * via exact title" should not produce equally confident answers.
 */

/* ------------------------------ lexical index --------------------------- */

interface TopicDoc {
  topicId: string;
  label: string;
  subjectId: string;
  titleStems: string[];
  tagStems: string[];
  hookStems: string[];
  body: Set<string>;
}

function stemsOf(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}/\\„""''—–-]+/u)
    .filter((w) => w.length >= 2)
    .map(kaStemDeep);
}

function topicBodyText(topic: Topic): string {
  const parts: string[] = [];
  for (const section of topic.sections) {
    for (const block of section.blocks) {
      switch (block.type) {
        case 'paragraph':
          parts.push(t(block.text));
          break;
        case 'list':
          parts.push(block.items.map((i) => t(i)).join(' '));
          break;
        case 'callout':
          parts.push(`${t(block.title)} ${t(block.text)}`);
          break;
        case 'termList':
          parts.push(block.items.map((i) => `${t(i.term)} ${t(i.def)}`).join(' '));
          break;
        case 'quote':
          parts.push(t(block.text));
          break;
        default:
          break;
      }
    }
  }
  return parts.join(' ');
}

interface LexicalIndex {
  docs: TopicDoc[];
  byTopicId: Map<string, TopicDoc>;
  /** stem → number of documents containing it, for inverse document frequency. */
  df: Map<string, number>;
  total: number;
}

let lexCache: LexicalIndex | null = null;

function lexicalIndex(): LexicalIndex {
  if (lexCache) return lexCache;
  const docs: TopicDoc[] = library.topics.map((topic) => ({
    topicId: topic.id,
    label: t(topic.title),
    subjectId: topic.subjectId,
    titleStems: [...stemsOf(t(topic.title)), ...stemsOf(topic.title.en ?? '')],
    tagStems: (topic.tags ?? []).flatMap(stemsOf),
    hookStems: stemsOf(t(topic.hook)),
    body: new Set([...stemsOf(topicBodyText(topic)), ...stemsOf(t(topic.hook))]),
  }));

  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const stem of doc.body) df.set(stem, (df.get(stem) ?? 0) + 1);
  }

  lexCache = { docs, byTopicId: new Map(docs.map((d) => [d.topicId, d])), df, total: docs.length };
  return lexCache;
}

/** Rare words carry more signal than common ones. */
function idf(stem: string, index: LexicalIndex): number {
  const df = index.df.get(stem) ?? 0;
  return Math.log(1 + index.total / (1 + df));
}

/* ------------------------------- rungs ---------------------------------- */

function candidateFor(entry: AliasEntry, score: number, layer: MatchLayer, coverage: number, evidence: string[]): KnowledgeCandidate {
  return {
    concept: entry.concept,
    label: entry.label,
    ...(entry.topicId ? { topicId: entry.topicId } : {}),
    score: score * (entry.weight ?? 1),
    layer,
    coverage,
    evidence,
  };
}

function topicCandidate(doc: TopicDoc, score: number, layer: MatchLayer, coverage: number, evidence: string[]): KnowledgeCandidate {
  return {
    concept: doc.topicId,
    label: doc.label,
    topicId: doc.topicId,
    score,
    layer,
    coverage,
    evidence,
  };
}

/** Rung 1+2: the message contains a stated alias phrase, longest first. */
function aliasMatches(message: NormalizedMessage, extra: readonly AliasEntry[]): KnowledgeCandidate[] {
  const index = aliasIndex(extra);
  const flat = message.stems.join(' ');
  const whole = flat.trim();
  const out: KnowledgeCandidate[] = [];
  const seen = new Set<string>();

  // Longest phrases first, so "binary search" beats a bare "search".
  const phrases = [...index.byPhrase.keys()].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const isWhole = whole === phrase;
    // A single-token alias must match a *content* stem. Matching against the
    // raw, unfiltered stem list let a pronoun like „შენ" (you) — which
    // over-stemming can coincidentally collapse down to the same three
    // letters as „შენონი" (Shannon) — spuriously resolve an entire message to
    // information theory. Multi-word phrases stay on the full text: a real
    // phrase occurring in sequence is specific enough on its own.
    const contained = phrase.includes(' ')
      ? flat.includes(phrase)
      : message.contentStems.includes(phrase);
    if (!isWhole && !contained) continue;
    for (const entry of index.byPhrase.get(phrase)!) {
      if (seen.has(entry.concept)) continue;
      seen.add(entry.concept);
      const words = phrase.split(' ').length;
      const coverage = message.contentStems.length
        ? Math.min(1, words / message.contentStems.length)
        : 1;
      out.push(
        candidateFor(
          entry,
          isWhole ? 26 : 14 + words * 4,
          isWhole ? 'exact' : words > 1 ? 'phrase' : 'alias',
          coverage,
          [phrase],
        ),
      );
    }
  }
  return out;
}

/** Rung 4: weighted lexical overlap against titles, tags, hooks and bodies. */
function lexicalMatches(message: NormalizedMessage): KnowledgeCandidate[] {
  const index = lexicalIndex();
  const query = message.contentStems;
  if (query.length === 0) return [];

  const out: KnowledgeCandidate[] = [];
  for (const doc of index.docs) {
    let score = 0;
    let covered = 0;
    const evidence: string[] = [];

    for (const stem of query) {
      let best = 0;
      if (doc.titleStems.includes(stem)) best = 12;
      else if (doc.tagStems.includes(stem)) best = 9;
      else if (doc.hookStems.includes(stem)) best = 5;
      else if (doc.body.has(stem)) best = 2 * idf(stem, index);
      else if (doc.titleStems.some((ts) => ts.startsWith(stem) || stem.startsWith(ts))) best = 6;
      if (best > 0) {
        covered++;
        score += best;
        evidence.push(stem);
      }
    }
    if (score <= 0) continue;
    out.push(topicCandidate(doc, score, 'token', covered / query.length, evidence));
  }
  out.sort((a, b) => b.score - a.score || b.coverage - a.coverage);
  return out.slice(0, 8);
}

/** Rung 5: typo and near-miss matching against alias vocabulary and titles. */
function fuzzyMatches(message: NormalizedMessage, extra: readonly AliasEntry[]): KnowledgeCandidate[] {
  const index = aliasIndex(extra);
  const out: KnowledgeCandidate[] = [];
  const seen = new Set<string>();

  for (const stem of message.contentStems) {
    if (stem.length < 4) continue;
    for (const vocab of index.vocabulary) {
      if (vocab.length < 4) continue;
      const near = isTypoOf(stem, vocab) || trigramSimilarity(stem, vocab) >= 0.62;
      if (!near) continue;
      for (const entry of index.byToken.get(vocab) ?? []) {
        if (seen.has(entry.concept)) continue;
        seen.add(entry.concept);
        out.push(
          candidateFor(entry, 7, 'fuzzy', 1 / Math.max(1, message.contentStems.length), [
            `${stem}≈${vocab}`,
          ]),
        );
      }
    }
  }

  const lex = lexicalIndex();
  for (const stem of message.contentStems) {
    if (stem.length < 4) continue;
    for (const doc of lex.docs) {
      if (seen.has(doc.topicId)) continue;
      const hit = doc.titleStems.some((ts) => ts.length >= 4 && (isTypoOf(stem, ts) || trigramSimilarity(stem, ts) >= 0.68));
      if (!hit) continue;
      seen.add(doc.topicId);
      out.push(topicCandidate(doc, 6, 'fuzzy', 1 / Math.max(1, message.contentStems.length), [`${stem}≈${doc.label}`]));
    }
  }
  return out.slice(0, 6);
}

/** Rung 6: concepts adjacent in the knowledge graph to what we are discussing. */
function relatedMatches(state: ConversationState): KnowledgeCandidate[] {
  if (!state.currentTopicId) return [];
  const out: KnowledgeCandidate[] = [];
  for (const edge of neighbours(state.currentTopicId)) {
    if (classifyId(edge.to) !== 'topic') continue;
    const topic = library.topicById.get(edge.to);
    if (!topic) continue;
    out.push({
      concept: topic.id,
      label: t(topic.title),
      topicId: topic.id,
      score: 4,
      layer: 'related',
      coverage: 0.3,
      evidence: [`graph:${edge.kind}`],
    });
  }
  return out.slice(0, 4);
}

/* ------------------------------ entry point ----------------------------- */

export interface RetrievalResult {
  candidates: KnowledgeCandidate[];
  layer: MatchLayer;
}

/**
 * Walk the ladder. `extraAliases` carries user-taught aliases so Teach Labo
 * takes effect immediately, without a rebuild.
 */
export function retrieve(
  message: NormalizedMessage,
  state: ConversationState,
  extraAliases: readonly AliasEntry[] = [],
): RetrievalResult {
  const alias = aliasMatches(message, extraAliases);
  if (alias.length > 0) {
    alias.sort((a, b) => b.score - a.score);
    return { candidates: alias, layer: alias[0]!.layer };
  }

  const lexical = lexicalMatches(message);
  // A lexical hit is trusted only when it explains a decent share of the
  // message *and* scores well enough to be more than an incidental body
  // mention; otherwise one common word picks an unrelated topic.
  const solid = lexical.filter((c) => (c.coverage >= 0.5 && c.score >= 8) || c.score >= 14);
  if (solid.length > 0) return { candidates: solid, layer: 'token' };

  const fuzzy = fuzzyMatches(message, extraAliases);
  if (fuzzy.length > 0) {
    fuzzy.sort((a, b) => b.score - a.score);
    return { candidates: fuzzy, layer: 'fuzzy' };
  }

  // Weak lexical evidence is better than nothing, but is reported as such.
  if (lexical.length > 0) return { candidates: lexical.slice(0, 3), layer: 'fuzzy' };

  const related = relatedMatches(state);
  if (related.length > 0) return { candidates: related, layer: 'related' };

  return { candidates: [], layer: 'none' };
}

/** Resolve a concept key to a library topic, when one exists. */
export function topicForConcept(concept: string): Topic | undefined {
  const direct = library.topicById.get(concept);
  if (direct) return direct;
  const entry = aliasIndex().byConcept.get(concept);
  return entry?.topicId ? library.topicById.get(entry.topicId) : undefined;
}

/** Human label for a concept, whether or not the library covers it. */
export function labelForConcept(concept: string): string {
  const topic = library.topicById.get(concept);
  if (topic) return t(topic.title);
  return aliasIndex().byConcept.get(concept)?.label ?? concept;
}

/** True when we recognise the concept but hold no material on it. */
export function isKnownButUncovered(concept: string): boolean {
  const entry = aliasIndex().byConcept.get(concept);
  return Boolean(entry && !entry.topicId && !library.topicById.has(concept));
}

export function resetRetrievalCache(): void {
  lexCache = null;
}
