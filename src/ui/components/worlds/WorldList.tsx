import { useMemo, useState } from 'react';
import { library, t as tr } from '@/content';
import {
  WORLD_STATUSES,
  type ParallelWorld,
  type WorldStatus,
  type WorldTreeNode,
} from '@/domain/worlds';
import { STATUS_LABEL } from './labels';

/**
 * The catalogue: search, status filter, favourites, and the branch lineage.
 *
 * Worlds are listed as trees rather than as a flat list, because a branch only
 * makes sense next to what it branched from — seeing "Gravity ×2" with its two
 * divergences indented beneath it is the whole point of the feature.
 */

interface Props {
  forest: WorldTreeNode[];
  worlds: readonly ParallelWorld[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

type Grouping = 'lineage' | 'subject';

function matches(world: ParallelWorld, needle: string): boolean {
  if (!needle) return true;
  const hay = `${world.title} ${world.changedRule} ${world.baseRule}`.toLowerCase();
  return hay.includes(needle);
}

export function WorldList({ forest, worlds, selectedId, onSelect, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<WorldStatus | 'all'>('all');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [grouping, setGrouping] = useState<Grouping>('lineage');

  const needle = search.trim().toLowerCase();

  const keep = (world: ParallelWorld) =>
    matches(world, needle) &&
    (status === 'all' || world.status === status) &&
    (!favouritesOnly || Boolean(world.favorite));

  /*
   * A branch stays visible when its parent is filtered out — otherwise
   * searching for a branch's own wording would hide the very result you asked
   * for. The parent is shown as a dimmed rail instead.
   */
  const visibleTree = useMemo(() => {
    const prune = (node: WorldTreeNode): WorldTreeNode | null => {
      const children = node.children.map(prune).filter((c): c is WorldTreeNode => c !== null);
      if (!keep(node.world) && children.length === 0) return null;
      return { ...node, children };
    };
    return forest.map(prune).filter((n): n is WorldTreeNode => n !== null);
  }, [forest, needle, status, favouritesOnly]);

  const bySubject = useMemo(() => {
    const groups = new Map<string, ParallelWorld[]>();
    for (const world of worlds.filter(keep)) {
      const key = world.subjectId ?? '—';
      const list = groups.get(key);
      if (list) list.push(world);
      else groups.set(key, [world]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [worlds, needle, status, favouritesOnly]);

  const row = (world: ParallelWorld, depth: number) => (
    <button
      key={world.id}
      className={`world-row${world.id === selectedId ? ' is-active' : ''}${
        keep(world) ? '' : ' is-dim'
      }`}
      style={depth > 0 ? { paddingInlineStart: `calc(${depth} * var(--space-4))` } : undefined}
      onClick={() => onSelect(world.id)}
    >
      {depth > 0 ? <span className="world-row__branch" aria-hidden="true">└</span> : null}
      <span className="world-row__title">
        {world.favorite ? '★ ' : ''}
        {world.title}
      </span>
      <span className={`world-status world-status--${world.status}`}>{STATUS_LABEL[world.status]}</span>
    </button>
  );

  const renderNode = (node: WorldTreeNode): React.ReactNode => (
    <div key={node.world.id} className="world-branch">
      {row(node.world, node.depth)}
      {node.children.map(renderNode)}
    </div>
  );

  const total = worlds.length;
  const shown = worlds.filter(keep).length;

  return (
    <aside className="world-list">
      <button className="btn btn--primary btn--sm world-list__new" onClick={onCreate}>
        + ახალი სამყარო
      </button>

      <input
        className="input input--sm"
        placeholder="ძებნა…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="world-list__filters">
        <select
          className="ask-select"
          value={status}
          onChange={(e) => setStatus(e.target.value as WorldStatus | 'all')}
        >
          <option value="all">ყველა სტატუსი</option>
          {WORLD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          className={`ask-tool${favouritesOnly ? ' is-on' : ''}`}
          onClick={() => setFavouritesOnly((v) => !v)}
          aria-pressed={favouritesOnly}
          title="მხოლოდ რჩეულები"
        >
          ★
        </button>
        <button
          className={`ask-tool${grouping === 'subject' ? ' is-on' : ''}`}
          onClick={() => setGrouping((g) => (g === 'lineage' ? 'subject' : 'lineage'))}
          title={grouping === 'lineage' ? 'დაჯგუფება საგნებით' : 'ტოტების ხე'}
        >
          {grouping === 'lineage' ? '⑂' : '⬡'}
        </button>
      </div>

      <div className="world-list__scroll">
        {total === 0 ? (
          <p className="xsmall muted">ჯერ არცერთი სამყარო არ არის. დაიწყე ერთი წესის შეცვლით.</p>
        ) : shown === 0 ? (
          <p className="xsmall muted">ამ ფილტრით ვერაფერი მოიძებნა.</p>
        ) : grouping === 'lineage' ? (
          visibleTree.map(renderNode)
        ) : (
          bySubject.map(([subjectId, list]) => (
            <div key={subjectId} className="world-group">
              <span className="world-group__label">
                {subjectId === '—' ? 'საგნის გარეშე' : tr(library.subjectById.get(subjectId)?.name)}
              </span>
              {list.map((world) => row(world, 0))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
