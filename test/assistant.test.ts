import { describe, expect, it } from 'vitest';
import { ask } from '@/domain/assistant';

describe('library assistant', () => {
  it('greets and offers openers for small talk', () => {
    const a = ask('გამარჯობა');
    expect(a.confidence).toBe('chat');
    expect(a.followUps.length).toBeGreaterThan(0);
  });

  it('explains itself honestly when asked what it is', () => {
    const a = ask('რას შეგიძლია?');
    expect(a.confidence).toBe('chat');
    expect(a.text).toMatch(/ენობრივი მოდელი არ ვარ/);
  });

  it('answers a "what is" question from the library with sources', () => {
    const a = ask('რა არის შავი ხვრელი?');
    expect(a.confidence).not.toBe('none');
    expect(a.text.length).toBeGreaterThan(80);
    expect(a.sources[0]?.href).toBe('/topics/black-holes');
    expect(a.followUps.length).toBeGreaterThan(0);
  });

  it('routes a "who" question to a person and quotes their story', () => {
    const a = ask('ვინ იყო ალან ტიურინგი?');
    expect(a.text).toMatch(/ტიურინგ/);
    expect(a.sources.some((s) => s.href === '/people/turing')).toBe(true);
  });

  it('answers a formula question with the expression', () => {
    const a = ask('რა ფორმულა აღწერს მასისა და ენერგიის კავშირს?');
    expect(a.text).toContain('E = mc²');
    expect(a.sources.some((s) => s.href.includes('/formulas'))).toBe(true);
  });

  it('uses the "why" section for a "why" question', () => {
    const why = ask('რატომ არის სინათლე მნიშვნელოვანი?');
    const what = ask('რა არის სინათლე?');
    expect(why.text.length).toBeGreaterThan(60);
    expect(why.text).not.toBe(what.text);
  });

  it('admits when a topic is not in the library', () => {
    const a = ask('რა არის კრიპტოვალუტების საგადასახადო რეგულირება საქართველოში?');
    expect(a.confidence).toBe('none');
    expect(a.related.length).toBeGreaterThan(0); // still offers somewhere to start
  });

  it('never returns an empty answer', () => {
    for (const q of ['', '   ', 'რა?', 'აბა', 'xyzzy plugh']) {
      const a = ask(q);
      expect(a.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same query', () => {
    expect(ask('რა არის დნმ?').text).toBe(ask('რა არის დნმ?').text);
  });
});
