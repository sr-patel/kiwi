import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type GraphLink, type GraphNode } from 'react-force-graph-2d';
import type { ForceGraphData, ForceGraphLink, ForceGraphNode, TagCluster } from '@/pages/network/types';
import { linkSelectionKey } from '@/pages/network/types';

interface DisplayLink extends ForceGraphLink {
  isInter?: boolean;
}

interface TagForceGraphProps {
  graphData: ForceGraphData;
  selectedTag: string | null;
  selectedLink: { source: string; target: string } | null;
  onSelectTag: (tag: string | null) => void;
  onSelectLink: (source: string, target: string) => void;
  onClearSelection: () => void;
  showInterLinks: boolean;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
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

function resolveLinkEndpointId(endpoint: string | ForceGraphNode | undefined): string | null {
  if (endpoint == null) return null;
  if (typeof endpoint === 'object') return endpoint.id ?? null;
  return String(endpoint);
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

    ctx.fillStyle = hexToRgba(cluster.color, isDark ? 0.14 : 0.2);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(cluster.color, isDark ? 0.4 : 0.5);
    ctx.lineWidth = 1.5 / globalScale;
    ctx.stroke();
  }
}

function drawClusterLabels(
  ctx: CanvasRenderingContext2D,
  clusters: TagCluster[],
  globalScale: number,
  isDark: boolean,
) {
  if (globalScale < 0.4) return;

  const labelCandidates = clusters
    .filter((cluster) => cluster.nodeCount >= 4 && cluster.label)
    .sort((a, b) => b.nodeCount - a.nodeCount)
    .slice(0, 30);

  const fontSize = Math.max(14 / globalScale, 3);
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const cluster of labelCandidates) {
    const text = `#${cluster.label}`;
    ctx.strokeStyle = isDark ? 'rgba(9, 9, 11, 0.75)' : 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3 / globalScale;
    ctx.strokeText(text, cluster.cx, cluster.cy);
    ctx.fillStyle = isDark ? '#f4f4f5' : '#18181b';
    ctx.fillText(text, cluster.cx, cluster.cy);
  }
}

export function TagForceGraph({
  graphData,
  selectedTag,
  selectedLink,
  onSelectTag,
  onSelectLink,
  onClearSelection,
  showInterLinks,
  zoomLevel,
  onZoomChange,
  accentHex,
  isDark,
}: TagForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods>();
  const hasFitRef = useRef(false);
  const skipZoomSyncRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, ForceGraphNode>();
    for (const node of graphData.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [graphData.nodes]);

  const selectedLinkKey = selectedLink
    ? linkSelectionKey(selectedLink.source, selectedLink.target)
    : null;

  const displayLinks = useMemo<DisplayLink[]>(() => {
    const intra = graphData.links.map((link) => ({ ...link, isInter: false }));
    if (!showInterLinks) return intra;
    const inter = graphData.interLinks.map((link) => ({ ...link, isInter: true }));
    return [...intra, ...inter];
  }, [graphData.links, graphData.interLinks, showInterLinks]);

  const displayGraph = useMemo(
    () => ({
      nodes: graphData.nodes,
      links: displayLinks,
    }),
    [graphData.nodes, displayLinks],
  );

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of graphData.nodes) {
      map.set(node.id, new Set());
    }
    for (const link of displayLinks) {
      const source = resolveLinkEndpointId(link.source);
      const target = resolveLinkEndpointId(link.target);
      if (source && target) {
        map.get(source)?.add(target);
        map.get(target)?.add(source);
      }
    }
    return map;
  }, [graphData.nodes, displayLinks]);

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
  }, [graphData, showInterLinks]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || hasFitRef.current) return;
    graph.zoomToFit(400, 160);
    skipZoomSyncRef.current = true;
    graph.zoom(zoomLevel, 0);
    hasFitRef.current = true;
  }, [displayGraph, dimensions.width, dimensions.height]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !hasFitRef.current) return;
    skipZoomSyncRef.current = true;
    graph.zoom(zoomLevel, 0);
  }, [zoomLevel]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedTag) return;

    const node = graphData.nodes.find((entry) => entry.id === selectedTag);
    if (node?.x != null && node?.y != null) {
      graph.centerAt(node.x, node.y, 500);
    }
  }, [selectedTag, graphData.nodes]);

  const getNodeColor = useCallback(
    (node: ForceGraphNode) => {
      if (selectedTag === node.id) return accentHex;
      if (hoveredTag === node.id) return accentHex;

      const base = node.color;
      if (!selectedTag && !selectedLink) return base;
      if (selectedTag && connectedToSelected.has(node.id)) return base;
      if (selectedLink && (node.id === selectedLink.source || node.id === selectedLink.target)) {
        return base;
      }
      return hexToRgba(base, 0.12);
    },
    [selectedTag, selectedLink, hoveredTag, accentHex, connectedToSelected],
  );

  const getLinkColor = useCallback(
    (link: DisplayLink) => {
      const sourceId = resolveLinkEndpointId(link.source);
      const targetId = resolveLinkEndpointId(link.target);
      if (!sourceId || !targetId) {
        return isDark ? 'rgba(161, 161, 170, 0.22)' : 'rgba(113, 113, 122, 0.3)';
      }

      if (link.isInter) {
        const linkKey = linkSelectionKey(sourceId, targetId);
        if (selectedLinkKey === linkKey) return hexToRgba(accentHex, 0.95);

        const touchesSelection =
          selectedTag &&
          (sourceId === selectedTag ||
            targetId === selectedTag ||
            connectedToSelected.has(sourceId) ||
            connectedToSelected.has(targetId));

        if (touchesSelection) return hexToRgba(accentHex, 0.7);
        return isDark ? 'rgba(161, 161, 170, 0.28)' : 'rgba(113, 113, 122, 0.35)';
      }

      const sourceNode = nodeById.get(sourceId);
      const clusterColor = sourceNode?.color ?? '#71717a';

      if (selectedTag) {
        const touchesSelection =
          sourceId === selectedTag ||
          targetId === selectedTag ||
          (connectedToSelected.has(sourceId) && connectedToSelected.has(targetId));

        if (touchesSelection) return hexToRgba(accentHex, 0.55);
        return isDark ? 'rgba(39, 39, 42, 0.12)' : 'rgba(228, 228, 231, 0.15)';
      }

      return hexToRgba(clusterColor, isDark ? 0.45 : 0.55);
    },
    [selectedTag, selectedLinkKey, connectedToSelected, accentHex, isDark, nodeById],
  );

  const drawNode = useCallback(
    (node: ForceGraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x == null || node.y == null) return;

      const radius = 4 + Math.sqrt(Math.max(node.val ?? 1, 1)) * 3.5;
      const color = getNodeColor(node);
      const showLabel = node.id === selectedTag || node.id === hoveredTag;

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
    [getNodeColor, selectedTag, hoveredTag, isDark],
  );

  const renderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawClusterHulls(ctx, graphData.clusters, globalScale, isDark);
      drawClusterLabels(ctx, graphData.clusters, globalScale, isDark);
    },
    [graphData.clusters, isDark],
  );

  const handleZoom = useCallback(
    (transform: { k: number }) => {
      if (skipZoomSyncRef.current) {
        skipZoomSyncRef.current = false;
        return;
      }
      const clamped = Math.min(4, Math.max(0.3, transform.k));
      onZoomChange(Math.round(clamped * 10) / 10);
    },
    [onZoomChange],
  );

  const getLinkWidth = useCallback(
    (link: DisplayLink) => {
      if (link.isInter) {
        const sourceId = resolveLinkEndpointId(link.source);
        const targetId = resolveLinkEndpointId(link.target);
        if (sourceId && targetId && selectedLinkKey === linkSelectionKey(sourceId, targetId)) {
          return 2.5;
        }
        const pmi = link.pmi ?? 1;
        return Math.min(0.5 + Math.log2(pmi + 1) * 0.25, 1.2);
      }
      const weight = link.weight ?? 1;
      return Math.min(0.4 + Math.log2(weight + 1) * 0.5, 2.5);
    },
    [selectedLinkKey],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={displayGraph as unknown as { nodes: GraphNode[]; links: GraphLink[] }}
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
        linkWidth={(link) => getLinkWidth(link as unknown as DisplayLink)}
        linkColor={(link) => getLinkColor(link as unknown as DisplayLink)}
        onNodeClick={(node) => {
          const entry = node as unknown as ForceGraphNode;
          onSelectTag(selectedTag === entry.id ? null : entry.id);
        }}
        onLinkClick={(link) => {
          const entry = link as unknown as DisplayLink;
          if (!entry.isInter) return;
          const sourceId = resolveLinkEndpointId(entry.source);
          const targetId = resolveLinkEndpointId(entry.target);
          if (!sourceId || !targetId) return;
          if (
            selectedLinkKey === linkSelectionKey(sourceId, targetId)
          ) {
            onClearSelection();
          } else {
            onSelectLink(sourceId, targetId);
          }
        }}
        onNodeHover={(node) => {
          setHoveredTag(node ? (node as unknown as ForceGraphNode).id : null);
        }}
        onBackgroundClick={onClearSelection}
        onZoom={handleZoom}
      />
    </div>
  );
}
