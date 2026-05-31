import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type GraphLink, type GraphNode } from 'react-force-graph-2d';
import type { ForceGraphData, ForceGraphLink, ForceGraphNode } from '@/pages/network/types';

interface TagForceGraphProps {
  graphData: ForceGraphData;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  accentHex: string;
  isDark: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TagForceGraph({
  graphData,
  selectedTag,
  onSelectTag,
  accentHex,
  isDark,
}: TagForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods>();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const oortPositionedRef = useRef(false);

  const topTagIds = useMemo(() => {
    return new Set(
      [...graphData.nodes]
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        .map((node) => node.id),
    );
  }, [graphData.nodes]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of graphData.nodes) {
      map.set(node.id, new Set());
    }
    for (const link of graphData.links) {
      const source = typeof link.source === 'object' ? link.source.id : link.source;
      const target = typeof link.target === 'object' ? link.target.id : link.target;
      if (typeof source === 'string' && typeof target === 'string') {
        map.get(source)?.add(target);
        map.get(target)?.add(source);
      }
    }
    return map;
  }, [graphData.nodes, graphData.links]);

  const connectedToSelected = useMemo(() => {
    if (!selectedTag) return new Set<string>();
    const connected = new Set<string>([selectedTag]);
    for (const neighbor of adjacency.get(selectedTag) ?? []) {
      connected.add(neighbor);
    }
    return connected;
  }, [selectedTag, adjacency]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({
        width: Math.max(width, 320),
        height: Math.max(height, 400),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    oortPositionedRef.current = false;
    for (const node of graphData.nodes) {
      delete node.fx;
      delete node.fy;
    }
  }, [graphData]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedTag) return;

    const node = graphData.nodes.find((entry) => entry.id === selectedTag);
    if (node?.x != null && node?.y != null) {
      graph.centerAt(node.x, node.y, 600);
      graph.zoom(2.2, 600);
    }
  }, [selectedTag, graphData.nodes]);

  const positionOortCloud = useCallback(() => {
    if (oortPositionedRef.current) return;

    const isolated = graphData.nodes.filter((node) => node.isIsolated);
    if (isolated.length === 0) {
      oortPositionedRef.current = true;
      return;
    }

    const radius = Math.min(dimensions.width, dimensions.height) * 0.38;
    isolated.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / isolated.length - Math.PI / 2;
      node.fx = radius * Math.cos(angle);
      node.fy = radius * Math.sin(angle);
    });

    oortPositionedRef.current = true;
    graphRef.current?.d3ReheatSimulation();
  }, [graphData.nodes, dimensions.width, dimensions.height]);

  const getNodeColor = useCallback(
    (node: ForceGraphNode) => {
      if (selectedTag === node.id) return accentHex;
      if (hoveredTag === node.id) return accentHex;

      const base = node.color;
      if (!selectedTag) return base;

      if (connectedToSelected.has(node.id)) return base;
      return hexToRgba(base, 0.15);
    },
    [selectedTag, hoveredTag, accentHex, connectedToSelected],
  );

  const getLinkColor = useCallback(
    (link: ForceGraphLink) => {
      const sourceId =
        typeof link.source === 'object' ? link.source.id : (link.source as string);
      const targetId =
        typeof link.target === 'object' ? link.target.id : (link.target as string);

      if (!selectedTag) {
        return isDark ? 'rgba(161, 161, 170, 0.25)' : 'rgba(113, 113, 122, 0.35)';
      }

      const touchesSelection =
        sourceId === selectedTag ||
        targetId === selectedTag ||
        (connectedToSelected.has(sourceId as string) &&
          connectedToSelected.has(targetId as string));

      if (touchesSelection) {
        return hexToRgba(accentHex, 0.55);
      }
      return isDark ? 'rgba(39, 39, 42, 0.2)' : 'rgba(228, 228, 231, 0.25)';
    },
    [selectedTag, connectedToSelected, accentHex, isDark],
  );

  const drawNode = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x == null || node.y == null) return;

      const radius = Math.sqrt(Math.max(node.val ?? 1, 1)) * 3.2;
      const color = getNodeColor(node);
      const showLabel =
        globalScale > 1.15 || topTagIds.has(node.id) || node.id === selectedTag;

      ctx.save();

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = color.includes('rgba') ? color : hexToRgba(color, 0.25);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (node.id === selectedTag || hoveredTag === node.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      if (showLabel) {
        const fontSize = Math.max(12 / globalScale, 2.5);
        ctx.font = `${node.id === selectedTag ? '600' : '500'} ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isDark ? '#f4f4f5' : '#18181b';
        ctx.fillText(`#${node.id}`, node.x, node.y + radius + 3 / globalScale);
      }

      ctx.restore();
    },
    [getNodeColor, topTagIds, selectedTag, hoveredTag, isDark],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-xl">
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData as unknown as { nodes: GraphNode[]; links: GraphLink[] }}
        backgroundColor={isDark ? '#09090b' : '#fafafa'}
        nodeRelSize={1}
        nodeVal="val"
        nodeLabel={(node) => {
          const entry = node as unknown as ForceGraphNode;
          return `#${entry.id} — ${entry.count.toLocaleString()} items`;
        }}
        nodeCanvasObject={(node, ctx, globalScale) =>
          drawNode(node as unknown as ForceGraphNode, ctx, globalScale)
        }
        nodeCanvasObjectMode={() => 'replace'}
        linkWidth={(link) => {
          const weight = (link as unknown as ForceGraphLink).weight ?? 1;
          return Math.min(0.5 + Math.log2(weight + 1) * 0.8, 4);
        }}
        linkColor={(link) => getLinkColor(link as unknown as ForceGraphLink)}
        linkDirectionalParticles={selectedTag ? 2 : 0}
        linkDirectionalParticleWidth={2}
        cooldownTicks={120}
        warmupTicks={40}
        enableNodeDrag
        onNodeClick={(node) => {
          const entry = node as unknown as ForceGraphNode;
          onSelectTag(selectedTag === entry.id ? null : entry.id);
        }}
        onNodeHover={(node) => {
          setHoveredTag(node ? (node as unknown as ForceGraphNode).id : null);
        }}
        onBackgroundClick={() => onSelectTag(null)}
        onZoom={({ k }) => setZoomLevel(k)}
        onEngineStop={positionOortCloud}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-400 backdrop-blur-sm">
        <div>Zoom: {Math.round(zoomLevel * 100)}%</div>
        <div className="mt-1 text-zinc-500">
          {zoomLevel < 0.8
            ? 'Macro view — clusters only'
            : zoomLevel < 1.5
              ? 'Mid zoom — top tag labels visible'
              : 'Detail zoom — all tag labels'}
        </div>
      </div>
    </div>
  );
}
