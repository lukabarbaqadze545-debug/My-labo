import { NODE_TYPES, RELATION_TYPES, type KnowledgeEdge, type KnowledgeNode, type KnowledgeNodeType, type RelationType } from './types';

/**
 * Import and export of hand-made graph data.
 *
 * Only manual nodes and edges travel. Exporting the derived graph as well
 * would produce a file that duplicates the entire library and goes stale the
 * moment the app's content is updated — and on import it would collide with
 * the very entities it was copied from.
 *
 * Import is defensive: this file may have been hand-edited or produced by an
 * older version, so every record is validated and bad ones are reported rather
 * than silently dropped or, worse, written through.
 */

export const GRAPH_EXPORT_VERSION = 1;

export interface GraphExport {
  format: 'lukas-labo-knowledge-graph';
  version: number;
  exportedAt: number;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export function exportGraphData(
  nodes: readonly KnowledgeNode[],
  edges: readonly KnowledgeEdge[],
  now = Date.now(),
): GraphExport {
  return {
    format: 'lukas-labo-knowledge-graph',
    version: GRAPH_EXPORT_VERSION,
    exportedAt: now,
    nodes: nodes.filter((node) => node.origin === 'manual').map((node) => ({ ...node })),
    edges: edges.filter((edge) => edge.origin === 'manual').map((edge) => ({ ...edge })),
  };
}

export interface GraphImportResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  /** Human-readable reasons records were rejected. */
  errors: string[];
}

const NODE_TYPE_SET = new Set<string>(NODE_TYPES);
const RELATION_SET = new Set<string>(RELATION_TYPES);

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function parseGraphImport(input: unknown, now = Date.now()): GraphImportResult {
  const errors: string[] = [];
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];

  const data = input as Partial<GraphExport> | null;
  if (!data || typeof data !== 'object') {
    return { nodes, edges, errors: ['ფაილი არ არის სწორი JSON ობიექტი.'] };
  }
  if (data.format !== 'lukas-labo-knowledge-graph') {
    return { nodes, edges, errors: ['ეს ფაილი ლაბოს ცოდნის რუკის ექსპორტი არ არის.'] };
  }
  if (typeof data.version === 'number' && data.version > GRAPH_EXPORT_VERSION) {
    errors.push(`ფაილი უფრო ახალი ვერსიისაა (${data.version}) — ნაწილი შეიძლება არ ჩაიტვირთოს.`);
  }

  const seenNodes = new Set<string>();
  for (const raw of Array.isArray(data.nodes) ? data.nodes : []) {
    const row = raw as Partial<KnowledgeNode>;
    const id = str(row.id);
    const title = str(row.title);
    const type = str(row.type);

    if (!id || !title || !type) {
      errors.push('კვანძი გამოტოვდა: აკლია id, სათაური ან ტიპი.');
      continue;
    }
    if (!NODE_TYPE_SET.has(type)) {
      errors.push(`კვანძი „${title}" გამოტოვდა: უცნობი ტიპი „${type}".`);
      continue;
    }
    if (seenNodes.has(id)) {
      errors.push(`კვანძი „${title}" გამოტოვდა: id მეორდება.`);
      continue;
    }
    seenNodes.add(id);

    nodes.push({
      id,
      type: type as KnowledgeNodeType,
      title,
      ...(str(row.description) ? { description: str(row.description)! } : {}),
      ...(str(row.subjectId) ? { subjectId: str(row.subjectId)! } : {}),
      tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : [],
      // Anything imported is manual by definition: derived data is never in a file.
      origin: 'manual',
      ...(typeof row.masteryLevel === 'number'
        ? { masteryLevel: Math.min(1, Math.max(0, row.masteryLevel)), masterySource: 'declared' as const }
        : {}),
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : now,
    });
  }

  const seenEdges = new Set<string>();
  for (const raw of Array.isArray(data.edges) ? data.edges : []) {
    const row = raw as Partial<KnowledgeEdge>;
    const id = str(row.id);
    const source = str(row.sourceNodeId);
    const target = str(row.targetNodeId);
    const relationType = str(row.relationType);

    if (!id || !source || !target || !relationType) {
      errors.push('კავშირი გამოტოვდა: აკლია სავალდებულო ველი.');
      continue;
    }
    if (!RELATION_SET.has(relationType)) {
      errors.push(`კავშირი გამოტოვდა: უცნობი ტიპი „${relationType}".`);
      continue;
    }
    if (source === target) {
      errors.push('კავშირი გამოტოვდა: კვანძი საკუთარ თავს უკავშირდება.');
      continue;
    }
    if (seenEdges.has(id)) {
      errors.push('კავშირი გამოტოვდა: id მეორდება.');
      continue;
    }
    seenEdges.add(id);

    edges.push({
      id,
      sourceNodeId: source,
      targetNodeId: target,
      relationType: relationType as RelationType,
      ...(str(row.note) ? { note: str(row.note)! } : {}),
      origin: 'manual',
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
    });
  }

  return { nodes, edges, errors };
}
