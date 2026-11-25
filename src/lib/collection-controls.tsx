// packages/ai-ui/src/lib/collection-controls.tsx
"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

import { SortableList } from "../components/sortable-list.js";
import { TreeView, type TreeNode } from "../components/tree-view.js";
import { ChoiceField, ItemList, matchesQuery, SearchField } from "./component-controls.js";

interface CollectionItem { id: string }

export function FilteredList<T extends CollectionItem>({ items, searchLabel, searchText, filterLabel, filters, category, empty, noMatches = "No matches.", render }: {
  items: readonly T[]; searchLabel: string; searchText: (item: T) => Array<string | undefined>;
  filterLabel?: string; filters?: readonly { value: string; label: string }[]; category?: (item: T) => string;
  /** Shown when there are no items at all. */
  empty: string;
  /** Shown when there are items but the search or filter hides all of them. */
  noMatches?: string;
  render: (item: T) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const available = filters?.some((option) => option.value === filter) ? filter : "";
  const visible = items.filter((item) => (!available || category?.(item) === available) && matchesQuery(query, ...searchText(item)));
  const narrowed = Boolean(query.trim() || available) && items.length > 0;
  return <>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <SearchField label={searchLabel} value={query} onChange={setQuery} />
      {filters?.length && filterLabel ? <ChoiceField label={filterLabel} value={available} options={filters} placeholder="All" onChange={setFilter} /> : null}
    </div>
    <ItemList items={visible} empty={items.length ? noMatches : empty} render={render} />
    {/* Always mounted so screen readers announce the count as the search or filter changes. */}
    <p role="status" className="sr-only">{narrowed ? `Showing ${visible.length} of ${items.length}` : ""}</p>
  </>;
}

export function OrderedList<T extends CollectionItem>({ items, label, itemLabel, onReorder, render, disabled, empty = "No items to order." }: {
  items: readonly T[]; label: string; itemLabel: (item: T) => string; onReorder: (ids: string[]) => void;
  render?: (item: T) => ReactNode; disabled?: boolean;
  /** Shown when there are no items. */
  empty?: string;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <SortableList ordered items={items} label={label} getKey={(item) => item.id} getLabel={itemLabel}
    disabled={disabled} onReorder={(ordered) => onReorder(ordered.map((item) => item.id))}
    renderItem={(item) => <div className="min-w-0 flex-1 text-sm break-words">
      {render?.(item) ?? itemLabel(item)}
    </div>} />;
}

/** Ids of the ancestors of `id`, outermost first, or null when it is not in the tree. */
function ancestorsOf<T extends { id: string; children?: readonly T[] }>(items: readonly T[], id: string | null | undefined, trail: string[] = []): string[] | null {
  if (!id) return null;
  for (const item of items) {
    if (item.id === id) return trail;
    const found = ancestorsOf(item.children ?? [], id, [...trail, item.id]);
    if (found) return found;
  }
  return null;
}

const NODE_ATTRIBUTE = "data-labeled-tree-node";

export function LabeledTree<T extends { id: string; label: string; children?: readonly T[] }>({ items, label, activeId, onSelect, detail, searchable }: {
  items: readonly T[]; label: string; activeId?: string | null; onSelect?: ((id: string) => void) | undefined;
  detail?: (item: T) => string | undefined; searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  // Start with the active node visible, and reveal it again whenever it moves into a collapsed branch.
  const [expanded, setExpanded] = useState<string[]>(() => ancestorsOf(items, activeId) ?? []);
  const [revealed, setRevealed] = useState(activeId);
  if (revealed !== activeId) {
    setRevealed(activeId);
    const path = ancestorsOf(items, activeId) ?? [];
    if (path.some((id) => !expanded.includes(id))) setExpanded([...new Set([...expanded, ...path])]);
  }
  const found = new Map<string, T>();
  const parents: string[] = [];
  function build(entries: readonly T[]): TreeNode[] {
    return entries.flatMap((item) => {
      const children = build(item.children ?? []);
      if (query.trim() && !children.length && !matchesQuery(query, item.label, detail?.(item))) return [];
      found.set(item.id, item);
      if (children.length) parents.push(item.id);
      return [{ id: item.id, label: item.label, children }];
    });
  }
  const nodes = build(items);
  // Selecting the node that is already selected changes nothing in the tree, so report it again here.
  const reactivate = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSelect || !activeId) return;
    const row = (event.target as Element).closest('[role="treeitem"]');
    if (row?.querySelector(`[${NODE_ATTRIBUTE}]`)?.getAttribute(NODE_ATTRIBUTE) === activeId) onSelect(activeId);
  };
  return <>
    {searchable && <SearchField label={"Search " + label.toLowerCase()} value={query} onChange={setQuery} />}
    <div className="contents" onClick={reactivate}>
      <TreeView label={label} nodes={nodes} expanded={query.trim() ? parents : expanded} onExpandedChange={setExpanded}
        selected={activeId && found.has(activeId) ? [activeId] : []} selectionMode={onSelect ? "single" : "none"}
        onSelectedChange={(ids) => { if (ids[0]) onSelect?.(ids[0]); }}
        onAction={onSelect ? (node) => { if (node.id === activeId) onSelect(node.id); } : undefined}
        renderLabel={(node) => {
          const item = found.get(node.id);
          const description = item && detail?.(item);
          // whitespace-normal lets long labels wrap inside the tree's truncating label slot.
          return <span {...{ [NODE_ATTRIBUTE]: node.id }} className="min-w-0 break-words whitespace-normal">{node.label}
            {description && <span className="ml-2 text-xs text-muted-foreground">{description}</span>}
          </span>;
        }} />
    </div>
  </>;
}
