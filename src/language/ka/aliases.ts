/**
 * Concept aliases: the bridge between how people actually write and what the
 * library is called.
 *
 * Two jobs:
 *
 *  1. Mixed-script and English technical vocabulary. „binary search ამიხსენი"
 *     must reach the topic titled „ძებნა", whose Georgian text never contains
 *     the word "binary". No amount of stemming gets there; only a stated
 *     synonym does.
 *
 *  2. Marking concepts we *recognise but do not cover*. An entry with no
 *     `topicId` is how the engine can say "I know what you're asking, I just
 *     don't have that yet" instead of "I don't understand" — the distinction
 *     the whole product rests on.
 *
 * Forms are matched after stemming, so only one form per inflection *family*
 * is needed. Irregular stems (თავისუფალი / თავისუფლება) do need both.
 */

export interface AliasEntry {
  /** Stable concept key. Equals `topicId` when the library covers it. */
  concept: string;
  /** Library topic, or omitted when the concept is known but uncovered. */
  topicId?: string;
  label: string;
  forms: string[];
  /** Extra retrieval weight; use for concepts users name constantly. */
  weight?: number;
}

export const ALIASES: AliasEntry[] = [
  /* ------------------------- algorithms & CS ------------------------- */
  {
    concept: 'searching',
    topicId: 'searching',
    label: 'ძებნა / Binary search',
    forms: [
      'binary search', 'binarysearch', 'bin search', 'ორობითი ძებნა', 'ბინარული ძებნა',
      'ბაინარი სერჩი', 'ძებნა', 'ძიება', 'linear search', 'წრფივი ძებნა', 'hashing',
      'ჰეშირება', 'ჰეში', 'hash table', 'search algorithm',
    ],
    weight: 1.2,
  },
  {
    concept: 'sorting-algorithms',
    topicId: 'sorting-algorithms',
    label: 'დალაგება / Sorting',
    forms: [
      'sorting', 'sort', 'დალაგება', 'დახარისხება', 'quicksort', 'ქუიქსორტი',
      'merge sort', 'მერჯ სორტი', 'bubble sort', 'ბაბლ სორტი', 'insertion sort',
    ],
  },
  {
    concept: 'dynamic-programming',
    topicId: 'dynamic-programming',
    label: 'დინამიური პროგრამირება / DP',
    forms: [
      'dp', 'dynamic programming', 'დინამიური პროგრამირება', 'დინამიკური პროგრამირება',
      'მემოიზაცია', 'memoization', 'memoisation',
    ],
    weight: 1.2,
  },
  {
    concept: 'graphs-and-paths',
    topicId: 'graphs-and-paths',
    label: 'გრაფები / Graphs',
    forms: [
      'bfs', 'dfs', 'graph', 'graphs', 'გრაფი', 'გრაფები', 'dijkstra', 'დეიკსტრა',
      'shortest path', 'უმოკლესი გზა', 'breadth first', 'depth first', 'traversal',
    ],
    weight: 1.2,
  },
  {
    concept: 'algorithm-complexity',
    topicId: 'algorithm-complexity',
    label: 'სირთულე / Big-O',
    forms: [
      'big o', 'bigo', 'big-o', 'ბიგ ო', 'complexity', 'სირთულე', 'ასიმპტოტიკა',
      'time complexity', 'დროის სირთულე', 'o(n)', 'ონ', 'ეფექტურობა',
    ],
  },
  {
    concept: 'data-structures',
    topicId: 'data-structures',
    label: 'მონაცემთა სტრუქტურები',
    forms: [
      'data structure', 'data structures', 'მონაცემთა სტრუქტურა', 'სტრუქტურა',
      'array', 'arrays', 'მასივი', 'მასივები', 'stack', 'სტეკი', 'queue', 'რიგი',
      'hash map', 'ჰეშმეპი', 'tree', 'ხე', 'ხეები',
    ],
  },
  {
    concept: 'recursion',
    topicId: 'recursion',
    label: 'რეკურსია',
    forms: ['recursion', 'recursive', 'რეკურსია', 'რეკურსიული', 'რეკურსიულად'],
  },
  {
    concept: 'greedy-algorithms',
    topicId: 'greedy-algorithms',
    label: 'ხარბი ალგორითმები',
    forms: ['greedy', 'ხარბი', 'ხარბი ალგორითმი', 'greedy algorithm'],
  },
  {
    concept: 'p-vs-np',
    topicId: 'p-vs-np',
    label: 'P vs NP',
    forms: ['p vs np', 'p=np', 'np', 'np-complete', 'np სრული', 'პი ენპი'],
  },
  {
    concept: 'cryptography',
    topicId: 'cryptography',
    label: 'კრიპტოგრაფია',
    forms: [
      'cryptography', 'crypto', 'კრიპტოგრაფია', 'დაშიფვრა', 'შიფრი', 'encryption',
      'rsa', 'დაშიფრვა', 'უსაფრთხოება',
    ],
  },
  {
    concept: 'how-code-runs',
    topicId: 'how-code-runs',
    label: 'როგორ სრულდება კოდი',
    forms: [
      'compiler', 'კომპილატორი', 'interpreter', 'ინტერპრეტატორი', 'compile',
      'კომპილაცია', 'machine code', 'მანქანური კოდი', 'როგორ მუშაობს კოდი',
    ],
  },
  {
    concept: 'variables-and-types',
    topicId: 'variables-and-types',
    label: 'ცვლადები და ტიპები',
    forms: ['variable', 'variables', 'ცვლადი', 'ცვლადები', 'type', 'types', 'ტიპი', 'ტიპები'],
  },
  {
    concept: 'control-flow',
    topicId: 'control-flow',
    label: 'მართვის ნაკადი',
    forms: ['if', 'loop', 'ციკლი', 'ციკლები', 'პირობა', 'control flow', 'for loop', 'while'],
  },
  {
    concept: 'version-control',
    topicId: 'version-control',
    label: 'ვერსიების კონტროლი / Git',
    forms: ['git', 'გიტი', 'github', 'version control', 'ვერსიების კონტროლი', 'commit', 'კომიტი'],
  },
  {
    concept: 'bugs-and-debugging',
    topicId: 'bugs-and-debugging',
    label: 'ბაგები და დებაგინგი',
    forms: ['bug', 'bugs', 'ბაგი', 'ბაგები', 'debug', 'დებაგი', 'debugging', 'შეცდომა კოდში'],
  },

  /* ----------------------------- AI / ML ----------------------------- */
  {
    concept: 'what-is-machine-learning',
    topicId: 'what-is-machine-learning',
    label: 'მანქანური სწავლება',
    forms: [
      'machine learning', 'ml', 'მანქანური სწავლება', 'მანქანური დასწავლა',
      'supervised', 'unsupervised', 'ზედამხედველობითი',
    ],
  },
  {
    concept: 'neural-networks',
    topicId: 'neural-networks',
    label: 'ნეირონული ქსელები',
    forms: [
      'neural network', 'neural networks', 'nn', 'ნეირონული ქსელი', 'ნეირონული ქსელები',
      'backpropagation', 'უკუგავრცელება', 'deep learning', 'ღრმა სწავლება',
    ],
  },
  {
    concept: 'large-language-models',
    topicId: 'large-language-models',
    label: 'დიდი ენობრივი მოდელები',
    forms: [
      'llm', 'llms', 'დიდი ენობრივი მოდელი', 'ენობრივი მოდელი', 'gpt', 'chatgpt',
      'transformer', 'ტრანსფორმერი', 'claude',
    ],
  },
  {
    concept: 'how-ai-can-fail',
    topicId: 'how-ai-can-fail',
    label: 'როგორ ცდება AI',
    forms: [
      'hallucination', 'ჰალუცინაცია', 'bias', 'მიკერძოება', 'ai failure',
      'როგორ ცდება ai', 'ai რისკები',
    ],
  },

  /* ---------------------------- philosophy --------------------------- */
  // Domain-level entries. Naming a whole field („ფილოსოფიაზე გადავიდეთ")
  // lands on that field's flagship topic, which is a sane place to start a
  // domain switch.
  {
    concept: 'free-will',
    topicId: 'free-will',
    label: 'ფილოსოფია',
    forms: ['ფილოსოფია', 'philosophy', 'ფილოსოფიური', 'ფილოსოფოსი'],
  },
  {
    concept: 'algorithm-complexity',
    topicId: 'algorithm-complexity',
    label: 'ალგორითმები',
    forms: ['ალგორითმი', 'ალგორითმები', 'algorithm', 'algorithms'],
  },
  {
    concept: 'free-will',
    topicId: 'free-will',
    label: 'თავისუფალი ნება',
    forms: [
      'free will', 'freewill', 'თავისუფალი ნება', 'თავისუფლება', 'თავისუფალი',
      'ნება', 'არჩევანის თავისუფლება', 'დეტერმინიზმი', 'determinism', 'determinist',
      'compatibilism', 'კომპატიბილიზმი', 'შეთავსებადობა', 'libertarianism',
      'ლიბერტარიანიზმი', 'არჩევანი',
    ],
    weight: 1.3,
  },
  {
    concept: 'ethics-frameworks',
    topicId: 'ethics-frameworks',
    label: 'ეთიკის მიდგომები',
    forms: [
      'ethics', 'ეთიკა', 'მორალი', 'მორალური', 'utilitarianism', 'უტილიტარიზმი',
      'deontology', 'დეონტოლოგია', 'virtue ethics', 'სათნოების ეთიკა', 'კანტი',
      'kant', 'trolley problem', 'ტრამვაის ამოცანა', 'სწორი და არასწორი',
    ],
    weight: 1.3,
  },
  {
    concept: 'theory-of-knowledge',
    topicId: 'theory-of-knowledge',
    label: 'ცოდნის თეორია',
    forms: [
      'epistemology', 'ეპისტემოლოგია', 'ცოდნა', 'ცოდნის თეორია', 'gettier', 'გეტიე',
      'skepticism', 'სკეპტიციზმი', 'justified true belief', 'დასაბუთებული რწმენა',
      'რწმენა', 'ჭეშმარიტება', 'truth',
    ],
    weight: 1.3,
  },
  {
    concept: 'logic-and-arguments',
    topicId: 'logic-and-arguments',
    label: 'ლოგიკა და არგუმენტები',
    forms: [
      'logic', 'ლოგიკა', 'argument', 'არგუმენტი', 'fallacy', 'ფალაცია', 'შეცდომა ლოგიკაში',
      'valid', 'sound', 'მართებული', 'მყარი', 'სილოგიზმი', 'syllogism', 'დედუქცია',
      'ინდუქცია', 'deduction', 'induction', 'წანამძღვარი', 'premise',
    ],
  },
  {
    concept: 'cognitive-biases',
    topicId: 'cognitive-biases',
    label: 'კოგნიტური მიკერძოებები',
    forms: [
      'cognitive bias', 'კოგნიტური მიკერძოება', 'მიკერძოება', 'confirmation bias',
      'kahneman', 'კანემანი', 'system 1', 'სისტემა 1',
    ],
  },

  /* ------------------------- maths & science ------------------------- */
  {
    concept: 'probability-basics',
    topicId: 'probability-basics',
    label: 'ალბათობა',
    forms: ['probability', 'ალბათობა', 'შანსი', 'ალბათური', 'chance'],
  },
  {
    concept: 'conditional-probability',
    topicId: 'conditional-probability',
    label: 'პირობითი ალბათობა',
    forms: [
      'bayes', 'ბაიესი', 'ბეიესი', 'conditional probability', 'პირობითი ალბათობა',
      'base rate', 'საბაზისო სიხშირე',
    ],
  },
  {
    concept: 'statistics-basics',
    topicId: 'statistics-basics',
    label: 'სტატისტიკა',
    forms: ['statistics', 'სტატისტიკა', 'საშუალო', 'mean', 'median', 'მედიანა', 'გადახრა'],
  },
  {
    concept: 'derivatives',
    topicId: 'derivatives',
    label: 'წარმოებულები',
    forms: ['derivative', 'derivatives', 'წარმოებული', 'calculus', 'ანალიზი', 'ზღვარი', 'limit'],
  },
  {
    concept: 'prime-numbers',
    topicId: 'prime-numbers',
    label: 'მარტივი რიცხვები',
    forms: ['prime', 'primes', 'მარტივი რიცხვი', 'მარტივი რიცხვები', 'prime number'],
  },
  {
    concept: 'gravity',
    topicId: 'gravity',
    label: 'გრავიტაცია',
    forms: ['gravity', 'გრავიტაცია', 'მიზიდულობა', 'newton', 'ნიუტონი', 'weight', 'წონა'],
  },
  {
    concept: 'relativity',
    topicId: 'relativity',
    label: 'ფარდობითობა',
    forms: [
      'relativity', 'ფარდობითობა', 'einstein', 'აინშტაინი', 'spacetime', 'სივრცე-დრო',
      'special relativity', 'general relativity',
    ],
  },
  {
    concept: 'black-holes',
    topicId: 'black-holes',
    label: 'შავი ხვრელები',
    forms: ['black hole', 'black holes', 'შავი ხვრელი', 'შავი ხვრელები', 'ჰორიზონტი'],
  },
  {
    concept: 'quantum',
    topicId: 'quantum',
    label: 'კვანტური მექანიკა',
    forms: [
      'quantum', 'კვანტური', 'კვანტი', 'quantum mechanics', 'კვანტური მექანიკა',
      'superposition', 'სუპერპოზიცია',
    ],
  },
  {
    concept: 'dna',
    topicId: 'dna',
    label: 'დნმ',
    forms: ['dna', 'დნმ', 'გენი', 'gene', 'ორმაგი სპირალი', 'double helix'],
  },
  {
    concept: 'evolution',
    topicId: 'evolution',
    label: 'ევოლუცია',
    forms: ['evolution', 'ევოლუცია', 'darwin', 'დარვინი', 'natural selection', 'ბუნებრივი გადარჩევა'],
  },
  {
    concept: 'entropy',
    topicId: 'thermodynamics',
    label: 'თერმოდინამიკა და ენტროპია',
    forms: ['entropy', 'ენტროპია', 'thermodynamics', 'თერმოდინამიკა', 'სითბო', 'heat'],
  },
  {
    concept: 'information-theory',
    topicId: 'information-theory',
    label: 'ინფორმაციის თეორია',
    forms: ['information theory', 'ინფორმაციის თეორია', 'shannon', 'შენონი', 'ბიტი', 'bit'],
  },

  /* --------- known concepts the library does not cover (yet) --------- */
  // These exist so the engine can say "I understand you, I don't have it"
  // rather than "I don't understand you". Add a topicId when coverage lands.
  {
    concept: 'vector',
    label: 'ვექტორი',
    forms: ['vector', 'vectors', 'ვექტორი', 'ვექტორები', 'ვექტორული'],
  },
  {
    concept: 'matrix',
    label: 'მატრიცა',
    forms: ['matrix', 'matrices', 'მატრიცა', 'მატრიცები', 'linear algebra', 'წრფივი ალგებრა'],
  },
  {
    concept: 'linked-list',
    label: 'ბმული სია',
    forms: ['linked list', 'ბმული სია', 'linkedlist'],
  },
  {
    concept: 'sql',
    label: 'SQL და ბაზები',
    forms: ['sql', 'database', 'მონაცემთა ბაზა', 'ბაზა', 'postgres', 'mysql'],
  },
  {
    concept: 'consciousness',
    label: 'ცნობიერება',
    forms: ['consciousness', 'ცნობიერება', 'ცნობიერი', 'qualia', 'კვალია', 'mind body', 'გონება-სხეული'],
  },
  {
    concept: 'personal-identity',
    label: 'პიროვნული იდენტობა',
    forms: ['personal identity', 'პიროვნული იდენტობა', 'იდენტობა', 'ship of theseus', 'თესევსის ხომალდი'],
  },
  {
    concept: 'existentialism',
    label: 'ეგზისტენციალიზმი',
    forms: ['existentialism', 'ეგზისტენციალიზმი', 'sartre', 'სარტრი', 'camus', 'კამიუ', 'აზრი ცხოვრებისა'],
  },
  {
    concept: 'stoicism',
    label: 'სტოიციზმი',
    forms: ['stoicism', 'სტოიციზმი', 'stoic', 'სტოიკოსი', 'marcus aurelius', 'ეპიქტეტე'],
  },
  {
    concept: 'justice',
    label: 'სამართლიანობა',
    forms: ['justice', 'სამართლიანობა', 'rawls', 'როულსი', 'social contract', 'საზოგადოებრივი კონტრაქტი'],
  },
];
