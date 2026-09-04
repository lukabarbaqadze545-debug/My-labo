import { library, t, type Subject, type Topic } from '@/content';
import { sameRoot } from '@/language/ka';
import { PHRASING } from '@/language/ka';
import type { Book, BookCorpus, BookScope, BookSection } from '@/domain/books';
import { booksInScope, isBookExclusive } from '@/domain/books';
import type { ConversationReply, ConversationState, NormalizedMessage } from './types';
import { pickAvoiding } from './variation';

/**
 * DOMAIN_INTRODUCTION.
 *
 * The failure this exists to fix: „ფილოსოფიაზე რას მეტყვი?" was landing on
 * whichever single topic the philosophy alias happened to point at (free
 * will) and dumping its article. Naming a whole field is not the same request
 * as naming a concept in it — the first wants an orientation and an invite,
 * the second wants an answer.
 *
 * Detection is deliberately narrow: a message counts as a domain
 * introduction only when, after removing the subject name and generic
 * wrapper words ("tell me", "let's talk"), nothing else is left. A message
 * that also names something specific — "philosophy — why did Kant believe
 * duty matters?" — is not a domain introduction and falls through to normal
 * retrieval, where it belongs.
 */

/** Verbs and nouns that only ever wrap a request; never the subject itself. */
const GENERIC_ASK_WORDS = [
  'მეტყვი', 'გვეტყვი', 'მითხარი', 'გვითხარი', 'გვიამბე', 'მიამბე', 'ამიხსენი',
  'გამაცანი', 'გაგვაცანი', 'ვისაუბროთ', 'საუბარი', 'ვისწავლოთ', 'გავეცნოთ',
  'გავეცნო', 'რას', 'რა', 'შესახებ', 'თემა', 'თემები',
];

/** Fully generic prompts that name no subject at all. */
const OPEN_PROMPT =
  /(რაზე\s+(შეგვიძლია\s+)?ვისაუბროთ|რა\s+თემები\s+გაქვს|რაზე\s+მკითხე|რა\s+იცი\s*\?*$|რით\s+დაგეხმარო)/u;

function stemAll(words: readonly string[]): string[] {
  return words.map((w) => w.normalize('NFC').toLowerCase());
}

const GENERIC_STEMS = stemAll(GENERIC_ASK_WORDS);

export interface DomainIntroMatch {
  /** null = fully generic, no subject named. */
  subjectId: string | null;
  label: string;
}

/** Cheap, dependency-free stemming consistent with how content terms compare. */
function looksLikeSubjectName(term: string, subject: Subject): boolean {
  const nameWords = t(subject.name).toLowerCase().split(/\s+/u);
  return nameWords.some((w) => sameRoot(term, w));
}

export function detectDomainIntro(message: NormalizedMessage): DomainIntroMatch | null {
  if (OPEN_PROMPT.test(message.text)) return { subjectId: null, label: 'ზოგადად' };

  const subjects = library.subjects;
  let matched: Subject | null = null;
  for (const term of message.contentStems) {
    const subject = subjects.find((s) => looksLikeSubjectName(term, s));
    if (subject) {
      matched = subject;
      break;
    }
  }
  if (!matched) return null;

  const remaining = message.contentStems.filter(
    (term) => !looksLikeSubjectName(term, matched!) && !GENERIC_STEMS.some((g) => sameRoot(term, g)),
  );
  if (remaining.length > 0) return null;

  return { subjectId: matched.id, label: t(matched.name) };
}

/* --------------------------------- library ------------------------------- */

function pickTopics(subjectId: string, seed: number, take = 4): Topic[] {
  const all = library.topicsBySubject.get(subjectId) ?? [];
  const spotlight = all.filter((tp) => tp.spotlight);
  const pool = spotlight.length >= 2 ? spotlight : all;
  // Rotate the starting point deterministically so repeated intros to the
  // same subject do not always list the same topics first.
  const offset = pool.length ? seed % pool.length : 0;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, take);
}

export function buildLaboDomainIntro(
  match: DomainIntroMatch,
  state: ConversationState,
  turnSeed: number,
): ConversationReply & { domainId: string | undefined; openerUsed: string } {
  const subject = match.subjectId ? library.subjectById.get(match.subjectId) : undefined;

  if (!subject) {
    // Fully generic — orient across a handful of labs rather than one.
    const picks = library.subjects.filter((s) => (library.topicsBySubject.get(s.id) ?? []).length > 0);
    const offset = picks.length ? turnSeed % picks.length : 0;
    const sample = [...picks.slice(offset), ...picks.slice(0, offset)].slice(0, 4);
    const names = sample.map((s) => t(s.name)).join(', ');
    const invite = pickAvoiding(PHRASING.domainInvite, `intro:${turnSeed}`, state.recentOpeners);
    return {
      text: `ლაბოში რამდენიმე მიმართულებაა — მაგალითად ${names}. ${invite}`,
      sources: sample.map((s) => ({ label: t(s.name), href: `/labs/${s.id}` })),
      related: [],
      suggestions: sample.map((s) => t(s.name)),
      action: 'domain_intro',
      verdict: 'answer',
      domainId: undefined,
      openerUsed: invite,
    };
  }

  const topics = pickTopics(subject.id, turnSeed);
  const names = topics.map((tp) => t(tp.title));
  const invite = pickAvoiding(PHRASING.domainInvite, `intro:${subject.id}:${turnSeed}`, state.recentOpeners);

  const tagline = t(subject.tagline);
  const list =
    names.length > 0
      ? ` მაგალითად, შეგვიძლია ვისაუბროთ: ${names.join(', ')}.`
      : '';

  return {
    text: `${tagline}${list} ${invite}`.trim(),
    sources: topics.map((tp) => ({ label: t(tp.title), href: `/topics/${tp.id}` })),
    related: [],
    suggestions: [...names, 'შენ აირჩიე თემა'].slice(0, 5),
    action: 'domain_intro',
    verdict: 'answer',
    domainId: subject.id,
    openerUsed: invite,
  };
}

/* ---------------------------------- books --------------------------------- */

/** Deterministic, cue-based match against a subject — no library topic needed. */
const SUBJECT_CUES: Record<string, string[]> = {
  philosophy: ['ფილოსოფ', 'philosophy'],
};

function sectionsFor(books: readonly Book[], corpus: BookCorpus): Map<string, BookSection[]> {
  const bySection = new Map<string, BookSection[]>();
  for (const book of books) {
    const sections = corpus.sections
      .filter((s) => s.bookId === book.id && s.level === 1 && s.title !== 'დასაწყისი' && s.title !== 'სრული ტექსტი')
      .sort((a, b) => a.order - b.order);
    bySection.set(book.id, sections);
  }
  return bySection;
}

export function buildBookDomainIntro(
  match: DomainIntroMatch,
  scope: BookScope,
  corpus: BookCorpus,
  state: ConversationState,
  turnSeed: number,
): (ConversationReply & { domainId: string | undefined; openerUsed: string }) | null {
  const books = booksInScope(scope, corpus.books);
  if (!books || books.length === 0) return null;

  const invite = pickAvoiding(PHRASING.domainInvite, `bintro:${turnSeed}`, state.recentOpeners);

  // Several books in scope: orient across the books themselves.
  if (books.length > 1) {
    const names = books.map((b) => `„${b.title}"`).join(', ');
    return {
      text: `ჩართული წიგნებია: ${names}. ${invite}`,
      sources: books.slice(0, 4).map((b) => ({ label: b.title, href: `/books/${b.id}` })),
      related: [],
      suggestions: books.slice(0, 4).map((b) => b.title),
      action: 'domain_intro',
      verdict: 'answer',
      domainId: match.subjectId ?? undefined,
      openerUsed: invite,
    };
  }

  // One book: orient across what is actually inside it.
  const book = books[0]!;
  const sections = (sectionsFor([book], corpus).get(book.id) ?? []).slice(0, 5);
  if (sections.length === 0) {
    return {
      text: `„${book.title}" ჩართულია, მაგრამ სექციები ვერ გამოვყავი — პირდაპირ მკითხე კონკრეტული საკითხი.`,
      sources: [{ label: book.title, href: `/books/${book.id}` }],
      related: [],
      suggestions: [],
      action: 'domain_intro',
      verdict: 'answer',
      domainId: match.subjectId ?? undefined,
      openerUsed: invite,
    };
  }
  const names = sections.map((s) => s.title);
  return {
    text: `„${book.title}"-ში საუბარია: ${names.join(', ')}. ${invite}`,
    sources: [{ label: book.title, href: `/books/${book.id}` }],
    related: [],
    suggestions: names,
    action: 'domain_intro',
    verdict: 'answer',
    domainId: match.subjectId ?? undefined,
    openerUsed: invite,
  };
}

/**
 * Choose the library or the book renderer.
 *
 * A book-exclusive scope must introduce the book's own structure — anything
 * else would let Labo's own topics leak into a mode whose entire point is
 * "answer only from this book". Non-exclusive scope (off / with_labo) always
 * introduces via the library, which is Labo's own authored orientation.
 */
export function buildDomainIntro(
  match: DomainIntroMatch,
  state: ConversationState,
  turnSeed: number,
  scope?: BookScope,
  corpus?: BookCorpus,
): ConversationReply & { domainId: string | undefined; openerUsed: string } {
  if (scope && corpus && isBookExclusive(scope)) {
    const cued = match.subjectId
      ? scoreBooksAgainstSubject(match.subjectId, scope, corpus)
      : scope;
    const fromBooks = buildBookDomainIntro(match, cued, corpus, state, turnSeed);
    if (fromBooks) return fromBooks;
  }
  return buildLaboDomainIntro(match, state, turnSeed);
}

/** In 'library' mode, narrow to books whose sections actually mention the subject. */
function scoreBooksAgainstSubject(subjectId: string, scope: BookScope, corpus: BookCorpus): BookScope {
  const cues = SUBJECT_CUES[subjectId];
  if (!cues || scope.mode !== 'library') return scope;
  const matches = corpus.books.filter((b) =>
    corpus.sections.some((s) => s.bookId === b.id && cues.some((c) => s.title.toLowerCase().includes(c))),
  );
  return matches.length > 0 ? { mode: 'selected', bookIds: matches.map((b) => b.id) } : scope;
}
