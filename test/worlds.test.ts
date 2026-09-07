import { describe, expect, it } from 'vitest';
import {
  buildForest,
  byKind,
  byLevel,
  causalChains,
  causalRoots,
  childrenOf,
  commonAncestor,
  compareWorlds,
  consequencesOf,
  descendantsOf,
  exportWorlds,
  lineageOf,
  parseWorldsImport,
  reasoningDepth,
  resolveWorld,
  wouldCycle,
  worldsById,
  type Consequence,
  type ParallelWorld,
} from '@/domain/worlds';
import { library } from '@/content';

/**
 * The domain is pure, so every rule of the feature is testable without a
 * browser or a database: lineage, inheritance, causal ordering, comparison and
 * the defensive import path.
 */

let seq = 0;
const world = (over: Partial<ParallelWorld> = {}): ParallelWorld => ({
  id: `w${++seq}`,
  title: `World ${seq}`,
  baseRule: '',
  changedRule: '',
  topicIds: [],
  openQuestions: [],
  conclusion: '',
  status: 'draft',
  createdAt: seq,
  updatedAt: seq,
  ...over,
});

const consequence = (over: Partial<Consequence> = {}): Consequence => ({
  id: `c${++seq}`,
  worldId: 'w1',
  kind: 'effect',
  level: 1,
  text: `Consequence ${seq}`,
  causedBy: [],
  order: 0,
  createdAt: seq,
  ...over,
});

/* ============================== creation ================================ */

describe('world shape', () => {
  it('holds one system and one change to it', () => {
    const w = world({
      title: 'გრავიტაცია ×2',
      baseRule: 'დედამიწის გრავიტაცია 9.8 მ/წმ²',
      changedRule: 'გრავიტაცია ორჯერ ძლიერია',
      subjectId: 'physics',
      topicIds: ['gravity'],
    });
    expect(w.changedRule).toBeTruthy();
    expect(w.status).toBe('draft');
    expect(w.parentId).toBeUndefined();
  });

  it('links to Labo topics by id, never by copy', () => {
    const topic = library.topics.find((t) => t.id === 'gravity') ?? library.topics[0]!;
    const w = world({ topicIds: [topic.id], subjectId: topic.subjectId });

    // The world stores an id; the library remains the only source of content.
    expect(w.topicIds).toEqual([topic.id]);
    expect(library.topicById.get(w.topicIds[0]!)).toBeDefined();
    expect(JSON.stringify(w)).not.toContain('sections');
  });
});

/* =============================== branching ============================== */

describe('branching and lineage', () => {
  const root = world({ id: 'root', baseRule: 'ბაზისური რეალობა', subjectId: 'physics', topicIds: ['gravity'], changedRule: 'გრავიტაცია ×2' });
  const a = world({ id: 'a', parentId: 'root', changedRule: 'ბიოლოგია მილიონ წელიწადში ეგუება' });
  const b = world({ id: 'b', parentId: 'root', changedRule: 'ადამიანები დღესვე გადავიდნენ' });
  const deep = world({ id: 'deep', parentId: 'a', changedRule: 'ჩონჩხი მთლიანად იცვლება' });
  const all = [root, a, b, deep];
  const byId = worldsById(all);

  it('reports the chain from root to leaf', () => {
    expect(lineageOf('deep', byId).map((w) => w.id)).toEqual(['root', 'a', 'deep']);
    expect(lineageOf('root', byId).map((w) => w.id)).toEqual(['root']);
  });

  it('finds children and all descendants', () => {
    expect(childrenOf('root', all).map((w) => w.id)).toEqual(['a', 'b']);
    expect(descendantsOf('root', all).map((w) => w.id).sort()).toEqual(['a', 'b', 'deep']);
    expect(descendantsOf('deep', all)).toEqual([]);
  });

  it('builds a tree with correct depth', () => {
    const forest = buildForest(all);
    expect(forest).toHaveLength(1);
    expect(forest[0]!.world.id).toBe('root');
    expect(forest[0]!.children.map((c) => c.world.id)).toEqual(['a', 'b']);
    expect(forest[0]!.children[0]!.children[0]!.depth).toBe(2);
  });

  it('finds the nearest shared ancestor of two branches', () => {
    expect(commonAncestor('a', 'b', byId)?.id).toBe('root');
    expect(commonAncestor('deep', 'b', byId)?.id).toBe('root');
    expect(commonAncestor('root', 'deep', byId)?.id).toBe('root');
  });

  it('keeps a branch whose parent is missing, as a root', () => {
    const orphan = world({ id: 'orphan', parentId: 'gone' });
    const forest = buildForest([orphan]);
    expect(forest).toHaveLength(1);
    expect(forest[0]!.world.id).toBe('orphan');
  });

  it('survives a corrupted parent cycle instead of hanging', () => {
    const x = world({ id: 'x', parentId: 'y' });
    const y = world({ id: 'y', parentId: 'x' });
    const cyclic = worldsById([x, y]);
    expect(() => lineageOf('x', cyclic)).not.toThrow();
    expect(lineageOf('x', cyclic).length).toBeLessThanOrEqual(2);
    expect(() => buildForest([x, y])).not.toThrow();
  });

  /* ---- inheritance: a branch owns only its divergence ---- */

  it('inherits base reality and links from the parent', () => {
    const resolved = resolveWorld(a, byId);
    expect(resolved.baseRule).toBe('ბაზისური რეალობა');
    expect(resolved.subjectId).toBe('physics');
    expect(resolved.topicIds).toEqual(['gravity']);
    expect(resolved.inherited.baseRule).toBe('root');
    // Its own divergence is untouched.
    expect(resolved.changedRule).toBe('ბიოლოგია მილიონ წელიწადში ეგუება');
  });

  it('lets a branch override what it inherits', () => {
    const own = world({ id: 'own', parentId: 'root', baseRule: 'სხვა ბაზისი' });
    const resolved = resolveWorld(own, worldsById([root, own]));
    expect(resolved.baseRule).toBe('სხვა ბაზისი');
    expect(resolved.inherited.baseRule).toBeUndefined();
  });

  it('inherits through more than one generation', () => {
    expect(resolveWorld(deep, byId).baseRule).toBe('ბაზისური რეალობა');
    expect(resolveWorld(deep, byId).inherited.baseRule).toBe('root');
  });

  it('does not duplicate inherited data into storage', () => {
    // The stored record stays empty; resolution happens at read time only.
    expect(a.baseRule).toBe('');
    expect(a.topicIds).toEqual([]);
  });

  it('keeps each branch’s divergence in its own changed rule', () => {
    // Two branches of one world differ by exactly this field, and neither
    // inherits it — a branch that inherited its parent's change would not be
    // a branch at all.
    expect(a.changedRule).not.toBe(b.changedRule);
    expect(resolveWorld(a, byId).changedRule).toBe('ბიოლოგია მილიონ წელიწადში ეგუება');
    expect(resolveWorld(b, byId).changedRule).toBe('ადამიანები დღესვე გადავიდნენ');
  });
});

/* ============================ consequences ============================== */

describe('consequence depth', () => {
  const list = [
    consequence({ id: 'l3', level: 3, order: 0, text: 'ცივილიზაცია იცვლება' }),
    consequence({ id: 'l1b', level: 1, order: 1, text: 'ძვლები ტყდება' }),
    consequence({ id: 'l1a', level: 1, order: 0, text: 'წონა იზრდება' }),
    consequence({ id: 'l2', level: 2, order: 0, text: 'არქიტექტურა იცვლება' }),
  ];

  it('orders immediate before indirect before systemic', () => {
    expect(consequencesOf('w1', list).map((c) => c.id)).toEqual(['l1a', 'l1b', 'l2', 'l3']);
  });

  it('groups by level with every level present', () => {
    const grouped = byLevel(list);
    expect([...grouped.keys()]).toEqual([1, 2, 3]);
    expect(grouped.get(1)!.map((c) => c.id)).toEqual(['l1a', 'l1b']);
    expect(grouped.get(3)!).toHaveLength(1);
  });

  it('groups by kind with every kind present', () => {
    const grouped = byKind([
      consequence({ id: 'k1', kind: 'breaks' }),
      consequence({ id: 'k2', kind: 'enables' }),
    ]);
    expect([...grouped.keys()]).toEqual(['effect', 'breaks', 'enables', 'unexpected']);
    expect(grouped.get('effect')).toEqual([]);
    expect(grouped.get('breaks')!.map((c) => c.id)).toEqual(['k1']);
  });

  it('reports how deep the reasoning actually went', () => {
    expect(reasoningDepth(list)).toBe(3);
    expect(reasoningDepth([consequence({ level: 1 })])).toBe(1);
    expect(reasoningDepth([])).toBe(0);
  });

  it('keeps one world’s consequences out of another’s', () => {
    const mixed = [consequence({ id: 'mine', worldId: 'w1' }), consequence({ id: 'theirs', worldId: 'w2' })];
    expect(consequencesOf('w1', mixed).map((c) => c.id)).toEqual(['mine']);
  });
});

/* ============================== causal map ============================== */

describe('local causal map', () => {
  const a = consequence({ id: 'a', level: 1, text: 'წონა იზრდება' });
  const b = consequence({ id: 'b', level: 2, text: 'სტრუქტურული დატვირთვა', causedBy: ['a'] });
  const c = consequence({ id: 'c', level: 3, text: 'სხვა არქიტექტურა', causedBy: ['b'] });
  const loose = consequence({ id: 'loose', level: 1, text: 'დამოუკიდებელი' });
  const chain = [a, b, c, loose];

  it('finds where the reasoning starts', () => {
    expect(causalRoots(chain).map((x) => x.id).sort()).toEqual(['a', 'loose']);
  });

  it('walks the chain with increasing depth', () => {
    const walked = causalChains(chain);
    const byId = new Map(walked.map((w) => [w.consequence.id, w.depth]));
    expect(byId.get('a')).toBe(0);
    expect(byId.get('b')).toBe(1);
    expect(byId.get('c')).toBe(2);
    expect(byId.get('loose')).toBe(0);
    expect(walked).toHaveLength(4);
  });

  it('refuses a link that would close a loop', () => {
    expect(wouldCycle('a', 'c', chain)).toBe(true); // c already descends from a
    expect(wouldCycle('a', 'a', chain)).toBe(true);
    expect(wouldCycle('loose', 'c', chain)).toBe(false);
  });

  it('still renders every node if the stored map contains a cycle', () => {
    const x = consequence({ id: 'x', causedBy: ['y'] });
    const y = consequence({ id: 'y', causedBy: ['x'] });
    const walked = causalChains([x, y]);
    expect(walked).toHaveLength(2);
    expect(new Set(walked.map((w) => w.consequence.id))).toEqual(new Set(['x', 'y']));
  });

  it('treats a link to a deleted consequence as no link', () => {
    const dangling = consequence({ id: 'd', causedBy: ['gone'] });
    expect(causalRoots([dangling]).map((c) => c.id)).toEqual(['d']);
  });
});

/* =============================== comparison ============================= */

describe('comparing two worlds', () => {
  const root = world({ id: 'r', baseRule: 'ბაზისი', changedRule: 'გრავიტაცია ×2', topicIds: ['gravity'] });
  const slow = world({ id: 'slow', parentId: 'r', changedRule: 'ევოლუციური ადაპტაცია', conclusion: 'სიცოცხლე ეგუება' });
  const fast = world({ id: 'fast', parentId: 'r', changedRule: 'მყისიერი გადასვლა', conclusion: 'ადამიანი ვერ უძლებს' });
  const worlds = [root, slow, fast];

  const cons: Consequence[] = [
    consequence({ id: 's1', worldId: 'slow', kind: 'effect', level: 1, text: 'ჩონჩხი მძლავრდება' }),
    consequence({ id: 's2', worldId: 'slow', kind: 'enables', level: 2, text: 'ახალი ეკოსისტემები' }),
    consequence({ id: 'f1', worldId: 'fast', kind: 'effect', level: 1, text: 'ჩონჩხი მძლავრდება' }),
    consequence({ id: 'f2', worldId: 'fast', kind: 'breaks', level: 1, text: 'ხერხემალი ვერ უძლებს' }),
  ];

  const cmp = compareWorlds('slow', 'fast', worlds, cons)!;

  it('identifies the shared ancestor and that they are siblings', () => {
    expect(cmp.ancestor?.id).toBe('r');
    expect(cmp.siblings).toBe(true);
  });

  it('marks the inherited base as the same and the change as different', () => {
    const base = cmp.fields.find((f) => f.label === 'baseRule')!;
    const changed = cmp.fields.find((f) => f.label === 'changedRule')!;
    expect(base.same).toBe(true);
    expect(base.a).toBe('ბაზისი');
    expect(changed.same).toBe(false);
  });

  it('separates shared consequences from those unique to each side', () => {
    const effects = cmp.consequences.find((c) => c.kind === 'effect')!;
    expect(effects.shared).toHaveLength(1);
    expect(effects.onlyA).toEqual([]);
    expect(effects.onlyB).toEqual([]);

    const breaks = cmp.consequences.find((c) => c.kind === 'breaks')!;
    expect(breaks.onlyB.map((c) => c.id)).toEqual(['f2']);
    expect(breaks.onlyA).toEqual([]);
  });

  it('compares conclusions', () => {
    const conclusion = cmp.fields.find((f) => f.label === 'conclusion')!;
    expect(conclusion.same).toBe(false);
    expect(conclusion.a).toBe('სიცოცხლე ეგუება');
  });

  it('detects an ancestor relationship rather than siblings', () => {
    const direct = compareWorlds('r', 'slow', worlds, cons)!;
    expect(direct.siblings).toBe(false);
  });

  it('refuses to compare a world with itself or with a missing one', () => {
    expect(compareWorlds('slow', 'slow', worlds, cons)).toBeNull();
    expect(compareWorlds('slow', 'nope', worlds, cons)).toBeNull();
  });
});

/* ============================ import / export =========================== */

describe('export and import', () => {
  const w = world({ id: 'x1', title: 'გრავიტაცია ×2', changedRule: 'ორჯერ ძლიერი', topicIds: ['gravity'] });
  const branch = world({ id: 'x2', title: 'ტოტი', parentId: 'x1' });
  const cons = [consequence({ id: 'cx', worldId: 'x1', text: 'წონა იზრდება' })];

  it('round-trips worlds, branches and consequences', () => {
    const dump = exportWorlds([w, branch], cons, 42);
    const parsed = parseWorldsImport(JSON.parse(JSON.stringify(dump)));

    expect(parsed.errors).toEqual([]);
    expect(parsed.worlds.map((x) => x.id)).toEqual(['x1', 'x2']);
    expect(parsed.worlds[1]!.parentId).toBe('x1');
    expect(parsed.consequences[0]!.text).toBe('წონა იზრდება');
    expect(dump.exportedAt).toBe(42);
  });

  it('never exports a consequence whose world is absent', () => {
    const dump = exportWorlds([w], [...cons, consequence({ id: 'orphan', worldId: 'elsewhere' })]);
    expect(dump.consequences.map((c) => c.id)).toEqual(['cx']);
  });

  it('rejects a file that is not a worlds export', () => {
    expect(parseWorldsImport({ format: 'other' }).errors).toHaveLength(1);
    expect(parseWorldsImport(null).errors).toHaveLength(1);
    expect(parseWorldsImport('nope').errors).toHaveLength(1);
    expect(parseWorldsImport(42).errors).toHaveLength(1);
  });

  it('skips malformed records, reports each, and keeps the good ones', () => {
    const parsed = parseWorldsImport({
      format: 'lukas-labo-parallel-worlds',
      version: 1,
      worlds: [
        { id: 'ok', title: 'კარგი', status: 'exploring' },
        { id: 'dup', title: 'ერთი' },
        { id: 'dup', title: 'მეორე' },
        { title: 'უid-ოდ' },
        { id: 'weird', title: 'უცნობი სტატუსი', status: 'teleported' },
      ],
      consequences: [
        { id: 'c-ok', worldId: 'ok', kind: 'effect', level: 2, text: 'კარგი შედეგი' },
        { id: 'c-lost', worldId: 'missing', kind: 'effect', level: 1, text: 'უსახლკარო' },
        { id: 'c-kind', worldId: 'ok', kind: 'exploded', level: 1, text: 'ცუდი ტიპი' },
        { id: 'c-level', worldId: 'ok', kind: 'effect', level: 9, text: 'ცუდი დონე' },
        { worldId: 'ok', kind: 'effect', level: 1, text: 'უid-ოდ' },
      ],
    });

    expect(parsed.worlds.map((w) => w.id)).toEqual(['ok', 'dup', 'weird']);
    // An unknown status degrades to draft rather than rejecting the world.
    expect(parsed.worlds.find((w) => w.id === 'weird')!.status).toBe('draft');
    expect(parsed.consequences.map((c) => c.id)).toEqual(['c-ok']);
    expect(parsed.errors.length).toBe(6);
  });

  it('promotes a branch to a root when its parent did not survive', () => {
    const parsed = parseWorldsImport({
      format: 'lukas-labo-parallel-worlds',
      version: 1,
      worlds: [{ id: 'child', title: 'ობოლი', parentId: 'vanished' }],
      consequences: [],
    });
    expect(parsed.worlds[0]!.parentId).toBeUndefined();
    expect(parsed.errors[0]).toMatch(/მშობელი/);
  });

  it('drops causal links to consequences that did not survive', () => {
    const parsed = parseWorldsImport({
      format: 'lukas-labo-parallel-worlds',
      version: 1,
      worlds: [{ id: 'w', title: 'სამყარო' }],
      consequences: [
        { id: 'keep', worldId: 'w', kind: 'effect', level: 1, text: 'დარჩა', causedBy: ['gone'] },
      ],
    });
    expect(parsed.consequences[0]!.causedBy).toEqual([]);
  });

  it('warns about a newer file but imports what it understands', () => {
    const parsed = parseWorldsImport({
      format: 'lukas-labo-parallel-worlds',
      version: 99,
      worlds: [{ id: 'w', title: 'სამყარო' }],
      consequences: [],
    });
    expect(parsed.errors[0]).toMatch(/99/);
    expect(parsed.worlds).toHaveLength(1);
  });
});
