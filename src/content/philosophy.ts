import type { Provenance } from './knowledge';

/**
 * Structured philosophy knowledge.
 *
 * Philosophy is not a list of definitions, so it is not stored as one. Each
 * concept carries the positions people actually hold, the arguments on each
 * side, the standard objections, the replies to those objections, the thought
 * experiments that test them, and the questions that make someone examine
 * their own view.
 *
 * This is what lets the assistant *discuss* rather than recite: a
 * counterargument request has real counterarguments to draw on, and a
 * Socratic question is chosen from questions attached to the live concept.
 *
 * Grounding rule: everything here is a summary of positions that are standard
 * in the literature, with a source attached. The engine may combine these
 * stored premises into new comparisons. It may not add new factual claims,
 * quotes, dates or attributions beyond what is stored.
 */

const sep = (label: string, slug: string): Provenance => ({
  sourceTitle: label,
  sourceURL: `https://plato.stanford.edu/entries/${slug}/`,
  sourceType: 'encyclopedia',
  confidence: 'high',
  notes: 'Stanford Encyclopedia of Philosophy',
});

const brit = (label: string, slug: string): Provenance => ({
  sourceTitle: label,
  sourceURL: `https://www.britannica.com/${slug}`,
  sourceType: 'encyclopedia',
  confidence: 'high',
  notes: 'Encyclopædia Britannica',
});

/* -------------------------------- types --------------------------------- */

export interface PhilPosition {
  id: string;
  label: string;
  gloss: string;
}

export interface PhilArgument {
  id: string;
  /** Short name of the argument. */
  title: string;
  /** Premises, in order. */
  premises: string[];
  conclusion: string;
  /** Which position it supports. */
  supports: string;
}

export interface PhilObjection {
  id: string;
  /** What the objection targets. */
  target: string;
  text: string;
  /** Standard reply, when one exists. */
  response?: string;
}

export interface ThoughtExperiment {
  id: string;
  label: string;
  setup: string;
  /** What the case is designed to test. */
  tests: string;
}

export interface PhilosophyConcept {
  id: string;
  label: string;
  /** Library topic that covers this, when one exists. */
  topicId?: string;
  definition: string;
  simple: string;
  positions: PhilPosition[];
  claims: string[];
  argumentsFor: PhilArgument[];
  argumentsAgainst: PhilArgument[];
  objections: PhilObjection[];
  assumptions: string[];
  thoughtExperiments: ThoughtExperiment[];
  examples: string[];
  relatedConcepts: string[];
  distinctions: { a: string; b: string; note: string }[];
  socraticQuestions: string[];
  misunderstandings: string[];
  sources: Provenance[];
}

export type ArgumentRelationKind =
  | 'supports'
  | 'challenges'
  | 'contradicts'
  | 'responds_to'
  | 'assumes'
  | 'depends_on'
  | 'clarifies'
  | 'distinguishes_from'
  | 'example_of'
  | 'counterexample_to'
  | 'related_to';

export interface ArgumentRelation {
  from: string;
  to: string;
  kind: ArgumentRelationKind;
  note?: string;
}

/* ------------------------------- concepts ------------------------------- */

export const PHILOSOPHY: PhilosophyConcept[] = [
  {
    id: 'free-will',
    label: 'თავისუფალი ნება',
    topicId: 'free-will',
    definition:
      'თავისუფალი ნება არის უნარი, ვიმოქმედოთ ისე, რომ მოქმედება ნამდვილად ჩვენი არჩევანი იყოს — და არა მხოლოდ წინა მიზეზების გარდაუვალი შედეგი.',
    simple:
      'თუ ყველაფერს წინა მიზეზი აქვს, შენს გადაწყვეტილებასაც აქვს. სად რჩება „მე ავირჩიე"? აი ეს არის მთელი პრობლემა.',
    positions: [
      { id: 'hard-determinism', label: 'მკაცრი დეტერმინიზმი', gloss: 'დეტერმინიზმი ჭეშმარიტია, ამიტომ თავისუფალი ნება არ არსებობს' },
      { id: 'libertarian-fw', label: 'ლიბერტარიანიზმი', gloss: 'თავისუფალი ნება ნამდვილია, ამიტომ დეტერმინიზმი (სულ მცირე გონების დონეზე) მცდარია' },
      { id: 'compatibilism', label: 'კომპატიბილიზმი', gloss: '„თავისუფალი" ნიშნავს „იძულების გარეშე, საკუთარი მოტივებით", არა „მიზეზების გარეშე"' },
    ],
    claims: [
      'დეტერმინიზმი ამტკიცებს, რომ ყოველი მოვლენა წინა პირობებით არის განსაზღვრული.',
      'თუ დეტერმინიზმი ჭეშმარიტია, მოცემულ მომენტში მხოლოდ ერთი მომავალია შესაძლებელი.',
      'კომპატიბილიზმი დღეს ფილოსოფოსებში ყველაზე გავრცელებული პოზიციაა.',
    ],
    argumentsFor: [
      {
        id: 'fw-experience',
        title: 'გამოცდილების არგუმენტი',
        premises: [
          'ჩვენ უშუალოდ განვიცდით არჩევანის გაკეთებას.',
          'უშუალო გამოცდილება მტკიცებულების საწყისი წერტილია, სანამ არ გაბათილდება.',
        ],
        conclusion: 'გვაქვს საფუძველი, ვირწმუნოთ, რომ არჩევანი რეალურია.',
        supports: 'libertarian-fw',
      },
      {
        id: 'fw-compat-practical',
        title: 'პრაქტიკული განსხვავების არგუმენტი',
        premises: [
          'არსებობს რეალური, დაკვირვებადი განსხვავება იძულებით და საკუთარი მოტივებით მოქმედებას შორის.',
          'სწორედ ამ განსხვავებას ვიყენებთ პასუხისმგებლობის მისაკუთვნებლად.',
        ],
        conclusion: '„თავისუფალი" შეიძლება ნიშნავდეს „იძულების გარეშე" — და ეს საკმარისია.',
        supports: 'compatibilism',
      },
    ],
    argumentsAgainst: [
      {
        id: 'fw-causal-closure',
        title: 'მიზეზობრივი ჩაკეტილობის არგუმენტი',
        premises: [
          'ტვინი ფიზიკური სისტემაა.',
          'ფიზიკური მოვლენები ფიზიკური მიზეზებით არის განსაზღვრული.',
          'გადაწყვეტილება ტვინის მოვლენაა.',
        ],
        conclusion: 'გადაწყვეტილება წინა ფიზიკური მდგომარეობით არის განსაზღვრული.',
        supports: 'hard-determinism',
      },
      {
        id: 'fw-randomness',
        title: 'შემთხვევითობის არგუმენტი',
        premises: [
          'თუ გადაწყვეტილება განსაზღვრული არაა, ის ნაწილობრივ შემთხვევითია.',
          'შემთხვევითი მოვლენა ჩემი კონტროლის ქვეშ არ არის.',
        ],
        conclusion: 'განუსაზღვრელობა თავისუფლებას ვერ იძლევა.',
        supports: 'compatibilism',
      },
    ],
    objections: [
      {
        id: 'obj-compat-shallow',
        target: 'compatibilism',
        text: 'კომპატიბილიზმი ტერმინს განმარტავს ისე, რომ პრობლემა გაქრეს — ეს პასუხი კი არა, თემის შეცვლაა.',
        response:
          'პასუხი: განმარტება თვითნებური არაა — ის იმ განსხვავებას იჭერს, რომელსაც სამართალი და ყოველდღიური მსჯელობა უკვე იყენებს.',
      },
      {
        id: 'obj-libet',
        target: 'libertarian-fw',
        text: 'ლიბეტის ტიპის ექსპერიმენტები აჩვენებს, რომ ტვინის მოსამზადებელი აქტივობა შეგნებულ გადაწყვეტილებას უსწრებს.',
        response:
          'პასუხი: შედეგების ინტერპრეტაცია სადავოა; შესაძლოა ეს განზრახვის ფორმირების ეტაპი იყოს, არა გადაწყვეტილება.',
      },
      {
        id: 'obj-responsibility',
        target: 'hard-determinism',
        text: 'თუ არავინ ვერ მოიქცეოდა სხვანაირად, პასუხისმგებლობის ცნება მთლიანად ინგრევა.',
        response:
          'პასუხი: ზოგი მკაცრი დეტერმინისტი სწორედ ამას იღებს და სასჯელის ნაცვლად პრევენციასა და მკურნალობას სთავაზობს.',
      },
    ],
    assumptions: [
      '„თავისუფალი" ნიშნავს „მიზეზების გარეშე", და არა „იძულების გარეშე".',
      'პასუხისმგებლობა მოითხოვს, რომ ადამიანს შეეძლო სხვანაირად მოქცევა.',
      'ფიზიკური აღწერა ამოწურავს იმას, რაც გადაწყვეტილებისას ხდება.',
    ],
    thoughtExperiments: [
      {
        id: 'te-libet',
        label: 'ლიბეტის ექსპერიმენტი',
        setup:
          'ტვინში მოძრაობის მოსამზადებელი აქტივობა ჩნდება მანამ, სანამ ადამიანი შეგნებულ გადაწყვეტილებას აცნობიერებს.',
        tests: 'ამოწმებს, არის თუ არა შეგნებული განზრახვა ქმედების ნამდვილი მიზეზი.',
      },
      {
        id: 'te-two-agents',
        label: 'ორი მოქმედი',
        setup:
          'ერთი ადამიანი თოფის ქვეშ აწერს ხელს, მეორე — საკუთარი რწმენით. ორივე შემთხვევაში მიზეზები არსებობს.',
        tests: 'ამოწმებს, აქვს თუ არა მნიშვნელობა იმას, *რომელი* მიზეზები მოქმედებს.',
      },
    ],
    examples: [
      'სასამართლო იძულებით ჩადენილ ქმედებას სხვაგვარად აფასებს, ვიდრე ნებაყოფლობითს — ეს კომპატიბილისტური განსხვავებაა პრაქტიკაში.',
      'დამოკიდებულების შემთხვევაში ვამბობთ, რომ ადამიანის ნება „დასუსტებულია" — ანუ თავისუფლებას ხარისხობრივად ვზომავთ.',
    ],
    relatedConcepts: ['moral-responsibility', 'consciousness', 'knowledge'],
    distinctions: [
      { a: 'დეტერმინიზმი', b: 'ფატალიზმი', note: 'დეტერმინიზმი ამბობს, რომ მიზეზები განსაზღვრავს შედეგს; ფატალიზმი — რომ შედეგი დადგება მიზეზების მიუხედავად.' },
      { a: 'თავისუფლება იძულებისგან', b: 'თავისუფლება მიზეზობრიობისგან', note: 'პირველი პრაქტიკული და გაზომვადია, მეორე მეტაფიზიკური.' },
    ],
    socraticQuestions: [
      'როცა ამბობ „თავისუფალი", გულისხმობ არჩევანს ყოველგვარი წინა მიზეზის გარეშე, თუ არჩევანს საკუთარი სურვილების მიხედვით?',
      'თუ შენი გადაწყვეტილება სრულიად შემთხვევითი იქნებოდა, უფრო თავისუფალი იქნებოდა თუ ნაკლებად?',
      'რა უნდა შეიცვალოს სამყაროში, რომ შენ თვითონ თქვა: „კარგი, აქ ნამდვილად არ იყო თავისუფალი არჩევანი"?',
    ],
    misunderstandings: [
      'კვანტური შემთხვევითობა თავისუფალ ნებას არ „შველის": უკონტროლო შემთხვევითობა ისეთივე უცხოა ჩემი არჩევანისთვის, როგორც განსაზღვრულობა.',
      'დეტერმინიზმი არ ნიშნავს, რომ მომავალი წინასწარმეტყველებადია — მხოლოდ იმას, რომ ის განსაზღვრულია.',
    ],
    sources: [sep('Free Will', 'freewill'), brit('Free will', 'topic/free-will')],
  },

  {
    id: 'moral-responsibility',
    label: 'მორალური პასუხისმგებლობა',
    topicId: 'free-will',
    definition:
      'მორალური პასუხისმგებლობა არის ის, რის საფუძველზეც ადამიანს ქებას ან საყვედურს მივაკუთვნებთ მისი ქმედებისთვის.',
    simple:
      'როდის არის სამართლიანი, ვთქვათ „შენ ხარ დამნაშავე"? პასუხი დამოკიდებულია იმაზე, შეეძლო თუ არა სხვანაირად მოქცევა — და იმაზეც, რას ნიშნავს „შეეძლო".',
    positions: [
      { id: 'mr-requires-alternatives', label: 'ალტერნატივების მოთხოვნა', gloss: 'პასუხისმგებლობა მოითხოვს, რომ სხვა ქმედება ნამდვილად შესაძლებელი ყოფილიყო' },
      { id: 'mr-reasons-responsive', label: 'მიზეზებზე რეაგირება', gloss: 'საკმარისია, რომ ადამიანი არგუმენტებზე რეაგირებდეს — ალტერნატიული სამყარო საჭირო არაა' },
    ],
    claims: [
      'სამართლის სისტემა უკვე განასხვავებს იძულებით და ნებაყოფლობით ქმედებას.',
      'ბავშვებსა და მძიმე ფსიქიკური აშლილობის მქონე ადამიანებს ნაკლებ პასუხისმგებლობას ვაკისრებთ.',
    ],
    argumentsFor: [
      {
        id: 'mr-practice',
        title: 'პრაქტიკის არგუმენტი',
        premises: [
          'ჩვენ უკვე ვმართავთ პასუხისმგებლობის სისტემას და ის მუშაობს.',
          'სისტემა რეაგირებს ისეთ განსხვავებებზე, რომლებიც რეალურად არსებობს (იძულება, ასაკი, ცოდნა).',
        ],
        conclusion: 'პასუხისმგებლობის ცნებას აქვს რეალური, გაზომვადი საფუძველი.',
        supports: 'mr-reasons-responsive',
      },
    ],
    argumentsAgainst: [
      {
        id: 'mr-luck',
        title: 'მორალური იღბლის არგუმენტი',
        premises: [
          'ადამიანის ხასიათი გენებისა და გარემოს შედეგია.',
          'არც გენები, არც ბავშვობის გარემო არ არის მისი არჩევანი.',
        ],
        conclusion: 'ის, რაზეც ვაკუთვნებთ პასუხისმგებლობას, თავად იღბალია.',
        supports: 'mr-requires-alternatives',
      },
    ],
    objections: [
      {
        id: 'obj-mr-nihilism',
        target: 'mr-luck',
        text: 'თუ პასუხისმგებლობა არ არსებობს, მაშინ ქებაც უსაფუძვლოა — და ეს დასკვნა უმეტესობას მიუღებელი ეჩვენება.',
        response:
          'პასუხი: ზოგი ავტორი სწორედ ამას იღებს და სასჯელის ჩანაცვლებას სთავაზობს პრევენციითა და რეაბილიტაციით.',
      },
    ],
    assumptions: [
      'ქება და საყვედური მხოლოდ მაშინაა გამართლებული, როცა ადამიანი ქმედების საბოლოო წყაროა.',
      'პასუხისმგებლობა „დიახ ან არა" კითხვაა, და არა ხარისხის საკითხი.',
    ],
    thoughtExperiments: [
      {
        id: 'te-frankfurt',
        label: 'ჩარევის შემთხვევა',
        setup:
          'ადამიანი თავისით იღებს გადაწყვეტილებას. ფარულად კი არსებობს მექანიზმი, რომელიც სხვა გადაწყვეტილებას ხელს შეუშლიდა — მაგრამ ის არასდროს ჩაერთო.',
        tests: 'ამოწმებს, ნამდვილად სჭირდება თუ არა პასუხისმგებლობას ალტერნატიული შესაძლებლობა.',
      },
    ],
    examples: [
      'იძულებით ხელმოწერილი ხელშეკრულება ბათილია — სამართალი აქ ნების ხარისხს ზომავს.',
      'არასრულწლოვნის მიმართ სასჯელი შემსუბუქებულია, რადგან პასუხისმგებლობის უნარი განვითარებადად ითვლება.',
    ],
    relatedConcepts: ['free-will', 'justice', 'ethics'],
    distinctions: [
      { a: 'მიზეზი', b: 'ბრალი', note: 'რაღაცის მიზეზი ყოფნა არ ნიშნავს მასზე მორალურ პასუხისმგებლობას — ქარიც არის მიზეზი.' },
    ],
    socraticQuestions: [
      'თუ ადამიანის ხასიათი მთლიანად გენებმა და აღზრდამ შექმნა, რას ვაკუთვნებთ საყვედურს?',
      'პასუხისმგებლობა „დიახ ან არა"-ა, თუ ხარისხის საკითხი? რა შემთხვევა გაფიქრებინებს მეორეს?',
    ],
    misunderstandings: [
      'პასუხისმგებლობის უარყოფა არ ნიშნავს სასჯელის უარყოფას — ის სასჯელის *გამართლების* შეცვლას ნიშნავს.',
    ],
    sources: [sep('Moral Responsibility', 'moral-responsibility')],
  },

  {
    id: 'ethics',
    label: 'ეთიკა',
    topicId: 'ethics-frameworks',
    definition:
      'ნორმატიული ეთიკა ცდილობს ჩამოაყალიბოს, რა ხდის ქმედებას სწორად ან არასწორად.',
    simple:
      'სამი განსხვავებული კითხვაა: რა შედეგი მოჰყვება? რომელ წესს ვასრულებ? როგორ მოიქცეოდა კარგი ადამიანი?',
    positions: [
      { id: 'consequentialism', label: 'კონსეკვენციალიზმი', gloss: 'სწორია ის, რაც საუკეთესო შედეგს იძლევა' },
      { id: 'deontology', label: 'დეონტოლოგია', gloss: 'არსებობს წესები, რომლებიც შედეგის მიუხედავად უნდა დაიცვა' },
      { id: 'virtue-ethics', label: 'სათნოების ეთიკა', gloss: 'კითხვა ქმედებაზე კი არა, ხასიათზეა' },
    ],
    claims: [
      'ფაქტი იმისა, თუ როგორ არის, თავისთავად არ გვეუბნება, როგორ უნდა იყოს.',
      'მორალური ინტუიცია მონაცემია, არა საბოლოო პასუხი.',
    ],
    argumentsFor: [
      {
        id: 'eth-util-impartial',
        title: 'მიუკერძოებლობის არგუმენტი',
        premises: [
          'ყველას კეთილდღეობა თანაბრად მნიშვნელოვანია.',
          'სწორი ქმედება უნდა ითვალისწინებდეს ყველას თანაბრად.',
        ],
        conclusion: 'სწორია ის, რაც ჯამურ კეთილდღეობას მაქსიმალურად ზრდის.',
        supports: 'consequentialism',
      },
      {
        id: 'eth-deon-dignity',
        title: 'ღირსების არგუმენტი',
        premises: [
          'ადამიანს აქვს ღირსება, რომელიც არ ექვემდებარება გამოთვლას.',
          'ჯამური სიკეთის მაქსიმიზაცია დაუშვებს ცალკეული ადამიანის იარაღად გამოყენებას.',
        ],
        conclusion: 'საჭიროა წესები, რომლებიც შედეგზე მაღლა დგას.',
        supports: 'deontology',
      },
    ],
    argumentsAgainst: [
      {
        id: 'eth-util-sacrifice',
        title: 'მსხვერპლის პრობლემა',
        premises: [
          'მკაცრი უტილიტარიზმი ითვლის მხოლოდ ჯამს.',
          'ჯამი შეიძლება გაიზარდოს უმცირესობის მძიმე ზიანით.',
        ],
        conclusion: 'მკაცრი უტილიტარიზმი ამართლებს იმას, რასაც უმეტესობა მიუღებლად თვლის.',
        supports: 'deontology',
      },
      {
        id: 'eth-deon-rigid',
        title: 'სიხისტის პრობლემა',
        premises: [
          'დეონტოლოგიური წესები შედეგზე არ არის დამოკიდებული.',
          'ზოგჯერ წესის დაცვა კატასტროფულ შედეგს იძლევა.',
        ],
        conclusion: 'მკაცრი დეონტოლოგია ზოგჯერ აშკარად არასწორ პასუხს აძლევს.',
        supports: 'consequentialism',
      },
    ],
    objections: [
      {
        id: 'obj-virtue-circular',
        target: 'virtue-ethics',
        text: '„მოიქეცი როგორც სათნო ადამიანი" წრიულია: სათნო ადამიანს ისედაც სწორი ქმედებით განვსაზღვრავთ.',
        response:
          'პასუხი: სათნოებები დამოუკიდებლად აღიწერება (გამბედაობა, პატიოსნება, ზომიერება) და აღზრდით ვითარდება.',
      },
    ],
    assumptions: [
      'არსებობს ერთი საზომი, რომლითაც სხვადასხვა სიკეთე შეიძლება შევადაროთ.',
      'მორალური კითხვას აქვს ერთადერთი სწორი პასუხი.',
    ],
    thoughtExperiments: [
      {
        id: 'te-trolley',
        label: 'ტრამვაის ამოცანა',
        setup:
          'ტრამვაი ხუთ ადამიანს გაუქანდება. შეგიძლია გადაიყვანო სხვა ლიანდაგზე, სადაც ერთი ადამიანია.',
        tests: 'ამოწმებს, აქვს თუ არა მნიშვნელობა განსხვავებას „მოვახდინე" და „დავუშვი" შორის.',
      },
      {
        id: 'te-lying-murderer',
        label: 'მკვლელი კარებთან',
        setup: 'მკვლელი გეკითხება, სად იმალება მისი მსხვერპლი. სიმართლის თქმა ადამიანს დაღუპავს.',
        tests: 'ამოწმებს, არის თუ არა წესი „არ მოტყუო" გამონაკლისის გარეშე.',
      },
    ],
    examples: [
      'თვითმართვადი ავტომობილის პროგრამირებისას ვიღაცამ უნდა გადაწყვიტოს, რომელი პრინციპი ჩაიწეროს კოდში.',
      'სამედიცინო ტრიაჟი კატასტროფის დროს პირდაპირ კონსეკვენციალისტური გამოთვლაა.',
    ],
    relatedConcepts: ['moral-responsibility', 'justice'],
    distinctions: [
      { a: 'აღწერითი', b: 'ნორმატიული', note: '„როგორ იქცევიან ადამიანები" და „როგორ უნდა იქცეოდნენ" სხვადასხვა კითხვაა.' },
      { a: 'ქმედება', b: 'დაშვება', note: 'რაღაცის გაკეთება და რაღაცის მოხდენის დაშვება ბევრ ჩარჩოში სხვადასხვაგვარად ფასდება.' },
    ],
    socraticQuestions: [
      'შენი წესი რომ ყველას გამოეყენებინა, სამყარო უკეთესი იქნებოდა თუ უარესი?',
      'თუ შედეგი ერთადერთი მნიშვნელოვანია, რა გიშლის ხელს ერთი უდანაშაულოს გაწირვაში ხუთის სასიკეთოდ?',
      'რომელი შემთხვევა გაფიქრებინებდა, რომ შენი პრინციპი გამონაკლისს საჭიროებს?',
    ],
    misunderstandings: [
      'უტილიტარიზმი არ ნიშნავს „მიზანი ამართლებს საშუალებას" — ის საშუალების ზიანსაც ითვლის.',
      'დეონტოლოგია არ ნიშნავს შედეგების იგნორირებას, არამედ იმას, რომ ზოგი წესი მათზე მაღლა დგას.',
    ],
    sources: [sep('Consequentialism', 'consequentialism'), brit('Ethics', 'topic/ethics-philosophy')],
  },

  {
    id: 'knowledge',
    label: 'ცოდნა',
    topicId: 'theory-of-knowledge',
    definition:
      'ეპისტემოლოგია სწავლობს, რა არის ცოდნა და როგორ განსხვავდება ის უბრალო რწმენისგან.',
    simple:
      'ცოდნა სწორი გამოცნობა არ არის. კლასიკური მოთხოვნაა სამი: გჯეროდეს, მართალი იყოს, და კარგი საფუძველი გქონდეს.',
    positions: [
      { id: 'rationalism', label: 'რაციონალიზმი', gloss: 'ცოდნის საიმედო წყარო გონებაა' },
      { id: 'empiricism', label: 'ემპირიზმი', gloss: 'ყოველი ცოდნა გამოცდილებიდან იწყება' },
      { id: 'fallibilism', label: 'ფალიბილიზმი', gloss: 'შესაძლებელია ვცდებოდე მაშინაც, როცა კარგი საფუძველი მაქვს' },
    ],
    claims: [
      'გეტიეს მაგალითებმა აჩვენა, რომ დასაბუთებული ჭეშმარიტი რწმენა ცოდნისთვის საკმარისი არ არის.',
      'ცოდნის წყაროებია აღქმა, მეხსიერება, ჩვენება და დასკვნა — თითოეულს თავისი სისუსტე აქვს.',
      'ჰიუმმა აჩვენა, რომ ინდუქციას ლოგიკური გამართლება არ აქვს.',
    ],
    argumentsFor: [
      {
        id: 'kn-testimony',
        title: 'სოციალური ცოდნის არგუმენტი',
        premises: [
          'ყველაფრის თავად შემოწმება ფიზიკურად შეუძლებელია.',
          'მაინც ვამბობთ, რომ ბევრი რამ „ვიცით".',
        ],
        conclusion: 'ცოდნა ნაწილობრივ სოციალურია — ის ინსტიტუტებსა და პროცედურებს ეყრდნობა.',
        supports: 'fallibilism',
      },
    ],
    argumentsAgainst: [
      {
        id: 'kn-skeptic',
        title: 'სკეპტიკური არგუმენტი',
        premises: [
          'ვერ გამოვრიცხავ, რომ სისტემატურად ვცდები.',
          'ცოდნა მოითხოვს ასეთი შესაძლებლობის გამორიცხვას.',
        ],
        conclusion: 'თითქმის არაფერი ვიცი.',
        supports: 'rationalism',
      },
    ],
    objections: [
      {
        id: 'obj-skeptic-selfdefeat',
        target: 'kn-skeptic',
        text: 'თუ არაფერი ვიცი, მაშინ არც ის ვიცი, რომ არაფერი ვიცი — არგუმენტი საკუთარ თავს ჭამს.',
        response:
          'პასუხი: ზომიერი სკეპტიციზმი არაფერს არ უარყოფს, მხოლოდ დასაბუთების მაღალ ზღვარს ითხოვს.',
      },
    ],
    assumptions: [
      'დასაბუთება ცოდნისთვის საკმარისია.',
      'ჭეშმარიტება რწმენისგან დამოუკიდებელია.',
    ],
    thoughtExperiments: [
      {
        id: 'te-gettier',
        label: 'გაჩერებული საათი',
        setup:
          'საათი გუშინ გაჩერდა 3-ზე. დღეს ზუსტად 3 საათია და შენ მას უყურებ. სწორად გგონია და დასაბუთებაც გაქვს.',
        tests: 'ამოწმებს, საკმარისია თუ არა დასაბუთებული ჭეშმარიტი რწმენა ცოდნისთვის.',
      },
    ],
    examples: [
      'სასამართლო წინასწარ განსაზღვრავს, რა ითვლება მტკიცებულებად — ეს ეპისტემოლოგიური გადაწყვეტილებაა.',
      'როცა მოდელის პასუხს ვენდობით, კითხვა ისმის: ეს ცოდნაა თუ ნდობა?',
    ],
    relatedConcepts: ['skepticism', 'free-will'],
    distinctions: [
      { a: 'რწმენა', b: 'ცოდნა', note: 'რწმენა შეიძლება მცდარი იყოს; ცოდნა განსაზღვრებით ჭეშმარიტია.' },
      { a: 'დარწმუნებულობა', b: 'დასაბუთება', note: 'ძლიერი განცდა არ არის საფუძველი.' },
    ],
    socraticQuestions: [
      'რა უნდა მომხდარიყო, რომ შენ თვითონ თქვა „მაშინ ეს არ ვიცოდი"?',
      'რით განსხვავდება „დარწმუნებული ვარ" და „საფუძველი მაქვს"?',
      'თუ სწორ პასუხს შემთხვევით მიაგნებ, ცოდნა იყო თუ იღბალი?',
    ],
    misunderstandings: [
      'სკეპტიციზმი უარყოფა კი არა, სიფრთხილეა — მოთხოვნა, რომ პრეტენზია საფუძველს დაეყრდნოს.',
    ],
    sources: [sep('The Analysis of Knowledge', 'knowledge-analysis'), brit('Epistemology', 'topic/epistemology')],
  },

  {
    id: 'consciousness',
    label: 'ცნობიერება',
    definition:
      'ცნობიერება არის ის, რომ არსებობს „როგორია იყო" ვინმე — სუბიექტური განცდა, რომელიც ფიზიკურ აღწერას თითქოს გაურბის.',
    simple:
      'ტვინის სრული ფიზიკური აღწერა შეიძლება გვქონდეს და მაინც არ გვეპასუხოს: რატომ ახლავს ამ პროცესს განცდა?',
    positions: [
      { id: 'physicalism', label: 'ფიზიკალიზმი', gloss: 'ცნობიერება ფიზიკური პროცესებით ამოიწურება' },
      { id: 'dualism', label: 'დუალიზმი', gloss: 'გონება და სხეული სხვადასხვა ბუნებისაა' },
      { id: 'functionalism', label: 'ფუნქციონალიზმი', gloss: 'მნიშვნელოვანია როლი, არა მასალა — იგივე ფუნქცია იგივე გონებას იძლევა' },
    ],
    claims: [
      'ე.წ. „რთული პრობლემა" კითხულობს, რატომ ახლავს ფიზიკურ პროცესს სუბიექტური განცდა.',
      'ფუნქციონალიზმის მიხედვით, გონება მასალაზე კი არა, ორგანიზაციაზეა დამოკიდებული.',
    ],
    argumentsFor: [
      {
        id: 'cs-multiple-realization',
        title: 'მრავალგვარი რეალიზაციის არგუმენტი',
        premises: [
          'ერთი და იგივე ფუნქცია სხვადასხვა ფიზიკურ სისტემაში შეიძლება განხორციელდეს.',
          'გონებრივი მდგომარეობები ფუნქციებით განისაზღვრება.',
        ],
        conclusion: 'გონება არ არის მიბმული კონკრეტულ ბიოლოგიურ მასალაზე.',
        supports: 'functionalism',
      },
    ],
    argumentsAgainst: [
      {
        id: 'cs-knowledge-argument',
        title: 'ცოდნის არგუმენტი',
        premises: [
          'შესაძლებელია ვიცოდე ფერის ხედვის მთელი ფიზიკა და არასდროს მენახოს ფერი.',
          'ფერის დანახვისას ახალ რამეს ვიგებ.',
        ],
        conclusion: 'ფიზიკური ცოდნა ყველაფერს არ ამოწურავს.',
        supports: 'dualism',
      },
    ],
    objections: [
      {
        id: 'obj-knowledge-ability',
        target: 'cs-knowledge-argument',
        text: 'შესაძლოა ახალი „ცოდნა" ფაქტი კი არა, ახალი უნარი იყოს — წარმოდგენისა და ამოცნობის.',
        response: 'პასუხი: ამ შემთხვევაშიც უნდა აიხსნას, რატომ ჰგავს განცდა ფაქტის შეტყობას.',
      },
    ],
    assumptions: [
      'ფიზიკური აღწერა პრინციპში სრული შეიძლება იყოს.',
      'სუბიექტური განცდა ერთიანი, განუყოფელი მოვლენაა.',
    ],
    thoughtExperiments: [
      {
        id: 'te-mary',
        label: 'ოთახში გაზრდილი მეცნიერი',
        setup:
          'მეცნიერმა იცის ფერის ხედვის სრული ფიზიკა, მაგრამ მთელი ცხოვრება შავ-თეთრ ოთახში გაატარა. ერთ დღეს გარეთ გამოდის.',
        tests: 'ამოწმებს, ამოწურავს თუ არა ფიზიკური ცოდნა ყველაფერს.',
      },
    ],
    examples: [
      'ანესთეზია გვიჩვენებს, რომ ცნობიერება შეიძლება გამოირთოს და ისევ ჩაირთოს — მაგრამ ეს არ გვეუბნება, რა არის ის.',
    ],
    relatedConcepts: ['personal-identity', 'knowledge', 'free-will'],
    distinctions: [
      { a: 'სიფხიზლე', b: 'განცდა', note: 'რეაქტიულობა და სუბიექტური განცდა სხვადასხვა რამაა; მანქანა პირველს ავლენს.' },
    ],
    socraticQuestions: [
      'რა დაგარწმუნებდა, რომ სხვა არსებას ნამდვილად აქვს განცდა და არა მხოლოდ ქცევა?',
      'თუ ნეირონებს თანდათან ჩაანაცვლებდი იდენტური ფუნქციის ჩიპებით, რომელ მომენტში გაქრებოდა განცდა?',
    ],
    misunderstandings: [
      'ცნობიერება არ არის იგივე, რაც ინტელექტი — მაღალი ინტელექტი განცდას არ გულისხმობს.',
    ],
    sources: [sep('Consciousness', 'consciousness')],
  },

  {
    id: 'personal-identity',
    label: 'პიროვნული იდენტობა',
    definition:
      'პიროვნული იდენტობა კითხულობს, რა ხდის დღევანდელ ადამიანს იმავე ადამიანად, ვინც ის ათი წლის წინ იყო.',
    simple:
      'შენი უჯრედები შეიცვალა, აზრები შეიცვალა, სხეული შეიცვალა. მაინც ამბობ „მე". რა არის ის, რაც არ შეცვლილა?',
    positions: [
      { id: 'psychological-continuity', label: 'ფსიქოლოგიური უწყვეტობა', gloss: 'იდენტობას მეხსიერებისა და ხასიათის ჯაჭვი ინარჩუნებს' },
      { id: 'biological-continuity', label: 'ბიოლოგიური უწყვეტობა', gloss: 'იდენტობა ორგანიზმის უწყვეტობაა' },
      { id: 'no-self', label: 'იდენტობის უარყოფა', gloss: 'მუდმივი „მე" არ არსებობს — არის მხოლოდ დაკავშირებული მდგომარეობების ნაკადი' },
    ],
    claims: [
      'ლოკის ტრადიციაში იდენტობის საზომი მეხსიერების უწყვეტობაა.',
      'გაორების შემთხვევები ფსიქოლოგიური კრიტერიუმისთვის სერიოზულ პრობლემას ქმნის.',
    ],
    argumentsFor: [
      {
        id: 'pi-memory',
        title: 'მეხსიერების არგუმენტი',
        premises: [
          'ადამიანი საკუთარ წარსულს შიგნიდან იხსენებს.',
          'სწორედ ეს კავშირი გვაფიქრებინებს, რომ ის იგივე ადამიანია.',
        ],
        conclusion: 'იდენტობა ფსიქოლოგიური უწყვეტობაა.',
        supports: 'psychological-continuity',
      },
    ],
    argumentsAgainst: [
      {
        id: 'pi-duplication',
        title: 'გაორების არგუმენტი',
        premises: [
          'თუ იდენტობა ფსიქოლოგიური უწყვეტობაა, ორი ზუსტი ასლი ორივე იქნებოდა „იგივე ადამიანი".',
          'ორი სხვადასხვა ადამიანი ერთი და იგივე ვერ იქნება.',
        ],
        conclusion: 'ფსიქოლოგიური კრიტერიუმი არასრულია.',
        supports: 'biological-continuity',
      },
    ],
    objections: [
      {
        id: 'obj-pi-what-matters',
        target: 'pi-duplication',
        text: 'შესაძლოა კითხვა „იგივე ადამიანია?" არასწორად დასმულია — მნიშვნელოვანია კავშირი, არა ვინაობა.',
        response: 'პასუხი: ამ შემთხვევაში პრაქტიკული საკითხები (დაპირება, სასჯელი, მემკვიდრეობა) ხელახლა უნდა გადაიწეროს.',
      },
    ],
    assumptions: [
      'იდენტობა „დიახ ან არა" საკითხია და არა ხარისხის.',
      'არსებობს ერთი ფაქტი, რომელიც საკითხს წყვეტს.',
    ],
    thoughtExperiments: [
      {
        id: 'te-ship',
        label: 'თესევსის ხომალდი',
        setup: 'ხომალდის ყოველი დაფა თანდათან იცვლება. მოგვიანებით ძველი დაფებისგან მეორე ხომალდი იკრიბება.',
        tests: 'ამოწმებს, მასალა განსაზღვრავს იდენტობას თუ ფორმა და უწყვეტობა.',
      },
      {
        id: 'te-teleport',
        label: 'ტელეპორტაცია',
        setup: 'მოწყობილობა სხეულს სკანირებს, ანადგურებს და სხვაგან ზუსტად აღადგენს.',
        tests: 'ამოწმებს, გადარჩენაა ეს თუ სიკვდილი და ასლის შექმნა.',
      },
    ],
    examples: [
      'სამართალი ვარაუდობს იდენტობის უწყვეტობას: ოცი წლის წინანდელი ქმედებისთვის დღეს სჯიან იმავე ადამიანს.',
    ],
    relatedConcepts: ['consciousness', 'moral-responsibility'],
    distinctions: [
      { a: 'რაობრივი იგივეობა', b: 'ხარისხობრივი მსგავსება', note: 'ორი იდენტური ბურთი ერთმანეთის მსგავსია, მაგრამ ერთი და იგივე არაა.' },
    ],
    socraticQuestions: [
      'თუ ხვალ ყველა მოგონებას დაკარგავ, იგივე ადამიანი იქნები?',
      'რას ზრუნავ სინამდვილეში — იმაზე, რომ *შენ* გადარჩე, თუ იმაზე, რომ ვიღაც შენნაირი გააგრძელოს?',
    ],
    misunderstandings: [
      'უჯრედების განახლება იდენტობის საკითხს არ წყვეტს — ის მხოლოდ აჩვენებს, რომ მასალა ვერ იქნება პასუხი.',
    ],
    sources: [sep('Personal Identity', 'identity-personal')],
  },

  {
    id: 'justice',
    label: 'სამართლიანობა',
    topicId: 'rights-and-constitutions',
    definition:
      'სამართლიანობა ეხება იმას, როგორ უნდა განაწილდეს სიკეთეები, ტვირთი და უფლებები საზოგადოებაში.',
    simple:
      'კითხვა არაა „ვის რა უნდა". კითხვაა, რომელი განაწილება იქნებოდა გამართლებული ისეთი ადამიანისთვისაც, ვინც არ იცის, რომელი ადგილი ერგება.',
    positions: [
      { id: 'egalitarian', label: 'ეგალიტარიზმი', gloss: 'თანასწორობა თავისთავად ღირებულებაა' },
      { id: 'libertarian-justice', label: 'ლიბერტარიანიზმი', gloss: 'სამართლიანია ის, რაც ნებაყოფლობითი გაცვლით მიიღწევა' },
      { id: 'utilitarian-justice', label: 'უტილიტარისტული', gloss: 'სამართლიანია ის განაწილება, რომელიც ჯამურ კეთილდღეობას ზრდის' },
    ],
    claims: [
      'უმრავლესობის გადაწყვეტილება და უფლება ერთმანეთს ეწინააღმდეგება, როცა უმრავლესობა უმცირესობის უფლებას ზღუდავს.',
      'კონსტიტუციის ერთ-ერთი მიზანი სწორედ ამ კონფლიქტის მოგვარებაა.',
    ],
    argumentsFor: [
      {
        id: 'js-veil',
        title: 'უცოდინრობის ფარდის არგუმენტი',
        premises: [
          'სამართლიანი წესი ისეთია, რომელსაც მიიღებდი შენი ადგილის ცოდნის გარეშე.',
          'ასეთ პირობებში ადამიანი ყველაზე ცუდი ვარიანტის დაზღვევას ეცდება.',
        ],
        conclusion: 'სამართლიანი წესრიგი ყველაზე დაუცველთა მდგომარეობას აუმჯობესებს.',
        supports: 'egalitarian',
      },
    ],
    argumentsAgainst: [
      {
        id: 'js-entitlement',
        title: 'უფლებამოსილების არგუმენტი',
        premises: [
          'თუ საკუთრება სამართლიანად შეიძინე და ნებაყოფლობით გასცემ, უსამართლობა არსად მოხდა.',
          'განაწილების შედეგის შესწორება ვიღაცის ნებაყოფლობით არჩევანს არღვევს.',
        ],
        conclusion: 'სამართლიანობა პროცედურულია, არა შედეგობრივი.',
        supports: 'libertarian-justice',
      },
    ],
    objections: [
      {
        id: 'obj-js-starting-point',
        target: 'js-entitlement',
        text: 'პროცედურა მხოლოდ მაშინაა სამართლიანი, თუ საწყისი წერტილიც სამართლიანი იყო — ისტორიულად ის იშვიათად არის.',
        response: 'პასუხი: ამიტომ ზოგი ავტორი წარსული უსამართლობის გამოსწორებას ცალკე პრინციპად აყენებს.',
      },
    ],
    assumptions: [
      'არსებობს ერთი საზომი, რომლითაც სხვადასხვა ადამიანის კეთილდღეობა შედარებადია.',
      'საწყისი განაწილება ნეიტრალურია.',
    ],
    thoughtExperiments: [
      {
        id: 'te-veil',
        label: 'უცოდინრობის ფარდა',
        setup:
          'ირჩევ საზოგადოების წესებს, მაგრამ არ იცი, ვინ იქნები მასში — მდიდარი თუ ღარიბი, ჯანმრთელი თუ არა.',
        tests: 'ამოწმებს, რომელი პრინციპები გადარჩება მიუკერძოებელ არჩევანს.',
      },
    ],
    examples: [
      'პროგრესული გადასახადი ეგალიტარულ არგუმენტს ეყრდნობა; ბრტყელი გადასახადი — პროცედურულს.',
      'კონსტიტუციური სასამართლო სწორედ იმისთვის არსებობს, რომ უმრავლესობამ უფლება ვერ გააუქმოს.',
    ],
    relatedConcepts: ['ethics', 'moral-responsibility'],
    distinctions: [
      { a: 'თანასწორობა', b: 'სამართლიანობა', note: 'თანაბარი განაწილება და დამსახურებული განაწილება ხშირად სხვადასხვა შედეგს იძლევა.' },
      { a: 'ფორმალური უფლება', b: 'რეალური შესაძლებლობა', note: 'უფლების ქონა და მისი გამოყენების შესაძლებლობა ერთი და იგივე არაა.' },
    ],
    socraticQuestions: [
      'რომელ წესს აირჩევდი, საკუთარი ადგილი რომ არ გცოდნოდა?',
      'თუ პროცედურა სამართლიანია, მაგრამ შედეგი აშკარად უსამართლო — რომელს ენდობი?',
    ],
    misunderstandings: [
      'სამართლიანობა არ ნიშნავს ყველასთვის ერთნაირს — ის ნიშნავს გამართლებულ განსხვავებას.',
    ],
    sources: [sep('Justice', 'justice'), brit('Justice', 'topic/justice')],
  },
];

/* ------------------------------ relations ------------------------------- */

/**
 * The lightweight argument graph. Nodes are concept ids, position ids,
 * argument ids and objection ids from above.
 */
export const ARGUMENT_RELATIONS: ArgumentRelation[] = [
  { from: 'hard-determinism', to: 'libertarian-fw', kind: 'contradicts' },
  { from: 'compatibilism', to: 'hard-determinism', kind: 'responds_to', note: 'ტერმინის გადააზრებით' },
  { from: 'compatibilism', to: 'libertarian-fw', kind: 'distinguishes_from' },
  { from: 'fw-causal-closure', to: 'hard-determinism', kind: 'supports' },
  { from: 'fw-randomness', to: 'libertarian-fw', kind: 'challenges' },
  { from: 'fw-experience', to: 'libertarian-fw', kind: 'supports' },
  { from: 'obj-compat-shallow', to: 'compatibilism', kind: 'challenges' },
  { from: 'te-libet', to: 'libertarian-fw', kind: 'counterexample_to' },
  { from: 'free-will', to: 'moral-responsibility', kind: 'depends_on' },
  { from: 'mr-requires-alternatives', to: 'free-will', kind: 'assumes' },
  { from: 'te-frankfurt', to: 'mr-requires-alternatives', kind: 'counterexample_to' },
  { from: 'mr-luck', to: 'mr-requires-alternatives', kind: 'supports' },

  { from: 'consequentialism', to: 'deontology', kind: 'contradicts' },
  { from: 'eth-util-sacrifice', to: 'consequentialism', kind: 'challenges' },
  { from: 'eth-deon-rigid', to: 'deontology', kind: 'challenges' },
  { from: 'te-trolley', to: 'consequentialism', kind: 'example_of' },
  { from: 'te-lying-murderer', to: 'deontology', kind: 'counterexample_to' },
  { from: 'virtue-ethics', to: 'consequentialism', kind: 'distinguishes_from' },
  { from: 'ethics', to: 'justice', kind: 'related_to' },

  { from: 'te-gettier', to: 'knowledge', kind: 'counterexample_to', note: 'დასაბუთებულ ჭეშმარიტ რწმენას' },
  { from: 'kn-skeptic', to: 'knowledge', kind: 'challenges' },
  { from: 'obj-skeptic-selfdefeat', to: 'kn-skeptic', kind: 'responds_to' },
  { from: 'fallibilism', to: 'kn-skeptic', kind: 'responds_to' },

  { from: 'cs-knowledge-argument', to: 'physicalism', kind: 'challenges' },
  { from: 'cs-multiple-realization', to: 'functionalism', kind: 'supports' },
  { from: 'te-mary', to: 'physicalism', kind: 'counterexample_to' },
  { from: 'consciousness', to: 'personal-identity', kind: 'related_to' },

  { from: 'pi-duplication', to: 'psychological-continuity', kind: 'challenges' },
  { from: 'te-ship', to: 'personal-identity', kind: 'example_of' },
  { from: 'te-teleport', to: 'psychological-continuity', kind: 'counterexample_to' },

  { from: 'js-veil', to: 'egalitarian', kind: 'supports' },
  { from: 'js-entitlement', to: 'libertarian-justice', kind: 'supports' },
  { from: 'obj-js-starting-point', to: 'js-entitlement', kind: 'challenges' },
];

/* -------------------------------- indexes ------------------------------- */

export const philosophyById = new Map(PHILOSOPHY.map((c) => [c.id, c]));

/** Concept ids reachable by a topic id, for cross-linking with the library. */
export const philosophyByTopic = new Map<string, PhilosophyConcept[]>();
for (const concept of PHILOSOPHY) {
  if (!concept.topicId) continue;
  const bucket = philosophyByTopic.get(concept.topicId);
  if (bucket) bucket.push(concept);
  else philosophyByTopic.set(concept.topicId, [concept]);
}

export function relationsFor(id: string): ArgumentRelation[] {
  return ARGUMENT_RELATIONS.filter((r) => r.from === id || r.to === id);
}

/** Every id the argument graph may legally reference — used by the tests. */
export function philosophyNodeIds(): Set<string> {
  const ids = new Set<string>();
  for (const c of PHILOSOPHY) {
    ids.add(c.id);
    for (const p of c.positions) ids.add(p.id);
    for (const a of [...c.argumentsFor, ...c.argumentsAgainst]) ids.add(a.id);
    for (const o of c.objections) ids.add(o.id);
    for (const te of c.thoughtExperiments) ids.add(te.id);
  }
  return ids;
}
