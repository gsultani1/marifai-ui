// packages/ai-ui/src/components/workspace-tabs.tsx
"use client";

import { ClipboardCopyIcon, HistoryIcon, PinIcon, PinOffIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { ActionContextMenu, ActionMenu, type MenuEntry } from "./action-menu.js";
import { fileIcon } from "./file-tree.js";

export interface WorkspaceTab {
  id: string;
  title: string;
  /** Shown on hover and copied by "Copy path". */
  path?: string;
  icon?: ReactNode;
  unsaved?: boolean;
  pinned?: boolean;
  /** Preview tab, shown in italics, replaced by the next file opened. */
  preview?: boolean;
  /** Extra state read with the title and shown on hover, e.g. "exited with code 1". */
  description?: string;
}

export interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  /** Closes one or more tabs; prompt for unsaved ones here if needed. */
  onClose?: (ids: string[]) => void;
  /** Receives the full new order. Pinned tabs always stay first. */
  onReorder?: (ids: string[]) => void;
  onPinChange?: (id: string, pinned: boolean) => void;
  /** Most recent first, for the "Recently closed" menu. */
  recentlyClosed?: WorkspaceTab[];
  onReopen?: (tab: WorkspaceTab) => void;
  /** Buttons after the tabs, e.g. "New terminal". */
  actions?: ReactNode;
  /** Content of the active tab. */
  children?: ReactNode;
  label?: string;
  className?: string;
  panelClassName?: string;
}

/** Pinned tabs first, keeping the relative order of each group. */
export function orderTabs<T extends { pinned?: boolean }>(tabs: T[]): T[] {
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];
}

/** The tab to activate after closing `ids`: the nearest open tab to the right, else to the left. */
export function neighbourAfterClose(tabs: { id: string }[], activeId: string | null, ids: string[]): string | null {
  if (!activeId || !ids.includes(activeId)) return activeId;
  const index = tabs.findIndex((tab) => tab.id === activeId);
  const remaining = (from: number, step: number) => {
    for (let position = from; position >= 0 && position < tabs.length; position += step) if (!ids.includes(tabs[position]!.id)) return tabs[position]!.id;
    return null;
  };
  return remaining(index + 1, 1) ?? remaining(index - 1, -1);
}

/**
 * Editor tabs (the close buttons are for pointers; keyboard and screen
 * reader users close with Delete or the context menu): pinned tabs, unsaved dots, preview tabs, middle-click and
 * Delete to close with focus moving to the neighbour, Alt+Shift+arrows to
 * reorder, a context menu (close others, close to the right, pin, copy
 * path) and a recently closed list.
 */
export function WorkspaceTabs({ tabs: tabsProp, activeId, onActiveChange, onClose, onReorder, onPinChange, recentlyClosed = [], onReopen, actions, children, label = "Open files", className, panelClassName }: WorkspaceTabsProps) {
  const tabs = orderTabs(tabsProp);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<WorkspaceTab | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { copy } = useCopyToClipboard();
  const id = useId();
  const tabDomId = (tabId: string) => `${id}-tab-${tabId}`;
  const roving = tabs.find((tab) => tab.id === focusedId)?.id ?? activeId ?? tabs[0]?.id;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(`${id}-tab-${activeId}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, id]);

  const focusTab = (tabId: string) => {
    setFocusedId(tabId);
    requestAnimationFrame(() => document.getElementById(tabDomId(tabId))?.focus());
  };

  const close = (ids: string[], refocus = false) => {
    const closable = ids.filter((tabId) => !tabs.find((tab) => tab.id === tabId)?.pinned || ids.length === 1);
    if (!closable.length || !onClose) return;
    const next = neighbourAfterClose(tabs, activeId, closable);
    onClose(closable);
    if (next && next !== activeId) onActiveChange(next);
    if (refocus) {
      const target = next ?? neighbourAfterClose(tabs, focusedId, closable);
      if (target) focusTab(target);
    }
  };

  const move = (tabId: string, step: number) => {
    if (!onReorder) return;
    const tab = tabs.find((item) => item.id === tabId);
    const group = tabs.filter((item) => Boolean(item.pinned) === Boolean(tab?.pinned));
    const index = group.findIndex((item) => item.id === tabId);
    const target = index + step;
    if (target < 0 || target >= group.length) return;
    const reordered = [...group];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const ids = tab?.pinned ? [...reordered, ...tabs.filter((item) => !item.pinned)] : [...tabs.filter((item) => item.pinned), ...reordered];
    onReorder(ids.map((item) => item.id));
    focusTab(tabId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, tab: WorkspaceTab) => {
    const index = tabs.findIndex((item) => item.id === tab.id);
    if (event.altKey && event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      move(tab.id, event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    const target = event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length] : event.key === "ArrowLeft" ? tabs[(index - 1 + tabs.length) % tabs.length] : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : undefined;
    if (target) {
      event.preventDefault();
      onActiveChange(target.id);
      focusTab(target.id);
    } else if (event.key === "Delete" && onClose && !tab.pinned) {
      event.preventDefault();
      close([tab.id], true);
    }
  };

  const menuItems = (tab: WorkspaceTab | null): MenuEntry[] => {
    if (!tab) return [];
    const index = tabs.findIndex((item) => item.id === tab.id);
    return [
      ...(onClose
        ? [
            { id: "close", label: "Close", shortcut: "Del", onSelect: () => close([tab.id]) },
            { id: "close-others", label: "Close others", disabled: tabs.length < 2, onSelect: () => close(tabs.filter((item) => item.id !== tab.id && !item.pinned).map((item) => item.id)) },
            { id: "close-right", label: "Close to the right", disabled: index === tabs.length - 1, onSelect: () => close(tabs.slice(index + 1).filter((item) => !item.pinned).map((item) => item.id)) },
            { id: "close-saved", label: "Close saved", onSelect: () => close(tabs.filter((item) => !item.unsaved && !item.pinned).map((item) => item.id)) },
          ]
        : []),
      ...(onPinChange ? [{ type: "separator" as const, id: "pin-separator" }, { id: "pin", label: tab.pinned ? "Unpin" : "Pin", icon: tab.pinned ? <PinOffIcon aria-hidden="true" /> : <PinIcon aria-hidden="true" />, onSelect: () => onPinChange(tab.id, !tab.pinned) }] : []),
      ...(tab.path ? [{ id: "copy-path", label: "Copy path", icon: <ClipboardCopyIcon aria-hidden="true" />, onSelect: () => void copy(tab.path!) }] : []),
    ];
  };

  const active = tabs.find((tab) => tab.id === activeId);

  return (
    <div data-slot="workspace-tabs" className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-stretch border-b border-border bg-muted/30">
        <ActionContextMenu items={menuItems(menuTarget)} onOpenChange={(open) => !open && setMenuTarget(null)} className="min-w-0 flex-1">
          <div ref={listRef} role="tablist" aria-label={label} className="flex min-w-0 overflow-x-auto [scrollbar-width:thin]">
            {tabs.map((tab) => {
              const selected = tab.id === activeId;
              return (
                <div
                  key={tab.id}
                  onContextMenu={() => setMenuTarget(tab)}
                  onAuxClick={(event) => {
                    if (event.button === 1 && !tab.pinned) {
                      event.preventDefault();
                      close([tab.id]);
                    }
                  }}
                  className={cn("group relative flex h-9 max-w-56 shrink-0 items-center border-r border-border text-sm", selected ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}
                >
                  {selected && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" />}
                  <div
                    id={tabDomId(tab.id)}
                    role="tab"
                    aria-label={[tab.title, tab.unsaved && "unsaved", tab.pinned && "pinned", tab.preview && "preview", tab.description].filter(Boolean).join(", ")}
                    aria-selected={selected}
                    aria-controls={selected ? `${id}-panel` : undefined}
                    aria-keyshortcuts={onClose && !tab.pinned ? "Delete" : undefined}
                    tabIndex={tab.id === roving ? 0 : -1}
                    title={[tab.path ?? tab.title, tab.description].filter(Boolean).join(" · ")}
                    onClick={() => onActiveChange(tab.id)}
                    onFocus={() => setFocusedId(tab.id)}
                    onKeyDown={(event) => onKeyDown(event, tab)}
                    className={cn("flex h-full min-w-0 cursor-pointer items-center gap-1.5 pl-3 select-none [&_svg]:size-3.5 [&_svg]:shrink-0", tab.pinned || !onClose ? "pr-3" : "pr-1", focusRing, "focus-visible:ring-offset-0 focus-visible:ring-inset")}
                  >
                    <span className="text-muted-foreground">{tab.icon ?? fileIcon(tab.title)}</span>
                    <span className={cn("truncate", tab.preview && "italic")}>{tab.title}</span>
                    {tab.pinned && <PinIcon aria-hidden="true" className="text-muted-foreground" />}
                  </div>
                  {onClose && !tab.pinned && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      aria-label={`Close ${tab.title}`}
                      title="Close (Delete)"
                      onClick={() => close([tab.id], selected)}
                      className={cn("relative mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5", focusRing)}
                    >
                      <XIcon aria-hidden="true" className={cn(tab.unsaved && "invisible group-focus-within:visible group-hover:visible")} />
                      {tab.unsaved && <span aria-hidden="true" className="absolute size-2 rounded-full bg-foreground group-focus-within:hidden group-hover:hidden" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ActionContextMenu>
        {actions && <div className="flex shrink-0 items-center gap-0.5 px-0.5">{actions}</div>}
        {onReopen && (
          <ActionMenu
            align="end"
            items={recentlyClosed.length ? recentlyClosed.slice(0, 10).map((tab) => ({ id: tab.id, label: tab.path ?? tab.title, icon: tab.icon ?? fileIcon(tab.title), onSelect: () => onReopen(tab) })) : [{ type: "label" as const, id: "empty", label: "No recently closed files" }]}
            trigger={
              <button type="button" aria-label="Recently closed" title="Recently closed" className={cn(iconButton, "m-0.5 self-center", focusRing)}>
                <HistoryIcon aria-hidden="true" />
              </button>
            }
          />
        )}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={active ? tabDomId(active.id) : undefined} aria-label={active ? undefined : label} className={cn("min-h-0 flex-1", panelClassName)}>
        {children}
      </div>
    </div>
  );
}
