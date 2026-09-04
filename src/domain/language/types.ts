/**
 * General Georgian language knowledge.
 *
 * This layer is deliberately separate from anything a book *says*. It records
 * how Georgian works — which connective marks a contrast, which phrase
 * introduces a conclusion, which forms a word takes — so the assistant can use
 * that grammar in subjects the source never mentioned.
 *
 *   SOURCE KNOWLEDGE   what the book claims        → BookKnowledgeItem
 *   LANGUAGE KNOWLEDGE how Georgian is written     → LanguageUnit
 *
 * Nothing here stores a sentence from a book. A unit is a word, a two-to-four
 * word function phrase, or a skeleton with placeholders — the reusable part,
 * not the expression it was found in.
 */

/** What a phrase *does* in an argument, independent of subject matter. */
export type LanguageFunction =
  | 'contrast'
  | 'concession'
  | 'conclusion'
  | 'cause'
  | 'condition'
  | 'addition'
  | 'example'
  | 'clarification'
  | 'reformulation'
  | 'emphasis'
  | 'uncertainty'
  | 'certainty'
  | 'comparison'
  | 'sequence'
  | 'purpose'
  | 'summary'
  | 'attribution'
  | 'question'
  | 'definition';

/**
 * How formal the unit sounds.
 *
 * This is what stops a binary-search explanation from sounding like a
 * philosophy seminar: academic units are filtered out for plain topics.
 */
export type Register = 'neutral' | 'formal' | 'academic';

/** Where in a sentence the unit naturally sits. */
export type Position = 'initial' | 'medial' | 'flexible';

export interface LanguageUnit {
  id: string;
  kind: 'phrase' | 'word' | 'pattern' | 'collocation';
  /** Canonical written form. */
  surface: string;
  /** Dictionary form, when the unit is a single inflected word. */
  lemma?: string;
  /** Inflected forms actually observed in a corpus. */
  forms: string[];
  function: LanguageFunction;
  register: Register;
  position: Position;
  /** Usable outside the domain it was mined from. */
  reusable: boolean;
  /** '*' means every subject. Otherwise specific subject ids. */
  domains: string[];
  /** Times observed across mined corpora. 0 = seeded but not attested. */
  frequency: number;
  /** Corpora this unit was attested in. */
  attestedIn: string[];
  /**
   * A usage skeleton with placeholders, never a copied sentence.
   * e.g. "{A}. მეორე მხრივ, {B}."
   */
  pattern?: string;
  /** Rough English gloss, for the inspector. */
  gloss?: string;
}

/** A word family: one lemma, the forms it was seen in, how often. */
export interface Lexeme {
  lemma: string;
  forms: { form: string; count: number }[];
  frequency: number;
  /** Subjects where the word is at home. '*' when general. */
  domains: string[];
  /** True for ordinary vocabulary usable anywhere. */
  general: boolean;
}

/** Two content words that co-occur far more often than chance. */
export interface Collocation {
  a: string;
  b: string;
  count: number;
  /** Pointwise mutual information; higher means more strongly bound. */
  pmi: number;
}

export interface LanguageCorpus {
  units: LanguageUnit[];
  lexemes: Lexeme[];
  collocations: Collocation[];
  meta: {
    sourceIds: string[];
    sentences: number;
    tokens: number;
    minedAt: number;
  };
}
