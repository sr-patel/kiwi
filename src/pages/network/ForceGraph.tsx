import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import type { ForceGraphData, TagNetworkLink, TagNetworkNode } from '@/pages/network/types';
import { linkSelectionKey } from '@/pages/network/types';
import {
  atlasBounds,
  atlasNodeRadius,
  distanceToSegment,
  fitAtlasTransform,
  screenToWorld,
  zoomAtlasAt,
  type AtlasTransform,
} from './atlasMath';

interface TagForceGraphProps {
  graphData: ForceGraphData;
  selectedTag: string | null;
  selectedLink: { source: string; target: string } | null;
  onSelectTag: (tag: string | null) => void;
  onSelectLink: (source: string, target: string) => void;
  onClearSelection: () => void;
  showInterLinks: boolean;
  showLabels: boolean;
  fitRequest: number;
  accentHex: string;
  isDark: boolean;
}

interface HoverState {
  node: TagNetworkNode;
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: AtlasTransform;
  moved: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized,
    16,
  );
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function isVisible(node: TagNetworkNode, transform: AtlasTransform, width: number, height: number) {
  const x = node.x * transform.scale + transform.x;
  const y = node.y * transform.scale + transform.y;
  return x > -40 && x < width + 40 && y > -40 && y < height + 40;
}

export function TagForceGraph({
  graphData,
  selectedTag,
  selectedLink,
  onSelectTag,
  onSelectLink,
  onClearSelection,
  showInterLinks,
  showLabels,
  fitRequest,
  accentHex,
  isDark,
}: TagForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const transformRef = useRef<AtlasTransform>({ x: 0, y: 0, scale: 1 });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [transform, setTransform] = useState<AtlasTransform>(transformRef.current);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [keyboardTag, setKeyboardTag] = useState<string | null>(null);

  const bounds = useMemo(() => atlasBounds(graphData), [graphData]);
  const nodeById = useMemo(() => new Map(graphData.nodes.map((node) => [node.id, node])), [graphData.nodes]);
  const orderedNodes = useMemo(
    () =>
      [...graphData.nodes].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.id.localeCompare(b.id)),
    [graphData.nodes],
  );
  const displayLinks = useMemo(
    () => (showInterLinks ? [...graphData.links, ...graphData.interLinks] : graphData.links),
    [graphData.links, graphData.interLinks, showInterLinks],
  );
  const interLinkKeys = useMemo(
    () => new Set(graphData.interLinks.map((link) => linkSelectionKey(link.source, link.target))),
    [graphData.interLinks],
  );
  const selectedLinkKey = selectedLink ? linkSelectionKey(selectedLink.source, selectedLink.target) : null;
  const connectedTags = useMemo(() => {
    if (!selectedTag) return new Set<string>();
    const connected = new Set([selectedTag]);
    for (const link of displayLinks) {
      if (link.source === selectedTag) connected.add(link.target);
      if (link.target === selectedTag) connected.add(link.source);
    }
    return connected;
  }, [displayLinks, selectedTag]);

  const updateTransform = useCallback((next: AtlasTransform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const fitGraph = useCallback(() => {
    updateTransform(fitAtlasTransform(bounds, dimensions.width, dimensions.height, 80));
  }, [bounds, dimensions.height, dimensions.width, updateTransform]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({
        width: Math.max(320, Math.round(entry.contentRect.width)),
        height: Math.max(360, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fitGraph();
  }, [fitGraph, fitRequest, graphData.nodes.length, graphData.clusters.length]);

  useEffect(() => {
    if (!selectedTag) return;
    const node = nodeById.get(selectedTag);
    if (!node) return;
    const current = transformRef.current;
    const scale = Math.max(current.scale, 0.7);
    updateTransform({
      x: dimensions.width / 2 - node.x * scale,
      y: dimensions.height / 2 - node.y * scale,
      scale,
    });
  }, [selectedTag, nodeById, dimensions.height, dimensions.width, updateTransform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(dimensions.width * dpr);
    const pixelHeight = Math.round(dimensions.height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = requestAnimationFrame(() => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const gridSize = 44;
      ctx.fillStyle = isDark ? 'rgba(113,113,122,.12)' : 'rgba(113,113,122,.1)';
      for (let x = ((transform.x % gridSize) + gridSize) % gridSize; x < dimensions.width; x += gridSize) {
        for (let y = ((transform.y % gridSize) + gridSize) % gridSize; y < dimensions.height; y += gridSize) {
          ctx.fillRect(x, y, 1, 1);
        }
      }

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      for (const cluster of graphData.clusters) {
        if (cluster.hull.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(cluster.hull[0].x, cluster.hull[0].y);
        for (const point of cluster.hull.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(cluster.color, isDark ? 0.1 : 0.08);
        ctx.strokeStyle = hexToRgba(cluster.color, isDark ? 0.35 : 0.3);
        ctx.lineWidth = 1.25 / transform.scale;
        ctx.fill();
        ctx.stroke();
      }

      for (const link of displayLinks) {
        const source = nodeById.get(link.source);
        const target = nodeById.get(link.target);
        if (!source || !target) continue;
        const isInter = interLinkKeys.has(linkSelectionKey(link.source, link.target));
        const isSelected = selectedLinkKey === linkSelectionKey(link.source, link.target);
        const touchesSelected = selectedTag && (link.source === selectedTag || link.target === selectedTag);
        const dimmed = selectedTag && !touchesSelected;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle =
          isSelected || touchesSelected
            ? hexToRgba(accentHex, isSelected ? 0.95 : 0.7)
            : isInter
              ? isDark
                ? 'rgba(161,161,170,.22)'
                : 'rgba(82,82,91,.2)'
              : hexToRgba(source.color, dimmed ? 0.08 : 0.38);
        ctx.lineWidth =
          (isSelected ? 2.5 : Math.min(0.65 + Math.log2(link.weight + 1) * 0.45, 2.5)) / transform.scale;
        if (isInter) ctx.setLineDash([5 / transform.scale, 6 / transform.scale]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const node of graphData.nodes) {
        if (!isVisible(node, transform, dimensions.width, dimensions.height)) continue;
        const radius = Math.max(atlasNodeRadius(node), 3 / transform.scale);
        const isActive = node.id === selectedTag || node.id === hover?.node.id || node.id === keyboardTag;
        const isDimmed =
          (selectedTag && !connectedTags.has(node.id)) ||
          (selectedLink && node.id !== selectedLink.source && node.id !== selectedLink.target);
        const color = isActive ? accentHex : node.color;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + (isActive ? 6 : 3) / transform.scale, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, isDimmed ? 0.04 : isActive ? 0.3 : 0.16);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDimmed ? hexToRgba(node.color, 0.16) : color;
        ctx.fill();
        if (isActive) {
          ctx.strokeStyle = isDark ? '#ffffff' : '#18181b';
          ctx.lineWidth = 1.5 / transform.scale;
          ctx.stroke();
        }

        const rank = node.rank ?? 9999;
        const labelLimit = transform.scale >= 0.85 ? 150 : transform.scale >= 0.4 ? 55 : 20;
        if (isActive || (showLabels && rank <= labelLimit)) {
          const fontSize = (isActive ? 12 : 10.5) / transform.scale;
          ctx.font = `${isActive ? 650 : 500} ${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.lineWidth = 3 / transform.scale;
          ctx.strokeStyle = isDark ? 'rgba(9,9,11,.9)' : 'rgba(250,250,250,.92)';
          ctx.strokeText(`#${node.id}`, node.x, node.y + radius + 5 / transform.scale);
          ctx.fillStyle = isDimmed ? (isDark ? '#71717a' : '#a1a1aa') : isDark ? '#f4f4f5' : '#18181b';
          ctx.fillText(`#${node.id}`, node.x, node.y + radius + 5 / transform.scale);
        }
      }

      if (showLabels) {
        for (const cluster of graphData.clusters) {
          const radius =
            cluster.radius ??
            Math.max(...cluster.hull.map((point) => Math.hypot(point.x - cluster.cx, point.y - cluster.cy)));
          const label = `#${cluster.label} · ${cluster.nodeCount} tags`;
          ctx.font = `650 ${12 / transform.scale}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = isDark ? 'rgba(9,9,11,.9)' : 'rgba(250,250,250,.94)';
          ctx.lineWidth = 4 / transform.scale;
          ctx.strokeText(label, cluster.cx, cluster.cy - radius + 22 / transform.scale);
          ctx.fillStyle = isDark ? '#d4d4d8' : '#3f3f46';
          ctx.fillText(label, cluster.cx, cluster.cy - radius + 22 / transform.scale);
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    accentHex,
    connectedTags,
    dimensions.height,
    dimensions.width,
    displayLinks,
    graphData,
    hover?.node.id,
    interLinkKeys,
    isDark,
    keyboardTag,
    nodeById,
    selectedLink,
    selectedLinkKey,
    selectedTag,
    showLabels,
    transform,
  ]);

  const pointerPosition = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const findNode = useCallback(
    (screenX: number, screenY: number) => {
      const world = screenToWorld({ x: screenX, y: screenY }, transformRef.current);
      const hitPadding = 7 / transformRef.current.scale;
      for (let index = graphData.nodes.length - 1; index >= 0; index -= 1) {
        const node = graphData.nodes[index];
        if (Math.hypot(world.x - node.x, world.y - node.y) <= atlasNodeRadius(node) + hitPadding) return node;
      }
      return null;
    },
    [graphData.nodes],
  );

  const findInterLink = useCallback(
    (screenX: number, screenY: number): TagNetworkLink | null => {
      if (!showInterLinks) return null;
      const world = screenToWorld({ x: screenX, y: screenY }, transformRef.current);
      const threshold = 7 / transformRef.current.scale;
      for (const link of graphData.interLinks) {
        const source = nodeById.get(link.source);
        const target = nodeById.get(link.target);
        if (source && target && distanceToSegment(world, source, target) <= threshold) return link;
      }
      return null;
    },
    [graphData.interLinks, nodeById, showInterLinks],
  );

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = pointerPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      origin: transformRef.current,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event);
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.moved) updateTransform({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy });
      return;
    }
    const node = findNode(point.x, point.y);
    setHover((previous) => {
      if (!node) return null;
      if (previous?.node.id === node.id) return previous;
      return { node, x: point.x, y: point.y };
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
    const node = findNode(point.x, point.y);
    if (node) {
      onSelectTag(selectedTag === node.id ? null : node.id);
      return;
    }
    const link = findInterLink(point.x, point.y);
    if (link) {
      if (selectedLinkKey === linkSelectionKey(link.source, link.target)) onClearSelection();
      else onSelectLink(link.source, link.target);
      return;
    }
    onClearSelection();
  };

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const factor = Math.exp(-event.deltaY * 0.0012);
    updateTransform(zoomAtlasAt(transformRef.current, point, transformRef.current.scale * factor));
  };

  const focusKeyboardNode = (direction: number) => {
    const currentIndex = orderedNodes.findIndex((node) => node.id === keyboardTag);
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + direction + orderedNodes.length) % orderedNodes.length;
    const node = orderedNodes[nextIndex];
    if (!node) return;
    setKeyboardTag(node.id);
    const current = transformRef.current;
    const scale = Math.max(current.scale, 0.7);
    updateTransform({
      x: dimensions.width / 2 - node.x * scale,
      y: dimensions.height / 2 - node.y * scale,
      scale,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Escape') {
      onClearSelection();
      setKeyboardTag(null);
    } else if (event.key === '0') {
      fitGraph();
    } else if (event.key === '+' || event.key === '=') {
      updateTransform(
        zoomAtlasAt(
          transformRef.current,
          { x: dimensions.width / 2, y: dimensions.height / 2 },
          transformRef.current.scale * 1.25,
        ),
      );
    } else if (event.key === '-') {
      updateTransform(
        zoomAtlasAt(
          transformRef.current,
          { x: dimensions.width / 2, y: dimensions.height / 2 },
          transformRef.current.scale / 1.25,
        ),
      );
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      focusKeyboardNode(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      focusKeyboardNode(-1);
    } else if (event.key === 'Enter' && keyboardTag) {
      onSelectTag(keyboardTag);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset"
        style={{ ['--tw-ring-color' as string]: accentHex }}
        width={dimensions.width}
        height={dimensions.height}
        tabIndex={0}
        role="application"
        aria-label={`Interactive tag atlas with ${graphData.nodes.length} tags in ${graphData.clusters.length} communities`}
        aria-describedby="tag-atlas-instructions"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => setHover(null)}
        onWheel={handleWheel}
        onDoubleClick={fitGraph}
        onKeyDown={handleKeyDown}
      />
      <p id="tag-atlas-instructions" className="sr-only">
        Drag to pan and use the mouse wheel to zoom. Arrow keys move between tags, Enter opens a tag, plus and
        minus zoom, zero fits the atlas, and Escape clears the selection.
      </p>
      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-64 rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-200 shadow-xl"
          style={{ left: Math.min(hover.x + 14, dimensions.width - 210), top: Math.max(8, hover.y - 54) }}
        >
          <p className="truncate font-semibold">#{hover.node.id}</p>
          <p className="mt-0.5 text-zinc-400">
            {hover.node.count.toLocaleString()} items · {hover.node.degree ?? 0} strong connections
          </p>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-zinc-800/70 bg-zinc-950/75 px-2 py-1 text-[10px] text-zinc-500 backdrop-blur-sm">
        {Math.round(transform.scale * 100)}% · drag to pan · scroll to zoom · double-click to fit
      </div>
    </div>
  );
}
