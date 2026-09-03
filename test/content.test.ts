import { describe, expect, it } from 'vitest';
import { findBrokenReferences, library, t } from '@/content';

describe('content library', () => {
  it('has no dangling cross-references', () => {
    expect(findBrokenReferences()).toEqual([]);
  });

  it('covers every MVP subject with real topics', () => {
    const required = ['math', 'physics', 'chemistry', 'biology', 'history', 'astronomy', 'cs'];
    for (const id of required) {
      expect(library.subjectById.has(id), `missing subject ${id}`).toBe(true);
    }
    // Each MVP lab must have reachable topics, counting sibling subjects in the
    // same group where the lab acts as an umbrella (e.g. math → algebra).
    const umbrella: Record<string, string[]> = {
      math: ['math', 'algebra', 'geometry', 'calculus', 'statistics', 'probability', 'trigonometry'],
      cs: ['cs', 'algorithms', 'programming', 'ai'],
      history: ['history', 'georgian-history'],
      physics: ['physics'],
      chemistry: ['chemistry'],
      biology: ['biology', 'ecology'],
      astronomy: ['astronomy'],
    };
    for (const [lab, ids] of Object.entries(umbrella)) {
      const count = ids.reduce((n, id) => n + (library.topicsBySubject.get(id)?.length ?? 0), 0);
      expect(count, `lab ${lab} has no topics`).toBeGreaterThan(0);
    }
  });

  it('every subject has a unique id and Georgian name', () => {
    const ids = new Set<string>();
    for (const s of library.subjects) {
      expect(ids.has(s.id), `duplicate subject id ${s.id}`).toBe(false);
      ids.add(s.id);
      expect(s.name.ka.length).toBeGreaterThan(0);
      expect(s.tagline.ka.length).toBeGreaterThan(0);
    }
  });

  it('every fact carries a source with a publisher', () => {
    for (const fact of library.facts) {
      expect(fact.source.publisher, `fact ${fact.id} has no publisher`).toBeTruthy();
      expect(fact.source.label, `fact ${fact.id} has no source label`).toBeTruthy();
    }
  });

  it('every formula defines its variables', () => {
    for (const f of library.formulas) {
      expect(f.variables.length, `formula ${f.id} has no variables`).toBeGreaterThan(0);
      expect(f.expression.length).toBeGreaterThan(0);
      expect(f.explanation.ka.length).toBeGreaterThan(20);
    }
  });

  it('every topic has the core narrative sections', () => {
    for (const topic of library.topics) {
      const kinds = topic.sections.map((s) => s.kind);
      expect(kinds, `topic ${topic.id} missing whatIs`).toContain('whatIs');
      expect(kinds, `topic ${topic.id} missing whyInteresting`).toContain('whyInteresting');
      expect(topic.hook.ka.length, `topic ${topic.id} has a weak hook`).toBeGreaterThan(10);
    }
  });

  it('quiz activities each have exactly one correct option per question', () => {
    for (const activity of library.activities) {
      if (activity.body.kind !== 'quiz') continue;
      for (const q of activity.body.questions) {
        const correct = q.options.filter((o) => o.correct).length;
        expect(correct, `activity ${activity.id} question "${q.prompt.ka}"`).toBe(1);
      }
    }
  });

  it('classify activities reference only declared buckets', () => {
    for (const activity of library.activities) {
      if (activity.body.kind !== 'classify') continue;
      const buckets = new Set(activity.body.buckets.map((b) => b.id));
      for (const item of activity.body.items) {
        expect(buckets.has(item.bucketId), `activity ${activity.id} item ${item.id}`).toBe(true);
      }
    }
  });

  it('resolves localized strings with a Georgian fallback', () => {
    expect(t({ ka: 'ფიზიკა', en: 'Physics' }, 'en')).toBe('Physics');
    expect(t({ ka: 'ფიზიკა' }, 'en')).toBe('ფიზიკა');
    expect(t(undefined)).toBe('');
  });
});
