import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type GraphLink, type GraphNode } from 'react-force-graph-2d';
import type { ForceGraphData, ForceGraphLink, ForceGraphNode, TagCluster } from '@/pages/network/types';

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

function drawClusterHulls(
  ctx: CanvasRenderingContext2D,
  clusters: TagCluster[],
  globalScale: number,
  isDark: boolean,
) {
  for (const cluster of clusters) {
    if (cluster.hull.length < 3) continue;

    ctx.beginPath();
    ctx.moveTo(cluster.hull[0].x, cluster.hull[0].y);
    for (let i = 1; i < cluster.hull.length; i += 1) {
      ctx.lineTo(cluster.hull[i].x, cluster.hull[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = hexToRgba(cluster.color, isDark ? 0.12 : 0.18);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(cluster.color, isDark ? 0.35 : 0.45);
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();
  }
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
  const hasFitRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

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
    hasFitRef.current = false;
  }, [graphData]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || hasFitRef.current) return;
    graph.zoomToFit(400, 80);
    hasFitRef.current = true;
  }, [graphData, dimensions.width, dimensions.height]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedTag) return;

    const node = graphData.nodes.find((entry) => entry.id === selectedTag);
    if (node?.x != null && node?.y != null) {
      graph.centerAt(node.x, node.y, 500);
      graph.zoom(1.8, 500);
    }
  }, [selectedTag, graphData.nodes]);

  const getNodeColor = useCallback(
    (node: ForceGraphNode) => {
      if (selectedTag === node.id) return accentHex;
      if (hoveredTag === node.id) return accentHex;

      const base = node.color;
      if (!selectedTag) return base;
      if (connectedToSelected.has(node.id)) return base;
      return hexToRgba(base, 0.12);
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
        return isDark ? 'rgba(161, 161, 170, 0.18)' : 'rgba(113, 113, 122, 0.25)';
      }

      const touchesSelection =
        sourceId === selectedTag ||
        targetId === selectedTag ||
        (connectedToSelected.has(sourceId as string) &&
          connectedToSelected.has(targetId as string));

      if (touchesSelection) return hexToRgba(accentHex, 0.5);
      return isDark ? 'rgba(39, 39, 42, 0.12)' : 'rgba(228, 228, 231, 0.15)';
    },
    [selectedTag, connectedToSelected, accentHex, isDark],
  );

  const drawNode = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x == null || node.y == null) return;

      const radius = Math.sqrt(Math.max(node.val ?? 1, 1)) * 2.8;
      const color = getNodeColor(node);
      const showLabel =
        node.id === selectedTag ||
        node.id === hoveredTag ||
        (zoomLevel > 1.4 && globalScale > 1.2);

      ctx.save();

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3 / globalScale, 0, 2 * Math.PI);
      ctx.fillStyle = color.includes('rgba') ? color : hexToRgba(color, 0.2);
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
        const fontSize = Math.max(11 / globalScale, 2.5);
        ctx.font = `${node.id === selectedTag ? '600' : '500'} ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = isDark ? '#f4f4f5' : '#18181b';
        ctx.fillText(`#${node.id}`, node.x, node.y + radius + 3 / globalScale);
      }

      ctx.restore();
    },
    [getNodeColor, selectedTag, hoveredTag, zoomLevel, isDark],
  );

  const renderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawClusterHulls(ctx, graphData.clusters, globalScale, isDark);
    },
    [graphData.clusters, isDark],
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
        cooldownTicks={0}
        warmupTicks={0}
        enableNodeDrag={false}
        d3AlphaMin={1}
        nodeLabel={(node) => {
          const entry = node as unknown as ForceGraphNode;
          return `#${entry.id} — ${entry.count.toLocaleString()} items`;
        }}
        onRenderFramePre={renderFramePre}
        nodeCanvasObject={(node, ctx, globalScale) =>
          drawNode(node as unknown as ForceGraphNode, ctx, globalScale)
        }
        nodeCanvasObjectMode={() => 'replace'}
        linkWidth={(link) => {
          const weight = (link as unknown as ForceGraphLink).weight ?? 1;
          return Math.min(0.4 + Math.log2(weight + 1) * 0.5, 2.5);
        }}
        linkColor={(link) => getLinkColor(link as unknown as ForceGraphLink)}
        onNodeClick={(node) => {
          const entry = node as unknown as ForceGraphNode;
          onSelectTag(selectedTag === entry.id ? null : entry.id);
        }}
        onNodeHover={(node) => {
          setHoveredTag(node ? (node as unknown as ForceGraphNode).id : null);
        }}
        onBackgroundClick={() => onSelectTag(null)}
        onZoom={({ k }) => setZoomLevel(k)}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-400 backdrop-blur-sm">
        <div>{graphData.clusters.length} clusters · {graphData.nodes.length} tags</div>
        <div className="mt-1 text-zinc-500">Hover or zoom in for labels</div>
      </div>
    </div>
  );
}
