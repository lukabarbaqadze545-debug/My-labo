import { useMemo } from 'react';
import { NODE_TYPE_GLYPH, analyseGraph, type KnowledgeGraph } from '@/domain/knowledge';

/**
 * A compact reading of the map. Every number here comes from a deterministic
 * engine function; nothing is estimated except mastery, which says so.
 */

interface Props {
  graph: KnowledgeGraph;
  onSelect: (id: string) => void;
}

export function GraphAnalyticsPanel({ graph, onSelect }: Props) {
  const stats = useMemo(() => analyseGraph(graph), [graph]);

  return (
    <section className="graph-analytics">
      <div className="graph-stats">
        <Stat label="კვანძი" value={stats.totalNodes} />
        <Stat label="კავშირი" value={stats.totalEdges} />
        <Stat label="ჩემი კვანძი" value={stats.manualNodes} />
        <Stat label="ჩემი კავშირი" value={stats.manualEdges} />
        <Stat label="იზოლირებული" value={stats.isolated.length} />
        <Stat label="კუნძული" value={stats.components} />
      </div>

      {stats.gaps.length > 0 ? (
        <Block title="გამოტოვებული წინაპირობები">
          <ul className="graph-list">
            {stats.gaps.map((gap) => (
              <li key={gap.node.id}>
                <button className="graph-rel__node" onClick={() => onSelect(gap.node.id)}>
                  {NODE_TYPE_GLYPH[gap.node.type]} {gap.node.title}
                </button>
                <span className="graph-gap__missing">
                  {gap.missing.map((m) => m.title).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      <Block title="ყველაზე დაკავშირებული">
        <ul className="graph-list">
          {stats.mostConnected.map(({ node, degree }) => (
            <li key={node.id}>
              <button className="graph-rel__node" onClick={() => onSelect(node.id)}>
                {NODE_TYPE_GLYPH[node.type]} {node.title}
              </button>
              <span className="xsmall muted">{degree}</span>
            </li>
          ))}
        </ul>
      </Block>

      {stats.bySubject.length > 0 ? (
        <Block title="ცოდნა საგნების მიხედვით">
          <ul className="graph-list">
            {stats.bySubject.map((row) => (
              <li key={row.subjectId}>
                <span>{row.title}</span>
                <span className="xsmall muted">{row.count}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {stats.weakMastery.length > 0 ? (
        <Block title="სუსტად ნასწავლი">
          <ul className="graph-list">
            {stats.weakMastery.map((node) => (
              <li key={node.id}>
                <button className="graph-rel__node" onClick={() => onSelect(node.id)}>
                  {node.title}
                </button>
                <span className="xsmall muted">{Math.round((node.masteryLevel ?? 0) * 100)}%</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {stats.unsupported.length > 0 ? (
        <Block title="მასალის გარეშე">
          <ul className="graph-list">
            {stats.unsupported.map((node) => (
              <li key={node.id}>
                <button className="graph-rel__node" onClick={() => onSelect(node.id)}>
                  {node.title}
                </button>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {stats.recentlyAdded.length > 0 ? (
        <Block title="ბოლოს დამატებული">
          <ul className="graph-list">
            {stats.recentlyAdded.map((node) => (
              <li key={node.id}>
                <button className="graph-rel__node" onClick={() => onSelect(node.id)}>
                  {NODE_TYPE_GLYPH[node.type]} {node.title}
                </button>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="graph-stat">
      <span className="graph-stat__value">{value}</span>
      <span className="graph-stat__label">{label}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="graph-analytics__block">
      <h3 className="graph-panel__h3">{title}</h3>
      {children}
    </div>
  );
}
