import {
  CONSEQUENCE_KINDS,
  CONSEQUENCE_LEVELS,
  WORLD_STATUSES,
  type Consequence,
  type ConsequenceKind,
  type ConsequenceLevel,
  type ParallelWorld,
  type WorldStatus,
} from './types';

/**
 * Export and import of thought experiments.
 *
 * Worlds are the user's own reasoning, so a file is the only way to get them
 * off one device. Import is defensive: the file may be hand-edited or from an
 * older build, and a malformed record must be reported rather than written
 * through or silently dropped.
 *
 * Links to Labo topics travel as ids only. A world file never carries a copy
 * of a topic — on another install the id either resolves or the link simply
 * shows as unavailable.
 */

export const WORLDS_EXPORT_VERSION = 1;

export interface WorldsExport {
  format: 'lukas-labo-parallel-worlds';
  version: number;
  exportedAt: number;
  worlds: ParallelWorld[];
  consequences: Consequence[];
}

export function exportWorlds(
  worlds: readonly ParallelWorld[],
  consequences: readonly Consequence[],
  now = Date.now(),
): WorldsExport {
  const ids = new Set(worlds.map((w) => w.id));
  return {
    format: 'lukas-labo-parallel-worlds',
    version: WORLDS_EXPORT_VERSION,
    exportedAt: now,
    worlds: worlds.map((w) => ({ ...w })),
    // Never export a consequence whose world is not in the file.
    consequences: consequences.filter((c) => ids.has(c.worldId)).map((c) => ({ ...c })),
  };
}

export interface WorldsImportResult {
  worlds: ParallelWorld[];
  consequences: Consequence[];
  errors: string[];
}

const STATUSES = new Set<string>(WORLD_STATUSES);
const KINDS = new Set<string>(CONSEQUENCE_KINDS);
const LEVELS = new Set<number>(CONSEQUENCE_LEVELS);

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];

export function parseWorldsImport(input: unknown, now = Date.now()): WorldsImportResult {
  const errors: string[] = [];
  const worlds: ParallelWorld[] = [];
  const consequences: Consequence[] = [];

  const data = input as Partial<WorldsExport> | null;
  if (!data || typeof data !== 'object') {
    return { worlds, consequences, errors: ['ფაილი არ არის სწორი JSON ობიექტი.'] };
  }
  if (data.format !== 'lukas-labo-parallel-worlds') {
    return { worlds, consequences, errors: ['ეს ფაილი ალტერნატიული სამყაროების ექსპორტი არ არის.'] };
  }
  if (typeof data.version === 'number' && data.version > WORLDS_EXPORT_VERSION) {
    errors.push(`ფაილი უფრო ახალი ვერსიისაა (${data.version}) — ნაწილი შეიძლება არ ჩაიტვირთოს.`);
  }

  const seen = new Set<string>();
  for (const raw of Array.isArray(data.worlds) ? data.worlds : []) {
    const row = raw as Partial<ParallelWorld>;
    const id = str(row.id);
    const title = str(row.title);

    if (!id || !title) {
      errors.push('სამყარო გამოტოვდა: აკლია id ან სათაური.');
      continue;
    }
    if (seen.has(id)) {
      errors.push(`სამყარო „${title}" გამოტოვდა: id მეორდება.`);
      continue;
    }
    seen.add(id);

    const status = str(row.status);
    worlds.push({
      id,
      title,
      baseRule: typeof row.baseRule === 'string' ? row.baseRule : '',
      changedRule: typeof row.changedRule === 'string' ? row.changedRule : '',
      ...(str(row.subjectId) ? { subjectId: str(row.subjectId)! } : {}),
      topicIds: strList(row.topicIds),
      openQuestions: strList(row.openQuestions),
      conclusion: typeof row.conclusion === 'string' ? row.conclusion : '',
      status: (status && STATUSES.has(status) ? status : 'draft') as WorldStatus,
      ...(str(row.parentId) ? { parentId: str(row.parentId)! } : {}),
      ...(row.favorite ? { favorite: true } : {}),
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : now,
    });
  }

  /*
   * A parent that did not survive import would leave a branch pointing at
   * nothing. Rather than dropping the branch — which would destroy reasoning
   * the user wrote — it is promoted to a root and the change is reported.
   */
  const worldIds = new Set(worlds.map((w) => w.id));
  for (const world of worlds) {
    if (world.parentId && !worldIds.has(world.parentId)) {
      errors.push(`„${world.title}"-ის მშობელი ვერ მოიძებნა — დამოუკიდებელ სამყაროდ ჩაიტვირთა.`);
      delete world.parentId;
    }
  }

  const seenConsequences = new Set<string>();
  for (const raw of Array.isArray(data.consequences) ? data.consequences : []) {
    const row = raw as Partial<Consequence>;
    const id = str(row.id);
    const worldId = str(row.worldId);
    const text = str(row.text);
    const kind = str(row.kind);
    const level = typeof row.level === 'number' ? row.level : undefined;

    if (!id || !worldId || !text) {
      errors.push('შედეგი გამოტოვდა: აკლია სავალდებულო ველი.');
      continue;
    }
    if (!worldIds.has(worldId)) {
      errors.push('შედეგი გამოტოვდა: მისი სამყარო ფაილში არ არის.');
      continue;
    }
    if (!kind || !KINDS.has(kind)) {
      errors.push(`შედეგი გამოტოვდა: უცნობი ტიპი „${kind ?? '—'}".`);
      continue;
    }
    if (level === undefined || !LEVELS.has(level)) {
      errors.push('შედეგი გამოტოვდა: დონე უნდა იყოს 1, 2 ან 3.');
      continue;
    }
    if (seenConsequences.has(id)) {
      errors.push('შედეგი გამოტოვდა: id მეორდება.');
      continue;
    }
    seenConsequences.add(id);

    consequences.push({
      id,
      worldId,
      kind: kind as ConsequenceKind,
      level: level as ConsequenceLevel,
      text,
      causedBy: strList(row.causedBy),
      order: typeof row.order === 'number' ? row.order : 0,
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : now,
    });
  }

  // Causal links to consequences that did not survive are dropped quietly:
  // the reasoning stands, only the arrow is gone.
  const consequenceIds = new Set(consequences.map((c) => c.id));
  for (const consequence of consequences) {
    consequence.causedBy = consequence.causedBy.filter((id) => consequenceIds.has(id));
  }

  return { worlds, consequences, errors };
}
