import { describe, expect, it } from 'vitest';
import {
  mineLanguage,
  mergeCorpora,
  pickUnit,
  connective,
  joinWith,
  applyPattern,
  formsOf,
  registerFor,
  SEED_UNITS,
} from '@/domain/language';

/**
 * A short passage in the register of the imported philosophy anthology. It is
 * written here rather than copied from the book: the point of the language
 * layer is that it learns *grammar*, so a paraphrase in the same style
 * exercises it exactly as the real source does.
 */
const PHILOSOPHY_TEXT = `
დეტერმინიზმი ნიშნავს, რომ ყოველი მოვლენა წინა მიზეზებით არის განსაზღვრული.
მაშასადამე, არჩევანიც განსაზღვრულია. თუმცა, ეს დასკვნა ყველას არ მიაჩნია საბოლოოდ.
მეორე მხრივ, თავისუფლება შეიძლება ნიშნავდეს იძულების არარსებობას.
აქედან გამომდინარე, პასუხისმგებლობა რეალურ განსხვავებას ეყრდნობა.
რადგან ადამიანი საკუთარი მოტივებით მოქმედებს, მას პასუხისმგებლობა ეკისრება.
მაგალითად, იძულებით ხელმოწერილი ხელშეკრულება ბათილია.
შესაბამისად, სამართალი ნების ხარისხს ზომავს. ამიტომ განსხვავება მნიშვნელოვანია.
ადამიანის ნება, ადამიანს, ადამიანები, ადამიანების — ყველა ფორმა გვხვდება ტექსტში.
`;

const corpus = mineLanguage(PHILOSOPHY_TEXT, { sourceId: 'test_philosophy' });

/* ================================ mining ================================ */

describe('mining general Georgian', () => {
  it('attests the connectives that actually appear', () => {
    const attested = corpus.units.filter((u) => u.frequency > 0).map((u) => u.surface);
    expect(attested).toContain('მაშასადამე');
    expect(attested).toContain('მეორე მხრივ');
    expect(attested).toContain('აქედან გამომდინარე');
    expect(attested).toContain('რადგან');
  });

  it('leaves unseen connectives seeded but unattested', () => {
    const unseen = corpus.units.find((u) => u.surface === 'შევაჯამოთ');
    expect(unseen?.frequency).toBe(0);
    expect(unseen?.attestedIn).toHaveLength(0);
  });

  it('labels each unit by what it does, not by subject', () => {
    const contrast = corpus.units.find((u) => u.surface === 'მეორე მხრივ');
    expect(contrast?.function).toBe('contrast');
    expect(contrast?.reusable).toBe(true);
    expect(contrast?.domains).toContain('*');
  });

  it('learns a word family with its inflected forms', () => {
    const forms = formsOf('ადამიან', corpus);
    expect(forms.length).toBeGreaterThanOrEqual(3);
    expect(forms.some((f) => f.startsWith('ადამიან'))).toBe(true);
  });

  it('stores no sentence from the source', () => {
    const stored = [
      ...corpus.units.map((u) => u.surface),
      ...corpus.units.flatMap((u) => u.pattern ?? []),
      ...corpus.lexemes.flatMap((l) => l.forms.map((f) => f.form)),
    ];
    for (const item of stored) {
      // Nothing stored may be long enough to be a sentence from the book.
      expect(item.length).toBeLessThan(40);
      expect(PHILOSOPHY_TEXT.includes(`${item}.`) && item.split(' ').length > 5).toBe(false);
    }
  });

  it('merges evidence across sources', () => {
    const second = mineLanguage('მაშასადამე, ეს ასეა. მაშასადამე, ისიც.', { sourceId: 'second' });
    const merged = mergeCorpora([corpus, second]);
    const unit = merged.units.find((u) => u.surface === 'მაშასადამე');
    expect(unit!.attestedIn).toEqual(expect.arrayContaining(['test_philosophy', 'second']));
    expect(unit!.frequency).toBeGreaterThan(
      corpus.units.find((u) => u.surface === 'მაშასადამე')!.frequency,
    );
  });
});

/* ========================= cross-domain reuse =========================== */

describe('language learned from philosophy is reusable everywhere', () => {
  it('offers a contrast connective when discussing algorithms', () => {
    const phrase = connective('contrast', { subjectId: 'algorithms', corpus });
    expect(phrase).toBeTruthy();
    // It must be one the philosophy corpus actually attested.
    const unit = corpus.units.find((u) => u.surface === phrase);
    expect(unit!.frequency).toBeGreaterThan(0);
  });

  it('builds a sentence about binary search using a philosophy-mined phrase', () => {
    const sentence = joinWith(
      'conclusion',
      'ორობითი ძებნა ყოველ ნაბიჯზე ნახევარს აგდებს',
      'მისი სირთულეა O(log n)',
      { subjectId: 'algorithms', corpus },
    );
    expect(sentence).toMatch(/ორობითი ძებნა/);
    expect(sentence).toMatch(/O\(log n\)/);
    // A real connective was used, not bare juxtaposition.
    expect(sentence.length).toBeGreaterThan(
      'ორობითი ძებნა ყოველ ნაბიჯზე ნახევარს აგდებს მისი სირთულეა O(log n)'.length,
    );
  });

  it('builds a biology sentence with a contrast connective', () => {
    const sentence = joinWith(
      'contrast',
      'ფოტოსინთეზი სინათლეს იყენებს',
      'ამ პროცესზე ტემპერატურაც მოქმედებს',
      { subjectId: 'biology', corpus },
    );
    expect(sentence).toMatch(/ფოტოსინთეზი/);
    expect(sentence).toMatch(/ტემპერატურაც/);
  });
});

/* ============================== register ================================ */

describe('register control keeps plain topics plain', () => {
  it('allows an academic connective in philosophy', () => {
    const unit = pickUnit('conclusion', { subjectId: 'philosophy', corpus, seed: 'a' });
    expect(unit).toBeTruthy();
    expect(registerFor('philosophy')).toBe('academic');
  });

  it('never uses an academic connective for a technical subject', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const unit = pickUnit('conclusion', { subjectId: 'algorithms', corpus, seed });
      if (unit) expect(unit.register).not.toBe('academic');
    }
    expect(registerFor('algorithms')).toBe('formal');
  });

  it('drops to the plainest register when the user asked for it simply', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const unit = pickUnit('conclusion', {
        subjectId: 'philosophy',
        ceiling: 'neutral',
        corpus,
        seed,
      });
      if (unit) expect(unit.register).toBe('neutral');
    }
  });

  it('caps how many connectives one reply may use', () => {
    expect(pickUnit('contrast', { corpus, usedInReply: 2 })).toBeNull();
    expect(pickUnit('contrast', { corpus, usedInReply: 0 })).toBeTruthy();
  });

  it('does not repeat a connective already used recently', () => {
    const first = pickUnit('contrast', { subjectId: 'algorithms', corpus, seed: 'x' })!;
    const second = pickUnit('contrast', {
      subjectId: 'algorithms',
      corpus,
      seed: 'x',
      recent: [first.surface],
    });
    expect(second?.surface).not.toBe(first.surface);
  });

  it('falls back to plain prose rather than forcing a phrase', () => {
    // No unit exists for this role at neutral register with everything used.
    const all = SEED_UNITS.filter((u) => u.function === 'attribution').map((u) => u.surface);
    const picked = pickUnit('attribution', { corpus, recent: all });
    expect(picked).toBeNull();
    const sentence = joinWith('attribution', 'პირველი ნაწილი', 'მეორე ნაწილი', { corpus, recent: all });
    expect(sentence).toBe('პირველი ნაწილი მეორე ნაწილი');
  });
});

/* ============================== patterns ================================ */

describe('patterns compose new sentences', () => {
  it('fills a stored skeleton with new content', () => {
    const unit = SEED_UNITS.find((u) => u.surface === 'მეორე მხრივ')!;
    const out = applyPattern(unit, {
      A: 'ორობითი ძებნა ძალიან სწრაფია',
      B: 'ის დალაგებულ მონაცემებს მოითხოვს',
    });
    expect(out).toBe('ორობითი ძებნა ძალიან სწრაფია. მეორე მხრივ, ის დალაგებულ მონაცემებს მოითხოვს.');
  });

  it('refuses a half-filled pattern', () => {
    const unit = SEED_UNITS.find((u) => u.surface === 'მეორე მხრივ')!;
    expect(applyPattern(unit, { A: 'მხოლოდ ერთი' })).toBeNull();
  });
});
