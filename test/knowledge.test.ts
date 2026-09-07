import { describe, expect, it } from 'vitest';
import {
  analyseGraph,
  buildKnowledgeGraph,
  connectedComponents,
  degree,
  dependentsOf,
  estimateMastery,
  filterGraph,
  findPrerequisiteGaps,
  graphContext,
  incidentEdges,
  isolatedNodes,
  learningPath,
  neighbourhood,
  neighbours,
  nodeId,
  prerequisitesOf,
  shortestPaths,
  sourceIdOf,
  exportGraphData,
  parseGraphImport,
  type KnowledgeEdge,
  type KnowledgeNode,
} from '@/domain/knowledge';
import { library } from '@/content';
import type { UserDocument, UserNote } from '@/persistence/db';

/**
 * The graph is tested against the *real* library, not a fixture, because the
 * whole point of normalisation is that it works on the content Luka's Labo
 * actually ships. Hand-built fixtures are used only where a specific shape is
 * needed (a cycle, an island) that the library does not contain.
 */

const manualNode = (id: string, over: Partial<KnowledgeNode> = {}): KnowledgeNode => ({
  id,
  type: 'concept',
  title: id,
  tags: [],
  origin: 'manual',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const manualEdge = (
  source: string,
  target: string,
  relationType: KnowledgeEdge['relationType'] = 'RELATED_TO',
): KnowledgeEdge => ({
  id: `m:${source}->${target}:${relationType}`,
  sourceNodeId: source,
  targetNodeId: target,
  relationType,
  origin: 'manual',
});

/**
 * A small isolated graph: A → B → C, plus a lone D.
 *
 * `buildKnowledgeGraph` always derives the whole library, so the fixture is
 * isolated by filtering to manual origin — which runs the real production
 * filter rather than hand-assembling a graph object the app would never build.
 */
function tinyGraph(edges: KnowledgeEdge[] = [], extra: KnowledgeNode[] = []) {
  return filterGraph(
    buildKnowledgeGraph({
      manualNodes: [manualNode('a'), manualNode('b'), manualNode('c'), manualNode('d'), ...extra],
      manualEdges: edges,
    }),
    { origin: 'manual' },
  );
}

/* ============================== normalization ============================ */

describe('normalization', () => {
  const graph = buildKnowledgeGraph();

  it('mirrors every library subject and topic as a node', () => {
    expect(graph.nodeById.has(nodeId('subject', library.subjects[0]!.id))).toBe(true);
    for (const topic of library.topics.slice(0, 20)) {
      expect(graph.nodeById.has(nodeId('topic', topic.id))).toBe(true);
    }
  });

  it('points at the original instead of copying its content', () => {
    const topic = library.topics[0]!;
    const node = graph.nodeById.get(nodeId('topic', topic.id))!;
    expect(node.sourceEntityId).toBe(topic.id);
    expect(node.href).toBe(`/topics/${topic.id}`);
    expect(node.origin).toBe('derived');
  });

  it('namespaces ids so a manual node cannot collide with a topic', () => {
    const topic = library.topics[0]!;
    const collide = buildKnowledgeGraph({ manualNodes: [manualNode(topic.id)] });
    expect(collide.nodeById.has(topic.id)).toBe(true);
    expect(collide.nodeById.has(nodeId('topic', topic.id))).toBe(true);
    expect(collide.nodeById.get(topic.id)!.origin).toBe('manual');
  });

  it('round-trips a node id back to its Labo entity', () => {
    expect(sourceIdOf(nodeId('topic', 'dna'))).toEqual({ type: 'topic', sourceId: 'dna' });
    expect(sourceIdOf('kn_local')).toBeNull();
  });

  it('derives the subject/topic hierarchy without manual entry', () => {
    const topic = library.topics[0]!;
    const partOf = graph.edges.find(
      (e) => e.sourceNodeId === nodeId('topic', topic.id) && e.relationType === 'PART_OF',
    );
    expect(partOf?.targetNodeId).toBe(nodeId('subject', topic.subjectId));
    expect(partOf?.origin).toBe('derived');
  });

  it('translates authored relations, keeping requires as a dependency', () => {
    const requires = library.relationships.find((r) => r.kind === 'requires')!;
    const edge = graph.edges.find(
      (e) =>
        e.sourceNodeId === nodeId('topic', requires.from) &&
        e.targetNodeId.endsWith(`:${requires.to}`) &&
        e.relationType === 'DEPENDS_ON',
    );
    expect(edge).toBeDefined();
  });

  it('derives edges with stable ids across rebuilds', () => {
    const again = buildKnowledgeGraph();
    expect(again.edges.map((e) => e.id).slice(0, 50)).toEqual(graph.edges.map((e) => e.id).slice(0, 50));
  });

  it('brings in documents, notes and their anchors', () => {
    const docs: UserDocument[] = [
      { id: 'd1', title: 'ჩემი ესე', doc: {}, text: 'ტექსტი', wordCount: 1, createdAt: 1, updatedAt: 2, subjectId: 'biology' },
      { id: 'd2', title: 'წაშლილი', doc: {}, text: '', wordCount: 0, createdAt: 1, updatedAt: 2, trashedAt: 5 },
    ];
    const notes: UserNote[] = [
      { id: 'n1', kind: 'idea', body: 'დნმ-ზე ფიქრი', topicId: 'dna', createdAt: 1, updatedAt: 1 },
    ];
    const withUser = buildKnowledgeGraph({ documents: docs, notes });

    expect(withUser.nodeById.has(nodeId('document', 'd1'))).toBe(true);
    expect(withUser.nodeById.has(nodeId('document', 'd2'))).toBe(false); // trashed
    expect(
      withUser.edges.some(
        (e) => e.sourceNodeId === nodeId('note', 'n1') && e.targetNodeId === nodeId('topic', 'dna'),
      ),
    ).toBe(true);
  });
});

/* ============================= edge validation =========================== */

describe('edge validation', () => {
  it('drops edges whose endpoints do not exist', () => {
    const graph = tinyGraph([manualEdge('a', 'ghost'), manualEdge('a', 'b')]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.targetNodeId).toBe('b');
  });

  it('drops self-loops', () => {
    expect(tinyGraph([manualEdge('a', 'a')]).edges).toHaveLength(0);
  });

  it('deduplicates identical relationships', () => {
    const graph = tinyGraph([manualEdge('a', 'b'), manualEdge('a', 'b')]);
    expect(graph.edges).toHaveLength(1);
  });

  it('keeps two different relation types between the same pair', () => {
    const graph = tinyGraph([manualEdge('a', 'b', 'RELATED_TO'), manualEdge('a', 'b', 'DEPENDS_ON')]);
    expect(graph.edges).toHaveLength(2);
  });

  it('survives deletion of a node by dropping its edges', () => {
    const before = tinyGraph([manualEdge('a', 'b')]);
    expect(before.edges).toHaveLength(1);
    const after = filterGraph(
      buildKnowledgeGraph({
        manualNodes: [manualNode('a')], // 'b' deleted
        manualEdges: [manualEdge('a', 'b')],
      }),
      { origin: 'manual' },
    );
    expect(after.edges).toHaveLength(0);
    expect(after.nodeById.has('a')).toBe(true);
  });
});

/* ============================ neighbour lookup =========================== */

describe('neighbour lookup', () => {
  const graph = tinyGraph([manualEdge('a', 'b'), manualEdge('b', 'c')]);

  it('finds neighbours in both directions', () => {
    expect(neighbours(graph, 'b').map((n) => n.id).sort()).toEqual(['a', 'c']);
  });

  it('reports direction on each incident edge', () => {
    const fromB = incidentEdges(graph, 'b');
    expect(fromB.find((e) => e.otherId === 'a')!.inverse).toBe(true);
    expect(fromB.find((e) => e.otherId === 'c')!.inverse).toBe(false);
  });

  it('counts degree and finds isolated nodes', () => {
    expect(degree(graph, 'b')).toBe(2);
    expect(degree(graph, 'd')).toBe(0);
    expect(isolatedNodes(graph).map((n) => n.id)).toEqual(['d']);
  });

  it('expands a neighbourhood by depth and respects the cap', () => {
    expect(neighbourhood(graph, ['a'], { depth: 1 })).toEqual(new Set(['a', 'b']));
    expect(neighbourhood(graph, ['a'], { depth: 2 })).toEqual(new Set(['a', 'b', 'c']));
    expect(neighbourhood(graph, ['a'], { depth: 5, limit: 2 }).size).toBe(2);
  });
});

/* ============================== path finding ============================= */

describe('path finding', () => {
  it('finds the shortest chain between two nodes', () => {
    const graph = tinyGraph([manualEdge('a', 'b'), manualEdge('b', 'c')]);
    const [path] = shortestPaths(graph, 'a', 'c');
    expect(path!.nodes).toEqual(['a', 'b', 'c']);
    expect(path!.edges).toHaveLength(2);
  });

  it('walks against the arrow — connection is not direction', () => {
    const graph = tinyGraph([manualEdge('b', 'a'), manualEdge('c', 'b')]);
    expect(shortestPaths(graph, 'a', 'c')[0]!.nodes).toEqual(['a', 'b', 'c']);
  });

  it('returns several equally short routes when they exist', () => {
    const graph = tinyGraph([
      manualEdge('a', 'b'),
      manualEdge('b', 'd'),
      manualEdge('a', 'c'),
      manualEdge('c', 'd'),
    ]);
    const paths = shortestPaths(graph, 'a', 'd');
    expect(paths.length).toBe(2);
    expect(paths.every((p) => p.nodes.length === 3)).toBe(true);
  });

  it('returns nothing for disconnected nodes', () => {
    expect(shortestPaths(tinyGraph([manualEdge('a', 'b')]), 'a', 'd')).toEqual([]);
  });

  it('is cycle-safe', () => {
    const graph = tinyGraph([manualEdge('a', 'b'), manualEdge('b', 'c'), manualEdge('c', 'a')]);
    const paths = shortestPaths(graph, 'a', 'c');
    expect(paths[0]!.nodes).toEqual(['a', 'c']);
    // No path may repeat a node.
    for (const path of paths) expect(new Set(path.nodes).size).toBe(path.nodes.length);
  });

  it('handles a node pathing to itself and to a missing node', () => {
    const graph = tinyGraph([manualEdge('a', 'b')]);
    expect(shortestPaths(graph, 'a', 'a')).toEqual([{ nodes: ['a'], edges: [] }]);
    expect(shortestPaths(graph, 'a', 'nope')).toEqual([]);
  });

  it('connects two real library topics through authored relations', () => {
    const graph = buildKnowledgeGraph();
    const paths = shortestPaths(graph, nodeId('topic', 'black-holes'), nodeId('subject', 'physics'));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]!.nodes[0]).toBe(nodeId('topic', 'black-holes'));
    expect(paths[0]!.nodes.at(-1)).toBe(nodeId('subject', 'physics'));
  });
});

/* ========================== disconnected graphs ========================== */

describe('connected components', () => {
  it('separates islands, largest first', () => {
    const graph = tinyGraph([manualEdge('a', 'b'), manualEdge('b', 'c')]);
    const components = connectedComponents(graph);
    expect(components).toHaveLength(2);
    expect(components[0]).toHaveLength(3);
    expect(components[1]).toEqual(['d']);
  });

  it('handles a graph with no edges at all — every node its own island', () => {
    const loose = filterGraph(buildKnowledgeGraph({ manualNodes: [manualNode('a'), manualNode('b')] }), {
      origin: 'manual',
    });
    expect(connectedComponents(loose)).toEqual([['a'], ['b']]);
  });
});

/* ========================== prerequisite analysis ======================== */

describe('prerequisite gaps', () => {
  const studied = manualNode('advanced', { title: 'Tree DP', masteryLevel: 0.8, masterySource: 'declared' });
  const weak = manualNode('basic', { title: 'DFS', masteryLevel: 0.1, masterySource: 'declared' });
  const solid = manualNode('known', { title: 'Recursion', masteryLevel: 0.9, masterySource: 'declared' });

  const graph = filterGraph(
    buildKnowledgeGraph({
      manualNodes: [studied, weak, solid],
      manualEdges: [
        manualEdge('advanced', 'basic', 'DEPENDS_ON'),
        manualEdge('known', 'advanced', 'PREREQUISITE_OF'),
      ],
    }),
    { origin: 'manual' },
  );

  it('resolves prerequisites stored in either direction', () => {
    expect(prerequisitesOf(graph, 'advanced').map((n) => n.id).sort()).toEqual(['basic', 'known']);
  });

  it('resolves dependents', () => {
    expect(dependentsOf(graph, 'basic').map((n) => n.id)).toEqual(['advanced']);
    expect(dependentsOf(graph, 'known').map((n) => n.id)).toEqual(['advanced']);
  });

  it('reports only the weak prerequisite of a topic being studied', () => {
    const gaps = findPrerequisiteGaps(graph);
    const gap = gaps.find((g) => g.node.id === 'advanced')!;
    expect(gap.missing.map((n) => n.id)).toEqual(['basic']);
  });

  it('never invents a prerequisite from a non-prerequisite edge', () => {
    const loose = filterGraph(
      buildKnowledgeGraph({
        manualNodes: [studied, weak],
        manualEdges: [manualEdge('advanced', 'basic', 'RELATED_TO')],
      }),
      { origin: 'manual' },
    );
    expect(prerequisitesOf(loose, 'advanced')).toEqual([]);
    expect(findPrerequisiteGaps(loose)).toEqual([]);
  });

  it('ignores topics the user has not started', () => {
    const untouched = filterGraph(
      buildKnowledgeGraph({
        manualNodes: [manualNode('x'), weak],
        manualEdges: [manualEdge('x', 'basic', 'DEPENDS_ON')],
      }),
      { origin: 'manual' },
    );
    expect(findPrerequisiteGaps(untouched)).toEqual([]);
  });

  it('orders a learning path deepest-first and terminates on a cycle', () => {
    const chain = filterGraph(
      buildKnowledgeGraph({
        manualNodes: [manualNode('a'), manualNode('b'), manualNode('c')],
        manualEdges: [manualEdge('a', 'b', 'DEPENDS_ON'), manualEdge('b', 'c', 'DEPENDS_ON')],
      }),
      { origin: 'manual' },
    );
    expect(learningPath(chain, 'a').map((n) => n.id)).toEqual(['c', 'b']);

    const cyclic = filterGraph(
      buildKnowledgeGraph({
        manualNodes: [manualNode('a'), manualNode('b')],
        manualEdges: [manualEdge('a', 'b', 'DEPENDS_ON'), manualEdge('b', 'a', 'DEPENDS_ON')],
      }),
      { origin: 'manual' },
    );
    expect(() => learningPath(cyclic, 'a')).not.toThrow();
    expect(learningPath(cyclic, 'a').map((n) => n.id)).toEqual(['b']);
  });
});

/* ================================ mastery =============================== */

describe('mastery estimation', () => {
  it('weighs doing above viewing', () => {
    const viewed = estimateMastery({
      interactions: Array.from({ length: 4 }, () => ({ topicId: 'dna', type: 'view' as const, at: 1 })),
    });
    const noted = estimateMastery({
      notes: [{ id: 'n', kind: 'note', body: 'x', topicId: 'dna', createdAt: 1, updatedAt: 1 }],
    });
    expect(noted.get('dna')!).toBeGreaterThan(viewed.get('dna')!);
  });

  it('credits a completed activity to its topic and stays within 0..1', () => {
    const mastery = estimateMastery({
      activityProgress: Array.from({ length: 20 }, (_, i) => ({
        activityId: `act${i}`,
        completedAt: 5,
        updatedAt: 5,
      })),
      activityTopic: new Map(Array.from({ length: 20 }, (_, i) => [`act${i}`, 'dna'])),
    });
    expect(mastery.get('dna')).toBe(1);
  });

  it('leaves untouched topics absent rather than zero', () => {
    expect(estimateMastery({}).has('dna')).toBe(false);
  });

  it('marks derived mastery as an estimate, never as declared', () => {
    const graph = buildKnowledgeGraph({ mastery: new Map([['dna', 0.5]]) });
    const node = graph.nodeById.get(nodeId('topic', 'dna'))!;
    expect(node.masteryLevel).toBe(0.5);
    expect(node.masterySource).toBe('estimated');
  });
});

/* =============================== filtering ============================== */

describe('filtering', () => {
  const graph = buildKnowledgeGraph();

  it('keeps only the requested node types, and edges follow', () => {
    const subjectsOnly = filterGraph(graph, { types: ['subject'] });
    expect(subjectsOnly.nodes.every((n) => n.type === 'subject')).toBe(true);
    for (const edge of subjectsOnly.edges) {
      expect(subjectsOnly.nodeById.has(edge.sourceNodeId)).toBe(true);
      expect(subjectsOnly.nodeById.has(edge.targetNodeId)).toBe(true);
    }
  });

  it('filters by subject and by search text', () => {
    const physics = filterGraph(graph, { types: ['topic'], subjectIds: ['physics'] });
    expect(physics.nodes.length).toBeGreaterThan(0);
    expect(physics.nodes.every((n) => n.subjectId === 'physics')).toBe(true);

    const searched = filterGraph(graph, { search: 'დნმ' });
    expect(searched.nodes.length).toBeGreaterThan(0);
  });

  it('separates derived from manual', () => {
    const withManual = buildKnowledgeGraph({ manualNodes: [manualNode('mine')] });
    expect(filterGraph(withManual, { origin: 'manual' }).nodes.map((n) => n.id)).toEqual(['mine']);
    expect(filterGraph(withManual, { origin: 'derived' }).nodes.some((n) => n.id === 'mine')).toBe(false);
  });

  it('focuses on a neighbourhood', () => {
    const focused = filterGraph(graph, {
      focus: { rootIds: [nodeId('topic', 'dna')], depth: 1 },
    });
    expect(focused.nodes.some((n) => n.id === nodeId('topic', 'dna'))).toBe(true);
    expect(focused.nodes.length).toBeLessThan(graph.nodes.length);
  });
});

/* =============================== analytics ============================== */

describe('analytics', () => {
  it('summarises the real library graph', () => {
    const stats = analyseGraph(buildKnowledgeGraph());
    expect(stats.totalNodes).toBeGreaterThan(100);
    expect(stats.totalEdges).toBeGreaterThan(100);
    expect(stats.derivedEdges).toBe(stats.totalEdges);
    expect(stats.manualEdges).toBe(0);
    expect(stats.mostConnected[0]!.degree).toBeGreaterThan(0);
    expect(stats.bySubject.length).toBeGreaterThan(0);
  });

  it('counts manual contributions separately', () => {
    const stats = analyseGraph(
      filterGraph(
        buildKnowledgeGraph({
          manualNodes: [manualNode('a'), manualNode('b')],
          manualEdges: [manualEdge('a', 'b')],
        }),
        { origin: 'manual' },
      ),
    );
    expect(stats.manualNodes).toBe(2);
    expect(stats.manualEdges).toBe(1);
  });
});

/* ============================ graph → context =========================== */

describe('graph context for the reasoning layer', () => {
  const graph = buildKnowledgeGraph();

  it('selects a compact neighbourhood, never the whole graph', () => {
    const context = graphContext(graph, 'შავი ხვრელი', { limit: 10 });
    expect(context.matched.length).toBeGreaterThan(0);
    expect(context.nodeIds.length).toBeLessThanOrEqual(10);
    expect(context.nodeIds.length).toBeLessThan(graph.nodes.length);
  });

  it('renders relationships as structure, not as factual evidence', () => {
    const context = graphContext(graph, 'შავი ხვრელი');
    expect(context.structure.length).toBeGreaterThan(0);
    // Structure is relationship statements about named nodes.
    expect(context.structure).toMatch(/„.+" .+ „.+"/);
  });

  it('exposes only content-bearing nodes as sources for grounding', () => {
    const context = graphContext(graph, 'შავი ხვრელი');
    for (const source of context.sources) {
      expect(['topic', 'document', 'note', 'book']).toContain(source.type);
      expect(source.sourceEntityId).toBeTruthy();
    }
    // A subject or formula node is structure only — it carries no passage.
    expect(context.sources.some((s) => s.type === 'subject' as never)).toBe(false);
  });

  it('returns nothing for a query that matches no node', () => {
    expect(graphContext(graph, 'zzzz qqqq wwww')).toEqual({
      matched: [],
      nodeIds: [],
      structure: '',
      sources: [],
    });
  });
});

/* ======================= persistence serialization ====================== */

describe('import and export', () => {
  const nodes: KnowledgeNode[] = [
    manualNode('kn_1', { title: 'GeoRoute', type: 'project', tags: ['maps'] }),
    manualNode('kn_2', { title: 'Dijkstra', type: 'concept' }),
  ];
  const edges: KnowledgeEdge[] = [manualEdge('kn_1', 'kn_2', 'DEPENDS_ON')];

  it('exports only hand-made data, never the derived library', () => {
    const graph = buildKnowledgeGraph({ manualNodes: nodes, manualEdges: edges });
    const dump = exportGraphData(graph.nodes, graph.edges, 111);

    expect(dump.nodes.map((n) => n.id).sort()).toEqual(['kn_1', 'kn_2']);
    expect(dump.edges).toHaveLength(1);
    expect(dump.nodes.some((n) => n.origin === 'derived')).toBe(false);
    expect(dump.exportedAt).toBe(111);
  });

  it('round-trips through JSON without loss', () => {
    const dump = exportGraphData(nodes, edges);
    const parsed = parseGraphImport(JSON.parse(JSON.stringify(dump)));

    expect(parsed.errors).toEqual([]);
    expect(parsed.nodes.map((n) => n.title)).toEqual(['GeoRoute', 'Dijkstra']);
    expect(parsed.nodes[0]!.tags).toEqual(['maps']);
    expect(parsed.edges[0]!.relationType).toBe('DEPENDS_ON');
  });

  it('rejects a file that is not a graph export', () => {
    expect(parseGraphImport({ format: 'something-else' }).errors).toHaveLength(1);
    expect(parseGraphImport(null).errors).toHaveLength(1);
    expect(parseGraphImport('nope').errors).toHaveLength(1);
  });

  it('skips malformed records and says why, keeping the good ones', () => {
    const parsed = parseGraphImport({
      format: 'lukas-labo-knowledge-graph',
      version: 1,
      nodes: [
        { id: 'ok', type: 'concept', title: 'კარგი' },
        { id: 'bad-type', type: 'wormhole', title: 'ცუდი' },
        { id: 'ok', type: 'concept', title: 'დუბლიკატი' },
        { type: 'concept' },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'ok', targetNodeId: 'other', relationType: 'RELATED_TO' },
        { id: 'e2', sourceNodeId: 'ok', targetNodeId: 'ok', relationType: 'RELATED_TO' },
        { id: 'e3', sourceNodeId: 'ok', targetNodeId: 'other', relationType: 'TELEPORTS_TO' },
      ],
    });

    expect(parsed.nodes.map((n) => n.id)).toEqual(['ok']);
    expect(parsed.errors.length).toBe(5);
    expect(parsed.edges.map((e) => e.id)).toEqual(['e1']); // self-loop and bad type rejected
  });

  it('marks everything imported as manual, whatever the file claimed', () => {
    const parsed = parseGraphImport({
      format: 'lukas-labo-knowledge-graph',
      version: 1,
      nodes: [{ id: 'x', type: 'topic', title: 'ჩასმული', origin: 'derived' }],
      edges: [],
    });
    expect(parsed.nodes[0]!.origin).toBe('manual');
  });

  it('treats a hand-typed mastery level as declared, not estimated', () => {
    const parsed = parseGraphImport({
      format: 'lukas-labo-knowledge-graph',
      version: 1,
      nodes: [{ id: 'x', type: 'concept', title: 'ცნება', masteryLevel: 0.7 }],
      edges: [],
    });
    expect(parsed.nodes[0]!.masterySource).toBe('declared');
  });

  it('warns about a newer file version but still imports what it can', () => {
    const parsed = parseGraphImport({
      format: 'lukas-labo-knowledge-graph',
      version: 99,
      nodes: [{ id: 'x', type: 'concept', title: 'ცნება' }],
      edges: [],
    });
    expect(parsed.errors[0]).toMatch(/99/);
    expect(parsed.nodes).toHaveLength(1);
  });

  it('imported edges survive a rebuild only while their nodes exist', () => {
    const dump = exportGraphData(nodes, edges);
    const parsed = parseGraphImport(dump);
    const rebuilt = filterGraph(
      buildKnowledgeGraph({ manualNodes: parsed.nodes, manualEdges: parsed.edges }),
      { origin: 'manual' },
    );
    expect(rebuilt.edges).toHaveLength(1);

    const withoutTarget = filterGraph(
      buildKnowledgeGraph({ manualNodes: [parsed.nodes[0]!], manualEdges: parsed.edges }),
      { origin: 'manual' },
    );
    expect(withoutTarget.edges).toHaveLength(0);
  });
});
