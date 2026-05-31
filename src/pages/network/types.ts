export interface TagCluster {
  id: number;
  color: string;
  hull: Array<{ x: number; y: number }>;
  nodeCount: number;
}

export interface TagNetworkNode {
  id: string;
  count: number;
  community: number;
  color: string;
  val: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
}

export interface TagNetworkLink {
  source: string;
  target: string;
  weight: number;
}

export interface TagNetworkGraph {
  nodes: TagNetworkNode[];
  links: TagNetworkLink[];
  clusters: TagCluster[];
  stats: {
    tags: number;
    links: number;
    communities: number;
  };
}

export interface ForceGraphNode extends TagNetworkNode {
  degree?: number;
  isIsolated?: boolean;
}

export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  weight: number;
}

export interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
  clusters: TagCluster[];
}
