import type {
  TagCluster as SharedTagCluster,
  TagNetworkGraph as SharedTagNetworkGraph,
  TagNetworkLink as SharedTagNetworkLink,
  TagNetworkNode as SharedTagNetworkNode,
} from '@kiwi/contracts';

export type TagCluster = SharedTagCluster;
export type TagNetworkNode = SharedTagNetworkNode;
export type TagNetworkLink = SharedTagNetworkLink;

export type TagCoOccurrenceEdge = TagNetworkLink;

export type TagNetworkGraph = SharedTagNetworkGraph;

export interface ForceGraphNode extends TagNetworkNode {
  degree?: number;
  isIsolated?: boolean;
}

export interface ForceGraphLink {
  source: string | ForceGraphNode;
  target: string | ForceGraphNode;
  weight: number;
  pmi?: number;
}

export interface ForceGraphData {
  nodes: ForceGraphNode[];
  links: ForceGraphLink[];
  interLinks: ForceGraphLink[];
  clusters: TagCluster[];
}

export type NetworkSelection =
  { kind: 'tag'; tag: string } | { kind: 'link'; source: string; target: string } | null;

export function linkSelectionKey(source: string, target: string): string {
  return source < target ? `${source}:${target}` : `${target}:${source}`;
}
