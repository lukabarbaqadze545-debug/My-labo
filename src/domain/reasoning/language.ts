/**
 * Georgian-language utilities for the reasoning engine.
 *
 * Georgian is agglutinative and case-free, so the tricks that matter are
 * prefix/stem matching and a generous stop list. Nothing here tries to be a
 * real parser — the engine only needs enough structure to *match* and *score*.
 * Every sentence it shows the user is quoted verbatim, so a bad parse degrades
 * question selection, never question wording.
 */

export const norm = (s: string) => s.normalize('NFC').toLowerCase().trim();

/** Filler that never identifies what a sentence is about. */
const STOP = new Set(
  (
    'რა რას რის რისი რაა არის არაა არა არც იყო იქნება იქნებოდა თუ და ან ის ეს იმ ამ ეგ მაგ ' +
    'მე შენ ჩვენ თქვენ მან მათ ვინც რომელიც თავად თვითონ ერთი ორი სხვა ყველა ყოველი ' +
    'მინდა მაინტერესებს მითხარი მიამბე ამიხსენი ახსენი გამაგებინე გავიგო ვიცოდე ვისწავლო ' +
    'რომ როგორც ხომ კი ხო აბა ცოტა უფრო ძალიან როცა რადგან იმიტომ ვინ სად როდის რატომ როგორ ' +
    'გთხოვ გეთაყვა კიდევ ისევ უკვე ჯერ მხოლოდ სწორედ ასევე ანუ მაინც მაგრამ თუმცა ალბათ ' +
    'ვფიქრობ მგონი მგონია ვგონებ ვთვლი ვიტყოდი აზრით შეიძლება შესაძლოა ნამდვილად აშკარად ' +
    // „არსებობს" is deliberately *not* a stop word: whether something exists
    // is the substance of half of philosophy, not filler.
    'ხდება ხდებოდა გვაქვს მაქვს გაქვს აქვს ვარ ხარ არიან ვართ ხართ ' +
    'ძალიან საერთოდ ზოგადად უბრალოდ პრინციპში ფაქტობრივად რეალურად ' +
    'ის ისე ასე აი აქ იქ ახლა მერე შემდეგ წინ უკან ძალა ' +
    // Bare agreement particles: they close a question, they do not assert a
    // topic, and they must not be recorded as claims.
    'დიახ ასეა რასაკვირველია'
  ).split(/\s+/),
);

/** Agreement / disagreement openers — used to close open questions. */
const AGREE = /^(კი|ჰო|ჰოო|დიახ|ასეა|მართალია|სწორია|ზუსტად|თანახმა|მართალი ხარ|დამეთანხმ)/;
const DISAGREE = /^(არა| არ |^არ |ვერა|არა მგონია|არ ვეთანხმები|არ მგონია|არასწორია|არ არის ასე)/;

const HEDGE = /(შეიძლება|შესაძლოა|ალბათ|მგონი|მგონია|ვფიქრობ|ვგონებ|ხანდახან|ზოგჯერ|ზოგადად|როგორც წესი|ხშირად)/;
const EMPHATIC = /(ნამდვილად|აშკარად|ცხადია|რა თქმა უნდა|უდავოდ|ცალსახად|ყოველთვის|არასდროს|არასოდეს)/;

const UNIVERSAL = /(ყველა|ყოველი|ყოველთვის|არასდროს|არასოდეს|არავინ|არაფერი|ნებისმიერ|მუდამ|სულ ერთი|გამონაკლისი არ)/;
const EXISTENTIAL = /(არსებობს|არ არსებობს|არსებობდეს|არსებობა)/;
const CAUSAL = /(იწვევს|გამოიწვია|გამო|იმიტომ რომ|შედეგად|განაპირობებს|დამოკიდებულია|იმის გამო|მიზეზი)/;
const NORMATIVE = /(უნდა|არ უნდა|ცუდი|კარგი|სწორი|არასწორი|სამართლიან|უსამართლო|მორალურ|ამორალურ|ვალდებულ|დასაშვებ|დაუშვებ|ბოროტ|კეთილ|პასუხისმგებ)/;
const CONDITIONAL = /(თუ .*(მაშინ|მაშ)|იმ შემთხვევაში|დავუშვათ)/;
const COMPARATIVE = /(უფრო|ვიდრე|ნაკლებად|ყველაზე|მეტად)/;
const DEFINITIONAL = /(ნიშნავს|ეწოდება|განიმარტება|არის ის|გულისხმობს)/;
const NEGATION = /(^|\s)(არ|არა|ვერ|ვერა|აღარ|არასდროს|არასოდეს|არავინ|არაფერ)(\s|$)/;

/** Asking to be told rather than questioned. */
const WANTS_ANSWER =
  /(მითხარი|უბრალოდ ახსენი|პირდაპირ თქვი|არ ვიცი|ვერ ვხვდები|ვერ გავიგე|დამეხმარე|რას ნიშნავს|პასუხი მინდა|გამიმარტე|ამიხსენი)/;

/** First-person framing that wraps a claim without changing it. */
const FRAMES =
  /^(მე\s+)?(ვფიქრობ|მგონია|მგონი|ვგონებ|ვთვლი|ჩემი აზრით|ჩემი მოსაზრებით|მჯერა|დარწმუნებული ვარ|ვიტყოდი)\s*[,;]?\s*(რომ)?\s*/;

/** Subordinate clauses qualify a claim; they do not negate or generalise it. */
const SUBORDINATOR = /[,;]\s*(როცა|როდესაც|რადგან|იმიტომ|თუ|სანამ|მიუხედავად|ვიდრე|თუმცა)/u;

/**
 * Sentence splitting that *keeps* the terminator. Dropping it loses the single
 * most reliable signal that a sentence was a question.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/[^.!?…\n]+[.!?…]*/gu)) {
    const s = match[0].trim();
    if (s.length > 2) out.push(s);
  }
  return out;
}

export function isQuestion(sentence: string): boolean {
  const s = norm(sentence);
  return (
    sentence.trim().endsWith('?') ||
    // Georgian polar questions hang on „თუ არა" and need no question mark.
    /(^|\s)თუ არა(\s|$)/.test(s) ||
    /^(რა|რას|რის|რატომ|როგორ|ვინ|სად|როდის|რომელ|რამდენ|განა|ხომ არ|შეიძლება თუ არა|არის თუ არა)/.test(s)
  );
}

/**
 * The asserting half of a sentence. „X ირჩევს, როცა არავინ აიძულებს" asserts
 * that X chooses; the negation in the trailing clause is a condition, not a
 * denial, and reading it as one inverts the claim.
 */
export function mainClause(sentence: string): string {
  const m = SUBORDINATOR.exec(sentence);
  return m ? sentence.slice(0, m.index).trim() : sentence.trim();
}

/** Drop the "I think that…" wrapper so the claim underneath can be classified. */
export function unframe(sentence: string): string {
  return sentence.replace(FRAMES, '').trim();
}

export function tokens(text: string): string[] {
  return norm(text)
    .split(/[\s,.;:!?"'„"()[\]{}\-–—/\\]+/u)
    .filter(Boolean);
}

/** Crude Georgian stem: trim inflectional tail from longer words. */
export function stem(word: string): string {
  if (word.length > 7) return word.slice(0, word.length - 3);
  if (word.length > 5) return word.slice(0, word.length - 2);
  return word;
}

export function contentTerms(text: string): string[] {
  const out: string[] = [];
  for (const tok of tokens(text)) {
    if (tok.length < 3 || STOP.has(tok)) continue;
    const st = stem(tok);
    if (!out.includes(st)) out.push(st);
  }
  return out;
}

/** Surface form for a stem, taken from the original text where possible. */
export function surfaceFor(stemmed: string, text: string): string {
  for (const tok of tokens(text)) if (stem(tok) === stemmed) return tok;
  return stemmed;
}

/**
 * Two Georgian stems refer to the same thing when one is a prefix of the
 * other. „ნება" / „ნებით" / „ნებას" all stem differently under a fixed-length
 * trim, so exact set comparison silently misses most agreement.
 */
export function termMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 4) return false;
  let i = 0;
  while (i < min && a[i] === b[i]) i++;
  // Either a solid shared prefix, or agreement on all but the final letter —
  // which is what „ნება" / „ნებით" / „ნებას" actually look like.
  return i >= 4 || i >= min - 1;
}

/** Fraction of `a`'s distinct terms that have a match in `b`. Asymmetric. */
export function fuzzyOverlap(a: readonly string[], b: readonly string[]): number {
  const uniqueA = [...new Set(a)];
  if (uniqueA.length === 0 || b.length === 0) return 0;
  let matched = 0;
  for (const x of uniqueA) if (b.some((y) => termMatch(x, y))) matched++;
  return matched / uniqueA.length;
}

/** Symmetric similarity built on the same prefix rule. */
export function fuzzySim(a: readonly string[], b: readonly string[]): number {
  const uniqueA = [...new Set(a)];
  const uniqueB = [...new Set(b)];
  if (uniqueA.length === 0 || uniqueB.length === 0) return 0;
  let matched = 0;
  for (const x of uniqueA) if (uniqueB.some((y) => termMatch(x, y))) matched++;
  return (2 * matched) / (uniqueA.length + uniqueB.length);
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const x of new Set(a)) if (setB.has(x)) shared++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

/** Fraction of `a` covered by `b` — asymmetric, better for subject matching. */
export function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const x of new Set(a)) if (setB.has(x)) shared++;
  return shared / new Set(a).size;
}

export const cues = {
  universal: (s: string) => UNIVERSAL.test(s),
  existential: (s: string) => EXISTENTIAL.test(s),
  causal: (s: string) => CAUSAL.test(s),
  normative: (s: string) => NORMATIVE.test(s),
  conditional: (s: string) => CONDITIONAL.test(s),
  comparative: (s: string) => COMPARATIVE.test(s),
  definitional: (s: string) => DEFINITIONAL.test(s),
  negated: (s: string) => NEGATION.test(s),
  hedged: (s: string) => HEDGE.test(s),
  emphatic: (s: string) => EMPHATIC.test(s),
  agrees: (s: string) => AGREE.test(norm(s)),
  disagrees: (s: string) => DISAGREE.test(norm(s)),
  wantsAnswer: (s: string) => WANTS_ANSWER.test(norm(s)),
};

/**
 * Split a sentence around a copula so subject and predicate can be matched
 * separately. Falls back to a halfway split, which is still useful for
 * overlap scoring even when it is linguistically wrong.
 */
export function splitSubjectPredicate(sentence: string): { subject: string; predicate: string } {
  const s = unframe(sentence);
  const copula = /\s(არის|არაა|არ არის|იყო|ნიშნავს|გულისხმობს|ეწოდება|იწვევს)\s/u.exec(s);
  if (copula && copula.index > 0) {
    return { subject: s.slice(0, copula.index).trim(), predicate: s.slice(copula.index + copula[0].length).trim() };
  }
  const words = s.split(/\s+/);
  if (words.length < 4) return { subject: s, predicate: s };
  const cut = Math.max(1, Math.floor(words.length / 2));
  return { subject: words.slice(0, cut).join(' '), predicate: words.slice(cut).join(' ') };
}

/** Deterministic small hash — used to pick a phrasing frame per target. */
export function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Shorten a user sentence for quoting back without losing the point. */
export function quote(sentence: string, max = 90): string {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
