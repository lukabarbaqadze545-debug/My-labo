import type { SeedQuestion } from './schema';

/**
 * Seed questions for „რა მაინტერესებს?" — these are examples the app offers
 * when the user's own list is empty, and each is wired to topics that actually
 * answer it.
 */
export const SEED_QUESTIONS: SeedQuestion[] = [
  { id: 'q-sky-blue', text: { ka: 'რატომ არის ცა ლურჯი?' }, subjectId: 'physics', topicIds: ['light'] },
  { id: 'q-moon-fall', text: { ka: 'რატომ არ ეცემა მთვარე დედამიწაზე?' }, subjectId: 'physics', topicIds: ['gravity', 'newton-laws'] },
  { id: 'q-bigger-infinity', text: { ka: 'არსებობს თუ არა უსასრულობაზე დიდი რიცხვი?' }, subjectId: 'math', topicIds: ['infinity'] },
  { id: 'q-dino-color', text: { ka: 'როგორ ვიცით დინოზავრების ფერი?' }, subjectId: 'biology', topicIds: ['evolution'] },
  { id: 'q-time-slow', text: { ka: 'რატომ ნელდება დრო მასიურ სხეულებთან?' }, subjectId: 'physics', topicIds: ['relativity', 'black-holes'] },
  { id: 'q-ice-floats', text: { ka: 'რატომ ტივტივებს ყინული, თუ ის მყარია?' }, subjectId: 'chemistry', topicIds: ['water', 'chemical-bonds'] },
  { id: 'q-star-death', text: { ka: 'რა ხდება, როცა ვარსკვლავი კვდება?' }, subjectId: 'astronomy', topicIds: ['stars', 'black-holes'] },
  { id: 'q-tree-mass', text: { ka: 'საიდან იღებს ხე თავის მასას?' }, subjectId: 'biology', topicIds: ['photosynthesis'] },
  { id: 'q-computer-limit', text: { ka: 'არსებობს თუ არა რამე, რაც კომპიუტერს არასოდეს შეეძლება?' }, subjectId: 'cs', topicIds: ['computability'] },
  { id: 'q-universe-edge', text: { ka: 'აქვს თუ არა სამყაროს კიდე?' }, subjectId: 'astronomy', topicIds: ['cosmology'] },
  { id: 'q-password-safe', text: { ka: 'რატომ ვერ კითხულობს ვებგვერდი ჩემს პაროლს?' }, subjectId: 'cs', topicIds: ['cryptography'] },
  { id: 'q-earthquake-predict', text: { ka: 'შეიძლება თუ არა მიწისძვრის წინასწარმეტყველება?' }, subjectId: 'earth', topicIds: ['earthquakes'] },
  { id: 'q-why-prime', text: { ka: 'რატომ არიან მარტივი რიცხვები ასეთი მნიშვნელოვანი?' }, subjectId: 'math', topicIds: ['prime-numbers'] },
  { id: 'q-georgian-caps', text: { ka: 'რატომ არ აქვს ქართულს დიდი ასოები?' }, subjectId: 'georgian-language', topicIds: ['georgian-script'] },
  { id: 'q-antibiotic', text: { ka: 'რატომ უნდა დავამთავრო ანტიბიოტიკის კურსი ბოლომდე?' }, subjectId: 'biology', topicIds: ['evolution'] },
  { id: 'q-quantum-weird', text: { ka: 'ნიშნავს თუ არა კვანტური ფიზიკა, რომ ყველაფერი შემთხვევითია?' }, subjectId: 'physics', topicIds: ['quantum'] },
  { id: 'q-ai-learn', text: { ka: 'როგორ „სწავლობს" ხელოვნური ინტელექტი — ვინ ეუბნება რა არის სწორი?' }, subjectId: 'ai', topicIds: ['what-is-machine-learning', 'neural-networks'] },
  { id: 'q-llm-think', text: { ka: 'ესმის თუ არა ჩატბოტს ის, რასაც წერს?' }, subjectId: 'ai', topicIds: ['large-language-models', 'how-ai-can-fail'] },
  { id: 'q-gps-route', text: { ka: 'როგორ პოულობს ნავიგატორი ყველაზე მოკლე გზას წამებში?' }, subjectId: 'algorithms', topicIds: ['graphs-and-paths'] },
  { id: 'q-why-recursion', text: { ka: 'რატომ იძახებს ფუნქცია საკუთარ თავს — და როგორ ჩერდება?' }, subjectId: 'programming', topicIds: ['recursion'] },
  { id: 'q-code-to-machine', text: { ka: 'რა ხდება, როცა კოდს „გავუშვებ"?' }, subjectId: 'programming', topicIds: ['how-code-runs'] },
  { id: 'q-why-sort-fast', text: { ka: 'რატომ არის ერთი დალაგების ალგორითმი მილიონჯერ სწრაფი მეორეზე?' }, subjectId: 'algorithms', topicIds: ['sorting-algorithms', 'algorithm-complexity'] },
];
