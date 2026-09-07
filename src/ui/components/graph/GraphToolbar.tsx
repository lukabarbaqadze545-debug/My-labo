import { library, t as tr } from '@/content';
import { NODE_TYPE_GLYPH, NODE_TYPE_LABEL, NODE_TYPES, type KnowledgeNodeType } from '@/domain/knowledge';

/**
 * Filters and view controls. Pure presentation: it reports what the user asked
 * for and the page decides what that means for the graph.
 */

export interface GraphView {
  search: string;
  types: KnowledgeNodeType[];
  subjectIds: string[];
  /** Restrict to the neighbourhood of the selection. */
  focus: boolean;
  depth: number;
  showLabels: boolean;
  manualOnly: boolean;
}

interface Props {
  view: GraphView;
  onChange: (patch: Partial<GraphView>) => void;
  onFit: () => void;
  visible: number;
  total: number;
}

export function GraphToolbar({ view, onChange, onFit, visible, total }: Props) {
  const toggleType = (type: KnowledgeNodeType) => {
    const next = view.types.includes(type)
      ? view.types.filter((x) => x !== type)
      : [...view.types, type];
    onChange({ types: next });
  };

  return (
    <div className="graph-toolbar">
      <div className="graph-toolbar__row">
        <input
          className="input input--sm graph-toolbar__search"
          placeholder="ძებნა რუკაზე…"
          value={view.search}
          onChange={(e) => onChange({ search: e.target.value })}
        />

        <select
          className="input input--sm"
          value={view.subjectIds[0] ?? ''}
          onChange={(e) => onChange({ subjectIds: e.target.value ? [e.target.value] : [] })}
        >
          <option value="">ყველა საგანი</option>
          {library.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {tr(subject.name)}
            </option>
          ))}
        </select>

        <label className="graph-toolbar__toggle">
          <input
            type="checkbox"
            checked={view.focus}
            onChange={(e) => onChange({ focus: e.target.checked })}
          />
          <span>მხოლოდ მეზობლები</span>
        </label>

        {view.focus ? (
          <select
            className="input input--sm"
            value={view.depth}
            onChange={(e) => onChange({ depth: Number(e.target.value) })}
          >
            <option value={1}>1 საფეხური</option>
            <option value={2}>2 საფეხური</option>
            <option value={3}>3 საფეხური</option>
          </select>
        ) : null}

        <label className="graph-toolbar__toggle">
          <input
            type="checkbox"
            checked={view.manualOnly}
            onChange={(e) => onChange({ manualOnly: e.target.checked })}
          />
          <span>მხოლოდ ჩემი</span>
        </label>

        <label className="graph-toolbar__toggle">
          <input
            type="checkbox"
            checked={view.showLabels}
            onChange={(e) => onChange({ showLabels: e.target.checked })}
          />
          <span>წარწერები</span>
        </label>

        <button className="btn btn--quiet btn--sm" onClick={onFit}>
          ჩატევა
        </button>

        <span className="xsmall muted graph-toolbar__count">
          {visible} / {total}
        </span>
      </div>

      <div className="graph-types">
        {NODE_TYPES.map((type) => (
          <button
            key={type}
            className={`graph-type${view.types.includes(type) ? ' is-on' : ''}`}
            onClick={() => toggleType(type)}
            title={NODE_TYPE_LABEL[type]}
          >
            {NODE_TYPE_GLYPH[type]} {NODE_TYPE_LABEL[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
