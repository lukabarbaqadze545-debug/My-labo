import { useState } from 'react';
import { library, t as tr } from '@/content';
import {
  MANUAL_NODE_TYPES,
  NODE_TYPE_GLYPH,
  NODE_TYPE_LABEL,
  RELATION_LABEL,
  RELATION_TYPES,
  type KnowledgeGraph,
  type KnowledgeNode,
  type KnowledgeNodeType,
  type RelationType,
} from '@/domain/knowledge';

/**
 * The two write surfaces: create/edit a node, and connect two nodes.
 *
 * Connecting is deliberately the four-step flow the user asked for — pick A,
 * pick B, pick the relationship, save — with A pre-filled from the selection so
 * the common case is two clicks.
 */

/* ------------------------------ node editor ------------------------------ */

export interface NodeDraft {
  type: KnowledgeNodeType;
  title: string;
  description: string;
  subjectId: string;
  tags: string;
  masteryLevel: string;
}

export const emptyDraft = (): NodeDraft => ({
  type: 'concept',
  title: '',
  description: '',
  subjectId: '',
  tags: '',
  masteryLevel: '',
});

export function draftOf(node: KnowledgeNode): NodeDraft {
  return {
    type: node.type,
    title: node.title,
    description: node.description ?? '',
    subjectId: node.subjectId ?? '',
    tags: node.tags.join(', '),
    masteryLevel: node.masteryLevel === undefined ? '' : String(Math.round(node.masteryLevel * 100)),
  };
}

export function NodeEditor({
  draft,
  editing,
  onChange,
  onSave,
  onCancel,
}: {
  draft: NodeDraft;
  editing: boolean;
  onChange: (patch: Partial<NodeDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="graph-editor">
      <h3 className="graph-panel__h3">{editing ? 'კვანძის რედაქტირება' : 'ახალი კვანძი'}</h3>

      <label className="field">
        <span className="field__label">სათაური</span>
        <input
          className="input input--sm"
          autoFocus
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </label>

      <div className="graph-editor__row">
        <label className="field">
          <span className="field__label">ტიპი</span>
          <select
            className="input input--sm"
            value={draft.type}
            onChange={(e) => onChange({ type: e.target.value as KnowledgeNodeType })}
          >
            {MANUAL_NODE_TYPES.map((type) => (
              <option key={type} value={type}>
                {NODE_TYPE_GLYPH[type]} {NODE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">საგანი</span>
          <select
            className="input input--sm"
            value={draft.subjectId}
            onChange={(e) => onChange({ subjectId: e.target.value })}
          >
            <option value="">—</option>
            {library.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {tr(subject.name)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">აღწერა</span>
        <textarea
          className="textarea"
          rows={2}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>

      <div className="graph-editor__row">
        <label className="field">
          <span className="field__label">ტეგები (მძიმით)</span>
          <input
            className="input input--sm"
            value={draft.tags}
            onChange={(e) => onChange({ tags: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field__label">ათვისება %</span>
          <input
            className="input input--sm"
            type="number"
            min={0}
            max={100}
            placeholder="—"
            value={draft.masteryLevel}
            onChange={(e) => onChange({ masteryLevel: e.target.value })}
          />
        </label>
      </div>

      <div className="row">
        <button className="btn btn--primary btn--sm" disabled={!draft.title.trim()} onClick={onSave}>
          შენახვა
        </button>
        <button className="btn btn--quiet btn--sm" onClick={onCancel}>
          გაუქმება
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ edge editor ------------------------------ */

export function ConnectEditor({
  graph,
  sourceId,
  onSave,
  onCancel,
}: {
  graph: KnowledgeGraph;
  sourceId: string;
  onSave: (targetId: string, relationType: RelationType, note: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState<RelationType>('RELATED_TO');
  const [note, setNote] = useState('');

  const source = graph.nodeById.get(sourceId);
  const target = targetId ? graph.nodeById.get(targetId) : undefined;

  const matches = query.trim()
    ? graph.nodes
        .filter((n) => n.id !== sourceId && n.title.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div className="graph-editor">
      <h3 className="graph-panel__h3">კავშირის დახატვა</h3>

      <p className="xsmall muted">
        {source ? `${NODE_TYPE_GLYPH[source.type]} ${source.title}` : sourceId}
      </p>

      <label className="field">
        <span className="field__label">რას დაუკავშირდეს</span>
        {target ? (
          <button className="graph-picker__chosen" onClick={() => setTargetId('')}>
            {NODE_TYPE_GLYPH[target.type]} {target.title} ✕
          </button>
        ) : (
          <input
            className="input input--sm"
            autoFocus
            placeholder="მოძებნე კვანძი…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </label>

      {!target && matches.length > 0 ? (
        <ul className="graph-picker__list">
          {matches.map((node) => (
            <li key={node.id}>
              <button
                onClick={() => {
                  setTargetId(node.id);
                  setQuery('');
                }}
              >
                {NODE_TYPE_GLYPH[node.type]} {node.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="field">
        <span className="field__label">კავშირის ტიპი</span>
        <select
          className="input input--sm"
          value={relationType}
          onChange={(e) => setRelationType(e.target.value as RelationType)}
        >
          {RELATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {RELATION_LABEL[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">შენიშვნა (არასავალდებულო)</span>
        <input className="input input--sm" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="row">
        <button
          className="btn btn--primary btn--sm"
          disabled={!targetId}
          onClick={() => onSave(targetId, relationType, note)}
        >
          შენახვა
        </button>
        <button className="btn btn--quiet btn--sm" onClick={onCancel}>
          გაუქმება
        </button>
      </div>
    </div>
  );
}
