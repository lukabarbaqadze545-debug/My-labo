import { library, t, type Topic } from '@/content';
import { facetsFor, hasFacet, type Facet } from '@/content/knowledge';
import { philosophyById, type PhilArgument, type PhilObjection, type PhilosophyConcept } from '@/content/philosophy';
import { PHRASING, CLARIFY_OPENERS, HONESTY, type PhrasingKey } from '@/language/ka';
import { connective, registerFor, type LanguageCorpus, type LanguageFunction } from '@/domain/language';
import { neighbours, classifyId } from '../graph';
import type {
  ClarificationQuestion,
  ConversationReply,
  ConversationState,
  IntentKind,
  KnowledgeCandidate,
  NextAction,
  UnderstandingVerdict,
} from './types';
import { labelForConcept, topicForConcept } from './retrieve';
import { pickAvoiding } from './variation';
import { AUTO_PICK_MARKER } from './plan';

/**
 * Stage 9 — response generation.
 *
 * Every factual sentence returned here was authored into the library or the
 * philosophy corpus. This stage chooses *which* stored material answers the
 * planned action, and wraps it in natural Georgian. It never writes a fact.
 *
 * Wrapping is varied but deterministic: the phrasing is picked by hashing the
 * concept and turn, so a conversation reads naturally and a test can assert
 * on it.
 */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function variant(key: PhrasingKey, seed: string): string {
  const list = PHRASING[key];
  return list[hash(seed) % list.length]!;
}

function pickHonesty(kind: keyof typeof HONESTY, seed: string): string {
  const list = HONESTY[kind];
  return list[hash(seed) % list.length]!;
}

/**
 * The first not-yet-served item from a list, falling back to the first item
 * once everything has been shown. Used for philosophy arguments/objections so
 * a second "give me a counterargument" does not repeat the first.
 */
function pickUnused<T extends { id: string }>(
  items: readonly T[],
  state: ConversationState,
  prefix: string,
): T | undefined {
  const unused = items.filter((item) => !state.servedKeys.includes(`${prefix}:${item.id}`));
  return unused[0] ?? items[0];
}

/** A philosophy question not yet asked in this conversation. */
function pickSocraticQuestion(phil: PhilosophyConcept, state: ConversationState, seed: string): string | undefined {
  const unused = phil.socraticQuestions.filter((q) => !state.servedKeys.includes(`sq:${q}`));
  const pool = unused.length > 0 ? unused : phil.socraticQuestions;
  return pool.length ? pool[hash(seed) % pool.length] : undefined;
}

/** An argument's premises and conclusion, joined into one flowing paragraph. */
function argumentProse(arg: PhilArgument, because: string | null): string {
  const premises = arg.premises.join(' ');
  const lead = because ? `${because}, ` : '';
  return `${premises} ${lead}${arg.conclusion}`.trim();
}

function objectionProse(obj: PhilObjection, but: string | null): string {
  const lead = but ? `${but}, ` : '';
  const reply = obj.response ? ` ${obj.response}` : '';
  return `${lead}${obj.text}${reply}`;
}

/** Two or more named positions, joined into one contrastive sentence. */
function composePositions(phil: PhilosophyConcept, lang: (fn: LanguageFunction) => string | null): string {
  const [first, second, ...rest] = phil.positions;
  if (!first) return '';
  let body = `${first.label} მიდგომით, ${first.gloss}.`;
  if (second) {
    const contrast = lang('contrast');
    body += ` ${contrast ? `${contrast}, ` : ''}${second.label} მიდგომა კი განსხვავებულია: ${second.gloss}.`;
  }
  if (rest.length > 0) {
    body += ` ასევე არსებობს ${rest.map((p) => p.label).join(', ')}.`;
  }
  return body;
}

/* ----------------------------- topic reading ---------------------------- */

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
    const text = blockText(block).trim();
    if (!text) continue;
    parts.push(text);
    len += text.length;
    if (len >= limit) break;
  }
  return parts.join('\n\n');
}

/* ------------------------------ facet access ---------------------------- */

/**
 * Pick the nth entry of a facet, skipping ones already served in this
 * conversation so „კიდევ ერთი" genuinely produces something new.
 */
function pickFacet(
  topicId: string,
  facet: Facet,
  state: ConversationState,
  index: number,
): { text: string; key: string } | null {
  const entries = facetsFor(topicId, facet);
  if (entries.length === 0) return null;
  const unused = entries.filter((e) => !state.servedKeys.includes(e.id));
  const pool = unused.length > 0 ? unused : entries;
  const chosen = pool[index % pool.length]!;
  return { text: t(chosen.text), key: chosen.id };
}

function levelled(topicId: string, facet: Facet, wantLevel: 1 | 3): string | null {
  const entries = facetsFor(topicId, facet);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) =>
    wantLevel === 1 ? (a.level ?? 2) - (b.level ?? 2) : (b.level ?? 2) - (a.level ?? 2),
  );
  return t(sorted[0]!.text);
}

/* -------------------------------- helpers ------------------------------- */

function refFor(topicId: string): { label: string; href: string } | null {
  const topic = library.topicById.get(topicId);
  return topic ? { label: t(topic.title), href: `/topics/${topicId}` } : null;
}

function relatedRefs(topicId: string | undefined, take = 3) {
  if (!topicId) return [];
  const out: { label: string; href: string }[] = [];
  for (const edge of neighbours(topicId)) {
    if (out.length >= take) break;
    if (classifyId(edge.to) !== 'topic') continue;
    const ref = refFor(edge.to);
    if (ref) out.push(ref);
  }
  return out;
}

/**
 * Follow-up chips advertise what the assistant can actually do next for this
 * concept, so the user learns the vocabulary by using it.
 */
function suggestionsFor(
  concept: string | undefined,
  topicId: string | undefined,
  phil: PhilosophyConcept | undefined,
  state: ConversationState,
): string[] {
  const out: string[] = [];
  if (topicId) {
    if (hasFacet(topicId, 'example')) {
      out.push((state.examplesGiven[concept ?? ''] ?? 0) > 0 ? 'კიდევ ერთი მაგალითი' : 'მაგალითი?');
    }
    if (hasFacet(topicId, 'simple')) out.push('უფრო მარტივად');
    if (hasFacet(topicId, 'limitation')) out.push('როდის არ გამოდგება?');
    if (hasFacet(topicId, 'whenToUse')) out.push('როდის ვიყენებ?');
    if (hasFacet(topicId, 'compare')) out.push('შეადარე');
  }
  if (phil) {
    out.push('კონტრარგუმენტი?');
    if (phil.positions.length >= 2) out.push('რა პოზიციები არსებობს?');
  }
  return out.slice(0, 4);
}

/* ------------------------------ clarification --------------------------- */

export function buildClarification(
  candidates: readonly KnowledgeCandidate[],
  state: ConversationState,
  referenceSurface?: string,
): ClarificationQuestion {
  const options = candidates.slice(0, 3).map((c) => ({ label: c.label, concept: c.concept }));

  // A pronoun with nothing to attach to: offer what is in play.
  if (options.length === 0 && state.currentConcept) {
    options.push({ label: labelForConcept(state.currentConcept), concept: state.currentConcept });
    if (state.previousConcept) {
      options.push({ label: labelForConcept(state.previousConcept), concept: state.previousConcept });
    }
  }

  const opener = CLARIFY_OPENERS[hash(state.turnIndex + (referenceSurface ?? '')) % CLARIFY_OPENERS.length]!;

  if (options.length >= 2) {
    const list = options.map((o) => `„${o.label}"`).join(' თუ ');
    return {
      text: `${opener} ${referenceSurface ? `„${referenceSurface}" ` : ''}${list}?`,
      options,
      key: `clarify:${options.map((o) => o.concept).sort().join('|')}`,
    };
  }

  if (options.length === 1) {
    return {
      text: `${opener} „${options[0]!.label}"-ს გულისხმობ?`,
      options,
      key: `clarify:${options[0]!.concept}`,
    };
  }

  return {
    text: `${opener} რომელ თემაზეა საუბარი? დამისახელე ცნება ან სიტყვა და ვიპოვი.`,
    options: [],
    key: 'clarify:open',
  };
}

/* -------------------------------- generate ------------------------------ */

export interface GenerateInput {
  action: NextAction;
  verdict: UnderstandingVerdict;
  state: ConversationState;
  candidates: readonly KnowledgeCandidate[];
  referenceSurface?: string | undefined;
  /** Set when the concept was inherited rather than named. */
  fromContext: boolean;
  clarification?: ClarificationQuestion | undefined;
  /**
   * General Georgian learned from imported sources. Available to every
   * subject: a connective mined from a philosophy book is used here to explain
   * an algorithm, because the layer stores function, not subject matter.
   */
  languageCorpus?: LanguageCorpus | null | undefined;
  /** The user's intent, for replies (smalltalk) that read it directly. */
  intent?: IntentKind;
  /** The raw message, for the rare case wording itself matters (e.g. "how are you"). */
  rawText?: string;
}

export interface Generated extends ConversationReply {
  /** Facet ids consumed, so the state can avoid repeating them. */
  servedKeys: string[];
  /** Set when the reply was a clarification. */
  clarification?: ClarificationQuestion;
  /** The opening line or closing question actually used, for repeat-avoidance. */
  openerUsed?: string;
  /** Connective surfaces actually used, fed back into the language layer. */
  connectivesUsed?: string[];
}

export function generate(input: GenerateInput): Generated {
  const { action, verdict, state, candidates, fromContext } = input;
  const concept = action.concept;
  const topic = concept ? topicForConcept(concept) : undefined;
  const topicId = topic?.id;
  const phil = concept ? philosophyById.get(concept) : undefined;
  const label = concept ? labelForConcept(concept) : '';
  const seed = `${concept ?? ''}:${state.turnIndex}`;

  const usedConnectives: string[] = [];

  /**
   * Pick a connective for a rhetorical role, at a register the subject can
   * carry. Simplification forces the plainest register, so „მაშასადამე" never
   * turns up in an answer the user asked to have made easier. Every pick is
   * excluded from its own next call (via `recentConnectives`) and recorded so
   * the state carries the exclusion into the next turn too.
   */
  const lang = (fn: LanguageFunction): string | null => {
    const picked = connective(fn, {
      ...(topic?.subjectId ? { subjectId: topic.subjectId } : {}),
      ceiling: action.kind === 'simplify' ? 'neutral' : registerFor(topic?.subjectId),
      ...(input.languageCorpus ? { corpus: input.languageCorpus } : {}),
      recent: [...state.recentConnectives, ...usedConnectives],
      seed,
    });
    if (picked) usedConnectives.push(picked);
    return picked;
  };

  const sources = topicId ? [refFor(topicId)].filter((x): x is { label: string; href: string } => !!x) : [];
  const related = relatedRefs(topicId);
  const suggestions = suggestionsFor(concept, topicId, phil, state);
  const servedKeys: string[] = [];
  let openerUsed: string | undefined;

  /** Prefix used when the topic was carried over rather than named. */
  const carried = fromContext && !input.referenceSurface ? '' : '';
  const contextNote =
    fromContext && state.currentConcept
      ? `${variant('continuing', seed)} `
      : carried;

  const done = (text: string, extra: Partial<Generated> = {}): Generated => ({
    text: text.trim(),
    sources,
    related,
    suggestions,
    action: action.kind,
    verdict,
    servedKeys,
    ...(usedConnectives.length ? { connectivesUsed: usedConnectives } : {}),
    ...(openerUsed ? { openerUsed } : {}),
    ...extra,
  });

  switch (action.kind) {
    /* ------------------------------ honesty ---------------------------- */
    case 'admit_missing_knowledge': {
      const near = candidates.filter((c) => c.topicId).slice(0, 3);
      const alt = near.length
        ? `\n\nსამაგიეროდ ამაზე მაქვს: ${near.map((c) => `„${c.label}"`).join(', ')}.`
        : '';
      return {
        text: `${pickHonesty('missingKnowledge', seed)}${label ? ` („${label}")` : ''}${alt}`,
        sources: [],
        related: near.map((c) => refFor(c.topicId!)).filter((x): x is { label: string; href: string } => !!x),
        suggestions: near.map((c) => `რა არის „${c.label}"?`).slice(0, 3),
        action: action.kind,
        verdict,
        servedKeys,
      };
    }

    case 'admit_not_understood': {
      return {
        text: `${pickHonesty('wording', seed)} სცადე სხვა სიტყვებით, ან დამისახელე თემა.`,
        sources: [],
        related: [],
        suggestions: ['რა არის ალგორითმი?', 'თავისუფალი ნება', 'რა არის ალბათობა?'],
        action: action.kind,
        verdict,
        servedKeys,
      };
    }

    case 'clarify': {
      const q = input.clarification ?? buildClarification(candidates, state, input.referenceSurface);
      return {
        text: q.text,
        sources: [],
        related: [],
        suggestions: q.options.map((o) => o.label),
        action: action.kind,
        verdict,
        servedKeys,
        clarification: q,
      };
    }

    /* ---------------------------- small talk --------------------------- */
    case 'smalltalk': {
      // Which small-talk move this is decides the whole reply, and none of
      // them touch retrieval — a greeting is never a search query.
      const howAreYou = /(როგორ\s+ხარ|რას\s+შვები|რას\s+აკეთებ|ყველაფერი\s+კარგად|how\s+are\s+you)/iu.test(
        input.rawText ?? '',
      );

      const pool: readonly string[] =
        input.intent === 'thanks'
          ? PHRASING.thanks
          : input.intent === 'meta'
            ? PHRASING.metaSelf
            : input.intent === 'stop'
              ? PHRASING.stopAck
              : howAreYou
                ? PHRASING.howAreYou
                : PHRASING.greeting;

      const text = pickAvoiding(pool, `${input.intent ?? 'greeting'}:${state.turnIndex}`, state.recentOpeners);
      openerUsed = text;

      const suggestions =
        input.intent === 'thanks' || input.intent === 'stop'
          ? []
          : ['binary search ამიხსენი', 'თავისუფალი ნება არსებობს?', 'რა არის ალბათობა?'];

      return done(text, { suggestions });
    }

    case 'acknowledge_correction': {
      return done(
        `${variant('corrected', seed)}${label ? ` ვსაუბრობთ „${label}"-ზე.` : ' რომელ თემას გულისხმობდი?'}${
          topicId ? `\n\n${sectionText(topic!, 'whatIs', 420)}` : ''
        }`,
      );
    }

    case 'switch_topic': {
      if (!topicId && !phil) {
        return done('წინა თემა ვერ აღვადგინე — დამისახელე და დავუბრუნდებით.');
      }
      return done(
        `${variant('switching', seed)} ვბრუნდებით „${label}"-ზე.\n\n${
          topicId ? sectionText(topic!, 'whatIs', 420) : phil!.simple
        }`,
      );
    }

    /* ------------------------------ content ---------------------------- */
    case 'simplify': {
      const simple = topicId ? levelled(topicId, 'simple', 1) : null;
      const text = simple ?? phil?.simple ?? (topicId ? sectionText(topic!, 'whatIs', 380) : '');
      if (topicId) {
        const entry = facetsFor(topicId, 'simple')[0];
        if (entry) servedKeys.push(entry.id);
      }
      return done(`${variant('simplify', seed)}\n\n${text}`);
    }

    case 'expand': {
      const deep = topicId ? levelled(topicId, 'example', 3) : null;
      const key = topicId ? sectionText(topic!, 'keyIdeas', 700) : '';
      const philDeep = phil ? `${phil.definition} ${phil.claims.join(' ')}` : '';
      const body = [key, philDeep, deep].filter(Boolean).join('\n\n');
      return done(`${variant('expand', seed)}\n\n${body || sectionText(topic!, 'whatIs', 600)}`);
    }

    case 'give_example':
    case 'give_another_example': {
      const index = state.examplesGiven[concept ?? ''] ?? 0;
      const picked = topicId ? pickFacet(topicId, 'example', state, index) : null;
      if (picked) {
        servedKeys.push(picked.key);
        const opener = action.kind === 'give_another_example' ? 'another' : 'example';
        // contextNote ("ვაგრძელებ:") and the opener itself ("მეორე მაგალითი:")
        // already both signal continuation — stacking a third connective on
        // top read as "continuing: also. another example:", which repeats
        // itself. One signal is enough.
        return done(`${contextNote}${variant(opener, seed + index)}\n\n${picked.text}`);
      }
      const philExample = phil?.examples[index % Math.max(1, phil.examples.length)];
      if (philExample) return done(`${variant('example', seed + index)}\n\n${philExample}`);
      return done(
        `მაგალითი ამ თემაზე ცალკე არ მაქვს ჩაწერილი, მაგრამ აი, არსი:\n\n${
          topicId ? sectionText(topic!, 'whatIs', 400) : phil?.simple ?? ''
        }`,
      );
    }

    case 'limitations': {
      const picked = topicId ? pickFacet(topicId, 'limitation', state, 0) : null;
      if (picked) {
        servedKeys.push(picked.key);
        const but = lang('contrast');
        return done(
          `${contextNote}${but ? `${but} — ` : ''}${variant('limitation', seed)}\n\n${picked.text}`,
        );
      }
      if (phil && phil.objections.length > 0) {
        const obj = phil.objections[0]!;
        return done(
          `${variant('limitation', seed)}\n\n${obj.text}${obj.response ? `\n\n${obj.response}` : ''}`,
        );
      }
      return done(
        `შეზღუდვები ცალკე ჩაწერილი არ მაქვს. აი, რას ამბობს თემა:\n\n${
          topicId ? sectionText(topic!, 'whatIs', 400) : ''
        }`,
      );
    }

    case 'explain_why': {
      const picked = topicId ? pickFacet(topicId, 'why', state, 0) : null;
      if (picked) {
        servedKeys.push(picked.key);
        return done(`${contextNote}${picked.text}`);
      }
      if (phil) {
        return done(phil.claims.join(' '));
      }
      const why = topicId ? sectionText(topic!, 'whyInteresting', 600) : '';
      const because = lang('cause');
      const body = why || (topicId ? sectionText(topic!, 'keyIdeas', 500) : '');
      return done(`${contextNote}${because ? `${because}: ` : ''}${body}`);
    }

    case 'when_to_use': {
      const picked = topicId ? pickFacet(topicId, 'whenToUse', state, 0) : null;
      if (picked) {
        servedKeys.push(picked.key);
        return done(`${contextNote}${variant('whenToUse', seed)}\n\n${picked.text}`);
      }
      return done(`${topicId ? sectionText(topic!, 'whyInteresting', 500) : ''}`);
    }

    case 'compare': {
      const picked = topicId ? pickFacet(topicId, 'compare', state, 0) : null;
      if (picked) {
        servedKeys.push(picked.key);
        return done(picked.text);
      }
      if (phil && phil.positions.length >= 2) {
        return done(`„${label}"-ზე ძირითადი პოზიციები ასე იყოფა: ${composePositions(phil, lang)}`);
      }
      return done(topicId ? sectionText(topic!, 'keyIdeas', 600) : '');
    }

    case 'define_term': {
      if (phil) return done(`${phil.definition}\n\n${phil.simple}`);
      return done(topicId ? sectionText(topic!, 'whatIs', 450) : '');
    }

    case 'summarize': {
      if (phil) {
        return done(`მოკლედ: ${phil.simple} ${composePositions(phil, lang)}`.trim());
      }
      return done(topic ? `მოკლედ: ${t(topic.hook)}.\n\n${sectionText(topic, 'whatIs', 350)}` : '');
    }

    /* ---------------------------- philosophy --------------------------- */
    case 'give_counterargument': {
      if (!phil) return done('კონტრარგუმენტი ამ თემაზე ჩაწერილი არ მაქვს.');
      const arg = pickUnused(phil.argumentsAgainst, state, 'ca_arg');
      const obj = pickUnused(phil.objections, state, 'ca_obj');
      if (arg) servedKeys.push(`ca_arg:${arg.id}`);
      if (obj) servedKeys.push(`ca_obj:${obj.id}`);

      const parts: string[] = [];
      if (arg) parts.push(argumentProse(arg, lang('conclusion')));
      if (obj) parts.push(objectionProse(obj, lang('contrast')));
      if (parts.length === 0) return done('კონტრარგუმენტი ამ თემაზე ჯერ არ მაქვს ჩაწერილი.');
      return done(parts.join(' '));
    }

    case 'give_supporting_argument': {
      if (!phil) return done('არგუმენტი ამ თემაზე ჩაწერილი არ მაქვს.');
      const arg = pickUnused(phil.argumentsFor, state, 'sa_arg');
      if (!arg) return done(phil.simple);
      servedKeys.push(`sa_arg:${arg.id}`);
      return done(argumentProse(arg, lang('conclusion')));
    }

    case 'ask_socratic_question': {
      if (!phil) return done('');
      const q = pickSocraticQuestion(phil, state, seed);
      if (!q) return done(phil.simple);
      servedKeys.push(`sq:${q}`);
      openerUsed = q;
      return done(q, { suggestions: ['კონტრარგუმენტი?', 'უფრო მარტივად', 'რა პოზიციები არსებობს?'] });
    }

    case 'challenge_assumption': {
      if (!phil) return done('');
      const a = phil.assumptions[0];
      return done(a ? `აქ ერთი რამ უსიტყვოდ იგულისხმება: ${a} ეს ნამდვილად ასეა?` : phil.simple);
    }

    case 'quiz': {
      if (phil) {
        const q = pickSocraticQuestion(phil, state, seed);
        if (q) servedKeys.push(`sq:${q}`);
        return done(q ? `კარგი, კითხვა შენთვის: ${q}` : phil.simple);
      }
      return done(
        topic ? `კითხვა: ${t(topic.hook)} — ახსნი, რატომ?` : 'დამისახელე თემა და დაგისვამ კითხვას.',
      );
    }

    /* ------------------------------ opinion ------------------------------ */
    case 'state_opinion': {
      const disclaimer = pickAvoiding(PHRASING.noOpinion, `op:${seed}`, []);
      if (phil && phil.positions.length >= 2) {
        return done(`${disclaimer} ${composePositions(phil, lang)}`);
      }
      if (phil) {
        return done(`${disclaimer} ${phil.simple}`);
      }
      if (topicId) {
        return done(`${disclaimer}\n\n${sectionText(topic!, 'whatIs', 400)}`);
      }
      return done(`${disclaimer} კონკრეტულად რომელ საკითხზე გაინტერესებს, რომ მასალა მოვძებნო?`);
    }

    /* ------------------------------ default ---------------------------- */
    case 'explain':
    case 'answer':
    default: {
      if (phil && !topicId) {
        return done(`${variant('explain', seed)}\n\n${phil.definition}\n\n${phil.simple}`);
      }
      if (!topic) return done(pickHonesty('wording', seed));
      const whatIs = sectionText(topic, 'whatIs', 550);
      const why = sectionText(topic, 'whyInteresting', 300);
      const autoPicked = action.rationale === AUTO_PICK_MARKER;
      const note = autoPicked
        ? `კარგი, ავირჩევ: „${t(topic.title)}".\n\n`
        : action.rationale.includes('არ მაქვს')
          ? `${action.rationale}\n\n`
          : '';
      return done(`${contextNote}${note}${[whatIs, why].filter(Boolean).join('\n\n')}`);
    }
  }
}
