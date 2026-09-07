import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { Core, ElementDefinition, NodeSingular } from 'cytoscape';
import { library } from '@/content';
import { NODE_TYPE_GLYPH, RELATION_LABEL, type KnowledgeGraph } from '@/domain/knowledge';

/**
 * The graph canvas.
 *
 * Cytoscape does the rendering, layout, zoom, pan and dragging — all of which
 * are genuinely hard to get right and completely solved. It is imported
 * dynamically so it lands in its own chunk and costs nothing for users who
 * never open this page, matching how the PDF and AI modules are already loaded.
 *
 * This component owns no knowledge logic. It receives an already-filtered
 * graph and reports clicks upward; every decision about *what* to show is made
 * before the data reaches here.
 */

export interface GraphCanvasHandle {
  /** Fit the whole graph into view. */
  fit: () => void;
  /** Centre on one node without changing zoom. */
  center: (id: string) => void;
}

interface Props {
  graph: KnowledgeGraph;
  selectedId?: string | undefined;
  /** Node ids to emphasise — a found path, for instance. */
  highlightIds?: readonly string[];
  showLabels: boolean;
  onSelect: (id: string | null) => void;
  onOpen?: ((id: string) => void) | undefined;
  handleRef?: Ref<GraphCanvasHandle>;
}

/** Read a CSS custom property, so the graph follows the app's theme. */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Colour by subject, reusing each lab's authored hue. A physics node is the
 * same colour here as the physics room is everywhere else, which is what makes
 * the map readable at a glance without a legend.
 */
function colourFor(subjectId: string | undefined, fallback: string): string {
  if (!subjectId) return fallback;
  const hue = library.subjectById.get(subjectId)?.theme.hue;
  return hue === undefined ? fallback : `hsl(${hue} 55% 52%)`;
}

function toElements(graph: KnowledgeGraph, muted: string): ElementDefinition[] {
  const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
    group: 'nodes',
    data: {
      id: node.id,
      label: `${NODE_TYPE_GLYPH[node.type]} ${node.title}`,
      type: node.type,
      colour: colourFor(node.subjectId, muted),
      // Manual nodes are visually distinct: the user should always be able to
      // see which part of the map they built themselves.
      manual: node.origin === 'manual' ? 1 : 0,
      // Degree drives size, so hubs read as hubs.
      weight: Math.min(6, (graph.incident.get(node.id)?.length ?? 0)),
    },
  }));

  const edges: ElementDefinition[] = graph.edges.map((edge) => ({
    group: 'edges',
    data: {
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      label: RELATION_LABEL[edge.relationType],
      manual: edge.origin === 'manual' ? 1 : 0,
    },
  }));

  return [...nodes, ...edges];
}

export function GraphCanvas({
  graph,
  selectedId,
  highlightIds,
  showLabels,
  onSelect,
  onOpen,
  handleRef,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  // Callbacks are read through a ref so re-rendering the page does not tear
  // down and rebuild the whole graph on every keystroke in the search box.
  const handlers = useRef({ onSelect, onOpen });
  handlers.current = { onSelect, onOpen };

  useImperativeHandle(handleRef, () => ({
    fit: () => cyRef.current?.fit(undefined, 40),
    center: (id: string) => {
      const node = cyRef.current?.getElementById(id);
      if (node && node.length > 0) cyRef.current?.animate({ center: { eles: node } }, { duration: 250 });
    },
  }));

  /* ---- create once, then feed it data ---- */
  useEffect(() => {
    let disposed = false;
    let instance: Core | null = null;

    void (async () => {
      const cytoscape = (await import('cytoscape')).default;
      if (disposed || !boxRef.current) return;

      const text = token('--text', '#1a1a1a');
      const muted = token('--text-muted', '#6b6b6b');
      const line = token('--border', '#d8d2c6');
      const accent = token('--accent', '#2f5ea8');

      instance = cytoscape({
        container: boxRef.current,
        elements: [],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(colour)',
              width: 'mapData(weight, 0, 6, 18, 42)',
              height: 'mapData(weight, 0, 6, 18, 42)',
              label: 'data(label)',
              'font-size': 9,
              'font-family': 'var(--font-sans, sans-serif)',
              color: text,
              'text-valign': 'bottom',
              'text-margin-y': 4,
              'text-max-width': '120px',
              'text-wrap': 'ellipsis',
              'border-width': 2,
              'border-color': line,
              'transition-property': 'opacity, border-color, border-width',
              'transition-duration': 140,
            },
          },
          { selector: 'node[manual = 1]', style: { 'border-color': accent, 'border-style': 'dashed' } },
          {
            selector: 'edge',
            style: {
              width: 1.2,
              'line-color': line,
              'target-arrow-color': line,
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.7,
              'curve-style': 'bezier',
              opacity: 0.55,
              'font-size': 7,
              color: muted,
              'text-rotation': 'autorotate',
            },
          },
          { selector: 'edge[manual = 1]', style: { 'line-style': 'dashed', 'line-color': accent, 'target-arrow-color': accent, opacity: 0.9 } },
          { selector: '.dimmed', style: { opacity: 0.12 } },
          {
            selector: '.picked',
            style: { 'border-color': accent, 'border-width': 4, opacity: 1 },
          },
          {
            selector: '.onpath',
            style: { 'border-color': accent, 'border-width': 3, 'line-color': accent, 'target-arrow-color': accent, opacity: 1, width: 3 },
          },
          { selector: '.hidelabel', style: { label: '' } },
        ],
        minZoom: 0.15,
        maxZoom: 3,
        wheelSensitivity: 0.2,
      });

      instance.on('tap', 'node', (event) => {
        handlers.current.onSelect((event.target as NodeSingular).id());
      });
      instance.on('dbltap', 'node', (event) => {
        handlers.current.onOpen?.((event.target as NodeSingular).id());
      });
      // Tapping empty canvas clears the selection, which is the gesture people
      // already expect from every map interface.
      instance.on('tap', (event) => {
        if (event.target === instance) handlers.current.onSelect(null);
      });

      cyRef.current = instance;
      // Trigger the data effect now that the instance exists.
      instance.emit('labo-ready');
    })();

    return () => {
      disposed = true;
      instance?.destroy();
      cyRef.current = null;
    };
  }, []);

  /* ---- data ---- */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      // The instance is still loading; a short retry keeps the first paint
      // correct without introducing a loading state that flashes.
      const timer = window.setTimeout(() => {
        const late = cyRef.current;
        if (!late) return;
        late.json({ elements: toElements(graph, token('--text-muted', '#6b6b6b')) });
        late.layout({ name: 'cose', animate: false, nodeRepulsion: () => 9000, idealEdgeLength: () => 90, padding: 30 } as never).run();
        late.fit(undefined, 40);
      }, 220);
      return () => window.clearTimeout(timer);
    }

    cy.json({ elements: toElements(graph, token('--text-muted', '#6b6b6b')) });
    cy.layout({
      name: 'cose',
      animate: false,
      nodeRepulsion: () => 9000,
      idealEdgeLength: () => 90,
      padding: 30,
    } as never).run();
    cy.fit(undefined, 40);
    return undefined;
  }, [graph]);

  /* ---- selection, neighbour highlight and path emphasis ---- */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('dimmed picked onpath');

    if (highlightIds && highlightIds.length > 0) {
      const onPath = cy.collection();
      for (const id of highlightIds) onPath.merge(cy.getElementById(id));
      // Edges between consecutive path nodes count as on-path too.
      const connecting = onPath.edgesWith(onPath);
      const shown = onPath.union(connecting);
      cy.elements().not(shown).addClass('dimmed');
      shown.addClass('onpath');
      return;
    }

    if (selectedId) {
      const node = cy.getElementById(selectedId);
      if (node.length > 0) {
        // Highlighting the neighbourhood is the whole point of clicking a node:
        // it answers "what is this connected to?" without a panel.
        const near = node.closedNeighborhood();
        cy.elements().not(near).addClass('dimmed');
        node.addClass('picked');
      }
    }
  }, [selectedId, highlightIds, graph]);

  /* ---- labels ---- */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (showLabels) cy.nodes().removeClass('hidelabel');
    else cy.nodes().addClass('hidelabel');
  }, [showLabels, graph]);

  return <div className="graph-canvas" ref={boxRef} role="application" aria-label="ცოდნის რუკა" />;
}
