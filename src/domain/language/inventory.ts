import type { LanguageFunction, LanguageUnit, Position, Register } from './types';

/**
 * The seed inventory of Georgian discourse units.
 *
 * Function labels cannot be mined reliably — no amount of counting tells you
 * that „მეორე მხრივ" marks a contrast. So the *semantics* are authored here
 * once, and mining supplies the evidence: which of these a real corpus
 * actually uses, how often, and in which variants.
 *
 * Everything marked reusable with domain '*' is available to every subject in
 * Luka's Labo. A unit mined from Plato is usable in a sentence about binary
 * search, which is the entire point of separating language from content.
 */

let seq = 0;
function u(
  surface: string,
  fn: LanguageFunction,
  register: Register,
  position: Position,
  gloss: string,
  pattern?: string,
  forms: string[] = [],
): LanguageUnit {
  return {
    id: `lu_${seq++}`,
    kind: surface.includes(' ') ? 'phrase' : 'word',
    surface,
    forms: [surface, ...forms],
    function: fn,
    register,
    position,
    reusable: true,
    domains: ['*'],
    frequency: 0,
    attestedIn: [],
    ...(pattern ? { pattern } : {}),
    gloss,
  };
}

export const SEED_UNITS: LanguageUnit[] = [
  /* ------------------------------ contrast ------------------------------ */
  u('მეორე მხრივ', 'contrast', 'neutral', 'initial', 'on the other hand', '{A}. მეორე მხრივ, {B}.'),
  u('თუმცა', 'contrast', 'neutral', 'flexible', 'however', '{A}, თუმცა {B}.'),
  u('მაგრამ', 'contrast', 'neutral', 'medial', 'but', '{A}, მაგრამ {B}.'),
  u('პირიქით', 'contrast', 'neutral', 'initial', 'on the contrary', '{A}. პირიქით, {B}.'),
  u('საპირისპიროდ', 'contrast', 'formal', 'initial', 'by contrast'),
  u('განსხვავებით', 'contrast', 'formal', 'medial', 'unlike', '{A}-გან განსხვავებით, {B}.'),
  u('ამის საპირისპიროდ', 'contrast', 'formal', 'initial', 'as against this'),

  /* ----------------------------- concession ----------------------------- */
  u('მიუხედავად ამისა', 'concession', 'formal', 'initial', 'nevertheless'),
  u('მაინც', 'concession', 'neutral', 'medial', 'still, anyway'),
  u('ცხადია', 'concession', 'neutral', 'initial', 'admittedly / clearly', '{A}, ცხადია, {B}.'),
  u('რა თქმა უნდა', 'concession', 'neutral', 'flexible', 'of course'),

  /* ----------------------------- conclusion ----------------------------- */
  u('აქედან გამომდინარე', 'conclusion', 'formal', 'initial', 'therefore, it follows', '{A}. აქედან გამომდინარე, {B}.'),
  u('მაშასადამე', 'conclusion', 'academic', 'initial', 'therefore'),
  u('შესაბამისად', 'conclusion', 'formal', 'initial', 'accordingly', '{A}. შესაბამისად, {B}.'),
  u('ამრიგად', 'conclusion', 'academic', 'initial', 'thus'),
  u('ამიტომ', 'conclusion', 'neutral', 'initial', 'so, that is why', '{A}, ამიტომ {B}.'),
  u('ე.ი.', 'conclusion', 'neutral', 'initial', 'i.e., so'),
  u('ანუ', 'reformulation', 'neutral', 'medial', 'that is, in other words'),

  /* -------------------------------- cause ------------------------------- */
  u('იმიტომ რომ', 'cause', 'neutral', 'medial', 'because', '{A}, იმიტომ რომ {B}.'),
  u('რადგან', 'cause', 'neutral', 'medial', 'since, because', '{A}, რადგან {B}.'),
  u('ვინაიდან', 'cause', 'academic', 'initial', 'inasmuch as'),
  u('ამის გამო', 'cause', 'neutral', 'initial', 'because of this'),
  u('ამის მიზეზი', 'cause', 'neutral', 'initial', 'the reason for this', 'ამის მიზეზი {A}-ია.'),

  /* ------------------------------ condition ----------------------------- */
  u('თუ', 'condition', 'neutral', 'initial', 'if', 'თუ {A}, მაშინ {B}.'),
  u('იმ შემთხვევაში', 'condition', 'formal', 'initial', 'in the case that'),
  u('დავუშვათ', 'condition', 'formal', 'initial', 'suppose', 'დავუშვათ, {A}. მაშინ {B}.'),
  u('წარმოიდგინე', 'example', 'neutral', 'initial', 'imagine', 'წარმოიდგინე, {A}.'),

  /* ------------------------------- addition ----------------------------- */
  u('ამასთან', 'addition', 'formal', 'initial', 'moreover'),
  u('გარდა ამისა', 'addition', 'neutral', 'initial', 'besides, in addition'),
  u('ასევე', 'addition', 'neutral', 'medial', 'also'),
  u('უფრო მეტიც', 'addition', 'neutral', 'initial', 'what is more'),

  /* -------------------------------- example ----------------------------- */
  u('მაგალითად', 'example', 'neutral', 'initial', 'for example', 'მაგალითად, {A}.'),
  u('კერძოდ', 'clarification', 'formal', 'initial', 'specifically'),
  u('ვთქვათ', 'example', 'neutral', 'initial', 'say, for instance'),

  /* ----------------------------- clarification -------------------------- */
  u('სხვა სიტყვებით', 'reformulation', 'neutral', 'initial', 'in other words'),
  u('მარტივად რომ ვთქვათ', 'reformulation', 'neutral', 'initial', 'simply put', 'მარტივად რომ ვთქვათ, {A}.'),
  u('უფრო ზუსტად', 'clarification', 'formal', 'initial', 'more precisely'),
  u('ანუ მოკლედ', 'summary', 'neutral', 'initial', 'in short'),

  /* -------------------------------- emphasis ---------------------------- */
  u('სწორედ', 'emphasis', 'neutral', 'medial', 'precisely, exactly'),
  u('სწორედ ამიტომ', 'emphasis', 'neutral', 'initial', 'this is exactly why'),
  u('მთავარია', 'emphasis', 'neutral', 'initial', 'the main thing is'),
  u('განსაკუთრებით', 'emphasis', 'neutral', 'medial', 'especially'),

  /* ------------------------------ uncertainty --------------------------- */
  u('შესაძლოა', 'uncertainty', 'formal', 'initial', 'possibly'),
  u('შეიძლება', 'uncertainty', 'neutral', 'medial', 'may, might'),
  u('სავარაუდოდ', 'uncertainty', 'neutral', 'initial', 'probably'),
  u('ზუსტად არ ვიცი', 'uncertainty', 'neutral', 'initial', 'I do not know exactly'),
  u('როგორც ჩანს', 'uncertainty', 'neutral', 'initial', 'apparently'),

  /* ------------------------------- certainty ---------------------------- */
  u('უდავოდ', 'certainty', 'formal', 'medial', 'undoubtedly'),
  u('ცალსახად', 'certainty', 'formal', 'medial', 'unambiguously'),
  u('ნამდვილად', 'certainty', 'neutral', 'medial', 'really, certainly'),

  /* ------------------------------ comparison ---------------------------- */
  u('ისევე როგორც', 'comparison', 'neutral', 'medial', 'just as'),
  u('შედარებით', 'comparison', 'neutral', 'medial', 'comparatively'),
  u('ერთი მხრივ', 'comparison', 'neutral', 'initial', 'on the one hand', 'ერთი მხრივ, {A}. მეორე მხრივ, {B}.'),
  u('ვიდრე', 'comparison', 'neutral', 'medial', 'than'),

  /* ------------------------------- sequence ----------------------------- */
  u('ჯერ', 'sequence', 'neutral', 'initial', 'first'),
  u('შემდეგ', 'sequence', 'neutral', 'initial', 'then, next'),
  u('ბოლოს', 'sequence', 'neutral', 'initial', 'finally'),
  u('პირველ რიგში', 'sequence', 'formal', 'initial', 'in the first place'),

  /* -------------------------------- purpose ----------------------------- */
  u('იმისათვის რომ', 'purpose', 'formal', 'medial', 'in order to'),
  u('რათა', 'purpose', 'academic', 'medial', 'so that'),

  /* -------------------------------- summary ----------------------------- */
  u('მოკლედ', 'summary', 'neutral', 'initial', 'in short', 'მოკლედ, {A}.'),
  u('შევაჯამოთ', 'summary', 'formal', 'initial', 'to summarise'),
  u('საბოლოოდ', 'summary', 'formal', 'initial', 'ultimately'),

  /* ------------------------------ attribution --------------------------- */
  u('მიხედვით', 'attribution', 'formal', 'medial', 'according to', '{A}-ის მიხედვით, {B}.'),
  u('როგორც ცნობილია', 'attribution', 'formal', 'initial', 'as is known'),

  /* ------------------------------- definition --------------------------- */
  u('ნიშნავს', 'definition', 'neutral', 'medial', 'means', '{A} ნიშნავს {B}-ს.'),
  u('ეწოდება', 'definition', 'formal', 'medial', 'is called'),
  u('გულისხმობს', 'definition', 'formal', 'medial', 'implies, means'),
  u('არის ის', 'definition', 'neutral', 'medial', 'is that which'),

  /* -------------------------------- question ---------------------------- */
  u('რას ნიშნავს', 'question', 'neutral', 'initial', 'what does it mean'),
  u('რატომ', 'question', 'neutral', 'initial', 'why'),
  u('რა მოხდება თუ', 'question', 'neutral', 'initial', 'what happens if'),
  u('როგორ ფიქრობ', 'question', 'neutral', 'initial', 'what do you think'),
  u('დარწმუნებული ხარ', 'question', 'neutral', 'initial', 'are you sure'),
];

/** Every distinct function the inventory can express. */
export const FUNCTIONS: LanguageFunction[] = [
  ...new Set(SEED_UNITS.map((x) => x.function)),
];
