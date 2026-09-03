import { library, t, type Topic } from '@/content';
import { buildContentIndex, tokenize, type SearchDoc } from './search';
import { classifyId, neighbours } from './graph';

/**
 * The library assistant.
 *
 * This is *not* a language model. It is retrieval over the app's own
 * hand-written content plus a small composition layer: it reads the question,
 * works out what is being asked ("what is…", "why…", "who…"), finds the best
 * matching topic / person / formula / fact / event, and stitches the relevant
 * passages into a conversational answer with sources and follow-up questions.
 *
 * Because every sentence it returns was authored for the library, it never
 * invents facts — and it says plainly when a subject is not covered yet.
 */

export type Intent = 'what' | 'why' | 'how' | 'who' | 'when' | 'where' | 'formula' | 'example' | 'contrast';

export interface AnswerRef {
  label: string;
  href: string;
}

export interface Answer {
  /** The composed reply, plain text with blank-line paragraph breaks. */
  text: string;
  confidence: 'high' | 'medium' | 'none' | 'chat';
  sources: AnswerRef[];
  related: AnswerRef[];
  followUps: string[];
}

const norm = (s: string) => s.normalize('NFC').toLowerCase().trim();

/* ------------------------------ vocabulary ------------------------------ */

const INTENT_WORDS: [RegExp, Intent][] = [
  [/^რატომ/, 'why'],
  [/^როგორ/, 'how'],
  [/^ვინ/, 'who'],
  [/^(როდის|როცა|რომელ\s*წელ|რა\s*წელს)/, 'when'],
  [/^სად/, 'where'],
  [/(ფორმულ|განტოლებ|გამოსახულებ)/, 'formula'],
  [/(მაგალით|მაგალითად)/, 'example'],
  [/(განსხვავებ|სხვაობ|რითი\s*განსხვავდებ)/, 'contrast'],
  [/^(რა|რას|რის|რისი|რაა|რა\s*არის)/, 'what'],
];

const STOP = new Set(
  (
    'რა რას რის რისი რაა არის არაა არა იყო იქნება თუ და ან ის ეს იმ ამ მე შენ ჩვენ თქვენ მათ მან ' +
    'მინდა მაინტერესებს მითხარი მიამბე ამიხსენი ახსენი გამაგებინე გავიგო ვიცოდე ვისწავლო ' +
    'რომ როგორც ხომ კი ხო აბა ერთი ცოტა უფრო ძალიან როცა რადგან იმიტომ ვინ სად როდის რატომ როგორ ' +
    'გთხოვ გეთაყვა თავად კიდევ ისევ უკვე ჯერ მხოლოდ სწორედ ასევე ანუ ე.ი მაინც ' +
    // intent triggers — signal the *kind* of answer, not the subject
    'ფორმულა ფორმულ ფორმულას განტოლება განტოლებ განტოლებას გამოსახულება მაგალითი მაგალით მაგალითად ' +
    'აღწერს აღწერ ეხება ეხმარება ნიშნავს მუშაობს მუშაობ მოქმედებს მოქმედებ აკეთებს ხდება ხდებოდა ჰქვია'
  ).split(/\s+/),
);

function detectIntents(tokens: string[]): Intent[] {
  const found = new Set<Intent>();
  for (const tok of tokens) {
    for (const [re, intent] of INTENT_WORDS) if (re.test(tok)) found.add(intent);
  }
  return [...found];
}

function contentTerms(tokens: string[]): string[] {
  return tokens.filter((tok) => tok.length >= 2 && !STOP.has(tok));
}

/** Crude Georgian stem: drop up to two trailing letters of a longish word. */
function stem(term: string): string {
  return term.length > 5 ? term.slice(0, term.length - 2) : term;
}

/**
 * A few science synonyms the content authors use interchangeably. Each stem on
 * the left also counts as a match for the stems on the right.
 */
const SYNONYMS: Record<string, string[]> = {
  გრავიტ: ['მიზიდულ'],
  მიზიდულ: ['გრავიტ'],
  კომპიუტ: ['გამომთვლ', 'გამოთვლ'],
  ალგორით: ['რეცეპ'],
  ვარსკვლ: ['მნათობ'],
  უჯრედ: ['ცელულ'],
  ატომ: ['ნაწილაკ'],
};

function expand(term: string): string[] {
  const st = stem(term);
  for (const [key, syns] of Object.entries(SYNONYMS)) if (st.startsWith(key)) return [st, ...syns];
  return [st];
}

/* ------------------------------ retrieval ------------------------------- */

let indexCache: SearchDoc[] | null = null;
function index(): SearchDoc[] {
  if (!indexCache) {
    // Seed questions and activities are prompts, not answers — the assistant
    // should route "why is the sky blue?" to the topic that explains it, not to
    // an identically worded question card.
    indexCache = buildContentIndex('ka').filter((d) => d.kind !== 'question' && d.kind !== 'activity');
  }
  return indexCache;
}

interface Hit {
  doc: SearchDoc;
  score: number;
  coverage: number;
}

const INTENT_KIND: Partial<Record<Intent, SearchDoc['kind']>> = {
  who: 'person',
  formula: 'formula',
  when: 'event',
};

function retrieve(terms: string[], docs: SearchDoc[]): Hit[] {
  if (terms.length === 0) return [];
  const expanded = terms.map(expand);
  const hits: Hit[] = [];
  for (const doc of docs) {
    const title = norm(doc.title);
    let score = 0;
    let covered = 0;
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i]!;
      let s = 0;
      if (title === term) s = 16;
      else if (title.startsWith(term)) s = 10;
      else if (title.includes(term)) s = 7;
      else if (expanded[i]!.some((st) => title.includes(st))) s = 4;
      else if (doc.haystack.includes(` ${term}`) || doc.haystack.startsWith(term)) s = 2.5;
      else if (doc.haystack.includes(term)) s = 1.5;
      else if (expanded[i]!.some((st) => doc.haystack.includes(st))) s = 0.8;
      if (s > 0) covered++;
      score += s;
    }
    if (score <= 0) continue;
    hits.push({ doc, score: score * doc.weight, coverage: covered / terms.length });
  }
  hits.sort((a, b) => b.score - a.score || b.coverage - a.coverage);
  return hits;
}

function bestHit(terms: string[], intents: Intent[]): Hit | null {
  const preferKind = intents.map((i) => INTENT_KIND[i]).find(Boolean);

  // "which formula…", "who…", "when…" — search that kind on its own first.
  // Filler words ("which", "describes") never hit a title, so even a modest
  // score against, say, the formulas alone is a confident answer.
  if (preferKind) {
    const typedOnly = retrieve(
      terms,
      index().filter((d) => d.kind === preferKind),
    );
    if (typedOnly[0] && typedOnly[0].score >= 4) return typedOnly[0];
  }

  const all = retrieve(terms, index());
  if (all.length === 0) return null;

  // Sorted by score already. A hit needs at least half the content words *and*
  // either a strong score (title match) or full coverage of a short query.
  const strong = all.find((h) => h.coverage >= 0.5 && h.score >= 8);
  if (strong) return strong;

  const full = all.find((h) => h.coverage >= 0.66 && h.score >= 4);
  return full ?? null;
}

/* --------------------------- text extraction --------------------------- */

const SECTION_FOR_INTENT: Partial<Record<Intent, Topic['sections'][number]['kind']>> = {
  why: 'whyInteresting',
  how: 'keyIdeas',
  when: 'history',
  formula: 'formulas',
};

function blockText(block: Topic['sections'][number]['blocks'][number]): string {
  switch (block.type) {
    case 'paragraph':
      return t(block.text);
    case 'callout':
      return `${block.title ? `${t(block.title)}: ` : ''}${t(block.text)}`;
    case 'list':
      return block.items.map((i) => `• ${t(i)}`).join('\n');
    case 'termList':
      return block.items.map((i) => `• ${t(i.term)} — ${t(i.def)}`).join('\n');
    case 'quote':
      return `„${t(block.text)}"`;
    default:
      return '';
  }
}

function sectionText(topic: Topic, kind: Topic['sections'][number]['kind'], limit = 700): string {
  const section = topic.sections.find((s) => s.kind === kind);
  if (!section) return '';
  const parts: string[] = [];
  let len = 0;
  for (const block of section.blocks) {
    const txt = blockText(block).trim();
    if (!txt) continue;
    parts.push(txt);
    len += txt.length;
    if (len >= limit) break;
  }
  return parts.join('\n\n');
}

/* ---------------------------- composition ----------------------------- */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

const LEADS = [
  'აი, რაც ჩემს ბიბლიოთეკაში წერია:',
  'მოკლედ:',
  'კარგი კითხვაა.',
  'ვნახოთ.',
  'ასე გამოიყურება:',
];

function related(id: string, take = 4): AnswerRef[] {
  const out: AnswerRef[] = [];
  const seen = new Set([id]);
  for (const edge of neighbours(id)) {
    if (seen.has(edge.to) || out.length >= take) continue;
    seen.add(edge.to);
    const ref = refFor(edge.to);
    if (ref) out.push(ref);
  }
  return out;
}

function refFor(id: string): AnswerRef | null {
  const kind = classifyId(id);
  if (kind === 'topic') {
    const x = library.topicById.get(id);
    return x ? { label: t(x.title), href: `/topics/${id}` } : null;
  }
  if (kind === 'person') {
    const x = library.personById.get(id);
    return x ? { label: t(x.name), href: `/people/${id}` } : null;
  }
  if (kind === 'formula') {
    const x = library.formulaById.get(id);
    return x ? { label: t(x.name), href: `/formulas?open=${id}` } : null;
  }
  if (kind === 'event') {
    const x = library.eventById.get(id);
    return x ? { label: `${x.year} · ${t(x.title)}`, href: `/timeline?open=${id}` } : null;
  }
  if (kind === 'fact') {
    const x = library.factById.get(id);
    return x ? { label: t(x.text).slice(0, 60), href: `/facts?open=${id}` } : null;
  }
  return null;
}

function followUpsForTopic(topic: Topic, intents: Intent[]): string[] {
  const q: string[] = [];
  const title = t(topic.title);
  if ((topic.personIds ?? []).length) q.push(`ვინ იდგა „${title}"-ის უკან?`);
  if ((topic.formulaIds ?? []).length && !intents.includes('formula'))
    q.push(`რომელი ფორმულა უკავშირდება „${title}"-ს?`);
  if ((topic.eventIds ?? []).length && !intents.includes('when')) q.push(`როდის აღმოაჩინეს ეს?`);
  if (!intents.includes('why')) q.push(`რატომ არის „${title}" მნიშვნელოვანი?`);
  const rel = related(topic.id, 1)[0];
  if (rel) q.push(`რა არის „${rel.label}"?`);
  return q.slice(0, 3);
}

function answerForTopic(topic: Topic, intents: Intent[], seed: number): Omit<Answer, 'confidence'> {
  const title = t(topic.title);
  let body = '';

  if (intents.includes('who')) {
    const ids = new Set(topic.personIds ?? []);
    for (const edge of neighbours(topic.id)) {
      if (classifyId(edge.to) === 'person') ids.add(edge.to);
    }
    const people = [...ids].map((id) => library.personById.get(id)).filter(Boolean);
    body = people.length
      ? people
          .map((p) => `${t(p!.name)} (${p!.lived}) — ${t(p!.known)}.\n\n${t(p!.story)}`)
          .join('\n\n')
      : `„${title}"-ს ბიბლიოთეკაში კონკრეტული აღმომჩენი მიბმული არ აქვს, მაგრამ აი, თავად თემა:\n\n${sectionText(topic, 'whatIs', 500)}`;
  } else if (intents.includes('formula')) {
    const f = (topic.formulaIds ?? [])
      .map((id) => library.formulaById.get(id))
      .find(Boolean);
    body = f
      ? `${t(f.name)}:  ${f.expression}\n\n${t(f.explanation)}${f.example ? `\n\nმაგალითი: ${t(f.example)}` : ''}`
      : sectionText(topic, 'formulas', 600) || sectionText(topic, 'keyIdeas', 600);
  } else {
    const kind = intents.map((i) => SECTION_FOR_INTENT[i]).find(Boolean);
    if (kind) body = sectionText(topic, kind, 800);
    if (!body) {
      const whatIs = sectionText(topic, 'whatIs', 550);
      const why = sectionText(topic, 'whyInteresting', 350);
      body = [whatIs, why].filter(Boolean).join('\n\n');
    }
  }

  // A closing "did you know" if the topic carries a fact.
  const factId = (topic.factIds ?? [])[0];
  const fact = factId ? library.factById.get(factId) : undefined;
  const tail = fact ? `\n\nიცოდი? ${t(fact.text)}` : '';

  const lead = intents.length === 0 ? `${pick(LEADS, seed)} ` : '';
  return {
    text: `${lead}${body}${tail}`.trim(),
    sources: [{ label: title, href: `/topics/${topic.id}` }],
    related: related(topic.id),
    followUps: followUpsForTopic(topic, intents),
  };
}

function answerForDoc(doc: SearchDoc, intents: Intent[], seed: number): Omit<Answer, 'confidence'> {
  switch (doc.kind) {
    case 'topic': {
      const topic = library.topicById.get(doc.id);
      if (topic) return answerForTopic(topic, intents, seed);
      break;
    }
    case 'person': {
      const p = library.personById.get(doc.id);
      if (p) {
        return {
          text: `${t(p.name)} (${p.lived}) — ${t(p.known)}.\n\n${t(p.story)}`,
          sources: [{ label: t(p.name), href: `/people/${p.id}` }],
          related: (p.topicIds ?? []).map(refFor).filter((x): x is AnswerRef => !!x),
          followUps: [`რას აღმოაჩენდა ${t(p.name)}?`, ...(p.topicIds ?? []).slice(0, 1).map((id) => {
            const tp = library.topicById.get(id);
            return tp ? `რა არის „${t(tp.title)}"?` : '';
          })].filter(Boolean),
        };
      }
      break;
    }
    case 'formula': {
      const f = library.formulaById.get(doc.id);
      if (f) {
        const vars = f.variables.map((v) => `• ${v.symbol} — ${t(v.meaning)}${v.unit ? ` [${v.unit}]` : ''}`).join('\n');
        return {
          text: `${t(f.name)}:  ${f.expression}\n\n${t(f.explanation)}${f.example ? `\n\nმაგალითი: ${t(f.example)}` : ''}\n\nსიმბოლოები:\n${vars}`,
          sources: [{ label: t(f.name), href: `/formulas?open=${f.id}` }],
          related: (f.topicIds ?? []).map(refFor).filter((x): x is AnswerRef => !!x),
          followUps: (f.topicIds ?? []).slice(0, 2).map((id) => {
            const tp = library.topicById.get(id);
            return tp ? `რა არის „${t(tp.title)}"?` : '';
          }).filter(Boolean),
        };
      }
      break;
    }
    case 'fact': {
      const fact = library.factById.get(doc.id);
      if (fact) {
        return {
          text: `${t(fact.text)}${fact.why ? `\n\nრატომ მნიშვნელოვანია: ${t(fact.why)}` : ''}\n\n(წყარო: ${fact.source.publisher})`,
          sources: [{ label: t(fact.text).slice(0, 60), href: `/facts?open=${fact.id}` }],
          related: (fact.topicIds ?? []).map(refFor).filter((x): x is AnswerRef => !!x),
          followUps: [],
        };
      }
      break;
    }
    case 'event': {
      const e = library.eventById.get(doc.id);
      if (e) {
        return {
          text: `${e.year} — ${t(e.title)}.\n\n${t(e.summary)}${e.cause ? `\n\nმიზეზი: ${t(e.cause)}` : ''}${e.consequence ? `\n\nშედეგი: ${t(e.consequence)}` : ''}`,
          sources: [{ label: `${e.year} · ${t(e.title)}`, href: `/timeline?open=${e.id}` }],
          related: (e.topicIds ?? []).map(refFor).filter((x): x is AnswerRef => !!x),
          followUps: [],
        };
      }
      break;
    }
    default:
      break;
  }
  return {
    text: `„${doc.title}" — ${doc.subtitle ?? ''}`,
    sources: [{ label: doc.title, href: doc.href }],
    related: [],
    followUps: [],
  };
}

/* -------------------------------- chat -------------------------------- */

function smallTalk(raw: string): Answer | null {
  const q = norm(raw);
  if (/^(გამარჯობა|სალამი|ჰეი|დილა მშვიდობის|საღამო მშვიდობის|გაისმარ)/.test(q)) {
    return {
      text: 'გამარჯობა! მე ლაბოს ბიბლიოთეკის დამხმარე ვარ. მკითხე ნებისმიერი თემა — „რა არის შავი ხვრელი?", „რატომ ანათებს ვარსკვლავი?", „ვინ იყო ტიურინგი?" — და ვიპოვი, რაც ვიცი.',
      confidence: 'chat',
      sources: [],
      related: [],
      followUps: ['რა არის დნმ?', 'რატომ არის ცა ლურჯი?', 'ვინ იყო ადა ლავლეისი?'],
    };
  }
  if (/(მადლ|გმადლობ|დიდი მადლ)/.test(q)) {
    return { text: 'სიამოვნებით. კიდევ რამე?', confidence: 'chat', sources: [], related: [], followUps: [] };
  }
  if (/(რას შეგიძლი[ას]|ვინ ხარ|რა ხარ ?\??$|როგორ მუშაობ(ხარ)? ?\??$|რა ინსტრუმენტი ხარ)/.test(q)) {
    return {
      text: 'მე ენობრივი მოდელი არ ვარ — ვეძებ და ვაერთიანებ ლაბოს ბიბლიოთეკის ხელით დაწერილ მასალას (112 თემა, ფაქტები, ფორმულები, ადამიანები, მოვლენები). ამიტომ არასდროს ვიგონებ ფაქტს და პირდაპირ ვამბობ, თუ რაღაც ჯერ არ მაქვს. მკითხე კონკრეტული თემა.',
      confidence: 'chat',
      sources: [],
      related: [],
      followUps: ['რა არის ენტროპია?', 'როგორ მუშაობს პომოდორო?'],
    };
  }
  return null;
}

const CLUELESS_LEADS = [
  'ამ თემას ჯერ არ ვფარავ ბიბლიოთეკაში.',
  'ზუსტ პასუხს ვერ გავცემ — ეს მასალა ჯერ არ მაქვს.',
];

function fallback(seed: number): Answer {
  const picks = library.topics
    .filter((tp) => tp.spotlight)
    .slice(0, 12);
  const suggestions = [picks[seed % picks.length], picks[(seed + 4) % picks.length], picks[(seed + 8) % picks.length]]
    .filter((x, i, a): x is Topic => !!x && a.indexOf(x) === i);
  return {
    text: `${pick(CLUELESS_LEADS, seed)} სცადე უფრო კონკრეტულად, ან დაიწყე რომელიმე ამ თემით.`,
    confidence: 'none',
    sources: [],
    related: suggestions.map((tp) => ({ label: t(tp.title), href: `/topics/${tp.id}` })),
    followUps: suggestions.map((tp) => `რა არის „${t(tp.title)}"?`),
  };
}

/* ------------------------------ entrypoint ---------------------------- */

/**
 * Retrieval context for the optional LLM path: the top matching library
 * passages, formatted for a system prompt, plus the refs they came from so the
 * UI can still show "Sources" even though the model's prose is free-form.
 */
export function buildGrounding(query: string): { context: string; sources: AnswerRef[] } {
  const terms = contentTerms(tokenize(query));
  if (terms.length === 0) return { context: '', sources: [] };
  const hits = retrieve(terms, index()).slice(0, 4).filter((h) => h.score >= 2);
  if (hits.length === 0) return { context: '', sources: [] };

  const blocks: string[] = [];
  const sources: AnswerRef[] = [];
  for (const hit of hits) {
    const composed = answerForDoc(hit.doc, [], 0);
    blocks.push(`### ${hit.doc.title}\n${composed.text}`);
    if (composed.sources[0]) sources.push(composed.sources[0]);
  }
  return { context: blocks.join('\n\n'), sources };
}

export function ask(query: string): Answer {
  const raw = query.trim();
  if (!raw) return fallback(0);

  const chat = smallTalk(raw);
  if (chat) return chat;

  const seed = hash(raw);
  const tokens = tokenize(raw);
  const intents = detectIntents(tokens);
  const terms = contentTerms(tokens);

  if (terms.length === 0) {
    return {
      text: 'რაზე გინდა რომ გელაპარაკო? დამისახელე თემა, ცნება ან ადამიანი.',
      confidence: 'chat',
      sources: [],
      related: [],
      followUps: ['რა არის ალგორითმი?', 'რატომ ვარდება საგნები ერთნაირად?'],
    };
  }

  const hit = bestHit(terms, intents);
  if (!hit) return fallback(seed);

  const composed = answerForDoc(hit.doc, intents, seed);
  const confidence: Answer['confidence'] =
    hit.coverage >= 0.8 && hit.score >= 10 ? 'high' : 'medium';

  // Only hedge when the match itself is shaky — not every non-perfect score.
  const prefix =
    hit.coverage < 0.6 ? 'ზუსტად ვერ დავრწმუნდი, მაგრამ ეს ახლოსაა:\n\n' : '';

  return { ...composed, text: prefix + composed.text, confidence };
}
