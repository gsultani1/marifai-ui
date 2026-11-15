// packages/ai-ui/src/lib/graph-layout.ts
export interface GraphNodeRef {
  id: string;
}

export interface GraphEdgeRef {
  from: string;
  to: string;
}

export interface GraphPosition {
  /** Column, counted from the sources on the left. */
  layer: number;
  /** Row within the column. */
  order: number;
}

/**
 * Lays a directed graph out in columns: each node sits one column right
 * of its furthest predecessor (longest path), edges that would close a
 * cycle are ignored for layering, and nodes within a column keep the
 * average row of their predecessors to reduce crossings.
 */
export function layoutLayers(nodes: readonly GraphNodeRef[], edges: readonly GraphEdgeRef[]): Map<string, GraphPosition> {
  const ids = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) if (ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to) outgoing.get(edge.from)!.push(edge.to);

  const state = new Map<string, "visiting" | "done">();
  const acyclic: GraphEdgeRef[] = [];
  const visit = (id: string) => {
    state.set(id, "visiting");
    for (const next of outgoing.get(id) ?? []) {
      if (state.get(next) === "visiting") continue;
      acyclic.push({ from: id, to: next });
      if (!state.has(next)) visit(next);
    }
    state.set(id, "done");
  };
  for (const node of nodes) if (!state.has(node.id)) visit(node.id);

  const incoming = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of acyclic) incoming.get(edge.to)!.push(edge.from);
  const layer = new Map<string, number>();
  const layerOf = (id: string, seen: Set<string> = new Set()): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const value = Math.max(-1, ...(incoming.get(id) ?? []).map((from) => layerOf(from, seen))) + 1;
    layer.set(id, value);
    return value;
  };
  for (const node of nodes) layerOf(node.id);

  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const column = layer.get(node.id)!;
    columns.set(column, [...(columns.get(column) ?? []), node.id]);
  }
  const positions = new Map<string, GraphPosition>();
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const members = columns.get(column)!;
    const weight = (id: string) => {
      const rows = (incoming.get(id) ?? []).map((from) => positions.get(from)?.order).filter((row): row is number => row !== undefined);
      return rows.length ? rows.reduce((sum, row) => sum + row, 0) / rows.length : Number.POSITIVE_INFINITY;
    };
    const ordered = members.map((id, index) => ({ id, index, weight: weight(id) })).sort((a, b) => a.weight - b.weight || a.index - b.index);
    ordered.forEach((item, order) => positions.set(item.id, { layer: column, order }));
  }
  return positions;
}
