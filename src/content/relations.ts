import type { Relationship } from './schema';

/**
 * The knowledge graph. Edges are authored in one direction; the graph module
 * builds the reverse index at load time, so exploration works both ways.
 *
 * Ids may point at topics, people, formulas, facts or events — traversal is
 * intentionally cross-entity, which is what lets „გრავიტაცია → ნიუტონი →
 * ფარდობითობა → შავი ხვრელები" work as a single walk.
 */
export const RELATIONSHIPS: Relationship[] = [
  /* გრავიტაციის ჯაჭვი */
  { from: 'gravity', to: 'newton', kind: 'discoveredBy', note: { ka: 'ჩამოაყალიბა კანონი' } },
  { from: 'gravity', to: 'newton-laws', kind: 'requires' },
  { from: 'gravity', to: 'relativity', kind: 'leadsTo', note: { ka: 'უფრო ღრმა ახსნა' } },
  { from: 'relativity', to: 'black-holes', kind: 'leadsTo', note: { ka: 'პროგნოზირებს' } },
  { from: 'relativity', to: 'cosmology', kind: 'explains' },
  { from: 'black-holes', to: 'stars', kind: 'requires', note: { ka: 'წარმოიქმნება მასიური ვარსკვლავისგან' } },
  { from: 'black-holes', to: 'schwarzschild', kind: 'explains' },
  { from: 'gravity', to: 'solar-system', kind: 'appliesTo' },
  { from: 'gravity', to: 'e-gravitational-waves', kind: 'leadsTo' },

  /* დნმ-ის ჯაჭვი */
  { from: 'dna', to: 'cells', kind: 'partOf' },
  { from: 'dna', to: 'evolution', kind: 'leadsTo', note: { ka: 'მუტაციები აწვდის მასალას' } },
  { from: 'evolution', to: 'ecosystems', kind: 'appliesTo' },
  { from: 'dna', to: 'franklin', kind: 'discoveredBy' },
  { from: 'dna', to: 'e-dna-structure', kind: 'leadsTo' },
  { from: 'cells', to: 'photosynthesis', kind: 'appliesTo' },
  { from: 'cells', to: 'neuroscience', kind: 'appliesTo' },
  { from: 'evolution', to: 'darwin', kind: 'discoveredBy' },

  /* ატომის ჯაჭვი */
  { from: 'atom-structure', to: 'periodic-table', kind: 'explains', note: { ka: 'ცხრილის ფორმას განსაზღვრავს' } },
  { from: 'atom-structure', to: 'quantum', kind: 'requires' },
  { from: 'atom-structure', to: 'rutherford', kind: 'discoveredBy' },
  { from: 'atom-structure', to: 'bohr', kind: 'discoveredBy' },
  { from: 'periodic-table', to: 'chemical-bonds', kind: 'leadsTo' },
  { from: 'chemical-bonds', to: 'water', kind: 'explains' },
  { from: 'periodic-table', to: 'mendeleev', kind: 'discoveredBy' },
  { from: 'quantum', to: 'light', kind: 'explains' },
  { from: 'light', to: 'waves', kind: 'partOf' },

  /* ენერგიის ჯაჭვი */
  { from: 'energy', to: 'thermodynamics', kind: 'leadsTo' },
  { from: 'energy', to: 'newton-laws', kind: 'requires' },
  { from: 'energy', to: 'mass-energy', kind: 'explains' },
  { from: 'thermodynamics', to: 'information-theory', kind: 'contrasts', note: { ka: 'ენტროპია ორივეგან' } },
  { from: 'electricity', to: 'light', kind: 'explains', note: { ka: 'სინათლე ელექტრომაგნიტური ტალღაა' } },
  { from: 'electricity', to: 'e-transistor', kind: 'leadsTo' },

  /* გამოთვლის ჯაჭვი */
  { from: 'algorithm-complexity', to: 'computability', kind: 'leadsTo' },
  { from: 'computability', to: 'turing', kind: 'discoveredBy' },
  { from: 'information-theory', to: 'shannon', kind: 'discoveredBy' },
  { from: 'information-theory', to: 'cryptography', kind: 'appliesTo' },
  { from: 'cryptography', to: 'prime-numbers', kind: 'requires' },
  { from: 'networks', to: 'cryptography', kind: 'requires' },
  { from: 'computing-history', to: 'computability', kind: 'partOf' },
  { from: 'computing-history', to: 'lovelace', kind: 'discoveredBy' },

  /* მათემატიკის ჯაჭვი */
  { from: 'quadratic-equations', to: 'derivatives', kind: 'leadsTo' },
  { from: 'derivatives', to: 'infinity', kind: 'requires', note: { ka: 'ზღვრის ცნება' } },
  { from: 'infinity', to: 'prime-numbers', kind: 'appliesTo' },
  { from: 'probability-basics', to: 'statistics-basics', kind: 'leadsTo' },
  { from: 'statistics-basics', to: 'information-theory', kind: 'appliesTo' },
  { from: 'pi', to: 'infinity', kind: 'contrasts', note: { ka: 'უსასრულო ათწილადი' } },
  { from: 'derivatives', to: 'newton-laws', kind: 'appliesTo' },
  { from: 'probability-basics', to: 'quantum', kind: 'appliesTo' },

  /* ისტორიისა და ენის ჯაჭვი */
  { from: 'printing-revolution', to: 'information-theory', kind: 'contrasts', note: { ka: 'ინფორმაციის გავრცელება' } },
  { from: 'printing-revolution', to: 'georgian-script', kind: 'appliesTo' },
  { from: 'georgian-script', to: 'vepkhistqaosani', kind: 'appliesTo' },
  { from: 'vepkhistqaosani', to: 'rustaveli', kind: 'discoveredBy' },
  { from: 'georgian-script', to: 'e-1978-language', kind: 'leadsTo' },

  /* დედამიწა */
  { from: 'earthquakes', to: 'waves', kind: 'requires', note: { ka: 'სეისმური ტალღები' } },
  { from: 'earthquakes', to: 'solar-system', kind: 'contrasts', note: { ka: 'პლანეტების შიდა აგებულება' } },
  { from: 'ecosystems', to: 'photosynthesis', kind: 'requires' },

  /* პროგრამირების ჯაჭვი */
  { from: 'how-code-runs', to: 'variables-and-types', kind: 'leadsTo' },
  { from: 'variables-and-types', to: 'control-flow', kind: 'leadsTo' },
  { from: 'control-flow', to: 'functions-and-abstraction', kind: 'leadsTo' },
  { from: 'functions-and-abstraction', to: 'recursion', kind: 'leadsTo' },
  { from: 'functions-and-abstraction', to: 'programming-paradigms', kind: 'leadsTo' },
  { from: 'recursion', to: 'data-structures', kind: 'appliesTo' },
  { from: 'data-structures', to: 'algorithm-complexity', kind: 'requires' },
  { from: 'how-code-runs', to: 'ritchie', kind: 'discoveredBy', note: { ka: 'ენა C' } },
  { from: 'version-control', to: 'torvalds', kind: 'discoveredBy', note: { ka: 'Git' } },
  { from: 'bugs-and-debugging', to: 'hopper', kind: 'discoveredBy', note: { ka: 'პირველი „ბაგი"' } },
  { from: 'functions-and-abstraction', to: 'mccarthy', kind: 'discoveredBy', note: { ka: 'Lisp' } },

  /* ალგორითმების ჯაჭვი */
  { from: 'algorithm-complexity', to: 'sorting-algorithms', kind: 'appliesTo' },
  { from: 'sorting-algorithms', to: 'searching', kind: 'contrasts', note: { ka: 'დალაგება ვს ძებნა' } },
  { from: 'searching', to: 'data-structures', kind: 'requires' },
  { from: 'sorting-algorithms', to: 'hoare', kind: 'discoveredBy', note: { ka: 'Quicksort' } },
  { from: 'graphs-and-paths', to: 'dijkstra', kind: 'discoveredBy', note: { ka: 'უმოკლესი გზა' } },
  { from: 'recursion', to: 'dynamic-programming', kind: 'leadsTo', note: { ka: 'მემოიზაცია' } },
  { from: 'dynamic-programming', to: 'greedy-algorithms', kind: 'contrasts' },
  { from: 'algorithm-complexity', to: 'p-vs-np', kind: 'leadsTo' },
  { from: 'p-vs-np', to: 'cryptography', kind: 'appliesTo', note: { ka: 'უსაფრთხოება სირთულეს ეყრდნობა' } },
  { from: 'p-vs-np', to: 'computability', kind: 'contrasts', note: { ka: 'ძნელი ვს შეუძლებელი' } },

  /* ხელოვნური ინტელექტის ჯაჭვი */
  { from: 'what-is-machine-learning', to: 'neural-networks', kind: 'leadsTo' },
  { from: 'neural-networks', to: 'training-vs-inference', kind: 'requires' },
  { from: 'neural-networks', to: 'large-language-models', kind: 'leadsTo' },
  { from: 'large-language-models', to: 'how-ai-can-fail', kind: 'leadsTo', note: { ka: 'ჰალუცინაცია' } },
  { from: 'what-is-machine-learning', to: 'mccarthy', kind: 'discoveredBy', note: { ka: 'ტერმინი „AI"' } },
  { from: 'neural-networks', to: 'hinton', kind: 'discoveredBy', note: { ka: 'უკუგავრცელება' } },
  { from: 'neural-networks', to: 'gradient-descent', kind: 'requires' },
  { from: 'search-and-games', to: 'e-alphago', kind: 'leadsTo' },
  { from: 'training-vs-inference', to: 'information-theory', kind: 'requires', note: { ka: 'ენტროპია დანაკარგში' } },
  { from: 'networks', to: 'berners-lee', kind: 'discoveredBy', note: { ka: 'ვები' } },
];
