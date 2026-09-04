import type { PageText, RawBook } from '@/domain/books';

/**
 * Synthetic books for the ingestion tests.
 *
 * They deliberately contain the things real books contain and naive pipelines
 * get wrong: a running head on every page, printed page numbers, a word
 * hyphenated across a line break, a page whose extraction came out as letter
 * soup, and a blank page.
 */

const RUNNING_HEAD = 'THE PROBLEM OF FREE WILL';

function page(n: number, lines: string[]): PageText {
  return { page: n, text: [RUNNING_HEAD, ...lines, String(n)].join('\n') };
}

/** A determinist book: free will is denied. */
export const DETERMINIST_BOOK: RawBook = {
  meta: { title: 'The Illusion of Choice', author: 'A. Hardline', totalPages: 6 },
  pages: [
    page(1, [
      'Chapter 1',
      'Determinism and Its Consequences',
      'Determinism is defined as the thesis that every event is necessitated by prior events together with the laws of nature.',
      'I shall argue that free will does not exist, and that our sense of choosing is a systematic illusion.',
    ]),
    page(2, [
      'Since every mental state is a physical state, and since every physical state is fixed by earlier ones, our deliber-',
      'ations are fixed as well. Therefore no agent could have acted otherwise than she did.',
      'For example, a person choosing tea over coffee has that preference fixed long before the moment of apparent decision.',
    ]),
    page(3, [
      'One might object that we experience deliberation directly, and that such experience is evidence of genuine choice.',
      'In reply, the vividness of an experience is no guarantee of its accuracy, as the study of perceptual illusion shows.',
    ]),
    page(4, [
      'Chapter 2',
      'The Compatibilist Retreat',
      'Compatibilism holds that freedom means acting without coercion rather than acting without causes.',
      'However, this redefinition abandons the question rather than answering it.',
    ]),
    // A page whose extraction came out letter-spaced.
    { page: 5, text: [RUNNING_HEAD, 'T h e   a r g u m e n t   c o n t i n u e s   h e r e', '5'].join('\n') },
    // A blank page.
    { page: 6, text: '' },
  ],
};

/** A compatibilist book: free will is affirmed, on a redefinition. */
export const COMPATIBILIST_BOOK: RawBook = {
  meta: { title: 'Freedom Enough', author: 'B. Reconciler', totalPages: 4 },
  pages: [
    {
      page: 1,
      text: [
        'FREEDOM ENOUGH',
        'Chapter 1',
        'What Freedom Requires',
        'By freedom, I mean the capacity to act on one’s own settled desires without external compulsion.',
        'I maintain that free will is real, and that it is fully compatible with universal causation.',
        '1',
      ].join('\n'),
    },
    {
      page: 2,
      text: [
        'FREEDOM ENOUGH',
        'The distinction between acting from compulsion and acting from one’s own values is not a verbal trick.',
        'Imagine two people who sign the same document: one at gunpoint, the other from conviction.',
        'Therefore the ordinary notion of responsibility tracks a real difference.',
        '2',
      ].join('\n'),
    },
    {
      page: 3,
      text: [
        'FREEDOM ENOUGH',
        'Critics argue that this account merely changes the subject and leaves the metaphysics untouched.',
        'In reply, an account that explains our actual practices of praise and blame has answered the question that mattered.',
        '3',
      ].join('\n'),
    },
    {
      page: 4,
      text: [
        'FREEDOM ENOUGH',
        'Chapter 2',
        'Responsibility Without Metaphysics',
        'For instance, courts already distinguish coerced signatures from voluntary ones.',
        '4',
      ].join('\n'),
    },
  ],
};

/** A short Georgian book, for cross-language retrieval. */
export const GEORGIAN_BOOK: RawBook = {
  meta: { title: 'ნების თავისუფლება', author: 'გ. ავტორი', totalPages: 2 },
  pages: [
    {
      page: 1,
      text: [
        'თავი 1',
        'დეტერმინიზმი',
        'დეტერმინიზმი ნიშნავს, რომ ყოველი მოვლენა წინა მიზეზებით არის განსაზღვრული.',
        'ვამტკიცებ, რომ თავისუფალი ნება არსებობს, თუ მას იძულების არარსებობად გავიგებთ.',
        '1',
      ].join('\n'),
    },
    {
      page: 2,
      text: [
        'წარმოიდგინე ორი ადამიანი, რომელთაგან ერთი იძულებით მოქმედებს, მეორე კი საკუთარი რწმენით.',
        'მაშასადამე, პასუხისმგებლობა რეალურ განსხვავებას ეყრდნობა.',
        '2',
      ].join('\n'),
    },
  ],
};
