// packages/ai-ui/src/lib/collection-controls.tsx
"use client";

import { useState, type ReactNode } from "react";

import { SortableList } from "../components/sortable-list.js";
import { TreeView, type TreeNode } from "../components/tree-view.js";
import { ChoiceField, ItemList, matchesQuery, SearchField } from "./component-controls.js";

interface CollectionItem { id: string }

export function FilteredList<T extends CollectionItem>({ items, searchLabel, searchText, filterLabel, filters, category, empty, render }: {
  items: readonly T[]; searchLabel: string; searchText: (item: T) => Array<string | undefined>;
  filterLabel?: string; filters?: readonly { value: string; label: string }[]; category?: (item: T) => string;
  empty: string; render: (item: T) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const available = filters?.some((option) => option.value === filter) ? filter : "";
  return <>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <SearchField label={searchLabel} value={query} onChange={setQuery} />
      {filters?.length && filterLabel ? <ChoiceField label={filterLabel} value={available} options={filters} placeholder="All" onChange={setFilter} /> : null}
    </div>
    <ItemList items={items.filter((item) => (!available || category?.(item) === available) && matchesQuery(query, ...searchText(item)))} empty={empty} render={render} />
  </>;
}

export function OrderedList<T extends CollectionItem>({ items, label, itemLabel, onReorder, render, disabled }: {
  items: readonly T[]; label: string; itemLabel: (item: T) => string; onReorder: (ids: string[]) => void;
  render?: (item: T) => ReactNode; disabled?: boolean;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No items to order.</p>;
  return <SortableList items={items} label={label} getKey={(item) => item.id} getLabel={itemLabel}
    disabled={disabled} onReorder={(ordered) => onReorder(ordered.map((item) => item.id))}
    renderItem={(item) => <div className="min-w-0 flex-1 text-sm break-words">
      {render?.(item) ?? itemLabel(item)}
    </div>} />;
}

export function LabeledTree<T extends { id: string; label: string; children?: readonly T[] }>({ items, label, activeId, onSelect, detail, searchable }: {
  items: readonly T[]; label: string; activeId?: string | null; onSelect?: ((id: string) => void) | undefined;
  detail?: (item: T) => string | undefined; searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
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
  return <>
    {searchable && <SearchField label={"Search " + label.toLowerCase()} value={query} onChange={setQuery} />}
    <TreeView label={label} nodes={nodes} expanded={query.trim() ? parents : expanded} onExpandedChange={setExpanded}
      selected={activeId && found.has(activeId) ? [activeId] : []} selectionMode={onSelect ? "single" : "none"}
      onSelectedChange={(ids) => { if (ids[0]) onSelect?.(ids[0]); }}
      renderLabel={(node) => {
        const item = found.get(node.id);
        const description = item && detail?.(item);
        return <span className="min-w-0 break-words">{node.label}
          {description && <span className="ml-2 text-xs text-muted-foreground">{description}</span>}
        </span>;
      }} />
  </>;
}
