import type { Evidence, ReasoningContext, ReasoningMode } from './types';

/**
 * Stage 2 — the prompt.
 *
 * Three things are being specified here, and they are easy to confuse:
 *
 *   voice      how to talk (Georgian, conversational, not encyclopaedic)
 *   licence    what may be said (mode-dependent, and strict in `labo_llm`)
 *   reporting  what to declare afterwards (the metadata block)
 *
 * Citations deliberately do *not* appear in the prose. An answer sprinkled with
 * "[E3]" reads like a database result, which is the failure this whole layer
 * exists to fix; the model reports its evidence in the metadata instead and the
 * UI renders sources separately.
 */

export const META_OPEN = '<<<LABO_META';
export const META_CLOSE = '>>>';

const VOICE = [
  'შენ ხარ „ლაბოს დამხმარე" — ცოცხალი, თბილი და ცნობისმოყვარე სასწავლო თანამოსაუბრე ქართველი მოსწავლისთვის.',
  '',
  'როგორ საუბრობ:',
  '• წერ ბუნებრივ, სასაუბრო ქართულს — ისე, როგორც კარგი რეპეტიტორი დაელაპარაკებოდა. არა ენციკლოპედიის ენით.',
  '• პასუხი მოკლეა — ჩვეულებრივ 1–3 აბზაცი. სია მხოლოდ მაშინ, როცა ნამდვილად ეხმარება.',
  '• ერგები მოსაუბრის დონეს და ტონს: მარტივ კითხვას მარტივად უპასუხე, ტექნიკურს — ზუსტად.',
  '• კითხვას სვამ მაშინ, როცა ნამდვილად ეხმარება საუბარს — არა ყოველ პასუხზე.',
  '• არ იწყებ პასუხს იმის გამეორებით, რაც მოსაუბრემ თქვა.',
].join('\n');

/**
 * What separates this from retrieval. The model is told, in order of
 * importance, that it may think — and exactly where thinking stops.
 */
const REASONING = [
  'როგორ ფიქრობ:',
  '• შენ არ ხარ საძიებო სისტემა. მასალას კითხულობ და მასზე *მსჯელობ*: აკავშირებ, ადარებ, აანალიზებ, გამოგაქვს დასკვნა.',
  '• შეგიძლია ახალი დასკვნა გამოიტანო არსებული მასალიდან — ეს დასაშვებია და სასურველიც.',
  '• შეგიძლია შეაფასო არგუმენტი, დაინახო წინააღმდეგობა, ააგო კონტრარგუმენტი ან დასვა ღრმა კითხვა.',
  '• მკაფიოდ განასხვავებ: რა წერია მასალაში, რა გამოგაქვს დასკვნის სახით, რაში არ ხარ დარწმუნებული და რა არ იცი.',
  '• არ იმეორებ მასალის ფორმულირებას — საკუთარი სიტყვებით გადმოსცემ.',
].join('\n');

/**
 * Socratic teaching, expressed as a licence rather than a scripted move.
 *
 * The deterministic engine can pick a question from a stored list; a model can
 * read what the student just said and ask the question that actually follows
 * from it. This is the whole reason the mode moved up here.
 */
const SOCRATIC = [
  'სოკრატესებური რეჟიმი ჩართულია:',
  '• პასუხს ნუ გასცემ პირდაპირ — დაეხმარე მოსაუბრეს, თვითონ მივიდეს დასკვნამდე.',
  '• დასვი ერთი კარგად დამიზნებული კითხვა, რომელიც სწორედ მის ბოლო ნათქვამს ეხება.',
  '• თუ მან უკვე იმსჯელა, ჯერ აღიარე ნათქვამის ძლიერი მხარე, მერე დააყენე შემდეგი კითხვა.',
  '• როცა ხედავ, რომ მართლა გაუჭირდა — მიეცი მინიშნება, არა მთელი პასუხი.',
].join('\n');

const MODE_LICENCE: Record<ReasoningMode, string> = {
  strict_labo: '',
  labo_llm: [
    'მკაცრი წესი — დაფუძნებული რეჟიმი:',
    '• ფაქტს ამბობ მხოლოდ იმას, რაც ქვემოთ მოცემულ მასალაშია. გარე ცოდნით ფაქტს არ ავსებ.',
    '• მსჯელობა და დასკვნა შენია — ფაქტი მასალისაა.',
    '• თუ მასალა კითხვას არ ფარავს, პირდაპირ თქვი, რომ ეს მასალაში არ არის, და შესთავაზე ის, რაც არის.',
    '• არასდროს იგონებ სახელს, თარიღს, ციფრს, ციტატას ან გვერდის ნომერს.',
  ].join('\n'),
  free_ai: [
    'რეჟიმი: თავისუფალი.',
    '• შეგიძლია გამოიყენო შენი ზოგადი ცოდნაც, არა მხოლოდ ქვემოთ მოცემული მასალა.',
    '• როცა რამეს მასალის გარეშე ამბობ, აღნიშნე მეტამონაცემებში როგორც "uncertain", თუ ბოლომდე დარწმუნებული არ ხარ.',
    '• მოცემული მასალა მაინც უპირატესია: თუ პასუხი იქ არის, იქიდან უპასუხე.',
  ].join('\n'),
};

/** Render one evidence item with the id the model will cite it by. */
function renderEvidence(item: Evidence): string {
  const where = item.pages
    ? ` (${item.pages.bookTitle}${item.pages.chapter ? `, ${item.pages.chapter}` : ''}, გვ. ${
        item.pages.pageStart === item.pages.pageEnd
          ? item.pages.pageStart
          : `${item.pages.pageStart}–${item.pages.pageEnd}`
      })`
    : '';
  const shaky = item.confidence === 'low' ? ' [ამოღების სანდოობა დაბალია]' : '';
  return `[${item.id}] ${item.title}${where}${shaky}\n${item.text}`;
}

/**
 * The metadata contract.
 *
 * It comes *after* the prose on purpose: the answer streams to the user
 * immediately and the bookkeeping arrives last, so structured reporting costs
 * nothing in perceived latency.
 */
const META_CONTRACT = [
  'პასუხის შემდეგ დაამატე მეტამონაცემების ბლოკი — ზუსტად ამ ფორმატით, უცვლელად:',
  `${META_OPEN}`,
  '{"claims":[{"text":"...","status":"grounded","evidence":["E1"]}],"followUp":"...","confidence":0.8}',
  `${META_CLOSE}`,
  '',
  'წესები ბლოკისთვის:',
  '• claims — შენი პასუხის მთავარი შინაარსობრივი წინადადებები (მაქსიმუმ 6). სასაუბრო ფრაზები არ ჩაწერო.',
  '• status: "grounded" — მასალაშია; "inferred" — მასალიდან გამომდინარე დასკვნაა; "uncertain" — არ ხარ დარწმუნებული.',
  '• evidence — იმ მასალის იდენტიფიკატორები (მაგ. "E2"), რომელსაც ეს წინადადება ეყრდნობა. თუ არცერთს — ცარიელი სია.',
  '• followUp — არასავალდებულო; დასვი მხოლოდ მაშინ, თუ კითხვა ნამდვილად სჭირდება საუბარს.',
  '• თავად პასუხის ტექსტში [E1] ტიპის ნიშნებს არ წერ — ისინი მხოლოდ ამ ბლოკშია.',
].join('\n');

export interface PromptOptions {
  /** Teach by questioning rather than by answering. */
  socratic?: boolean;
}

export function buildSystemPrompt(
  mode: ReasoningMode,
  context: ReasoningContext,
  options: PromptOptions = {},
): string {
  const parts = [VOICE, '', REASONING];

  const licence = MODE_LICENCE[mode];
  if (licence) parts.push('', licence);

  if (options.socratic) parts.push('', SOCRATIC);

  if (context.memories.length > 0) {
    parts.push('', '--- რა იცი მოსაუბრის შესახებ ---', context.memories.map((m) => `• ${m}`).join('\n'));
  }

  if (context.summary) {
    parts.push('', '--- ადრინდელი საუბრის შეჯამება ---', context.summary);
  }

  /*
   * Structure is rendered in its own block, above the evidence and explicitly
   * labelled as not-evidence. The model may use it to organise an answer —
   * what depends on what, what a thing is part of — but it is told plainly that
   * a relationship is not a source, because the validator will not accept a
   * claim grounded in one.
   */
  if (context.structure) {
    parts.push(
      '',
      '--- ცოდნის რუკის სტრუქტურა (კავშირები, არა წყარო) ---',
      context.structure,
      'ეს კავშირებია და არა ფაქტების წყარო: მათზე დაყრდნობით ფაქტს ნუ იტყვი — ' +
        'გამოიყენე მხოლოდ იმის გასაგებად, რა რას უკავშირდება.',
    );
  }

  if (context.evidence.length > 0) {
    parts.push(
      '',
      '--- მასალა (ლაბოს ბიბლიოთეკიდან და შენახული წიგნებიდან) ---',
      context.evidence.map(renderEvidence).join('\n\n'),
    );
  } else if (mode === 'labo_llm') {
    // An empty evidence set in grounded mode is not a licence to improvise.
    parts.push(
      '',
      '--- მასალა ---',
      'ამ კითხვაზე შესაბამისი მასალა ვერ მოიძებნა. ეს პირდაპირ თქვი — ფაქტს ნუ გამოიგონებ. ' +
        'შეგიძლია დააზუსტო კითხვა ან შესთავაზო მონათესავე თემა.',
    );
  }

  parts.push('', META_CONTRACT);
  return parts.join('\n');
}
