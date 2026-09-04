import type { DomainPack } from '../types';

/**
 * Adaptive travel clarification.
 *
 * This pack exists to keep the decision engine honest about being
 * domain-independent: it plugs into the same `respond()` loop, the same
 * scoring and the same repetition/depth control, but its highest-value move is
 * `clarifyGoal` rather than `surfaceAssumption` — because in travel planning
 * the useful thing to withhold is a route, not an argument.
 *
 * Luka's Labo does not route trips, so nothing here is wired into the UI. It
 * is the seam GeoRoute plugs into, and it is exercised by the test suite so it
 * cannot rot.
 */
export const GEOROUTE_PACK: DomainPack = {
  id: 'georoute',
  label: 'მოგზაურობის დაზუსტება',

  cues: ['მოგზაურ', 'მარშრუტ', 'გასამგზავრ', 'ტური', 'სასტუმრ', 'ბილეთ', 'ღირსშესან', 'დღიან'],

  loadBearingTerms: ['ბიუჯეტ', 'დღე', 'სეზონ', 'ტემპ'],

  contestedCues: ['საუკეთეს', 'ჯობ', 'ღირს', 'უკეთეს'],

  concepts: [
    {
      cues: ['მარშრუტ', 'გზა', 'ტრანსპორტ', 'მანქან', 'მატარებ'],
      label: 'რას ვამჯობინებთ მარშრუტში',
      positions: [
        { label: 'ყველაზე სწრაფი', gloss: 'მინიმალური დრო გზაში, ხედები მეორეხარისხოვანია' },
        { label: 'ყველაზე იაფი', gloss: 'მინიმალური ხარჯი, დრო მოქნილია' },
        { label: 'ყველაზე ლამაზი', gloss: 'ხედები და გაჩერებები ჯობია დროის ეკონომიას' },
      ],
    },
  ],

  assumptionSchemas: [
    {
      id: 'best-criterion',
      when: (c) => c.type === 'comparative' || /(საუკეთეს|ჯობ|უკეთეს)/.test(c.text),
      build: () => ({
        text: '„საუკეთესო" აქ ერთ კონკრეტულ საზომს ნიშნავს — დროს, ფასს თუ შთაბეჭდილებას.',
        load: 0.8,
      }),
    },
  ],

  goalSlots: [
    {
      id: 'origin',
      question: 'საიდან იწყებ გზას? საწყისი წერტილი მარშრუტს მთლიანად ცვლის.',
      filledBy: ['თბილის', 'ბათუმ', 'ქუთაის', 'საიდან', 'გამგზავრ'],
      priority: 2,
    },
    {
      id: 'duration',
      question: 'რამდენი დღე გაქვს? სამდღიანი და ათდღიანი მარშრუტი სხვადასხვა ლოგიკით იგება.',
      filledBy: ['დღე', 'კვირ', 'ღამ'],
      priority: 1.5,
    },
    {
      id: 'pace',
      question: 'რას ამჯობინებ — ბევრი ადგილი სწრაფად, თუ ცოტა ადგილი მშვიდად?',
      filledBy: ['ტემპ', 'მშვიდ', 'სწრაფ', 'დასვენებ'],
      priority: 1,
    },
    {
      id: 'season',
      question: 'როდის მიემგზავრები? სეზონი განსაზღვრავს, რომელი გზა იქნება საერთოდ ღია.',
      filledBy: ['ზაფხულ', 'ზამთარ', 'გაზაფხულ', 'შემოდგომ', 'სეზონ', 'თვე'],
      priority: 0.8,
    },
  ],
};
