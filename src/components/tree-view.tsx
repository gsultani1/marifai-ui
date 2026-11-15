// packages/ai-ui/src/components/tree-view.tsx
"use client";

import { CheckIcon, ChevronRightIcon, LoaderCircleIcon, MinusIcon, RotateCwIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface TreeNode {
  id: string;
  /** Text label, also used for typeahead. */
  label: string;
  icon?: ReactNode;
  children?: TreeNode[];
  /** Marks a node whose children load on first expand through `loadChildren`. */
  hasChildren?: boolean;
  disabled?: boolean;
}

/** Children loaded on demand, keyed by parent id. */
export type LoadedTreeChildren = ReadonlyMap<string, TreeNode[]>;

export interface FlatTreeNode {
  node: TreeNode;
  /** 1-based depth, as in aria-level. */
  level: number;
  parentId: string | null;
  /** 1-based position among siblings, as in aria-posinset. */
  posinset: number;
  setsize: number;
  /** Has children, or may have them once loaded. */
  expandable: boolean;
  expanded: boolean;
}

export type TreeCheckState = "checked" | "unchecked" | "mixed";

function childrenOf(node: TreeNode, loaded?: LoadedTreeChildren): TreeNode[] | undefined {
  return node.children ?? loaded?.get(node.id);
}

function isExpandable(node: TreeNode, loaded?: LoadedTreeChildren): boolean {
  const children = childrenOf(node, loaded);
  return children ? children.length > 0 : node.hasChildren === true;
}

/** Visible nodes in display order: roots, then the children of every expanded node, depth first. */
export function flattenVisibleTree(nodes: readonly TreeNode[], expanded: ReadonlySet<string>, loaded?: LoadedTreeChildren): FlatTreeNode[] {
  const result: FlatTreeNode[] = [];
  const walk = (siblings: readonly TreeNode[], level: number, parentId: string | null) => {
    siblings.forEach((node, index) => {
      const expandable = isExpandable(node, loaded);
      const open = expandable && expanded.has(node.id);
      result.push({ node, level, parentId, posinset: index + 1, setsize: siblings.length, expandable, expanded: open });
      const children = childrenOf(node, loaded);
      if (open && children) walk(children, level + 1, node.id);
    });
  };
  walk(nodes, 1, null);
  return result;
}

/**
 * Checkbox state of every node: leaves are checked when their id is in
 * `checked`; a parent is checked when all of its children are, unchecked
 * when none are, and mixed otherwise. A parent without known children uses
 * its own id.
 */
export function computeTreeCheckState(nodes: readonly TreeNode[], checked: ReadonlySet<string>, loaded?: LoadedTreeChildren): Map<string, TreeCheckState> {
  const states = new Map<string, TreeCheckState>();
  const visit = (node: TreeNode): TreeCheckState => {
    const children = childrenOf(node, loaded);
    let state: TreeCheckState;
    if (!children || children.length === 0) {
      state = checked.has(node.id) ? "checked" : "unchecked";
    } else {
      const childStates = children.map(visit);
      state = childStates.every((value) => value === "checked") ? "checked" : childStates.every((value) => value === "unchecked") ? "unchecked" : "mixed";
    }
    states.set(node.id, state);
    return state;
  };
  nodes.forEach(visit);
  return states;
}

function findNode(nodes: readonly TreeNode[], id: string, loaded?: LoadedTreeChildren): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const children = childrenOf(node, loaded);
    const found = children && findNode(children, id, loaded);
    if (found) return found;
  }
  return undefined;
}

/**
 * Toggles a node's checkbox and cascades: the node and all enabled
 * descendants take the new value, and every parent's id is kept in the
 * result exactly when all of its children are checked.
 */
export function toggleTreeChecked(nodes: readonly TreeNode[], checked: ReadonlySet<string>, id: string, loaded?: LoadedTreeChildren): Set<string> {
  const target = findNode(nodes, id, loaded);
  const next = new Set(checked);
  if (!target) return next;
  const value = computeTreeCheckState(nodes, checked, loaded).get(id) !== "checked";
  const cascade = (node: TreeNode, root: boolean) => {
    if (node.disabled && !root) return;
    if (value) next.add(node.id);
    else next.delete(node.id);
    childrenOf(node, loaded)?.forEach((child) => cascade(child, false));
  };
  cascade(target, true);
  const states = computeTreeCheckState(nodes, next, loaded);
  const sync = (node: TreeNode) => {
    const children = childrenOf(node, loaded);
    if (!children || children.length === 0) return;
    children.forEach(sync);
    if (states.get(node.id) === "checked") next.add(node.id);
    else next.delete(node.id);
  };
  nodes.forEach(sync);
  return next;
}

export interface TreeViewLabelState {
  level: number;
  expanded: boolean;
  selected: boolean;
}

export interface TreeViewProps extends Omit<ComponentProps<"div">, "children" | "onSelect" | "defaultChecked" | "defaultValue"> {
  nodes: TreeNode[];
  /** Accessible name of the tree. */
  label: string;
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Defaults to "single". */
  selectionMode?: "none" | "single" | "multiple";
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Shows tri-state checkboxes that cascade to descendants. */
  checkboxes?: boolean;
  checked?: string[];
  defaultChecked?: string[];
  onCheckedChange?: (ids: string[]) => void;
  /** Loads the children of a node marked `hasChildren` the first time it expands. */
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  /** Enter on a node; without it, Enter toggles parents and selects leaves. */
  onAction?: (node: TreeNode) => void;
  renderLabel?: (node: TreeNode, state: TreeViewLabelState) => ReactNode;
  emptyLabel?: ReactNode;
}

type LoadStatus = { state: "loading" } | { state: "error"; message: string };

type Row = { kind: "node"; key: string; flat: FlatTreeNode } | { kind: "status"; key: string; parent: FlatTreeNode; status: LoadStatus };

const TYPEAHEAD_RESET_MS = 500;

/**
 * Generic hierarchical list following the WAI-ARIA tree pattern: one tab
 * stop (roving tabindex), Up and Down move, Right expands or enters a
 * parent, Left collapses or returns to the parent, Home and End jump, `*`
 * expands all siblings, typing jumps to a matching label, Enter activates
 * and Space selects or checks. Supports single or multiple selection
 * (Shift extends, Ctrl+A selects all), tri-state cascading checkboxes, and
 * async children with a loading row and a retry row on failure.
 */
export function TreeView({
  nodes,
  label,
  expanded,
  defaultExpanded = [],
  onExpandedChange,
  selectionMode = "single",
  selected,
  defaultSelected = [],
  onSelectedChange,
  checkboxes = false,
  checked,
  defaultChecked = [],
  onCheckedChange,
  loadChildren,
  onAction,
  renderLabel,
  emptyLabel = "Nothing to show",
  className,
  ...props
}: TreeViewProps) {
  const id = useId();
  const [expandedIds, setExpandedIds] = useControllableState({ value: expanded, defaultValue: defaultExpanded, onChange: onExpandedChange });
  const [selectedIds, setSelectedIds] = useControllableState({ value: selected, defaultValue: defaultSelected, onChange: onSelectedChange });
  const [checkedIds, setCheckedIds] = useControllableState({ value: checked, defaultValue: defaultChecked, onChange: onCheckedChange });
  const [loaded, setLoaded] = useState<ReadonlyMap<string, TreeNode[]>>(() => new Map());
  const [loading, setLoading] = useState<ReadonlyMap<string, LoadStatus>>(() => new Map());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const rowElements = useRef(new Map<string, HTMLDivElement>());
  const typeahead = useRef<{ text: string; timer: ReturnType<typeof setTimeout> | undefined }>({ text: "", timer: undefined });
  const inFlight = useRef(new Set<string>());
  const latest = useRef({ checkedIds, loaded });

  useEffect(() => {
    latest.current = { checkedIds, loaded };
  }, [checkedIds, loaded]);

  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds]);
  const flat = useMemo(() => flattenVisibleTree(nodes, expandedSet, loaded), [nodes, expandedSet, loaded]);
  const checkStates = useMemo(() => (checkboxes ? computeTreeCheckState(nodes, checkedSet, loaded) : null), [checkboxes, nodes, checkedSet, loaded]);

  const rows = useMemo(() => {
    const result: Row[] = [];
    for (const item of flat) {
      result.push({ kind: "node", key: item.node.id, flat: item });
      const status = loading.get(item.node.id);
      if (item.expanded && status && !childrenOf(item.node, loaded)) result.push({ kind: "status", key: `${item.node.id}::load-status`, parent: item, status });
    }
    return result;
  }, [flat, loading, loaded]);
  const navigable = rows.filter((row) => (row.kind === "node" ? !row.flat.node.disabled : row.status.state === "error"));
  const activeKey = navigable.some((row) => row.key === focusedKey) ? focusedKey : (navigable.find((row) => row.kind === "node" && selectedSet.has(row.key))?.key ?? navigable[0]?.key ?? null);

  const focusRow = (key: string | undefined) => {
    if (key === undefined) return;
    setFocusedKey(key);
    rowElements.current.get(key)?.focus();
  };

  const load = (node: TreeNode) => {
    if (!loadChildren || inFlight.current.has(node.id)) return;
    inFlight.current.add(node.id);
    setLoading((previous) => new Map(previous).set(node.id, { state: "loading" }));
    setAnnouncement(`Loading ${node.label}`);
    loadChildren(node).then(
      (children) => {
        inFlight.current.delete(node.id);
        const nextLoaded = new Map(latest.current.loaded).set(node.id, children);
        setLoaded((previous) => new Map(previous).set(node.id, children));
        setLoading((previous) => {
          const next = new Map(previous);
          next.delete(node.id);
          return next;
        });
        const currentChecked = latest.current.checkedIds;
        if (checkboxes && currentChecked.includes(node.id) && children.length > 0) {
          const added = new Set(currentChecked);
          const addAll = (list: TreeNode[]) =>
            list.forEach((child) => {
              if (!child.disabled) added.add(child.id);
              const grand = childrenOf(child, nextLoaded);
              if (grand) addAll(grand);
            });
          addAll(children);
          setCheckedIds([...added]);
        }
        setAnnouncement(children.length === 0 ? `${node.label} is empty` : `${children.length} ${children.length === 1 ? "item" : "items"} loaded in ${node.label}`);
      },
      (error: unknown) => {
        inFlight.current.delete(node.id);
        const message = error instanceof Error && error.message ? error.message : "Could not load";
        setLoading((previous) => new Map(previous).set(node.id, { state: "error", message }));
        setAnnouncement(`Could not load ${node.label}`);
      },
    );
  };

  const setExpanded = (node: TreeNode, open: boolean) => {
    const next = new Set(expandedSet);
    if (open) next.add(node.id);
    else next.delete(node.id);
    setExpandedIds([...next]);
    if (open && !childrenOf(node, loaded) && node.hasChildren && !loading.has(node.id)) load(node);
  };

  const select = (key: string, mode: "replace" | "toggle" | "range") => {
    if (selectionMode === "none") return;
    if (selectionMode === "single") {
      if (!(selectedIds.length === 1 && selectedIds[0] === key)) setSelectedIds([key]);
      return;
    }
    if (mode === "range" && anchor) {
      const keys = flat.filter((item) => !item.node.disabled).map((item) => item.node.id);
      const from = keys.indexOf(anchor);
      const to = keys.indexOf(key);
      if (from >= 0 && to >= 0) {
        const range = keys.slice(Math.min(from, to), Math.max(from, to) + 1);
        setSelectedIds([...new Set([...selectedIds, ...range])]);
        return;
      }
    }
    if (mode === "toggle") setSelectedIds(selectedSet.has(key) ? selectedIds.filter((value) => value !== key) : [...selectedIds, key]);
    else setSelectedIds([key]);
    setAnchor(key);
  };

  const toggleCheck = (node: TreeNode) => {
    if (!checkboxes || node.disabled) return;
    setCheckedIds([...toggleTreeChecked(nodes, checkedSet, node.id, loaded)]);
  };

  const activate = (row: Row, event: KeyboardEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>) => {
    if (row.kind === "status") {
      if (row.status.state === "error") load(row.parent.node);
      return;
    }
    const { node, expandable, expanded: open } = row.flat;
    if (node.disabled) return;
    if (event.type === "click") {
      if (checkboxes && selectionMode === "none") toggleCheck(node);
      else if (selectionMode !== "none") select(node.id, event.shiftKey ? "range" : "toggle");
      else if (expandable) setExpanded(node, !open);
      return;
    }
    if (onAction) onAction(node);
    else if (expandable) setExpanded(node, !open);
    if (selectionMode === "single") select(node.id, "replace");
    else if (selectionMode === "multiple" && !onAction && !expandable) select(node.id, "toggle");
  };

  const runTypeahead = (character: string, fromIndex: number) => {
    const state = typeahead.current;
    clearTimeout(state.timer);
    state.text = state.text + character.toLowerCase();
    state.timer = setTimeout(() => {
      state.text = "";
    }, TYPEAHEAD_RESET_MS);
    const candidates = navigable.filter((row): row is Extract<Row, { kind: "node" }> => row.kind === "node");
    const start = state.text.length === 1 ? fromIndex + 1 : fromIndex;
    for (let offset = 0; offset < candidates.length; offset++) {
      const row = candidates[(start + offset) % candidates.length]!;
      if (row.flat.node.label.toLowerCase().startsWith(state.text)) {
        focusRow(row.key);
        return;
      }
    }
  };

  const onRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: Row) => {
    const position = navigable.findIndex((item) => item.key === row.key);
    const flatItem = row.kind === "node" ? row.flat : null;
    const move = (target: Row | undefined, extend: boolean) => {
      if (!target) return;
      event.preventDefault();
      focusRow(target.key);
      if (extend && selectionMode === "multiple" && target.kind === "node") {
        if (!selectedSet.has(target.key)) setSelectedIds([...selectedIds, target.key]);
        setAnchor(target.key);
      }
    };
    switch (event.key) {
      case "ArrowDown":
        move(navigable[position + 1], event.shiftKey);
        return;
      case "ArrowUp":
        move(navigable[position - 1], event.shiftKey);
        return;
      case "Home":
        move(navigable[0], false);
        return;
      case "End":
        move(navigable[navigable.length - 1], false);
        return;
      case "ArrowRight":
        if (!flatItem?.expandable) return;
        event.preventDefault();
        if (!flatItem.expanded) setExpanded(flatItem.node, true);
        else {
          const next = navigable[position + 1];
          if (next && (next.kind === "status" ? next.parent.node.id === flatItem.node.id : next.flat.parentId === flatItem.node.id)) focusRow(next.key);
        }
        return;
      case "ArrowLeft": {
        event.preventDefault();
        if (flatItem?.expanded) {
          setExpanded(flatItem.node, false);
          return;
        }
        const parentId = flatItem ? flatItem.parentId : row.kind === "status" ? row.parent.node.id : null;
        if (parentId) focusRow(parentId);
        return;
      }
      case "Enter":
        event.preventDefault();
        activate(row, event);
        return;
      case " ":
        event.preventDefault();
        if (row.kind === "status") activate(row, event);
        else if (checkboxes) toggleCheck(row.flat.node);
        else if (selectionMode === "multiple") {
          if (event.shiftKey && anchor) select(row.key, "range");
          else select(row.key, "toggle");
        } else select(row.key, "replace");
        return;
      case "*": {
        if (!flatItem) return;
        event.preventDefault();
        const siblings = flat.filter((item) => item.parentId === flatItem.parentId && item.level === flatItem.level && item.expandable && !item.expanded);
        if (siblings.length === 0) return;
        const next = new Set(expandedSet);
        siblings.forEach((item) => next.add(item.node.id));
        setExpandedIds([...next]);
        siblings.forEach((item) => {
          if (!childrenOf(item.node, loaded) && item.node.hasChildren && !loading.has(item.node.id)) load(item.node);
        });
        return;
      }
      default:
        if ((event.key === "a" || event.key === "A") && (event.ctrlKey || event.metaKey) && selectionMode === "multiple") {
          event.preventDefault();
          setSelectedIds(flat.filter((item) => !item.node.disabled).map((item) => item.node.id));
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && /\S/.test(event.key)) {
          event.preventDefault();
          const nodeRows = navigable.filter((item) => item.kind === "node");
          runTypeahead(event.key, Math.max(0, nodeRows.findIndex((item) => item.key === row.key)));
        }
    }
  };

  const registerRow = (key: string) => (element: HTMLDivElement | null) => {
    if (element) rowElements.current.set(key, element);
    else rowElements.current.delete(key);
  };

  const indent = (level: number) => ({ paddingInlineStart: `${(level - 1) * 1.25 + 0.25}rem` });

  return (
    <div data-slot="tree-view" className={cn("flex flex-col", className)} {...props}>
      {rows.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div role="tree" aria-label={label} aria-multiselectable={selectionMode === "multiple" || undefined} className="flex flex-col gap-px">
          {rows.map((row) => {
            const tabIndex = row.key === activeKey ? 0 : -1;
            if (row.kind === "status") {
              const { status, parent } = row;
              if (status.state === "loading") {
                return (
                  <div key={row.key} aria-hidden="true" data-slot="tree-view-loading" className="flex h-8 items-center gap-2 text-sm text-muted-foreground" style={indent(parent.level + 1)}>
                    <span className="size-4 shrink-0" />
                    <LoaderCircleIcon className="size-4 motion-safe:animate-spin" />
                    Loading
                  </div>
                );
              }
              return (
                <div
                  key={row.key}
                  ref={registerRow(row.key)}
                  id={`${id}-${row.key}`}
                  role="treeitem"
                  aria-level={parent.level + 1}
                  aria-setsize={1}
                  aria-posinset={1}
                  tabIndex={tabIndex}
                  data-slot="tree-view-error"
                  onKeyDown={(event) => onRowKeyDown(event, row)}
                  onClick={(event) => {
                    setFocusedKey(row.key);
                    activate(row, event);
                  }}
                  className={cn("flex min-h-8 cursor-pointer items-center gap-2 rounded-md text-sm text-destructive hover:bg-accent", focusRing)}
                  style={indent(parent.level + 1)}
                >
                  <span className="size-4 shrink-0" aria-hidden="true" />
                  <RotateCwIcon aria-hidden="true" className="size-4 shrink-0" />
                  <span>
                    Could not load {parent.node.label}. <span className="underline underline-offset-2">Retry</span>
                  </span>
                </div>
              );
            }
            const { node, level, posinset, setsize, expandable, expanded: open } = row.flat;
            const isSelected = selectedSet.has(node.id);
            const checkState = checkStates?.get(node.id);
            const busy = loading.get(node.id)?.state === "loading";
            return (
              <div
                key={row.key}
                ref={registerRow(row.key)}
                id={`${id}-${node.id}`}
                role="treeitem"
                aria-level={level}
                aria-setsize={setsize}
                aria-posinset={posinset}
                aria-expanded={expandable ? open : undefined}
                aria-selected={selectionMode === "none" ? undefined : isSelected}
                aria-checked={checkState === undefined ? undefined : checkState === "mixed" ? "mixed" : checkState === "checked"}
                aria-disabled={node.disabled || undefined}
                aria-busy={busy || undefined}
                tabIndex={node.disabled ? undefined : tabIndex}
                data-slot="tree-view-item"
                data-selected={isSelected ? "" : undefined}
                onKeyDown={(event) => onRowKeyDown(event, row)}
                onFocus={(event) => {
                  if (event.target === event.currentTarget && focusedKey !== row.key) setFocusedKey(row.key);
                }}
                onClick={(event) => {
                  if (node.disabled) return;
                  setFocusedKey(row.key);
                  activate(row, event);
                }}
                className={cn(
                  "group flex min-h-8 cursor-default items-center gap-1.5 rounded-md pe-2 text-sm text-foreground select-none hover:bg-accent/60",
                  isSelected && "bg-accent text-accent-foreground hover:bg-accent",
                  node.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                  focusRing,
                )}
                style={indent(level)}
              >
                {expandable ? (
                  <span
                    aria-hidden="true"
                    data-slot="tree-view-toggle"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (node.disabled) return;
                      setFocusedKey(row.key);
                      setExpanded(node, !open);
                    }}
                    className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {busy ? <LoaderCircleIcon className="size-3.5 motion-safe:animate-spin" /> : <ChevronRightIcon className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-90")} />}
                  </span>
                ) : (
                  <span aria-hidden="true" className="size-6 shrink-0" />
                )}
                {checkState !== undefined && (
                  <span
                    aria-hidden="true"
                    data-slot="tree-view-checkbox"
                    data-state={checkState}
                    onClick={(event) => {
                      event.stopPropagation();
                      setFocusedKey(row.key);
                      toggleCheck(node);
                    }}
                    className={cn(
                      "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-muted-foreground bg-background text-primary-foreground [&_svg]:size-3",
                      checkState !== "unchecked" && "border-primary bg-primary",
                    )}
                  >
                    {checkState === "checked" ? <CheckIcon strokeWidth={3} /> : checkState === "mixed" ? <MinusIcon strokeWidth={3} /> : null}
                  </span>
                )}
                {node.icon && <span aria-hidden="true" className="inline-flex shrink-0 text-muted-foreground [&_svg]:size-4">{node.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{renderLabel ? renderLabel(node, { level, expanded: open, selected: isSelected }) : node.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
