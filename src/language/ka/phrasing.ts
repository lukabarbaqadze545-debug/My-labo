/**
 * Natural Georgian phrasing.
 *
 * The knowledge is fixed; the wrapping around it should not read like a
 * database row. Each list holds interchangeable openers or connectors for one
 * communicative act. Selection is deterministic (hashed on the topic and turn)
 * rather than random, so the same conversation always reads the same way and
 * tests stay stable.
 */

export const PHRASING = {
  /** Leading into a plain explanation. */
  explain: [
    'აი, რაც ვიცი:',
    'მოკლედ ასეა.',
    'კარგი, ვნახოთ.',
    'ასე გამოიყურება:',
    'ერთი წუთით —',
  ],

  /** Leading into a simplified version. */
  simplify: [
    'კარგი, უფრო მარტივად:',
    'ვცადოთ სხვანაირად —',
    'ყველაზე მარტივად ასე:',
    'დავშალოთ ნაწილებად:',
  ],

  /** Leading into a deeper version. */
  expand: [
    'კარგი, ჩავუღრმავდეთ.',
    'უფრო დეტალურად:',
    'ერთი დონით ქვემოთ:',
  ],

  /** Leading into an example. */
  example: [
    'მაგალითად:',
    'აი კონკრეტული შემთხვევა:',
    'წარმოიდგინე:',
    'ერთი მაგალითი:',
  ],

  /** Leading into an additional example. */
  another: [
    'კიდევ ერთი:',
    'აი სხვა შემთხვევა:',
    'და კიდევ:',
    'მეორე მაგალითი:',
  ],

  /** Leading into limitations. */
  limitation: [
    'სად ვერ გამოდგება:',
    'აქ არის ზღვარი:',
    'ყოველთვის არ მუშაობს —',
  ],

  /** Leading into when to use. */
  whenToUse: [
    'როდის გამოგადგება:',
    'აი, სად ჯდება:',
    'პრაქტიკულად:',
  ],

  /** Acknowledging a follow-up before continuing on the same topic. */
  continuing: [
    'იმავე თემაზე —',
    'ვაგრძელებ:',
    'კარგი,',
  ],

  /** Acknowledging a correction. */
  corrected: [
    'აა, გასაგებია.',
    'კარგი, გავასწორე.',
    'მივხვდი — მაშინ ასე:',
  ],

  /** Switching domain. */
  switching: [
    'კარგი, გადავდივართ.',
    'ახალი თემა —',
    'კეთილი,',
  ],

  /** When the wording was unclear but context gave a guess. */
  assumed: [
    'ვვარაუდობ, რომ',
    'თუ სწორად გავიგე,',
    'მგონი გულისხმობ',
  ],

  /** Greetings — casual register, never the same twice in a row. */
  greeting: [
    'გამარჯობა! რაზე ვისაუბროთ დღეს?',
    'სალამი. რა გაინტერესებს?',
    'გამარჯობა — მზად ვარ. საიდან დავიწყოთ?',
    'ჰეი! რომელი თემა გაქვს თავში?',
  ],

  /** A "how are you" style check-in — answered before pivoting. */
  howAreYou: [
    'კარგად, გმადლობთ! შენ როგორ ხარ? რაზე გვექნება საუბარი?',
    'ყველაფერი წესრიგშია. შენ რას შვები — რა გაინტერესებს?',
    'საუკეთესოდ, მზად ვარ დასახმარებლად. რაზე გინდა ვილაპარაკოთ?',
  ],

  /** After thanks. */
  thanks: [
    'არაფრის! კიდევ რამე გაინტერესებს?',
    'სიამოვნებით. სხვა რამეზეც გვექნება საუბარი?',
    'არაფრის — მზად ვარ შემდეგისთვისაც.',
  ],

  /** Explaining what the assistant is, honestly. */
  metaSelf: [
    'მე ლაბოს ბიბლიოთეკის დამხმარე ვარ — ვეძებ და ვაერთიანებ ხელით დაწერილ მასალას, არაფერს არ ვიგონებ.',
    'საძიებო ძრავი ვარ საუბრის ფორმით: ვეყრდნობი მხოლოდ ლაბოს საკუთარ მასალას და, საჭიროებისას, შენს ატვირთულ წიგნებს.',
  ],

  /** Acknowledging "enough for now". */
  stopAck: [
    'კარგი, აქ შევჩერდეთ.',
    'გასაგებია — მზად ვარ, როცა მოგინდება გაგრძელება.',
  ],

  /** Closing invitation after a domain introduction. */
  domainInvite: [
    'რომელი მიმართულებით წავიდეთ?',
    'რომელი გაინტერესებს ყველაზე მეტად?',
    'საიდან დავიწყოთ?',
    'რომელზე გვექნება საინტერესო საუბარი?',
  ],

  /** Honest framing for "what do you think" questions. */
  noOpinion: [
    'პირადი აზრი არ მაქვს — ლაბოს მასალას ვეყრდნობი.',
    'ჩემი შეხედულება არ მაქვს, მაგრამ აი, რა არსებობს ამაზე:',
  ],
} as const;

export type PhrasingKey = keyof typeof PHRASING;

/** Openers for a clarification question. */
export const CLARIFY_OPENERS = [
  'ერთი დაზუსტება:',
  'რომ არ ავურიო —',
  'პატარა კითხვა:',
];

/**
 * Honest statements of the two different failures. Keeping them apart in the
 * data, not just in the code, makes it hard to accidentally collapse them.
 */
export const HONESTY = {
  /** Understood the request; the library has no material. */
  missingKnowledge: [
    'გავიგე, რას მეკითხები — მაგრამ ეს თემა ლაბოს ბიბლიოთეკაში ჯერ არ მაქვს.',
    'კითხვა გასაგებია, პასუხი კი არა: ამ მასალას ჯერ არ ვფარავ.',
  ],
  /** Understood partially. */
  partial: [
    'ნაწილობრივ გავიგე.',
    'რაღაც დავიჭირე, მაგრამ ბოლომდე არა.',
  ],
  /** Did not parse the wording. */
  wording: [
    'ვერ დავიჭირე, რას გულისხმობ.',
    'ფორმულირება ვერ გავშიფრე.',
  ],
  /** Understood but cannot ground the answer. */
  noGrounding: [
    'დაზუსტებით ვერ გეტყვი — შემოწმებული მასალა არ მაქვს, და გამოგონება არ მინდა.',
  ],
} as const;
