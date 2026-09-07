import { useMemo, useState } from 'react';
import {
  NODE_TYPE_GLYPH,
  RELATION_LABEL,
  shortestPaths,
  type GraphPath,
  type KnowledgeGraph,
} from '@/domain/knowledge';

/**
 * Path finder.
 *
 * Two nodes in, real routes out. The paths come from BFS over stored edges
 * only — if the graph holds no connection, the answer is "no connection",
 * never a plausible-sounding invention.
 */

interface Props {
  graph: KnowledgeGraph;
  fromId?: string | undefined;
  toId?: string | undefined;
  onPick: (slot: 'from' | 'to', id: string) => void;
  onHighlight: (ids: string[]) => void;
  onSelect: (id: string) => void;
}

function NodePicker({
  graph,
  value,
  label,
  onChange,
}: {
  graph: KnowledgeGraph;
  value: string | undefined;
  label: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const chosen = value ? graph.nodeById.get(value) : undefined;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return graph.nodes
      .filter((node) => node.title.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [graph, query]);

  return (
    <div className="graph-picker">
      <span className="field__label">{label}</span>
      {chosen ? (
        <button className="graph-picker__chosen" onClick={() => onChange('')}>
          {NODE_TYPE_GLYPH[chosen.type]} {chosen.title} ✕
        </button>
      ) : (
        <>
          <input
            className="input input--sm"
            placeholder="მოძებნე კვანძი…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {matches.length > 0 ? (
            <ul className="graph-picker__list">
              {matches.map((node) => (
                <li key={node.id}>
                  <button
                    onClick={() => {
                      onChange(node.id);
                      setQuery('');
                    }}
                  >
                    {NODE_TYPE_GLYPH[node.type]} {node.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function PathRow({ graph, path, onSelect }: { graph: KnowledgeGraph; path: GraphPath; onSelect: (id: string) => void }) {
  return (
    <li className="graph-path">
      {path.nodes.map((id, index) => {
        const node = graph.nodeById.get(id);
        const edge = path.edges[index - 1];
        return (
          <span key={id} className="graph-path__step">
            {edge ? (
              <span className="graph-path__rel">— {RELATION_LABEL[edge.relationType]} →</span>
            ) : null}
            <button className="graph-path__node" onClick={() => onSelect(id)}>
              {node ? `${NODE_TYPE_GLYPH[node.type]} ${node.title}` : id}
            </button>
          </span>
        );
      })}
    </li>
  );
}

export function PathFinder({ graph, fromId, toId, onPick, onHighlight, onSelect }: Props) {
  const paths = useMemo(() => {
    if (!fromId || !toId) return [];
    return shortestPaths(graph, fromId, toId, { maxPaths: 3 });
  }, [graph, fromId, toId]);

  const ready = Boolean(fromId && toId);

  return (
    <section className="graph-pathfinder">
      <div className="graph-pathfinder__pickers">
        <NodePicker graph={graph} value={fromId} label="საიდან" onChange={(id) => onPick('from', id)} />
        <NodePicker graph={graph} value={toId} label="სად" onChange={(id) => onPick('to', id)} />
      </div>

      {ready && paths.length === 0 ? (
        <p className="xsmall muted">
          ამ ორს შორის კავშირი რუკაზე არ არსებობს. დახატე კავშირი, თუ ის მართლა არსებობს.
        </p>
      ) : null}

      {paths.length > 0 ? (
        <>
          <ul className="graph-paths">
            {paths.map((path) => (
              <PathRow key={path.nodes.join('>')} graph={graph} path={path} onSelect={onSelect} />
            ))}
          </ul>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => onHighlight(paths.flatMap((p) => p.nodes))}
          >
            რუკაზე ჩვენება
          </button>
        </>
      ) : null}
    </section>
  );
}
