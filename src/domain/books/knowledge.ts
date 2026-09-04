import { aliasIndex, kaStemDeep } from '@/language/ka';
import type {
  BookChunk,
  BookKnowledgeItem,
  BookProvenance,
  BookRelation,
  BookRelationKind,
  BookSection,
  Confidence,
  KnowledgeItemType,
} from './types';
import { chunkTerms } from './chunk';

/**
 * Stage 5 — structured knowledge extraction.
 *
 * Chunks alone reduce a book to a search box. What makes a book *usable* in
 * conversation is the structure inside it: which sentences define something,
 * which assert a position, which raise an objection, which reply to one.
 *
 * The extraction is marker-driven and deliberately conservative. Philosophical
 * prose is unusually cooperative here — it signposts its own moves ("one might
 * object", "it follows that", "suppose that") because it is written to be
 * argued with. Where a marker is explicit the item is high confidence; where
 * the reading is inferred it is marked lower, and the retrieval layer weighs
 * it accordingly.
 *
 * Nothing is invented. Every item's `content` is a span of the book's own
 * text, and every item carries the page range it was taken from.
 */

/* ------------------------------- markers -------------------------------- */

interface Marker {
  type: KnowledgeItemType;
  patterns: RegExp[];
  confidence: Confidence;
  /** Capture group holding the subject being defined, if any. */
  subjectGroup?: number;
}

const MARKERS: Marker[] = [
  {
    type: 'definition',
    confidence: 'high',
    subjectGroup: 1,
    patterns: [
      /\b([A-Z][\w-]*(?:\s+[a-z][\w-]*){0,3})\s+(?:is|are)\s+(?:defined|understood|taken)\s+(?:as|to\s+be)\b/,
      /\bby\s+["“']?([\w\s-]{3,40})["”']?\s*,?\s*(?:i|we)\s+mean\b/i,
      /\bthe\s+term\s+["“']?([\w\s-]{3,40})["”']?\s+(?:refers\s+to|denotes|means)\b/i,
      /\b([\w-]{4,30})\s+means\s+(?:that\s+)?\b/i,
      /(?<![\p{L}])([\p{L}-]{4,30})\s*—?\s*ეს\s+არის(?![\p{L}])/u,
      /(?<![\p{L}])([\p{L}-]{4,30})\s+ნიშნავს(?![\p{L}])/u,
      /(?<![\p{L}])([\p{L}-]{4,30})-?ს\s+ეწოდება(?![\p{L}])/u,
    ],
  },
  {
    type: 'position',
    confidence: 'high',
    subjectGroup: 1,
    patterns: [
      /\b(\w*ism|\w*ists?)\b[^.]{0,40}\b(?:holds?|maintains?|claims?|asserts?|says?)\s+that\b/i,
      /\baccording\s+to\s+([\w\s]{3,40}),/i,
      /(?<![\p{L}])([\p{L}]{4,30}იზმი)[^.]{0,40}(?:ამტკიცებს|მიიჩნევს|ამბობს)(?![\p{L}])/u,
    ],
  },
  {
    type: 'argument',
    confidence: 'high',
    patterns: [
      /\b(?:therefore|thus|hence|consequently|it\s+follows\s+that|we\s+may\s+conclude)\b/i,
      /(?<![\p{L}])(?:მაშასადამე|შესაბამისად|აქედან\s+გამომდინარე|ამრიგად)(?![\p{L}])/u,
    ],
  },
  {
    type: 'objection',
    confidence: 'high',
    patterns: [
      /\b(?:one\s+might\s+object|it\s+may\s+be\s+objected|critics?\s+(?:argue|claim|object)|an?\s+obvious\s+objection|against\s+this(?:\s+view)?)\b/i,
      /\b(?:the\s+)?(?:standard|common|main)\s+objection\b/i,
      /(?<![\p{L}])(?:შესაგებელი|წინააღმდეგობა|კრიტიკოსები\s+ამბობენ|ამის\s+წინააღმდეგ)(?![\p{L}])/u,
    ],
  },
  {
    type: 'reply',
    confidence: 'high',
    patterns: [
      /\b(?:in\s+reply|the\s+reply\s+is|in\s+response|this\s+objection\s+fails|the\s+defender\s+(?:may|can)\s+respond|but\s+this\s+(?:objection\s+)?(?:misses|ignores|overlooks))\b/i,
      /(?<![\p{L}])(?:პასუხად|საპასუხოდ|ეს\s+შესაგებელი\s+ვერ)(?![\p{L}])/u,
    ],
  },
  {
    type: 'counterargument',
    confidence: 'medium',
    patterns: [
      /\b(?:on\s+the\s+other\s+hand|however,|by\s+contrast|conversely|yet\s+this)\b/i,
      /(?<![\p{L}])(?:მეორე\s+მხრივ|თუმცა,|საპირისპიროდ)/u,
    ],
  },
  {
    type: 'thoughtExperiment',
    confidence: 'high',
    patterns: [
      /\b(?:thought\s+experiment|imagine\b|suppose\b|consider\s+a\s+case|picture\s+a)/i,
      /(?<![\p{L}])(?:წარმოიდგინე|დავუშვათ|წარმოვიდგინოთ|სააზროვნო\s+ექსპერიმენტი)/u,
    ],
  },
  {
    type: 'example',
    confidence: 'medium',
    patterns: [
      /\b(?:for\s+example|for\s+instance|to\s+take\s+an?\s+example|as\s+an\s+illustration|e\.g\.)\b/i,
      /(?<![\p{L}])(?:მაგალითად|მაგალითისთვის)/u,
    ],
  },
  {
    type: 'distinction',
    confidence: 'high',
    patterns: [
      /\bdistinction\s+between\s+([\w\s-]{3,50})\s+and\s+([\w\s-]{3,50})/i,
      /\bmust\s+be\s+distinguished\s+from\b/i,
      /\bdiffers?\s+from\b[^.]{0,60}\bin\s+that\b/i,
      /(?<![\p{L}])(?:განსხვავება|უნდა\s+გავმიჯნოთ|განსხვავდება)[^.]{0,50}(?:\s+და\s+|-გან)/u,
    ],
  },
  {
    type: 'claim',
    confidence: 'medium',
    patterns: [
      /\b(?:i\s+(?:shall\s+)?argue\s+that|my\s+claim\s+is|the\s+central\s+claim|i\s+maintain\s+that|the\s+thesis\s+(?:is|of))\b/i,
      /(?<![\p{L}])(?:ვამტკიცებ|ჩემი\s+თეზისი|მთავარი\s+მტკიცება)/u,
    ],
  },
];

/** Premise markers, used to reconstruct an argument's shape. */
const PREMISE_MARKER =
  /(?:\bsince\b|\bbecause\b|\bgiven\s+that\b|\binasmuch\s+as\b|რადგან|იმიტომ\s+რომ|ვინაიდან)/i;
const CONCLUSION_MARKER =
  /(?:\btherefore\b|\bthus\b|\bhence\b|\bconsequently\b|\bit\s+follows\b|მაშასადამე|შესაბამისად|ამრიგად)/i;

/* ------------------------------ sentences ------------------------------- */

/** Split into sentences without breaking on common abbreviations. */
export function splitSentences(text: string): string[] {
  // Split on paragraph boundaries first. A chunk joins paragraphs with a blank
  // line, and a "sentence" that spans one is a splice of two passages that are
  // not adjacent in the book — its text would not appear contiguously on the
  // page it cites.
  return text
    .split(/\n{2,}/)
    .flatMap((paragraph) => {
      const guarded = paragraph.replace(
        /\b(e\.g|i\.e|cf|etc|vs|Dr|Mr|Mrs|Prof|St|ch|p|pp|vol)\./gi,
        '$1\u0001',
      );
      return guarded.split(/(?<=[.!?])\s+(?=[\p{L}\u201e"'(])|(?<=[.!?])\n+/u);
    })
    .map((s) => s.split('\u0001').join('.').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 25 && s.length <= 600);
}

/* ------------------------------- concepts ------------------------------- */

const ISM = /\b([a-z]{3,}(?:ism|ity|ance|ence))\b/gi;
const KA_ISM = /(?<![\p{L}])([\p{L}]{4,}(?:იზმი|ობა|ება))(?![\p{L}])/gu;

/**
 * Which Labo concept does this text belong to?
 *
 * This is the join between an imported book and the existing Labo Brain: when
 * a passage's vocabulary matches a known alias, the extracted item is filed
 * under that same concept key, so book knowledge and authored knowledge answer
 * the same question. When nothing matches, the book's own dominant term
 * becomes the key, and the item stays retrievable on its own terms.
 */
export function assignConcept(text: string): { concept: string; label: string; matched: boolean } {
  const index = aliasIndex();
  const terms = chunkTerms(text);

  const votes = new Map<string, number>();
  for (const term of terms) {
    for (const entry of index.byToken.get(term) ?? []) {
      votes.set(entry.concept, (votes.get(entry.concept) ?? 0) + 1);
    }
  }

  let best: { concept: string; count: number } | null = null;
  for (const [concept, count] of votes) {
    if (!best || count > best.count) best = { concept, count };
  }

  if (best && best.count >= 2) {
    const entry = index.byConcept.get(best.concept);
    return { concept: best.concept, label: entry?.label ?? best.concept, matched: true };
  }

  // Fall back to a distinctive term from the passage itself.
  const isms = [...text.matchAll(ISM)].map((m) => m[1]!.toLowerCase());
  const kaIsms = [...text.matchAll(KA_ISM)].map((m) => m[1]!.toLowerCase());
  const candidate = isms[0] ?? kaIsms[0];
  if (candidate) {
    return { concept: `book:${kaStemDeep(candidate)}`, label: candidate, matched: false };
  }

  const frequent = terms
    .reduce<Map<string, number>>((map, t) => map.set(t, (map.get(t) ?? 0) + 1), new Map());
  const top = [...frequent.entries()].sort((a, b) => b[1] - a[1])[0];
  return top
    ? { concept: `book:${top[0]}`, label: top[0], matched: false }
    : { concept: 'book:general', label: 'ზოგადი', matched: false };
}

/* ------------------------------ extraction ------------------------------ */

/**
 * The page range a sentence actually occupies.
 *
 * A chunk may span two pages; attributing every sentence in it to the whole
 * range would widen citations for no reason. The chunk's recorded spans say
 * which paragraph each offset belongs to, so the citation stays as tight as
 * the source allows. When the sentence cannot be located, the chunk's own
 * range is used — wider, but still true.
 */
export function pagesForSentence(
  chunk: BookChunk,
  sentence: string,
): { pageStart: number; pageEnd: number } {
  const offset = chunk.text.indexOf(sentence.slice(0, 40));
  if (offset < 0 || chunk.spans.length === 0) {
    return { pageStart: chunk.pageStart, pageEnd: chunk.pageEnd };
  }
  const end = offset + sentence.length;
  const touched = chunk.spans.filter((span) => span.start < end && span.end > offset);
  if (touched.length === 0) {
    return { pageStart: chunk.pageStart, pageEnd: chunk.pageEnd };
  }
  return {
    pageStart: Math.min(...touched.map((s) => s.pageStart)),
    pageEnd: Math.max(...touched.map((s) => s.pageEnd)),
  };
}

function downgrade(confidence: Confidence, chunkQuality: Confidence): Confidence {
  // A perfectly-matched marker on a badly-extracted page is still doubtful.
  if (chunkQuality === 'low') return 'low';
  if (chunkQuality === 'medium' && confidence === 'high') return 'medium';
  return confidence;
}

export interface ExtractKnowledgeInput {
  bookId: string;
  bookTitle: string;
  author?: string;
  chunks: readonly BookChunk[];
  sections: readonly BookSection[];
  importedAt: number;
  meta?: { edition?: string; publisher?: string; year?: number; isbn?: string };
}

export function extractKnowledge(input: ExtractKnowledgeInput): {
  items: BookKnowledgeItem[];
  relations: BookRelation[];
} {
  const sectionById = new Map(input.sections.map((s) => [s.id, s]));
  const items: BookKnowledgeItem[] = [];
  const relations: BookRelation[] = [];
  let seq = 0;
  let relSeq = 0;

  const seen = new Set<string>();

  /*
   * Rolling antecedents, carried across chunks within one section.
   *
   * A claim and the objection to it are almost never inside the same
   * 900-character chunk — in real prose they are pages apart. Resetting these
   * per chunk produced almost no relations on a real book; scoping them to the
   * section is both more accurate and far more productive.
   */
  let lastClaimId: string | undefined;
  let lastObjectionId: string | undefined;
  let lastSectionId: string | undefined;

  for (const chunk of input.chunks) {
    const section = sectionById.get(chunk.sectionId);
    const sectionTerms = section
      ? chunkTerms(`${section.title} ${section.chapter ?? ''}`)
      : [];
    if (chunk.sectionId !== lastSectionId) {
      lastClaimId = undefined;
      lastObjectionId = undefined;
      lastSectionId = chunk.sectionId;
    }
    const sentences = splitSentences(chunk.text);

    for (const sentence of sentences) {
      for (const marker of MARKERS) {
        let match: RegExpExecArray | null = null;
        for (const pattern of marker.patterns) {
          match = pattern.exec(sentence);
          if (match) break;
        }
        if (!match) continue;

        // The same sentence can only be filed once, under its strongest marker.
        const key = `${marker.type}:${sentence.slice(0, 60)}`;
        if (seen.has(key)) break;
        seen.add(key);

        const { concept, label } = assignConcept(
          marker.subjectGroup && match[marker.subjectGroup]
            ? `${match[marker.subjectGroup]} ${sentence}`
            : sentence,
        );

        const pages = pagesForSentence(chunk, sentence);
        const source: BookProvenance = {
          bookId: input.bookId,
          bookTitle: input.bookTitle,
          ...(input.author ? { author: input.author } : {}),
          ...(section?.chapter ? { chapter: section.chapter } : {}),
          ...(section?.title ? { section: section.title } : {}),
          pageStart: pages.pageStart,
          pageEnd: pages.pageEnd,
          sourceChunkId: chunk.id,
          importedAt: input.importedAt,
          ...(input.meta ?? {}),
        };

        const id = `bk_${input.bookId}_${seq++}`;
        const item: BookKnowledgeItem = {
          id,
          bookId: input.bookId,
          type: marker.type,
          concept,
          conceptLabel: label,
          content: sentence,
          confidence: downgrade(marker.confidence, chunk.quality),
          source,
          /*
           * Section terms ride along with the sentence's own.
           *
           * In an anthology the author's name lives in the running head and
           * the section title, never in the sentence — so „მაკიაველი რას
           * წერს…" cannot reach Machiavelli's claims without this.
           */
          terms: [...chunkTerms(sentence), ...sectionTerms],
        };

        // Reconstruct argument shape where the prose signposts it.
        if (marker.type === 'argument') {
          const premises = sentences
            .filter((s) => s !== sentence && PREMISE_MARKER.test(s))
            .slice(0, 3);
          const conclusionPart = sentence.split(CONCLUSION_MARKER).pop()?.trim();
          if (premises.length) item.premises = premises;
          if (conclusionPart && conclusionPart.length > 10) item.conclusion = conclusionPart;
        }

        items.push(item);

        /* ---- relations within the chunk ---- */
        const addRelation = (from: string, to: string, kind: BookRelationKind, c: Confidence) => {
          relations.push({
            id: `rel_${input.bookId}_${relSeq++}`,
            bookId: input.bookId,
            from,
            to,
            kind,
            confidence: c,
          });
        };

        if (marker.type === 'claim' || marker.type === 'position') lastClaimId = id;
        if (marker.type === 'objection') {
          lastObjectionId = id;
          // An objection appearing after a claim in the same passage is
          // almost always aimed at it.
          if (lastClaimId) addRelation(id, lastClaimId, 'challenges', 'medium');
        }
        if (marker.type === 'reply' && lastObjectionId) {
          addRelation(id, lastObjectionId, 'responds_to', 'medium');
        }
        if (marker.type === 'counterargument' && lastClaimId) {
          addRelation(id, lastClaimId, 'contradicts', 'low');
        }
        if ((marker.type === 'example' || marker.type === 'thoughtExperiment') && lastClaimId) {
          addRelation(id, lastClaimId, 'example_of', 'medium');
        }
        if (marker.type === 'argument' && lastClaimId) {
          addRelation(id, lastClaimId, 'supports', 'medium');
        }

        break; // one marker per sentence
      }
    }
  }

  // Concept records: one per distinct concept the book actually discusses.
  const conceptCounts = new Map<string, { label: string; count: number; first: BookKnowledgeItem }>();
  for (const item of items) {
    const existing = conceptCounts.get(item.concept);
    if (existing) existing.count++;
    else conceptCounts.set(item.concept, { label: item.conceptLabel, count: 1, first: item });
  }
  for (const [concept, info] of conceptCounts) {
    if (info.count < 2) continue;
    items.push({
      id: `bk_${input.bookId}_c_${seq++}`,
      bookId: input.bookId,
      type: 'concept',
      concept,
      conceptLabel: info.label,
      content: info.first.content,
      confidence: info.count >= 4 ? 'high' : 'medium',
      source: info.first.source,
      terms: info.first.terms,
    });
  }

  return { items, relations };
}
