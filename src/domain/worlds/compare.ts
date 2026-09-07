import { commonAncestor, lineageOf, resolveWorld, worldsById } from './lineage';
import { byKind, consequencesOf } from './consequences';
import { CONSEQUENCE_KINDS, type Consequence, type ConsequenceKind, type ParallelWorld } from './types';

/**
 * Comparing two worlds.
 *
 * Entirely deterministic and entirely from stored data: the comparison reports
 * what each world says, never an interpretation of what the difference means.
 * The interesting output is usually the third column — consequences one world
 * reasoned through and the other did not.
 */

export interface ComparedField {
  label: 'baseRule' | 'changedRule' | 'conclusion';
  a: string;
  b: string;
  same: boolean;
}

export interface ComparedConsequences {
  kind: ConsequenceKind;
  /** Present in A only. */
  onlyA: Consequence[];
  /** Present in B only. */
  onlyB: Consequence[];
  /** Same text on both sides — where the two worlds agree. */
  shared: { a: Consequence; b: Consequence }[];
}

export interface WorldComparison {
  a: ParallelWorld;
  b: ParallelWorld;
  /** The nearest world both descend from, when they are related. */
  ancestor?: ParallelWorld;
  /** True when neither is an ancestor of the other. */
  siblings: boolean;
  fields: ComparedField[];
  consequences: ComparedConsequences[];
  openQuestions: { onlyA: string[]; onlyB: string[]; shared: string[] };
}

/** Loose text identity: whitespace and case should not read as disagreement. */
const key = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

function diffStrings(a: readonly string[], b: readonly string[]) {
  const bKeys = new Set(b.map(key));
  const aKeys = new Set(a.map(key));
  return {
    onlyA: a.filter((x) => !bKeys.has(key(x))),
    onlyB: b.filter((x) => !aKeys.has(key(x))),
    shared: a.filter((x) => bKeys.has(key(x))),
  };
}

export function compareWorlds(
  aId: string,
  bId: string,
  worlds: readonly ParallelWorld[],
  allConsequences: readonly Consequence[],
): WorldComparison | null {
  const byId = worldsById(worlds);
  const rawA = byId.get(aId);
  const rawB = byId.get(bId);
  if (!rawA || !rawB || aId === bId) return null;

  // Compare what each world *effectively* says, inherited context included —
  // otherwise a branch that never overrode its base reality would appear to
  // have no base reality at all.
  const a = resolveWorld(rawA, byId);
  const b = resolveWorld(rawB, byId);

  const ancestor = commonAncestor(aId, bId, byId);
  const lineA = lineageOf(aId, byId).map((w) => w.id);
  const lineB = lineageOf(bId, byId).map((w) => w.id);
  const siblings = !lineA.includes(bId) && !lineB.includes(aId);

  const fields: ComparedField[] = (
    [
      ['baseRule', a.baseRule, b.baseRule],
      ['changedRule', a.changedRule, b.changedRule],
      ['conclusion', a.conclusion, b.conclusion],
    ] as const
  ).map(([label, x, y]) => ({ label, a: x, b: y, same: key(x) === key(y) }));

  const consA = byKind(consequencesOf(aId, allConsequences));
  const consB = byKind(consequencesOf(bId, allConsequences));

  const consequences: ComparedConsequences[] = CONSEQUENCE_KINDS.map((kind) => {
    const listA = consA.get(kind) ?? [];
    const listB = consB.get(kind) ?? [];
    const keysB = new Map(listB.map((c) => [key(c.text), c]));
    const keysA = new Set(listA.map((c) => key(c.text)));

    return {
      kind,
      onlyA: listA.filter((c) => !keysB.has(key(c.text))),
      onlyB: listB.filter((c) => !keysA.has(key(c.text))),
      shared: listA
        .filter((c) => keysB.has(key(c.text)))
        .map((c) => ({ a: c, b: keysB.get(key(c.text))! })),
    };
  });

  return {
    a: rawA,
    b: rawB,
    ...(ancestor ? { ancestor } : {}),
    siblings,
    fields,
    consequences,
    openQuestions: diffStrings(a.openQuestions, b.openQuestions),
  };
}
