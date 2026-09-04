/**
 * Conversational and intent signals, as data.
 *
 * These are the phrases that carry *what the user wants done* rather than
 * *what they want it done to*. Keeping them here — instead of as regexes
 * scattered through the engine — is what makes „უფრო მარტივად" work without a
 * topic in the message: the signal says "simplify", and the topic comes from
 * conversation state.
 *
 * Every entry is matched against the normalised, stemmed token stream, so
 * inflected forms do not need separate rows.
 */

export type ConversationSignalKind =
  | 'simplify'
  | 'expand'
  | 'example'
  | 'another'
  | 'why'
  | 'how'
  | 'when_to_use'
  | 'limitations'
  | 'compare'
  | 'define'
  | 'summarize'
  | 'continue'
  | 'repeat'
  | 'back'
  | 'correction'
  | 'agree'
  | 'disagree'
  | 'counterargument'
  | 'argue_for'
  | 'deeper'
  | 'quiz'
  | 'stop'
  | 'thanks'
  | 'greeting'
  | 'meta'
  | 'opinion'
  | 'defer_choice';

export interface SignalRule {
  kind: ConversationSignalKind;
  /** Matched against the raw normalised text (substring, already lowercased). */
  phrases: string[];
  /** Matched against stemmed tokens (any one is enough). */
  stems?: string[];
  /**
   * A signal that can stand alone as a whole message, carrying its topic from
   * context. „მაგალითი?" is complete; „მაგალითი" inside a longer sentence is
   * a modifier, not the whole request.
   */
  standalone?: boolean;
  /** Higher wins when several signals match. */
  weight: number;
}

export const CONVERSATION_SIGNALS: SignalRule[] = [
  {
    kind: 'simplify',
    phrases: [
      'უფრო მარტივად', 'მარტივად', 'ბავშვივით', 'გამარტივებ', 'ადვილად ახსენი',
      'ვერ გავიგე', 'რთულია', 'ძალიან რთული', 'უფრო ადვილად', 'ჩვეულებრივი ენით',
      'simpler', 'simplify', 'eli5',
    ],
    stems: ['მარტივ', 'გამარტივ', 'ადვილ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'expand',
    phrases: ['უფრო დეტალურად', 'დეტალურად', 'ვრცლად', 'მეტი დეტალი', 'გააფართოვე', 'more detail'],
    stems: ['დეტალ', 'ვრცლ', 'ვრცელ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'deeper',
    phrases: ['უფრო ღრმად', 'ღრმად', 'ჩაუღრმავდი', 'go deeper', 'deeper'],
    stems: ['ღრმ', 'სიღრმ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'example',
    phrases: ['მაგალითი', 'მაგალითად', 'მაგალითს', 'ერთი მაგალითი', 'example', 'for example'],
    stems: ['მაგალით'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'another',
    phrases: [
      'კიდევ ერთი', 'კიდევ', 'სხვა მაგალითი', 'სხვა', 'მეორე მაგალითი', 'გაიმეორე სხვა',
      'another', 'one more', 'next',
    ],
    stems: ['კიდევ'],
    standalone: true,
    weight: 4,
  },
  {
    kind: 'why',
    phrases: ['რატომ', 'რის გამო', 'რატომაა', 'რატომ არის', 'why'],
    stems: ['რატომ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'how',
    phrases: ['როგორ მუშაობს', 'როგორ', 'how does it work', 'how'],
    stems: [],
    standalone: true,
    weight: 2,
  },
  {
    kind: 'when_to_use',
    phrases: [
      'როდის ვიყენებ', 'როდის გამოვიყენო', 'როდის გამოდგება', 'სად გამოვიყენო',
      'როდის არის საჭირო', 'when do i use', 'when to use',
    ],
    stems: ['გამოყენებ'],
    standalone: true,
    weight: 4,
  },
  {
    kind: 'limitations',
    phrases: [
      'როდის არ გამოდგება', 'როდის არ მუშაობს', 'სად ვერ გამოვიყენებ', 'ნაკლი',
      'სუსტი მხარე', 'შეზღუდვა', 'პრობლემა რა აქვს', 'როდის ცდება',
      'limitations', 'drawbacks', 'when not to use',
    ],
    stems: ['შეზღუდვ', 'ნაკლ'],
    standalone: true,
    weight: 5,
  },
  {
    kind: 'compare',
    phrases: ['შეადარე', 'რითი განსხვავდება', 'განსხვავება', 'სხვაობა', 'vs', 'compare', 'difference'],
    stems: ['განსხვავებ', 'შედარებ', 'სხვაობ'],
    standalone: true,
    weight: 4,
  },
  {
    kind: 'define',
    phrases: ['რას ნიშნავს', 'განმარტება', 'როგორ განვმარტოთ', 'define', 'definition'],
    stems: ['განმარტებ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'summarize',
    phrases: ['შეაჯამე', 'შეჯამება', 'მოკლედ', 'რეზიუმე', 'summarize', 'tldr'],
    stems: ['შეჯამებ', 'შეაჯამ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'continue',
    phrases: ['გააგრძელე', 'აგრძელე', 'და მერე', 'შემდეგ', 'continue', 'go on'],
    stems: ['გაგრძელ', 'აგრძელ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'repeat',
    phrases: ['გაიმეორე', 'თავიდან', 'კიდევ ერთხელ თქვი', 'repeat'],
    stems: ['გამეორ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'back',
    phrases: [
      'წინა თემას', 'წინა თემაზე', 'დავუბრუნდეთ', 'უკან დავბრუნდეთ', 'ადრინდელს',
      'go back', 'previous topic',
    ],
    stems: ['დაბრუნ', 'დავბრუნ'],
    standalone: true,
    weight: 5,
  },
  {
    kind: 'correction',
    phrases: [
      'არა, ', 'არა ', 'ეგ არ მიგულისხმია', 'არ მიგულისხმია', 'სხვა რაღაც ვიგულისხმე',
      'ვიგულისხმე', 'მე ვგულისხმობდი', 'ვგულისხმობდი', 'ის კი არა', 'არა ეგ',
      'i meant', 'no i meant',
    ],
    stems: ['გულისხმ'],
    weight: 6,
  },
  {
    kind: 'counterargument',
    phrases: [
      'კონტრარგუმენტი', 'საწინააღმდეგო არგუმენტი', 'რას მიპასუხებდი', 'და თუ არა',
      'counterargument', 'counter argument', 'objection',
    ],
    stems: ['კონტრარგუმენტ', 'შეპასუხებ'],
    standalone: true,
    weight: 5,
  },
  {
    kind: 'argue_for',
    phrases: ['დამიცავი', 'არგუმენტი მომეცი', 'რა არგუმენტია', 'argue for', 'defend'],
    stems: [],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'quiz',
    phrases: ['გამომცადე', 'დამისვი კითხვა', 'ტესტი', 'quiz', 'test me'],
    stems: [],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'agree',
    phrases: ['დიახ', 'კი', 'ჰო', 'ასეა', 'მართალია', 'ზუსტად', 'გეთანხმები', 'yes', 'agreed'],
    stems: ['თანხმ'],
    standalone: true,
    weight: 2,
  },
  {
    kind: 'disagree',
    phrases: [
      'არ ვეთანხმები', 'არ გეთანხმები', 'არ მეთანხმები', 'არ მგონია', 'ვერა',
      'არასწორია', 'disagree', 'no',
    ],
    stems: [],
    standalone: true,
    weight: 2,
  },
  {
    kind: 'stop',
    phrases: ['კმარა', 'გავჩერდეთ', 'აღარ მინდა', 'stop', 'enough'],
    stems: [],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'thanks',
    phrases: ['მადლობა', 'გმადლობ', 'დიდი მადლობა', 'thanks', 'thank you'],
    stems: ['მადლ'],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'greeting',
    phrases: [
      'გამარჯობა', 'სალამი', 'ჰეი', 'დილა მშვიდობის', 'საღამო მშვიდობის',
      'როგორ ხარ', 'რას შვები', 'რას აკეთებ', 'ყველაფერი კარგად',
      'hello', 'hi', 'how are you',
    ],
    stems: [],
    standalone: true,
    weight: 3,
  },
  {
    kind: 'meta',
    phrases: [
      'ვინ ხარ', 'რას შეგიძლია', 'რა ხარ', 'როგორ მუშაობ', 'რა ინსტრუმენტი ხარ',
      'who are you', 'what can you do',
    ],
    stems: [],
    standalone: true,
    weight: 4,
  },
  {
    kind: 'opinion',
    phrases: [
      'შენ რას ფიქრობ', 'რას ფიქრობ ამაზე', 'შენი აზრით', 'რა არის შენი აზრი',
      'შენ როგორ ფიქრობ', 'რას იტყოდი', 'what do you think', 'your opinion',
    ],
    stems: [],
    standalone: true,
    weight: 4,
  },
  {
    kind: 'defer_choice',
    phrases: [
      'შენ აირჩიე', 'თავად აირჩიე', 'შენ ამოირჩიე', 'რაც გინდა', 'რომელიმე აირჩიე',
      'შენ გადაწყვიტე', 'რომელიც გინდა', 'შენ დაასახელე',
    ],
    stems: [],
    standalone: true,
    weight: 5,
  },
];

/** Words that stand in for something already discussed. */
export const REFERENCE_WORDS: { surface: string[]; kind: 'near' | 'far' | 'previous' }[] = [
  { surface: ['ეს', 'ესა', 'ამას', 'ამაზე', 'ამის', 'ამან', 'აქ'], kind: 'near' },
  { surface: ['ეგ', 'ეგა', 'მაგას', 'მაგაზე', 'მაგის', 'იმას', 'იმაზე', 'იმის', 'ის', 'იმ'], kind: 'far' },
  { surface: ['წინა', 'ადრინდელი', 'უკანასკნელი', 'ბოლო', 'previous', 'last'], kind: 'previous' },
];

/**
 * Discourse particles that carry no topic. A message made only of these plus a
 * reference word („ხო და ეგ?") is a pure follow-up and must resolve entirely
 * from state.
 */
export const PARTICLES = new Set([
  'ხო', 'ხომ', 'და', 'აბა', 'მერე', 'კარგი', 'ჰმ', 'ოკ', 'ok', 'აუ', 'ეხლა', 'ახლა',
  'ერთი', 'რა', 'თუ', 'ან', 'კი', 'ჰო', 'მაშ', 'მაშინ', 'ანუ', 'ე.ი', 'ეე', 'უი',
]);
