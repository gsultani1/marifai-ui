// packages/ai-ui/src/components/transfer-list.tsx
"use client";

import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, SearchIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useId, useMemo, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface TransferItem {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface TransferListProps extends Omit<ComponentProps<"div">, "children" | "defaultValue"> {
  items: TransferItem[];
  /** Ids in the right-hand list, in order. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (ids: string[]) => void;
  /** Heading of the left list. */
  sourceLabel?: string;
  /** Heading of the right list. */
  targetLabel?: string;
  /** Shows a filter field above each list. */
  searchable?: boolean;
  /** Matches an item against the filter text; defaults to a case-insensitive label and description match. */
  filter?: (item: TransferItem, query: string) => boolean;
  renderItem?: (item: TransferItem) => ReactNode;
  emptyLabel?: string;
}

type Side = "source" | "target";

function defaultFilter(item: TransferItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || item.label.toLowerCase().includes(needle) || (item.description?.toLowerCase().includes(needle) ?? false);
}

interface PaneProps {
  side: Side;
  title: string;
  items: TransferItem[];
  total: number;
  selected: ReadonlySet<string>;
  onSelectedChange: (ids: Set<string>) => void;
  onActivate: (id: string) => void;
  searchable: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  renderItem?: (item: TransferItem) => ReactNode;
  emptyLabel: string;
}

function TransferPane({ side, title, items, total, selected, onSelectedChange, onActivate, searchable, query, onQueryChange, renderItem, emptyLabel }: PaneProps) {
  const id = useId();
  const [active, setActive] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const enabled = items.filter((item) => !item.disabled);
  const activeId = enabled.some((item) => item.id === active) ? active : null;
  const selectedVisible = items.filter((item) => selected.has(item.id)).length;

  const scrollTo = (itemId: string) => {
    document.getElementById(`${id}-${itemId}`)?.scrollIntoView({ block: "nearest" });
  };

  const range = (from: string, to: string) => {
    const ids = enabled.map((item) => item.id);
    const a = ids.indexOf(from);
    const b = ids.indexOf(to);
    if (a < 0 || b < 0) return [to];
    return ids.slice(Math.min(a, b), Math.max(a, b) + 1);
  };

  const toggle = (itemId: string) => {
    const next = new Set(selected);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    onSelectedChange(next);
    setAnchor(itemId);
  };

  const onClickItem = (event: ReactMouseEvent<HTMLDivElement>, item: TransferItem) => {
    if (item.disabled) return;
    setActive(item.id);
    if (event.shiftKey && anchor) onSelectedChange(new Set([...selected, ...range(anchor, item.id)]));
    else if (event.ctrlKey || event.metaKey) toggle(item.id);
    else {
      onSelectedChange(new Set(selected.has(item.id) && selected.size === 1 ? [] : [item.id]));
      setAnchor(item.id);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabled.length === 0) return;
    const index = activeId ? enabled.findIndex((item) => item.id === activeId) : -1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = Math.min(enabled.length - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else if (event.key === " " && activeId) {
      event.preventDefault();
      if (event.shiftKey && anchor) onSelectedChange(new Set([...selected, ...range(anchor, activeId)]));
      else toggle(activeId);
      return;
    } else if (event.key === "Enter" && activeId) {
      event.preventDefault();
      onActivate(activeId);
      return;
    } else if ((event.key === "a" || event.key === "A") && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSelectedChange(new Set(enabled.map((item) => item.id)));
      return;
    }
    if (next === null) return;
    event.preventDefault();
    const target = enabled[next]!;
    setActive(target.id);
    scrollTo(target.id);
    if (event.shiftKey) {
      const from = anchor ?? activeId ?? target.id;
      onSelectedChange(new Set([...selected, ...range(from, target.id)]));
      if (!anchor) setAnchor(from);
    }
  };

  return (
    <div data-slot="transfer-list-pane" data-side={side} className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-card text-card-foreground">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <span id={`${id}-title`} className="text-sm font-medium">
          {title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {selectedVisible > 0 ? `${selectedVisible} of ${items.length} selected` : `${total} ${total === 1 ? "item" : "items"}`}
        </span>
      </div>
      {searchable && (
        <div className="relative border-b border-border p-2">
          <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input type="search" aria-label={`Filter ${title}`} placeholder="Filter" value={query} onChange={(event) => onQueryChange(event.target.value)} className={cn(input, "h-8 pl-8", focusRing)} />
        </div>
      )}
      <div
        role="listbox"
        aria-labelledby={`${id}-title`}
        aria-multiselectable="true"
        aria-activedescendant={activeId ? `${id}-${activeId}` : undefined}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.target === event.currentTarget && !activeId && enabled[0]) setActive(enabled[0].id);
        }}
        className={cn("h-56 overflow-y-auto p-1", focusRing, "focus-visible:ring-offset-0")}
      >
        {items.length === 0 ? (
          <div role="option" aria-selected="false" aria-disabled="true" className="px-2 py-6 text-center text-sm text-muted-foreground">
            {query ? "No matches" : emptyLabel}
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selected.has(item.id);
            return (
              <div
                key={item.id}
                id={`${id}-${item.id}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={item.disabled || undefined}
                data-transfer-id={item.id}
                data-active={item.id === activeId ? "" : undefined}
                onClick={(event) => onClickItem(event, item)}
                onDoubleClick={() => !item.disabled && onActivate(item.id)}
                className={cn(
                  "flex cursor-default flex-col rounded-md px-2 py-1.5 text-sm select-none hover:bg-accent/60",
                  isSelected && "bg-accent text-accent-foreground hover:bg-accent",
                  item.id === activeId && "ring-2 ring-ring ring-inset",
                  item.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
              >
                {renderItem ? (
                  renderItem(item)
                ) : (
                  <>
                    <span>{item.label}</span>
                    {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Two labelled multi-select listboxes for moving items between "available"
 * and "selected", such as departments assigned to an employee. Each list
 * has a filter field and counts; click, Ctrl or Cmd click, Shift click,
 * arrow keys with Shift, Space and Ctrl+A select, and Enter or double-click
 * moves one item. Buttons move the selected or all visible items in either
 * direction. The value is the ordered ids of the right-hand list.
 */
export function TransferList({
  items,
  value,
  defaultValue = [],
  onValueChange,
  sourceLabel = "Available",
  targetLabel = "Selected",
  searchable = true,
  filter = defaultFilter,
  renderItem,
  emptyLabel = "No items",
  className,
  ...props
}: TransferListProps) {
  const [targetIds, setTargetIds] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [selection, setSelection] = useState<Record<Side, Set<string>>>(() => ({ source: new Set(), target: new Set() }));
  const [queries, setQueries] = useState<Record<Side, string>>({ source: "", target: "" });
  const [announcement, setAnnouncement] = useState("");
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const targetSet = useMemo(() => new Set(targetIds), [targetIds]);
  const sourceItems = items.filter((item) => !targetSet.has(item.id));
  const targetItems = targetIds.map((itemId) => byId.get(itemId)).filter((item): item is TransferItem => item !== undefined);
  const visible: Record<Side, TransferItem[]> = {
    source: sourceItems.filter((item) => filter(item, queries.source)),
    target: targetItems.filter((item) => filter(item, queries.target)),
  };
  const movableSelected = (side: Side) => visible[side].filter((item) => selection[side].has(item.id) && !item.disabled);
  const movableAll = (side: Side) => visible[side].filter((item) => !item.disabled);

  const move = (from: Side, ids: string[]) => {
    if (ids.length === 0) return;
    const moving = new Set(ids);
    const next = from === "source" ? [...targetIds, ...items.filter((item) => moving.has(item.id)).map((item) => item.id)] : targetIds.filter((itemId) => !moving.has(itemId));
    setTargetIds(next);
    setSelection((previous) => ({ ...previous, [from]: new Set([...previous[from]].filter((itemId) => !moving.has(itemId))) }));
    const destination = from === "source" ? targetLabel : sourceLabel;
    setAnnouncement(ids.length === 1 ? `Moved ${byId.get(ids[0]!)?.label ?? ids[0]} to ${destination}.` : `Moved ${ids.length} items to ${destination}.`);
  };

  const pane = (side: Side) => (
    <TransferPane
      side={side}
      title={side === "source" ? sourceLabel : targetLabel}
      items={visible[side]}
      total={side === "source" ? sourceItems.length : targetItems.length}
      selected={selection[side]}
      onSelectedChange={(ids) => setSelection((previous) => ({ ...previous, [side]: ids }))}
      onActivate={(itemId) => move(side, [itemId])}
      searchable={searchable}
      query={queries[side]}
      onQueryChange={(query) => setQueries((previous) => ({ ...previous, [side]: query }))}
      emptyLabel={emptyLabel}
      {...(renderItem ? { renderItem } : {})}
    />
  );

  const control = cn(
    "inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-background [&_svg]:size-4",
    focusRing,
  );
  const toTarget = movableSelected("source");
  const toSource = movableSelected("target");
  const allToTarget = movableAll("source");
  const allToSource = movableAll("target");

  return (
    <div data-slot="transfer-list" className={cn("flex flex-col gap-3 sm:flex-row sm:items-stretch", className)} {...props}>
      {pane("source")}
      <div role="group" aria-label="Move items" className="flex shrink-0 justify-center gap-2 sm:flex-col">
        <button type="button" aria-label={`Move selected to ${targetLabel}`} title={`Move selected to ${targetLabel}`} aria-disabled={toTarget.length === 0 || undefined} onClick={() => move("source", toTarget.map((item) => item.id))} className={control}>
          <ChevronRightIcon aria-hidden="true" className="max-sm:rotate-90" />
        </button>
        <button type="button" aria-label={`Move all to ${targetLabel}`} title={`Move all to ${targetLabel}`} aria-disabled={allToTarget.length === 0 || undefined} onClick={() => move("source", allToTarget.map((item) => item.id))} className={control}>
          <ChevronsRightIcon aria-hidden="true" className="max-sm:rotate-90" />
        </button>
        <button type="button" aria-label={`Move selected to ${sourceLabel}`} title={`Move selected to ${sourceLabel}`} aria-disabled={toSource.length === 0 || undefined} onClick={() => move("target", toSource.map((item) => item.id))} className={control}>
          <ChevronLeftIcon aria-hidden="true" className="max-sm:rotate-90" />
        </button>
        <button type="button" aria-label={`Move all to ${sourceLabel}`} title={`Move all to ${sourceLabel}`} aria-disabled={allToSource.length === 0 || undefined} onClick={() => move("target", allToSource.map((item) => item.id))} className={control}>
          <ChevronsLeftIcon aria-hidden="true" className="max-sm:rotate-90" />
        </button>
      </div>
      {pane("target")}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
