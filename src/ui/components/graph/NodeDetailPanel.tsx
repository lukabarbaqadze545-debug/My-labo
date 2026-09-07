import { Link } from 'react-router-dom';
import {
  NODE_TYPE_GLYPH,
  NODE_TYPE_LABEL,
  RELATION_LABEL,
  dependentsOf,
  incoming,
  outgoing,
  prerequisitesOf,
  type KnowledgeEdge,
  type KnowledgeGraph,
  type KnowledgeNode,
} from '@/domain/knowledge';
import { library, t as tr } from '@/content';

/**
 * Everything known about one node, and nothing computed here: the panel asks
 * the engine for relationships and renders the answer.
 */

interface Props {
  graph: KnowledgeGraph;
  node: KnowledgeNode;
  onSelect: (id: string) => void;
  onConnect: (id: string) => void;
  onEdit: (node: KnowledgeNode) => void;
  onDelete: (node: KnowledgeNode) => void;
  onDeleteEdge: (edge: KnowledgeEdge) => void;
  onPathFrom: (id: string) => void;
}

function RelationRow({
  graph,
  edge,
  selfId,
  onSelect,
  onDeleteEdge,
}: {
  graph: KnowledgeGraph;
  edge: KnowledgeEdge;
  selfId: string;
  onSelect: (id: string) => void;
  onDeleteEdge: (edge: KnowledgeEdge) => void;
}) {
  const otherId = edge.sourceNodeId === selfId ? edge.targetNodeId : edge.sourceNodeId;
  const other = graph.nodeById.get(otherId);
  if (!other) return null;

  return (
    <li className="graph-rel">
      <span className="graph-rel__kind">{RELATION_LABEL[edge.relationType]}</span>
      <button className="graph-rel__node" onClick={() => onSelect(otherId)}>
        {NODE_TYPE_GLYPH[other.type]} {other.title}
      </button>
      {edge.note ? <span className="graph-rel__note">{edge.note}</span> : null}
      {edge.origin === 'manual' ? (
        <button
          className="btn btn--quiet btn--sm popmenu__danger"
          title="კავშირის წაშლა"
          onClick={() => onDeleteEdge(edge)}
        >
          ✕
        </button>
      ) : (
        <span className="graph-rel__auto" title="ავტომატურად გამოტანილი კავშირი">
          auto
        </span>
      )}
    </li>
  );
}

export function NodeDetailPanel({
  graph,
  node,
  onSelect,
  onConnect,
  onEdit,
  onDelete,
  onDeleteEdge,
  onPathFrom,
}: Props) {
  const out = outgoing(graph, node.id);
  const inc = incoming(graph, node.id);
  const prerequisites = prerequisitesOf(graph, node.id);
  const dependents = dependentsOf(graph, node.id);
  const subject = node.subjectId ? library.subjectById.get(node.subjectId) : undefined;

  // Documents, notes and books hanging off this node — its supporting material.
  const supporting = (graph.incident.get(node.id) ?? [])
    .map((edge) => graph.nodeById.get(edge.sourceNodeId === node.id ? edge.targetNodeId : edge.sourceNodeId))
    .filter((n): n is KnowledgeNode => Boolean(n) && ['document', 'note', 'book'].includes(n!.type));

  const mastery = node.masteryLevel;

  return (
    <aside className="graph-panel">
      <header className="graph-panel__head">
        <span className="graph-panel__type">
          {NODE_TYPE_GLYPH[node.type]} {NODE_TYPE_LABEL[node.type]}
          {node.origin === 'manual' ? ' · ჩემი' : ''}
        </span>
        <h2 className="graph-panel__title">{node.title}</h2>
        {subject ? <span className="graph-panel__subject">{tr(subject.name)}</span> : null}
      </header>

      {node.description ? <p className="graph-panel__desc">{node.description}</p> : null}

      {mastery !== undefined ? (
        <div className="graph-mastery">
          <div className="graph-mastery__bar">
            <span style={{ width: `${Math.round(mastery * 100)}%` }} />
          </div>
          <span className="xsmall muted">
            {Math.round(mastery * 100)}% ·{' '}
            {node.masterySource === 'declared' ? 'შენ მიუთითე' : 'შეფასებულია აქტივობით'}
          </span>
        </div>
      ) : null}

      {node.tags.length > 0 ? (
        <div className="graph-tags">
          {node.tags.map((tag) => (
            <span key={tag} className="ask-chip ask-chip--sm">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="graph-panel__actions">
        {node.href ? (
          <Link className="btn btn--ghost btn--sm" to={node.href}>
            გახსნა ↗
          </Link>
        ) : null}
        <button className="btn btn--ghost btn--sm" onClick={() => onConnect(node.id)}>
          დაკავშირება
        </button>
        <button className="btn btn--quiet btn--sm" onClick={() => onPathFrom(node.id)}>
          გზა აქედან
        </button>
        {node.origin === 'manual' ? (
          <>
            <button className="btn btn--quiet btn--sm" onClick={() => onEdit(node)}>
              რედაქტირება
            </button>
            <button className="btn btn--quiet btn--sm popmenu__danger" onClick={() => onDelete(node)}>
              წაშლა
            </button>
          </>
        ) : null}
      </div>

      {prerequisites.length > 0 ? (
        <section className="graph-panel__section">
          <h3 className="graph-panel__h3">წინაპირობები</h3>
          <ul className="graph-rels">
            {prerequisites.map((p) => (
              <li key={p.id} className="graph-rel">
                <button className="graph-rel__node" onClick={() => onSelect(p.id)}>
                  {NODE_TYPE_GLYPH[p.type]} {p.title}
                </button>
                {(p.masteryLevel ?? 0) < 0.34 ? <span className="graph-gap__flag">სუსტია</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dependents.length > 0 ? (
        <section className="graph-panel__section">
          <h3 className="graph-panel__h3">რას გახსნის</h3>
          <ul className="graph-rels">
            {dependents.map((d) => (
              <li key={d.id} className="graph-rel">
                <button className="graph-rel__node" onClick={() => onSelect(d.id)}>
                  {NODE_TYPE_GLYPH[d.type]} {d.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {supporting.length > 0 ? (
        <section className="graph-panel__section">
          <h3 className="graph-panel__h3">დამხმარე მასალა</h3>
          <ul className="graph-rels">
            {supporting.map((s) => (
              <li key={s.id} className="graph-rel">
                <button className="graph-rel__node" onClick={() => onSelect(s.id)}>
                  {NODE_TYPE_GLYPH[s.type]} {s.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="graph-panel__section">
        <h3 className="graph-panel__h3">გამავალი კავშირები ({out.length})</h3>
        <ul className="graph-rels">
          {out.map((edge) => (
            <RelationRow
              key={edge.id}
              graph={graph}
              edge={edge}
              selfId={node.id}
              onSelect={onSelect}
              onDeleteEdge={onDeleteEdge}
            />
          ))}
          {out.length === 0 ? <li className="xsmall muted">არცერთი</li> : null}
        </ul>
      </section>

      <section className="graph-panel__section">
        <h3 className="graph-panel__h3">შემომავალი კავშირები ({inc.length})</h3>
        <ul className="graph-rels">
          {inc.map((edge) => (
            <RelationRow
              key={edge.id}
              graph={graph}
              edge={edge}
              selfId={node.id}
              onSelect={onSelect}
              onDeleteEdge={onDeleteEdge}
            />
          ))}
          {inc.length === 0 ? <li className="xsmall muted">არცერთი</li> : null}
        </ul>
      </section>
    </aside>
  );
}
