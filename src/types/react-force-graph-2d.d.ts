declare module 'react-force-graph-2d' {
  import type { ComponentType, MutableRefObject } from 'react';

  export interface GraphNode {
    id?: string | number;
    x?: number;
    y?: number;
    fx?: number;
    fy?: number;
    val?: number;
    [key: string]: unknown;
  }

  export interface GraphLink {
    source: string | number | GraphNode;
    target: string | number | GraphNode;
    [key: string]: unknown;
  }

  export interface ForceGraphMethods {
    centerAt(x?: number, y?: number, ms?: number): void;
    zoom(level?: number, ms?: number): void;
    zoomToFit(ms?: number, padding?: number): void;
    d3Force(name: string, force?: unknown): unknown;
    d3ReheatSimulation(): void;
  }

  export interface ForceGraph2DProps {
    graphData?: { nodes: GraphNode[]; links: GraphLink[] };
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeRelSize?: number;
    nodeVal?: string | ((node: GraphNode) => number);
    nodeLabel?: string | ((node: GraphNode) => string);
    nodeColor?: string | ((node: GraphNode) => string);
    linkWidth?: string | ((link: GraphLink) => number);
    linkColor?: string | ((link: GraphLink) => string);
    linkDirectionalParticles?: number;
    linkDirectionalParticleWidth?: number;
    cooldownTicks?: number;
    warmupTicks?: number;
    enableNodeDrag?: boolean;
    enableZoomInteraction?: boolean;
    enablePanInteraction?: boolean;
    onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
    onNodeHover?: (node: GraphNode | null, previous: GraphNode | null) => void;
    onLinkClick?: (link: GraphLink, event: MouseEvent) => void;
    onBackgroundClick?: () => void;
    onZoom?: (transform: { k: number; x: number; y: number }) => void;
    onRenderFramePre?: (
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => void;
    d3AlphaMin?: number;
    nodeCanvasObject?: (
      node: GraphNode,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => void;
    nodeCanvasObjectMode?: string | ((node: GraphNode) => string);
    ref?: MutableRefObject<ForceGraphMethods | undefined>;
  }

  const ForceGraph2D: ComponentType<ForceGraph2DProps>;
  export default ForceGraph2D;
}
