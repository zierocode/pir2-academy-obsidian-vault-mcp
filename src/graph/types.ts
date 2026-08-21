export type GraphPropertyValue = string | string[];

export type GraphNode = {
  id: string;
  path: string;
  title: string;
  aliases: string[];
  properties: Record<string, GraphPropertyValue>;
  contentHash: string;
};

export type GraphEdge = {
  from: string;
  to: string | null;
  rawTarget: string;
  kind: "wikilink" | "embed" | "property";
  relation: string;
  unresolved: boolean;
  resolution: "relative" | "vault" | "basename" | "alias" | "ambiguous" | "missing";
};

export type GraphIndex = {
  schemaVersion: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
  outgoing: Record<string, string[]>;
  backlinks: Record<string, string[]>;
};
