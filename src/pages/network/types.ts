export interface TagCoOccurrenceEdge {
  source: string;
  target: string;
  weight: number;
}

export interface TagGraphNode {
  id: string;
  count: number;
  community: number;
  degree: number;
  isIsolated: boolean;
}

export interface TagGraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface TagGraphData {
  nodes: TagGraphNode[];
  links: TagGraphLink[];
}

export interface ForceGraphNode extends TagGraphNode {
  val: number;
  color: string;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  weight: number;
}

export interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
}
