import { describe, expect, it } from 'vitest';
import {
  CT_CATEGORY_ORDER,
  CT_TOPICS,
  ctBrokenReferences,
  ctTopicById,
  ctTopicsByCategory,
  isAuthored,
} from '@/content/competitive';
import {
  buildRoadmap,
  buildTopicView,
  computeStats,
  filterTopics,
  recommendNext,
  relatedTopics,
  statusAtLeast,
} from '@/domain/competitive';
import { emptyProgress, type CtStatus, type CtTopicProgress } from '@/domain/competitive/types';

/** A progress map from sparse overrides; everything else is not-started. */
function progressMap(overrides: Record<string, Partial<CtTopicProgress>>): Map<string, CtTopicProgress> {
  const m = new Map<string, CtTopicProgress>();
  for (const [id, patch] of Object.entries(overrides)) {
    m.set(id, { ...emptyProgress(id), ...patch, topicId: id });
  }
  return m;
}

/** Topics that must satisfy the full teaching contract. Grows one batch per phase. */
const AUTHORED = [
  // Phase 1
  'prefix-sums', 'difference-arrays', 'frequency-arrays', 'two-pointers', 'sliding-window',
  // Phase 2
  'binary-search', 'bit-manipulation', 'recursion', 'sorting-techniques', 'coordinate-compression',
];

/* =============================== content =============================== */

describe('topic content', () => {
  it('assembles every category with no gaps', () => {
    for (const cat of CT_CATEGORY_ORDER) {
      expect(ctTopicsByCategory.get(cat)!.length).toBeGreaterThan(0);
    }
    // Orders within a category are unique and dense enough to sort stably.
    for (const cat of CT_CATEGORY_ORDER) {
      const orders = ctTopicsByCategory.get(cat)!.map((t) => t.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it('has no dangling relationship ids', () => {
    expect(ctBrokenReferences()).toEqual([]);
  });

  it('has unique topic ids', () => {
    const ids = CT_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks exactly the authored topics as authored', () => {
    const authored = CT_TOPICS.filter(isAuthored).map((t) => t.id).sort();
    expect(authored).toEqual([...AUTHORED].sort());
  });

  it('every authored topic fills the teaching contract', () => {
    for (const id of AUTHORED) {
      const topic = ctTopicById.get(id)!;
      expect(topic.whatIs, `${id}.whatIs`).toBeTruthy();
      expect(topic.intuition, `${id}.intuition`).toBeTruthy();
      expect(topic.whyItWorks, `${id}.whyItWorks`).toBeTruthy();
      expect(topic.naive, `${id}.naive (problem-solving core)`).toBeTruthy();
      expect(topic.whenToUse?.length, `${id}.whenToUse`).toBeGreaterThan(0);
      expect(topic.signals?.length, `${id}.signals`).toBeGreaterThan(0);
      expect(topic.walkthrough?.length, `${id}.walkthrough`).toBeGreaterThan(1);
      expect(topic.cpp?.length, `${id}.cpp`).toBeGreaterThan(0);
      expect(topic.time, `${id}.time`).toBeTruthy();
      expect(topic.space, `${id}.space`).toBeTruthy();
      expect(topic.mistakes?.length, `${id}.mistakes`).toBeGreaterThan(0);
      expect(topic.edgeCases?.length, `${id}.edgeCases`).toBeGreaterThan(0);
      expect(topic.exercises?.length, `${id}.exercises`).toBeGreaterThan(0);
      expect(topic.practice?.length, `${id}.practice`).toBeGreaterThan(0);
      expect(topic.combineNote, `${id}.combineNote`).toBeTruthy();
      // every relationship field is present (may be empty for roots)
      for (const f of ['prerequisites', 'related', 'combinesWith', 'next'] as const) {
        expect(Array.isArray(topic[f]), `${id}.${f}`).toBe(true);
      }
    }
  });

  it('C++ snippets look like real contest code', () => {
    for (const id of AUTHORED) {
      for (const snippet of ctTopicById.get(id)!.cpp!) {
        expect(snippet.code.length, `${id} snippet`).toBeGreaterThan(40);
      }
    }
    // Prefix sums must teach the overflow lesson.
    const ps = ctTopicById.get('prefix-sums')!;
    expect(ps.cpp!.some((c) => c.code.includes('long long'))).toBe(true);
    expect(ps.mistakes!.join(' ')).toMatch(/overflow/i);
    // Binary search must warn about the midpoint overflow.
    const bs = ctTopicById.get('binary-search')!;
    expect(bs.mistakes!.join(' ')).toMatch(/overflow/i);
    expect(bs.cpp!.some((c) => c.code.includes('lo + (hi - lo)'))).toBe(true);
    // Bit manipulation must warn about the 1 << i vs 1LL << i trap.
    expect(ctTopicById.get('bit-manipulation')!.mistakes!.join(' ')).toMatch(/1LL/);
  });

  it('authored topics form a coherent prerequisite chain', () => {
    // The foundation line, down through the core techniques.
    expect(ctTopicById.get('difference-arrays')!.prerequisites).toContain('prefix-sums');
    expect(ctTopicById.get('two-pointers')!.prerequisites).toContain('frequency-arrays');
    expect(ctTopicById.get('sliding-window')!.prerequisites).toContain('two-pointers');
    expect(ctTopicById.get('sorting-techniques')!.prerequisites).toContain('two-pointers');
    expect(ctTopicById.get('coordinate-compression')!.prerequisites).toContain('sorting-techniques');
    // Binary search, bit manipulation and recursion are genuine roots — no prereq forced.
    expect(ctTopicById.get('binary-search')!.prerequisites).toEqual([]);
    expect(ctTopicById.get('bit-manipulation')!.prerequisites).toEqual([]);
    expect(ctTopicById.get('recursion')!.prerequisites).toEqual([]);
  });

  it('the Phase 2 connection map is present', () => {
    const rel = (id: string) => {
      const t = ctTopicById.get(id)!;
      return new Set([...t.related, ...t.combinesWith, ...t.next]);
    };
    expect([...rel('binary-search')]).toEqual(
      expect.arrayContaining(['binary-search-on-answer', 'prefix-sums', 'sorting-techniques']),
    );
    expect([...rel('bit-manipulation')]).toEqual(
      expect.arrayContaining(['bitmask-enumeration', 'bitmask-dp']),
    );
    expect([...rel('recursion')]).toEqual(
      expect.arrayContaining(['backtracking', 'dfs', 'trees']),
    );
    expect([...rel('sorting-techniques')]).toEqual(
      expect.arrayContaining(['two-pointers', 'greedy', 'coordinate-compression']),
    );
    expect([...rel('coordinate-compression')]).toEqual(
      expect.arrayContaining(['sorting-techniques', 'fenwick-tree', 'segment-tree']),
    );
  });
});

/* ============================ relationships =========================== */

describe('relationship model', () => {
  it('resolves relationship ids to topic objects', () => {
    const ps = ctTopicById.get('prefix-sums')!;
    const next = relatedTopics(ps.next);
    expect(next.map((t) => t.id)).toEqual(ps.next);
    expect(relatedTopics(['prefix-sums', 'does-not-exist'])).toHaveLength(1);
  });

  it('prerequisite edges never form a cycle', () => {
    const seen = new Set<string>();
    const stack = new Set<string>();
    const visit = (id: string): boolean => {
      if (stack.has(id)) return false; // back edge
      if (seen.has(id)) return true;
      seen.add(id);
      stack.add(id);
      for (const pre of ctTopicById.get(id)?.prerequisites ?? []) {
        if (!visit(pre)) return false;
      }
      stack.delete(id);
      return true;
    };
    expect(CT_TOPICS.every((t) => visit(t.id))).toBe(true);
  });
});

/* ============================== roadmap ============================== */

describe('roadmap engine', () => {
  it('a topic with no prerequisites is always unlocked', () => {
    const view = buildTopicView(ctTopicById.get('prefix-sums')!, new Map());
    expect(view.unlocked).toBe(true);
    expect(view.missingPrereqs).toEqual([]);
  });

  it('locks a topic until its prerequisites reach practicing', () => {
    const locked = buildTopicView(ctTopicById.get('difference-arrays')!, new Map());
    expect(locked.unlocked).toBe(false);
    expect(locked.missingPrereqs.map((t) => t.id)).toEqual(['prefix-sums']);

    const learning = buildTopicView(
      ctTopicById.get('difference-arrays')!,
      progressMap({ 'prefix-sums': { status: 'learning' } }),
    );
    expect(learning.unlocked).toBe(false); // learning is below practicing

    const unlocked = buildTopicView(
      ctTopicById.get('difference-arrays')!,
      progressMap({ 'prefix-sums': { status: 'practicing' } }),
    );
    expect(unlocked.unlocked).toBe(true);
  });

  it('treats "needs review" as practicing-level for unlocking', () => {
    const v = buildTopicView(
      ctTopicById.get('two-pointers')!,
      progressMap({ 'frequency-arrays': { status: 'review' } }),
    );
    expect(v.unlocked).toBe(true);
    expect(statusAtLeast('review', 'practicing')).toBe(true);
    expect(statusAtLeast('learning', 'practicing')).toBe(false);
  });

  it('builds the roadmap in syllabus order', () => {
    const roadmap = buildRoadmap(new Map());
    expect(roadmap.map((c) => c.category)).toEqual(CT_CATEGORY_ORDER);
    expect(roadmap[0]!.topics[0]!.topic.id).toBe('prefix-sums');
  });
});

/* ============================ recommendation ========================= */

describe('recommendNext', () => {
  const views = () => buildRoadmap(new Map()).flatMap((c) => c.topics);

  it('starts a fresh student on prefix sums', () => {
    expect(recommendNext(views())!.topic.id).toBe('prefix-sums');
  });

  it('prefers finishing a topic already in progress', () => {
    const r = buildRoadmap(progressMap({ 'two-pointers': { status: 'learning', lastStudiedAt: 5 } }))
      .flatMap((c) => c.topics);
    expect(recommendNext(r)!.topic.id).toBe('two-pointers');
  });

  it('surfaces a stale review-flagged topic over a fresh one', () => {
    const r = buildRoadmap(
      progressMap({
        'prefix-sums': { status: 'mastered', reviewFlag: true, lastStudiedAt: 1 },
        'difference-arrays': { status: 'mastered', lastStudiedAt: 100 },
      }),
    ).flatMap((c) => c.topics);
    expect(recommendNext(r)!.topic.id).toBe('prefix-sums');
  });

  it('advances to the next unlocked authored topic once the current is mastered', () => {
    const r = buildRoadmap(progressMap({ 'prefix-sums': { status: 'mastered' } }))
      .flatMap((c) => c.topics);
    // difference-arrays and frequency-arrays both unlock; frequency-arrays is
    // earlier in order among the essentials? both order 2 and 3 → order wins.
    expect(['difference-arrays', 'frequency-arrays']).toContain(recommendNext(r)!.topic.id);
    expect(recommendNext(r)!.topic.id).toBe('difference-arrays');
  });

  it('returns null when every authored topic is mastered and unflagged', () => {
    const done: Record<string, Partial<CtTopicProgress>> = {};
    for (const t of CT_TOPICS.filter(isAuthored)) done[t.id] = { status: 'mastered' as CtStatus };
    const r = buildRoadmap(progressMap(done)).flatMap((c) => c.topics);
    expect(recommendNext(r)).toBeNull();
  });
});

/* =============================== stats ============================== */

describe('stats and filters', () => {
  it('counts statuses, solved problems and mastery fraction', () => {
    const r = buildRoadmap(
      progressMap({
        'prefix-sums': { status: 'mastered', solved: 12 },
        'difference-arrays': { status: 'practicing', solved: 3 },
        'two-pointers': { status: 'learning', reviewFlag: true },
      }),
    ).flatMap((c) => c.topics);
    const s = computeStats(r);
    expect(s.solved).toBe(15);
    expect(s.byStatus.mastered).toBe(1);
    expect(s.byStatus.learning).toBe(1);
    expect(s.reviewCount).toBe(1);
    expect(s.authored).toBe(10);
    expect(s.mastery).toBeCloseTo(1 / 10);
  });

  it('filters by category, priority, status and text', () => {
    const all = buildRoadmap(progressMap({ 'prefix-sums': { status: 'mastered' } }))
      .flatMap((c) => c.topics);

    expect(filterTopics(all, { category: 'graphs' }).every((v) => v.topic.category === 'graphs')).toBe(true);
    expect(filterTopics(all, { priority: 'essential' }).every((v) => v.topic.priority === 'essential')).toBe(true);
    expect(filterTopics(all, { status: 'mastered' }).map((v) => v.topic.id)).toEqual(['prefix-sums']);
    expect(filterTopics(all, { query: 'window' }).map((v) => v.topic.id)).toEqual(['sliding-window']);
    expect(filterTopics(all, { query: 'ფანჯარა' }).map((v) => v.topic.id)).toEqual(['sliding-window']);
  });
});

/* ============================= progress model ======================= */

describe('progress model', () => {
  it('empty progress is not-started with zero counters', () => {
    const p = emptyProgress('x');
    expect(p).toMatchObject({ status: 'not-started', solved: 0, confidence: 0, reviewFlag: false });
  });
});
