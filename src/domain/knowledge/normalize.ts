import { library, t, type RelationKind } from '@/content';
import type { Book } from '@/domain/books';
import type { UserDocument, UserNote, UserTopic } from '@/persistence/db';
import {
  type KnowledgeEdge,
  type KnowledgeGraph,
  type KnowledgeNode,
  type KnowledgeNodeType,
  type RelationType,
} from './types';

/**
 * Normalisation: existing Luka's Labo data → graph nodes and derived edges.
 *
 * Nothing is copied. A node carries a title, a type and a pointer; the topic,
 * document or book itself stays where it lives and remains the only place its
 * content is stored. That is why importing a book or editing a document needs
 * no graph maintenance — the next rebuild simply sees the new state.
 *
 * Derived edges are recomputed here on every build and never persisted, so
 * they cannot drift from the structure they describe. Only hand-drawn nodes
 * and edges are stored.
 */

/* ------------------------------- node ids -------------------------------- */

/**
 * Node ids are namespaced by type. A topic called `dna` and a hand-made
 * concept node about DNA are different things and must not collide, and the
 * namespace also lets a node id be resolved back to its Labo entity without a
 * lookup table.
 */
export function nodeId(type: KnowledgeNodeType, sourceId: string): string {
  return `${type}:${sourceId}`;
}

/** The Labo id behind a derived node id, or null for a hand-made node. */
export function sourceIdOf(id: string): { type: KnowledgeNodeType; sourceId: string } | null {
  const at = id.indexOf(':');
  if (at <= 0) return null;
  const type = id.slice(0, at) as KnowledgeNodeType;
  return { type, sourceId: id.slice(at + 1) };
}

/* ------------------------------ relation map ----------------------------- */

/**
 * The authored vocabulary, translated. `requires` is the important one: it is
 * the only prerequisite signal the library already contains, and it maps onto
 * DEPENDS_ON in the same direction ("gravity requires Newton's laws").
 */
const RELATION_FROM_KIND: Record<RelationKind, RelationType> = {
  partOf: 'PART_OF',
  requires: 'DEPENDS_ON',
  leadsTo: 'LEADS_TO',
  explains: 'EXPLAINS',
  contrasts: 'CONTRASTS',
  discoveredBy: 'DISCOVERED_BY',
  appliesTo: 'APPLIES_TO',
};

/** Library entity kind → node type, for resolving authored relation endpoints. */
function libraryNodeId(id: string): string | null {
  if (library.topicById.has(id)) return nodeId('topic', id);
  if (library.personById.has(id)) return nodeId('person', id);
  if (library.formulaById.has(id)) return nodeId('formula', id);
  if (library.factById.has(id)) return nodeId('fact', id);
  if (library.eventById.has(id)) return nodeId('event', id);
  if (library.subjectById.has(id)) return nodeId('subject', id);
  return null;
}

/* -------------------------------- building ------------------------------- */

export interface NormalizeInput {
  documents?: readonly UserDocument[];
  notes?: readonly UserNote[];
  books?: readonly Book[];
  userTopics?: readonly UserTopic[];
  /** Hand-made nodes, from storage. */
  manualNodes?: readonly KnowledgeNode[];
  /** Hand-drawn edges, from storage. */
  manualEdges?: readonly KnowledgeEdge[];
  /** topicId → 0..1, from `estimateMastery`. */
  mastery?: ReadonlyMap<string, number>;
  now?: number;
}

/** A derived edge's id is a function of its endpoints, so rebuilds are stable. */
function derivedEdge(
  source: string,
  target: string,
  relationType: RelationType,
  note?: string,
): KnowledgeEdge {
  return {
    id: `d:${source}|${relationType}|${target}`,
    sourceNodeId: source,
    targetNodeId: target,
    relationType,
    ...(note ? { note } : {}),
    origin: 'derived',
  };
}

export function buildKnowledgeGraph(input: NormalizeInput = {}): KnowledgeGraph {
  const now = input.now ?? Date.now();
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const mastery = input.mastery;

  const base = { tags: [] as string[], origin: 'derived' as const, createdAt: now, updatedAt: now };

  /* ------------------------------ subjects ------------------------------ */
  for (const subject of library.subjects) {
    nodes.push({
      ...base,
      id: nodeId('subject', subject.id),
      type: 'subject',
      title: t(subject.name),
      description: t(subject.tagline),
      sourceEntityId: subject.id,
      href: `/labs/${subject.id}`,
    });
  }

  /* ------------------------------- topics ------------------------------- */
  const allTopics = [
    ...library.topics.map((topic) => ({ topic, tags: topic.tags ?? [] })),
    ...(input.userTopics ?? []).map((topic) => ({ topic, tags: topic.tags ?? [] })),
  ];

  for (const { topic, tags } of allTopics) {
    const level = mastery?.get(topic.id);
    nodes.push({
      ...base,
      id: nodeId('topic', topic.id),
      type: 'topic',
      title: t(topic.title),
      description: t(topic.hook),
      subjectId: topic.subjectId,
      tags: [...tags],
      sourceEntityId: topic.id,
      href: `/topics/${topic.id}`,
      ...(level !== undefined ? { masteryLevel: level, masterySource: 'estimated' as const } : {}),
    });

    // Structure that already exists needs no manual graph entry.
    edges.push(derivedEdge(nodeId('topic', topic.id), nodeId('subject', topic.subjectId), 'PART_OF'));

    for (const personId of topic.personIds ?? []) {
      edges.push(derivedEdge(nodeId('topic', topic.id), nodeId('person', personId), 'DISCOVERED_BY'));
    }
    for (const formulaId of topic.formulaIds ?? []) {
      edges.push(derivedEdge(nodeId('formula', formulaId), nodeId('topic', topic.id), 'USED_BY'));
    }
    for (const eventId of topic.eventIds ?? []) {
      edges.push(derivedEdge(nodeId('event', eventId), nodeId('topic', topic.id), 'RELATED_TO'));
    }
    for (const factId of topic.factIds ?? []) {
      edges.push(derivedEdge(nodeId('fact', factId), nodeId('topic', topic.id), 'RELATED_TO'));
    }
  }

  /* --------------------- other authored library entities ---------------- */
  for (const person of library.people) {
    nodes.push({
      ...base,
      id: nodeId('person', person.id),
      type: 'person',
      title: t(person.name),
      description: t(person.known),
      subjectId: person.subjectId,
      sourceEntityId: person.id,
      href: `/people/${person.id}`,
    });
  }
  for (const formula of library.formulas) {
    nodes.push({
      ...base,
      id: nodeId('formula', formula.id),
      type: 'formula',
      title: t(formula.name),
      description: formula.expression,
      subjectId: formula.subjectId,
      sourceEntityId: formula.id,
      href: `/formulas?open=${formula.id}`,
    });
  }
  for (const fact of library.facts) {
    nodes.push({
      ...base,
      id: nodeId('fact', fact.id),
      type: 'fact',
      title: t(fact.text).slice(0, 70),
      subjectId: fact.subjectId,
      sourceEntityId: fact.id,
      href: `/facts?open=${fact.id}`,
    });
  }
  for (const event of library.events) {
    nodes.push({
      ...base,
      id: nodeId('event', event.id),
      type: 'event',
      title: `${event.year} · ${t(event.title)}`,
      description: t(event.summary),
      subjectId: event.subjectId,
      sourceEntityId: event.id,
      href: `/timeline?open=${event.id}`,
    });
  }

  /* --------------------------- authored edges --------------------------- */
  for (const relation of library.relationships) {
    const source = libraryNodeId(relation.from);
    const target = libraryNodeId(relation.to);
    if (!source || !target) continue;
    edges.push(
      derivedEdge(source, target, RELATION_FROM_KIND[relation.kind], relation.note ? t(relation.note) : undefined),
    );
  }

  /* ----------------------------- user data ------------------------------ */
  for (const doc of input.documents ?? []) {
    if (doc.trashedAt) continue;
    nodes.push({
      ...base,
      id: nodeId('document', doc.id),
      type: 'document',
      title: doc.title || 'უსათაურო',
      description: doc.text.slice(0, 160),
      ...(doc.subjectId ? { subjectId: doc.subjectId } : {}),
      sourceEntityId: doc.id,
      href: `/write/${doc.id}`,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
    if (doc.subjectId) {
      edges.push(derivedEdge(nodeId('document', doc.id), nodeId('subject', doc.subjectId), 'PART_OF'));
    }
  }

  for (const note of input.notes ?? []) {
    nodes.push({
      ...base,
      id: nodeId('note', note.id),
      type: 'note',
      title: note.title || note.body.slice(0, 60),
      description: note.body.slice(0, 160),
      ...(note.subjectId ? { subjectId: note.subjectId } : {}),
      tags: [...(note.tags ?? [])],
      sourceEntityId: note.id,
      href: '/notes',
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    });
    if (note.topicId) {
      edges.push(derivedEdge(nodeId('note', note.id), nodeId('topic', note.topicId), 'RELATED_TO'));
    } else if (note.subjectId) {
      edges.push(derivedEdge(nodeId('note', note.id), nodeId('subject', note.subjectId), 'PART_OF'));
    }
  }

  for (const book of input.books ?? []) {
    nodes.push({
      ...base,
      id: nodeId('book', book.id),
      type: 'book',
      title: book.title,
      ...(book.author ? { description: book.author } : {}),
      ...(book.subject ? { subjectId: book.subject } : {}),
      tags: [...book.tags],
      sourceEntityId: book.id,
      href: '/books',
      createdAt: book.importedAt,
      updatedAt: book.importedAt,
    });
    if (book.subject) {
      edges.push(derivedEdge(nodeId('book', book.id), nodeId('subject', book.subject), 'PART_OF'));
    }
  }

  /* ------------------------------- manual ------------------------------- */
  for (const node of input.manualNodes ?? []) nodes.push({ ...node, origin: 'manual' });

  /* ------------------------------ assemble ------------------------------ */
  const nodeById = new Map<string, KnowledgeNode>();
  for (const node of nodes) {
    // A hand-made node may deliberately override a derived one (for instance to
    // set a declared mastery); last write wins, and manual comes last.
    nodeById.set(node.id, node);
  }

  const merged = [...edges, ...(input.manualEdges ?? []).map((e) => ({ ...e, origin: 'manual' as const }))];
  const valid: KnowledgeEdge[] = [];
  const seen = new Set<string>();

  for (const edge of merged) {
    // Edge validation: no dangling endpoints, no self-loops, no duplicates.
    // A manual edge whose node was deleted simply disappears rather than
    // poisoning traversal with an id that resolves to nothing.
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) continue;
    if (edge.sourceNodeId === edge.targetNodeId) continue;
    const key = `${edge.sourceNodeId}|${edge.relationType}|${edge.targetNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(edge);
  }

  const incident = new Map<string, KnowledgeEdge[]>();
  const push = (id: string, edge: KnowledgeEdge) => {
    const list = incident.get(id);
    if (list) list.push(edge);
    else incident.set(id, [edge]);
  };
  for (const edge of valid) {
    push(edge.sourceNodeId, edge);
    push(edge.targetNodeId, edge);
  }

  return { nodes: [...nodeById.values()], edges: valid, nodeById, incident };
}
