// packages/ai-ui/src/components/chat-history.tsx
"use client";

import { ArchiveIcon, ArchiveRestoreIcon, CopyIcon, DownloadIcon, FolderInputIcon, LoaderCircleIcon, MoreHorizontalIcon, PencilIcon, PinIcon, PinOffIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { useNow } from "../hooks/use-now.js";
import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { groupByRecency } from "../lib/conversation.js";
import { isSameDay, toDate } from "../lib/dates.js";
import { ActionMenu, type MenuEntry } from "./action-menu.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { FilterChips } from "./filter-chips.js";
import { SearchInput } from "./search-input.js";
import { SegmentedControl } from "./segmented-control.js";

export interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: Date | string | number;
  preview?: string;
  folderId?: string | null;
  archived?: boolean;
  pinned?: boolean;
  unread?: boolean;
}

export interface ChatFolder {
  id: string;
  name: string;
}

export interface ChatHistoryProps {
  conversations: ChatHistoryItem[];
  folders?: ChatFolder[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew?: () => void;
  onRename?: (id: string, title: string) => void;
  onArchive?: (ids: string[], archived: boolean) => void;
  /** Runs after confirmation; the dialog stays open while a returned promise is pending. */
  onDelete?: (ids: string[]) => void | Promise<void>;
  onDuplicate?: (id: string) => void;
  onExport?: (ids: string[]) => void;
  onMove?: (ids: string[], folderId: string | null) => void;
  onPin?: (id: string, pinned: boolean) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Server search; without it titles and previews are filtered locally. */
  onSearch?: (query: string) => void;
  searching?: boolean;
  locale?: string;
  label?: string;
  className?: string;
}

/**
 * Conversation list for a sidebar: grouped by recency with pinned chats on
 * top, local or server search, active and archived views, folders, inline
 * rename (F2), delete with confirmation (Delete), a menu per chat, bulk
 * selection, arrow-key navigation and load more.
 */
export function ChatHistory({ conversations, folders = [], activeId, onSelect, onNew, onRename, onArchive, onDelete, onDuplicate, onExport, onMove, onPin, hasMore, loadingMore, onLoadMore, onSearch, searching, locale, label = "Chat history", className }: ChatHistoryProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [folder, setFolder] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirming, setConfirming] = useState<string[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const now = useNow(60_000);
  const id = useId();
  const search = onSearch ? "" : query.trim().toLowerCase();
  const visible = conversations.filter(
    (item) => Boolean(item.archived) === (view === "archived") && (!folder.length || (item.folderId ?? "") === folder[0]) && (!search || item.title.toLowerCase().includes(search) || (item.preview ?? "").toLowerCase().includes(search)),
  );
  const pinned = visible.filter((item) => item.pinned);
  const groups = [...(pinned.length ? [{ label: "Pinned", items: pinned }] : []), ...groupByRecency(visible.filter((item) => !item.pinned), now, locale)];
  const dayFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const stamp = (value: ChatHistoryItem["updatedAt"]) => (isSameDay(value, now) ? timeFormat : dayFormat).format(toDate(value));
  const titleOf = (itemId: string) => conversations.find((item) => item.id === itemId)?.title ?? "chat";

  const commitRename = () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    const original = titleOf(renaming.id);
    if (title && title !== original) onRename?.(renaming.id, title);
    const focusId = renaming.id;
    setRenaming(null);
    requestAnimationFrame(() => document.getElementById(`${id}-item-${focusId}`)?.focus());
  };

  const toggleSelected = (itemId: string) => {
    const next = new Set(selected);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSelected(next);
  };

  const menuFor = (item: ChatHistoryItem): MenuEntry[] => [
    ...(onRename ? [{ id: "rename", label: "Rename", icon: <PencilIcon aria-hidden="true" />, shortcut: "F2", onSelect: () => setRenaming({ id: item.id, title: item.title }) }] : []),
    ...(onPin ? [{ id: "pin", label: item.pinned ? "Unpin" : "Pin", icon: item.pinned ? <PinOffIcon aria-hidden="true" /> : <PinIcon aria-hidden="true" />, onSelect: () => onPin(item.id, !item.pinned) }] : []),
    ...(onDuplicate ? [{ id: "duplicate", label: "Duplicate", icon: <CopyIcon aria-hidden="true" />, onSelect: () => onDuplicate(item.id) }] : []),
    ...(onExport ? [{ id: "export", label: "Export", icon: <DownloadIcon aria-hidden="true" />, onSelect: () => onExport([item.id]) }] : []),
    ...(onMove && folders.length
      ? [
          {
            type: "submenu" as const,
            id: "move",
            label: "Move to",
            icon: <FolderInputIcon aria-hidden="true" />,
            items: [{ id: "none", label: "No folder", checked: !item.folderId, onSelect: () => onMove([item.id], null) }, ...folders.map((entry) => ({ id: entry.id, label: entry.name, checked: item.folderId === entry.id, onSelect: () => onMove([item.id], entry.id) }))],
          },
        ]
      : []),
    ...(onArchive ? [{ id: "archive", label: item.archived ? "Unarchive" : "Archive", icon: item.archived ? <ArchiveRestoreIcon aria-hidden="true" /> : <ArchiveIcon aria-hidden="true" />, onSelect: () => onArchive([item.id], !item.archived) }] : []),
    ...(onDelete ? [{ type: "separator" as const, id: "sep" }, { id: "delete", label: "Delete", icon: <Trash2Icon aria-hidden="true" />, destructive: true, shortcut: "Del", onSelect: () => setConfirming([item.id]) }] : []),
  ];

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-chat-item]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    const itemId = items[index]!.dataset.chatItem!;
    const target = event.key === "ArrowDown" ? items[index + 1] : event.key === "ArrowUp" ? items[index - 1] : event.key === "Home" ? items[0] : event.key === "End" ? items[items.length - 1] : undefined;
    if (target) {
      event.preventDefault();
      target.focus();
    } else if (event.key === "F2" && onRename) {
      event.preventDefault();
      setRenaming({ id: itemId, title: titleOf(itemId) });
    } else if ((event.key === "Delete" || event.key === "Backspace") && onDelete) {
      event.preventDefault();
      setConfirming([itemId]);
    }
  };

  const bulkIds = [...selected];
  const count = confirming?.length ?? 0;

  return (
    <nav aria-label={label} data-slot="chat-history" className={cn("flex min-h-0 flex-col gap-2 text-sm", className)}>
      <div className="flex flex-col gap-2">
        {onNew && (
          <button type="button" onClick={onNew} className={cn(button, buttonVariants.outline, "justify-start", focusRing)}>
            <PlusIcon aria-hidden="true" />
            New chat
          </button>
        )}
        <SearchInput
          label="Search chats"
          placeholder="Search chats"
          value={query}
          onValueChange={setQuery}
          loading={searching ?? false}
          {...(onSearch ? { onSearch } : { resultCount: visible.length })}
        />
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl
            label="Show"
            size="sm"
            value={view}
            onValueChange={(next) => {
              setView(next);
              setSelected(new Set());
            }}
            options={[
              { value: "active", label: "Chats" },
              { value: "archived", label: "Archived" },
            ]}
          />
          {(onArchive || onDelete || onExport) && (
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => {
                setSelecting(!selecting);
                setSelected(new Set());
              }}
              className={cn("rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-pressed:bg-accent aria-pressed:text-foreground", focusRing)}
            >
              {selecting ? "Done" : "Select"}
            </button>
          )}
        </div>
        {folders.length > 0 && <FilterChips label="Folders" multiple={false} clearLabel={false} value={folder} onValueChange={setFolder} options={folders.map((entry) => ({ value: entry.id, label: entry.name, count: conversations.filter((item) => item.folderId === entry.id && Boolean(item.archived) === (view === "archived")).length }))} />}
      </div>
      {selecting && (
        <div role="toolbar" aria-label="Selected chats" className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-1.5 text-xs">
          <span className="px-1 font-medium">{selected.size} selected</span>
          {onArchive && (
            <button type="button" disabled={!selected.size} onClick={() => {
                onArchive(bulkIds, view === "active");
                setSelected(new Set());
              }} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              {view === "active" ? "Archive" : "Unarchive"}
            </button>
          )}
          {onExport && (
            <button type="button" disabled={!selected.size} onClick={() => onExport(bulkIds)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
              Export
            </button>
          )}
          {onDelete && (
            <button type="button" disabled={!selected.size} onClick={() => setConfirming(bulkIds)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs text-destructive", focusRing)}>
              Delete
            </button>
          )}
        </div>
      )}
      <div ref={listRef} onKeyDown={onListKeyDown} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {groups.map((group) => (
          <section key={group.label} aria-labelledby={`${id}-${group.label}`} className="flex flex-col gap-0.5">
            <h3 id={`${id}-${group.label}`} className="px-2 text-xs font-medium text-muted-foreground">
              {group.label}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.id === activeId;
                return (
                  <li key={item.id} className={cn("group relative flex items-center gap-1 rounded-md hover:bg-accent/60", active && "bg-accent")}>
                    {selecting && <input type="checkbox" aria-label={`Select ${item.title}`} checked={selected.has(item.id)} onChange={() => toggleSelected(item.id)} className="ml-2 size-4 shrink-0 accent-primary" />}
                    {renaming?.id === item.id ? (
                      <input
                        autoFocus
                        aria-label={`Rename ${item.title}`}
                        value={renaming.title}
                        onChange={(event) => setRenaming({ id: item.id, title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename();
                          else if (event.key === "Escape") {
                            event.stopPropagation();
                            setRenaming(null);
                            requestAnimationFrame(() => document.getElementById(`${id}-item-${item.id}`)?.focus());
                          }
                        }}
                        onBlur={commitRename}
                        onFocus={(event) => event.currentTarget.select()}
                        className="m-1 h-8 min-w-0 flex-1 rounded-md border border-ring bg-background px-2 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        id={`${id}-item-${item.id}`}
                        data-chat-item={item.id}
                        aria-current={active ? "page" : undefined}
                        onClick={() => (selecting ? toggleSelected(item.id) : onSelect(item.id))}
                        className={cn("flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1.5 pr-9 text-left", focusRing)}
                      >
                        <span className="flex w-full items-center gap-1.5">
                          {item.unread && (
                            <>
                              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
                              <span className="sr-only">Unread: </span>
                            </>
                          )}
                          <span className={cn("min-w-0 flex-1 truncate", item.unread && "font-semibold")}>{item.title || "Untitled"}</span>
                          <time dateTime={toDate(item.updatedAt).toISOString()} className="shrink-0 text-[11px] text-muted-foreground tabular-nums group-hover:invisible group-focus-within:invisible">
                            {stamp(item.updatedAt)}
                          </time>
                        </span>
                        {item.preview && <span className="w-full truncate text-xs text-muted-foreground">{item.preview}</span>}
                      </button>
                    )}
                    {!selecting && renaming?.id !== item.id && menuFor(item).length > 0 && (
                      <span className="absolute top-1 right-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                        <ActionMenu align="end" items={menuFor(item)} trigger={<button type="button" aria-label={`More actions for ${item.title}`} className={cn(iconButton, "size-7", focusRing)}><MoreHorizontalIcon aria-hidden="true" /></button>} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="px-2 py-4 text-center text-muted-foreground">{query.trim() ? "No chats match." : view === "archived" ? "No archived chats." : "No chats yet."}</p>}
        {hasMore && onLoadMore && (
          <button type="button" disabled={loadingMore} onClick={onLoadMore} className={cn(button, buttonVariants.ghost, "self-center", focusRing)}>
            {loadingMore && <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            {loadingMore ? "Loading" : "Load more"}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={count === 1 ? `Delete "${titleOf(confirming![0]!)}"?` : `Delete ${count} chats?`}
        description="This can't be undone."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => {
          if (!confirming) return;
          await onDelete?.(confirming);
          setSelected(new Set());
        }}
      />
    </nav>
  );
}
