/**
 * Parallel Worlds — the vocabulary of a thought experiment.
 *
 * A world is one deliberate change to one system, plus the reasoning that
 * follows from it. Two ideas shape the model:
 *
 *   1. A consequence is not a free-text paragraph. It has a *kind* (what sort
 *      of consequence) and a *depth* (how far downstream), because "gravity is
 *      stronger so bones break" and "therefore architecture changes" are
 *      different moves in the same argument. Splitting them is what pushes the
 *      thinking past one step.
 *
 *   2. A branch owns only what it changes. Everything else — the base system,
 *      the subject, the linked topics — resolves through its ancestors, so two
 *      branches of one world cannot drift apart on facts they never edited.
 */

/* --------------------------------- world -------------------------------- */

export const WORLD_STATUSES = ['draft', 'exploring', 'developed', 'archived'] as const;
export type WorldStatus = (typeof WORLD_STATUSES)[number];

export interface ParallelWorld {
  id: string;
  title: string;
  /**
   * The system being altered, and the single alteration.
   *
   * On a branch both may be empty, in which case they resolve from the nearest
   * ancestor that has them — a branch usually keeps the base reality and
   * changes only how the story runs from there.
   */
  baseRule: string;
  changedRule: string;
  /** Labo subject this belongs to. Never a copy — just the id. */
  subjectId?: string;
  /** Labo topic ids this world reasons about. Ids only; never duplicated. */
  topicIds: string[];
  openQuestions: string[];
  conclusion: string;
  status: WorldStatus;
  /**
   * Set when this world was branched from another.
   *
   * A branch's divergence lives in `changedRule` like any other world's — the
   * point of "humans are suddenly moved there today" is that it *is* the rule
   * this branch changes, so a separate note field would only duplicate it.
   */
  parentId?: string;
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------ consequences ----------------------------- */

/**
 * What sort of consequence this is.
 *
 *   effect      it follows that…
 *   breaks      this stops working
 *   enables     this becomes possible
 *   unexpected  the non-obvious one — the reason the exercise is worth doing
 */
export const CONSEQUENCE_KINDS = ['effect', 'breaks', 'enables', 'unexpected'] as const;
export type ConsequenceKind = (typeof CONSEQUENCE_KINDS)[number];

/**
 * How far downstream a consequence sits.
 *
 *   1 immediate — follows directly from the changed rule
 *   2 indirect  — follows from the immediate effects
 *   3 systemic  — long-term, structural, civilisational
 */
export const CONSEQUENCE_LEVELS = [1, 2, 3] as const;
export type ConsequenceLevel = (typeof CONSEQUENCE_LEVELS)[number];

export interface Consequence {
  id: string;
  worldId: string;
  kind: ConsequenceKind;
  level: ConsequenceLevel;
  text: string;
  /**
   * Consequences this one follows from — the local causal map.
   *
   * Scoped to a single world and unrelated to the app's knowledge graph: this
   * records "what caused what inside this thought experiment", not a claim
   * about the real world.
   */
  causedBy: string[];
  order: number;
  createdAt: number;
}

/* -------------------------------- resolved ------------------------------- */

/**
 * A world with inherited context filled in from its ancestors, ready to
 * display. `inherited` says which fields came from a parent rather than from
 * the world itself, so the UI can show that honestly instead of pretending the
 * branch authored them.
 */
export interface ResolvedWorld extends ParallelWorld {
  inherited: {
    baseRule?: string;
    subjectId?: string;
    topicIds?: string;
  };
}

/* ------------------------------- lineage --------------------------------- */

export interface WorldTreeNode {
  world: ParallelWorld;
  depth: number;
  children: WorldTreeNode[];
}
