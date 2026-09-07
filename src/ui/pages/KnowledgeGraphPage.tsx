import { useCallback, useMemo, useRef, useState } from 'react';
import {
  filterGraph,
  exportGraphData,
  parseGraphImport,
  type KnowledgeEdge,
  type KnowledgeNode,
  type RelationType,
} from '@/domain/knowledge';
import {
  createGraphEdge,
  createGraphNode,
  deleteGraphEdge,
  deleteGraphNode,
  importGraphData,
  updateGraphNode,
} from '@/persistence/repositories';
import { useKnowledgeGraph } from '../state/useKnowledgeGraph';
import { GraphCanvas, type GraphCanvasHandle } from '../components/graph/GraphCanvas';
import { GraphToolbar, type GraphView } from '../components/graph/GraphToolbar';
import { NodeDetailPanel } from '../components/graph/NodeDetailPanel';
import { PathFinder } from '../components/graph/PathFinder';
import { GraphAnalyticsPanel } from '../components/graph/GraphAnalyticsPanel';
import {
  ConnectEditor,
  NodeEditor,
  draftOf,
  emptyDraft,
  type NodeDraft,
} from '../components/graph/GraphEditors';

/**
 * The knowledge map.
 *
 * This component composes; it does not compute. Filtering, traversal, path
 * finding and analytics all live in `@/domain/knowledge` and are unit-tested
 * without React. What is left here is view state and persistence calls.
 */

type Side = 'detail' | 'paths' | 'stats';

const DEFAULT_VIEW: GraphView = {
  search: '',
  // Opening on every fact, formula and person at once is unreadable. The
  // default is the shape of the library; everything else is one click away.
  types: ['subject', 'topic', 'concept', 'project', 'technology', 'goal', 'idea'],
  subjectIds: [],
  focus: false,
  depth: 1,
  showLabels: true,
  manualOnly: false,
};

export function KnowledgeGraphPage() {
  const { graph, loading } = useKnowledgeGraph();
  const [view, setView] = useState<GraphView>(DEFAULT_VIEW);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [side, setSide] = useState<Side>('detail');
  const [highlight, setHighlight] = useState<string[]>([]);
  const [pathFrom, setPathFrom] = useState<string>();
  const [pathTo, setPathTo] = useState<string>();
  const [editing, setEditing] = useState<{ node?: KnowledgeNode; draft: NodeDraft } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canvasRef = useRef<GraphCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** The graph actually drawn: all filters applied, in the engine, not here. */
  const visible = useMemo(
    () =>
      filterGraph(graph, {
        types: view.types,
        ...(view.subjectIds.length ? { subjectIds: view.subjectIds } : {}),
        ...(view.search.trim() ? { search: view.search } : {}),
        ...(view.manualOnly ? { origin: 'manual' as const } : {}),
        ...(view.focus && selectedId
          ? { focus: { rootIds: [selectedId], depth: view.depth, limit: 120 } }
          : {}),
      }),
    [graph, view, selectedId],
  );

  const selected = selectedId ? graph.nodeById.get(selectedId) : undefined;

  const patchView = useCallback((patch: Partial<GraphView>) => {
    setView((prev) => ({ ...prev, ...patch }));
  }, []);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setHighlight([]);
    if (id) setSide('detail');
  }, []);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };

  /* ------------------------------ writes ------------------------------- */

  const saveNode = async () => {
    if (!editing) return;
    const { draft, node } = editing;
    const tags = draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const masteryPercent = Number(draft.masteryLevel);
    const mastery =
      draft.masteryLevel.trim() && Number.isFinite(masteryPercent)
        ? Math.min(1, Math.max(0, masteryPercent / 100))
        : undefined;

    if (node) {
      await updateGraphNode(node.id, {
        type: draft.type,
        title: draft.title.trim(),
        description: draft.description.trim(),
        subjectId: draft.subjectId || undefined,
        tags,
        ...(mastery !== undefined ? { masteryLevel: mastery } : {}),
      });
    } else {
      const created = await createGraphNode({
        type: draft.type,
        title: draft.title,
        description: draft.description,
        ...(draft.subjectId ? { subjectId: draft.subjectId } : {}),
        tags,
        ...(mastery !== undefined ? { masteryLevel: mastery } : {}),
      });
      if (created) setSelectedId(created.id);
    }
    setEditing(null);
  };

  const removeNode = async (node: KnowledgeNode) => {
    if (!window.confirm(`წავშალო „${node.title}" და მისი კავშირები?`)) return;
    await deleteGraphNode(node.id);
    setSelectedId(null);
  };

  const connect = async (targetId: string, relationType: RelationType, note: string) => {
    if (!connecting) return;
    await createGraphEdge(connecting, targetId, relationType, note);
    setConnecting(null);
    flash('კავშირი დაემატა.');
  };

  const removeEdge = async (edge: KnowledgeEdge) => {
    await deleteGraphEdge(edge.id);
  };

  /* --------------------------- import / export -------------------------- */

  const doExport = () => {
    const dump = exportGraphData(graph.nodes, graph.edges);
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `labo-knowledge-graph-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const parsed = parseGraphImport(JSON.parse(await file.text()));
      if (parsed.nodes.length === 0 && parsed.edges.length === 0) {
        flash(parsed.errors[0] ?? 'ფაილში ვერაფერი მოიძებნა.');
        return;
      }
      await importGraphData(parsed.nodes, parsed.edges, 'merge');
      flash(
        `დაემატა ${parsed.nodes.length} კვანძი, ${parsed.edges.length} კავშირი.` +
          (parsed.errors.length ? ` ${parsed.errors.length} ჩანაწერი გამოტოვდა.` : ''),
      );
    } catch {
      flash('ფაილი ვერ წაიკითხა.');
    }
  };

  /* -------------------------------- view -------------------------------- */

  return (
    <div className="page graph-page">
      <header className="hero">
        <h1 className="hero__title">ცოდნის რუკა</h1>
        <p className="hero__sub">
          თემები, დოკუმენტები, წიგნები და შენი საკუთარი ცნებები — ერთ დაკავშირებულ რუკაზე.
        </p>
      </header>

      <div className="graph-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => setEditing({ draft: emptyDraft() })}
        >
          + ახალი კვანძი
        </button>
        <button className="btn btn--ghost btn--sm" onClick={doExport}>
          ექსპორტი
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
          იმპორტი
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file);
            e.target.value = '';
          }}
        />
        <div className="graph-sides" role="group">
          {(['detail', 'paths', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              className={`ask-modes__btn${side === tab ? ' is-active' : ''}`}
              onClick={() => setSide(tab)}
            >
              {tab === 'detail' ? 'დეტალები' : tab === 'paths' ? 'გზები' : 'სტატისტიკა'}
            </button>
          ))}
        </div>
      </div>

      {notice ? <p className="ask-note ask-note--ok">{notice}</p> : null}

      <GraphToolbar
        view={view}
        onChange={patchView}
        onFit={() => canvasRef.current?.fit()}
        visible={visible.nodes.length}
        total={graph.nodes.length}
      />

      <div className="graph-layout">
        <div className="graph-stage">
          {loading ? (
            <p className="xsmall muted graph-stage__note">იტვირთება…</p>
          ) : visible.nodes.length === 0 ? (
            <p className="xsmall muted graph-stage__note">
              ამ ფილტრით კვანძი არ დარჩა. შეცვალე ფილტრი ან დაამატე ახალი კვანძი.
            </p>
          ) : null}
          <GraphCanvas
            handleRef={canvasRef}
            graph={visible}
            selectedId={selectedId ?? undefined}
            highlightIds={highlight}
            showLabels={view.showLabels}
            onSelect={select}
            onOpen={(id) => {
              const node = graph.nodeById.get(id);
              if (node?.href) window.location.assign(node.href);
            }}
          />
        </div>

        <div className="graph-side">
          {editing ? (
            <NodeEditor
              draft={editing.draft}
              editing={Boolean(editing.node)}
              onChange={(patch) =>
                setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev))
              }
              onSave={() => void saveNode()}
              onCancel={() => setEditing(null)}
            />
          ) : connecting ? (
            <ConnectEditor
              graph={graph}
              sourceId={connecting}
              onSave={(target, relation, note) => void connect(target, relation, note)}
              onCancel={() => setConnecting(null)}
            />
          ) : side === 'paths' ? (
            <PathFinder
              graph={graph}
              fromId={pathFrom}
              toId={pathTo}
              onPick={(slot, id) => (slot === 'from' ? setPathFrom(id || undefined) : setPathTo(id || undefined))}
              onHighlight={setHighlight}
              onSelect={select}
            />
          ) : side === 'stats' ? (
            <GraphAnalyticsPanel graph={graph} onSelect={select} />
          ) : selected ? (
            <NodeDetailPanel
              graph={graph}
              node={selected}
              onSelect={select}
              onConnect={(id) => setConnecting(id)}
              onEdit={(node) => setEditing({ node, draft: draftOf(node) })}
              onDelete={(node) => void removeNode(node)}
              onDeleteEdge={(edge) => void removeEdge(edge)}
              onPathFrom={(id) => {
                setPathFrom(id);
                setSide('paths');
              }}
            />
          ) : (
            <p className="xsmall muted graph-side__empty">
              აირჩიე კვანძი რუკაზე, რომ ნახო რას უკავშირდება.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
