// packages/ai-ui/src/components/file-tree.tsx
"use client";

import {
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ClipboardCopyIcon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  ImageIcon,
  LockIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { type DragEvent, type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { filesFromDataTransfer } from "../lib/file-import.js";
import { ancestorPaths, buildFileTree, type FileChangeStatus, type FileTreeEntry, type FileTreeNode, findNode, parentPath, validateFileName, visibleNodes } from "../lib/file-tree.js";
import { ActionContextMenu, type MenuEntry } from "./action-menu.js";
import { ConfirmDialog } from "./confirm-dialog.js";

/** Letter, spoken label and dot color per change status; color is never the only signal. */
export const FILE_STATUS: Record<FileChangeStatus, { letter: string; label: string; dot: string }> = {
  added: { letter: "A", label: "added", dot: "bg-success" },
  untracked: { letter: "U", label: "untracked", dot: "bg-success" },
  modified: { letter: "M", label: "modified", dot: "bg-warning" },
  renamed: { letter: "R", label: "renamed", dot: "bg-ring" },
  deleted: { letter: "D", label: "deleted", dot: "bg-destructive" },
  conflicted: { letter: "!", label: "conflicted", dot: "bg-destructive" },
};

/** Change badge: colored dot, a letter drawn with CSS so it stays out of accessible names, and a spoken status. */
export function FileStatusBadge({ status, labelled = true, className }: { status: FileChangeStatus; /** False when the status is already spoken elsewhere. */ labelled?: boolean; className?: string }) {
  const meta = FILE_STATUS[status];
  return (
    <span title={meta.label} aria-hidden={labelled ? undefined : true} className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", meta.dot)} />
      <span aria-hidden="true" data-letter={meta.letter} className="w-2.5 text-center font-mono text-xs font-semibold text-muted-foreground before:content-[attr(data-letter)]" />
      {labelled && <span className="sr-only">, {meta.label}</span>}
    </span>
  );
}

const CODE = /\.(m?[jt]sx?|c?js|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|hpp|cs|php|sh|sql|html?|css|scss|vue|svelte|toml|ya?ml)$/i;

/** Icon for a file name: code, JSON, text, image or generic. */
export function fileIcon(name: string): ReactNode {
  if (/\.json$/i.test(name)) return <FileJsonIcon aria-hidden="true" />;
  if (CODE.test(name)) return <FileCodeIcon aria-hidden="true" />;
  if (/\.(md|mdx|txt|rst|csv|log)$/i.test(name)) return <FileTextIcon aria-hidden="true" />;
  if (/\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(name)) return <ImageIcon aria-hidden="true" />;
  return <FileIcon aria-hidden="true" />;
}

export interface FileTreeProps {
  files: FileTreeEntry[];
  /** Gitignore-style patterns hidden from the tree, e.g. ["node_modules/", "*.log"]. */
  ignore?: string[];
  selectedPath?: string | null;
  /** Opens a file; folders toggle instead. */
  onSelect?: (path: string) => void;
  /** Controlled expanded folders; include `ancestorPaths(selected)` to reveal a file. */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (expanded: string[]) => void;
  onCreate?: (path: string, kind: "file" | "folder") => void | Promise<void>;
  onRename?: (from: string, to: string) => void | Promise<void>;
  /** Runs after confirmation. */
  onDelete?: (path: string, kind: "file" | "folder") => void | Promise<void>;
  /** Files dropped from the desktop onto a folder (or the root, ""). Folder paths are kept in `webkitRelativePath`. */
  onDropFiles?: (folder: string, files: File[]) => void;
  label?: string;
  /** Hides the header with the label and the new file, new folder and collapse buttons. */
  hideHeader?: boolean;
  className?: string;
}

type Editing = { mode: "create"; parent: string; kind: "file" | "folder" } | { mode: "rename"; path: string };

interface FileTreeEditRowProps {
  level: number;
  kind: "file" | "folder";
  renaming: boolean;
  value: string;
  error: string | null;
  errorId: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function FileTreeEditRow({ level, kind, renaming, value, error, errorId, onChange, onCommit, onCancel }: FileTreeEditRowProps) {
  const name = renaming ? "New name" : kind === "folder" ? "Folder name" : "File name";
  return (
    <div role="treeitem" aria-level={level} aria-label={renaming ? "Renaming" : kind === "folder" ? "New folder" : "New file"} className="flex flex-col gap-0.5 py-0.5 pr-2" style={{ paddingLeft: `${level * 12 + 4}px` }}>
      <div className="flex items-center gap-1.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
        <span className="w-4" />
        {kind === "folder" ? <FolderIcon aria-hidden="true" /> : fileIcon(value)}
        <input
          autoFocus
          aria-label={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            const dot = event.currentTarget.value.lastIndexOf(".");
            event.currentTarget.setSelectionRange(0, kind === "file" && dot > 0 ? dot : event.currentTarget.value.length);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onCancel();
            }
          }}
          onBlur={onCommit}
          className="h-6 min-w-0 flex-1 rounded-sm border border-ring bg-background px-1.5 text-sm outline-none aria-invalid:border-destructive"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="pl-11 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Workspace file tree: ARIA tree keyboard support (arrows, Home and End,
 * type to jump, * expands siblings, F2 renames, Delete removes), change,
 * unsaved and lock badges, a context menu, inline create and rename, drop
 * to upload and gitignore-style hiding.
 */
export function FileTree({
  files,
  ignore = [],
  selectedPath = null,
  onSelect,
  expanded: expandedProp,
  defaultExpanded = [],
  onExpandedChange,
  onCreate,
  onRename,
  onDelete,
  onDropFiles,
  label = "Files",
  hideHeader = false,
  className,
}: FileTreeProps) {
  const [internal, setInternal] = useState(() => new Set([...defaultExpanded, ...(selectedPath ? ancestorPaths(selectedPath) : [])]));
  const [revealedFor, setRevealedFor] = useState(selectedPath);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FileTreeNode | null>(null);
  const [menuTarget, setMenuTarget] = useState<FileTreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  // An edit that was cancelled or is being committed, so a late blur can't commit it again.
  const closedEdit = useRef<Editing | null>(null);
  const { copy } = useCopyToClipboard();
  const id = useId();

  if (selectedPath !== revealedFor) {
    setRevealedFor(selectedPath);
    if (selectedPath && !expandedProp) setInternal((current) => new Set([...current, ...ancestorPaths(selectedPath)]));
  }

  const expanded = expandedProp ? new Set(expandedProp) : internal;
  const tree = buildFileTree(files, ignore);
  const rows = visibleNodes(tree, expanded);
  const context = rows.find((row) => row.node.path === focusedPath) ?? rows.find((row) => row.node.path === selectedPath);
  const focused = context ?? rows[0];
  const contextFolder = context ? (context.node.kind === "folder" ? context.node.path : parentPath(context.node.path)) : "";

  const setExpanded = (next: Set<string>) => {
    if (!expandedProp) setInternal(next);
    onExpandedChange?.([...next]);
  };

  const toggle = (path: string, open?: boolean) => {
    const next = new Set(expanded);
    if (open ?? !next.has(path)) next.add(path);
    else next.delete(path);
    setExpanded(next);
  };

  const focusRow = (path: string) => {
    setFocusedPath(path);
    requestAnimationFrame(() => treeRef.current?.querySelector<HTMLElement>(`[data-path="${path.replace(/["\\]/g, "\\$&")}"]`)?.focus());
  };

  const startCreate = (parent: string, kind: "file" | "folder") => {
    if (parent) {
      const next = new Set(expanded);
      next.add(parent);
      for (const ancestor of ancestorPaths(`${parent}/x`)) next.add(ancestor);
      setExpanded(next);
    }
    setEditing({ mode: "create", parent, kind });
    setDraft("");
    setEditError(null);
  };

  const startRename = (node: FileTreeNode) => {
    setEditing({ mode: "rename", path: node.path });
    setDraft(node.name);
    setEditError(null);
  };

  const siblingsOf = (parent: string, except?: string) => (parent ? (findNode(tree, parent)?.children ?? []) : tree).filter((node) => node.path !== except).map((node) => node.name);

  const commitEdit = async () => {
    if (!editing || closedEdit.current === editing) return;
    const parent = editing.mode === "create" ? editing.parent : parentPath(editing.path);
    const original = editing.mode === "rename" ? findNode(tree, editing.path)?.name : undefined;
    if (editing.mode === "rename" && draft.trim() === original) {
      closedEdit.current = editing;
      setEditing(null);
      focusRow(editing.path);
      return;
    }
    if (editing.mode === "create" && !draft.trim()) {
      closedEdit.current = editing;
      setEditing(null);
      return;
    }
    const error = validateFileName(draft, siblingsOf(parent, editing.mode === "rename" ? editing.path : undefined));
    if (error) {
      setEditError(error);
      return;
    }
    const target = parent ? `${parent}/${draft.trim()}` : draft.trim();
    closedEdit.current = editing;
    try {
      if (editing.mode === "create") {
        await onCreate?.(target, editing.kind);
        setAnnouncement(`Created ${target}`);
      } else {
        await onRename?.(editing.path, target);
        setAnnouncement(`Renamed to ${target}`);
      }
      setEditing((current) => (current === editing ? null : current));
      const active = document.activeElement;
      if (!active || active === document.body || (active instanceof HTMLInputElement && treeRef.current?.contains(active))) focusRow(target);
    } catch (reason) {
      closedEdit.current = null;
      setEditError(reason instanceof Error && reason.message ? reason.message : "That didn't work. Try again.");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!focused || editing || event.target instanceof HTMLInputElement) return;
    const index = rows.indexOf(focused);
    const { node } = focused;
    const move = (next: number) => {
      const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
      if (row) focusRow(row.node.path);
    };
    switch (event.key) {
      case "ArrowDown":
        move(index + 1);
        break;
      case "ArrowUp":
        move(index - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(rows.length - 1);
        break;
      case "ArrowRight":
        if (node.kind !== "folder") return;
        if (!expanded.has(node.path)) toggle(node.path, true);
        else if (node.children[0]) focusRow(node.children[0].path);
        break;
      case "ArrowLeft":
        if (node.kind === "folder" && expanded.has(node.path)) toggle(node.path, false);
        else if (focused.parent) focusRow(focused.parent);
        break;
      case "Enter":
      case " ":
        if (node.kind === "folder") toggle(node.path);
        else onSelect?.(node.path);
        break;
      case "*": {
        const siblings = focused.parent ? (findNode(tree, focused.parent)?.children ?? []) : tree;
        setExpanded(new Set([...expanded, ...siblings.filter((sibling) => sibling.kind === "folder").map((sibling) => sibling.path)]));
        break;
      }
      case "F2":
        if (!onRename) return;
        startRename(node);
        break;
      case "Delete":
        if (!onDelete) return;
        setDeleting(node);
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const now = event.timeStamp;
        typeahead.current = { text: now - typeahead.current.at < 600 ? typeahead.current.text + event.key.toLowerCase() : event.key.toLowerCase(), at: now };
        const query = typeahead.current.text;
        const ordered = [...rows.slice(index + (query.length === 1 ? 1 : 0)), ...rows.slice(0, index + (query.length === 1 ? 1 : 0))];
        const match = ordered.find((row) => row.node.name.toLowerCase().startsWith(query));
        if (match) focusRow(match.node.path);
        break;
      }
    }
    event.preventDefault();
  };

  const menuItems = (target: FileTreeNode | null): MenuEntry[] => {
    const folder = target ? (target.kind === "folder" ? target.path : parentPath(target.path)) : "";
    return [
      ...(onCreate
        ? [
            { id: "new-file", label: "New file", icon: <FilePlusIcon aria-hidden="true" />, onSelect: () => startCreate(folder, "file") },
            { id: "new-folder", label: "New folder", icon: <FolderPlusIcon aria-hidden="true" />, onSelect: () => startCreate(folder, "folder") },
          ]
        : []),
      ...(target
        ? [
            ...(onRename ? [{ id: "rename", label: "Rename", icon: <PencilIcon aria-hidden="true" />, shortcut: "F2", onSelect: () => startRename(target) }] : []),
            { id: "copy-path", label: "Copy path", icon: <ClipboardCopyIcon aria-hidden="true" />, onSelect: () => void copy(target.path) },
            ...(onDelete ? [{ type: "separator" as const, id: "separator" }, { id: "delete", label: "Delete", icon: <Trash2Icon aria-hidden="true" />, destructive: true, shortcut: "Del", onSelect: () => setDeleting(target) }] : []),
          ]
        : []),
    ];
  };

  const dropProps = (folder: string) =>
    onDropFiles
      ? {
          onDragOver: (event: DragEvent) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";
            setDropTarget(folder);
          },
          onDragLeave: (event: DragEvent) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
          },
          onDrop: (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setDropTarget(null);
            void filesFromDataTransfer(event.dataTransfer).then((dropped) => {
              if (!dropped.length) return;
              onDropFiles(folder, dropped);
              setAnnouncement(`Added ${dropped.length} ${dropped.length === 1 ? "file" : "files"} to ${folder || "the workspace root"}`);
            });
          },
        }
      : {};

  const cancelEdit = () => {
    closedEdit.current = editing;
    const path = editing?.mode === "rename" ? editing.path : undefined;
    setEditing(null);
    if (path) focusRow(path);
  };

  const editRow = (level: number, key: string, kind: "file" | "folder") => (
    <FileTreeEditRow
      key={key}
      level={level}
      kind={kind}
      renaming={editing?.mode === "rename"}
      value={draft}
      error={editError}
      errorId={`${id}-edit-error`}
      onChange={(value) => {
        setDraft(value);
        setEditError(null);
      }}
      onCommit={() => void commitEdit()}
      onCancel={cancelEdit}
    />
  );

  const content: ReactNode[] = [];
  if (editing?.mode === "create" && editing.parent === "") content.push(editRow(1, "create-root", editing.kind));
  for (const row of rows) {
    const { node, level } = row;
    if (editing?.mode === "rename" && editing.path === node.path) {
      content.push(editRow(level, node.path, node.kind));
      continue;
    }
    const isOpen = node.kind === "folder" && expanded.has(node.path);
    const status = node.entry?.status;
    const selected = node.kind === "file" && node.path === selectedPath;
    content.push(
      <div
        key={node.path}
        role="treeitem"
        aria-label={[node.name, node.entry?.locked && "locked", node.entry?.unsaved && "unsaved", status && FILE_STATUS[status].label, node.kind === "folder" && node.changes > 0 && !isOpen && `${node.changes} changed`].filter(Boolean).join(", ")}
        data-path={node.path}
        tabIndex={node.path === focused?.node.path ? 0 : -1}
        aria-level={level}
        aria-setsize={row.setSize}
        aria-posinset={row.position}
        aria-expanded={node.kind === "folder" ? isOpen : undefined}
        aria-selected={node.kind === "file" ? selected : undefined}
        onFocus={() => setFocusedPath(node.path)}
        onClick={() => {
          setFocusedPath(node.path);
          if (node.kind === "folder") toggle(node.path);
          else onSelect?.(node.path);
        }}
        onContextMenu={() => setMenuTarget(node)}
        {...dropProps(node.kind === "folder" ? node.path : row.parent)}
        className={cn(
          "flex h-7 cursor-pointer items-center gap-1.5 rounded-sm pr-2 text-sm select-none hover:bg-accent/60 [&_svg]:size-4 [&_svg]:shrink-0",
          selected && "bg-accent text-accent-foreground",
          dropTarget === node.path && node.kind === "folder" && "bg-accent ring-1 ring-ring",
          focusRing,
          "focus-visible:ring-offset-0",
        )}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
      >
        {node.kind === "folder" ? <ChevronRightIcon aria-hidden="true" className={cn("text-muted-foreground transition-transform motion-reduce:transition-none", isOpen && "rotate-90")} /> : <span className="w-4 shrink-0" />}
        <span className="text-muted-foreground">{node.kind === "folder" ? isOpen ? <FolderOpenIcon aria-hidden="true" /> : <FolderIcon aria-hidden="true" /> : fileIcon(node.name)}</span>
        <span className={cn("min-w-0 flex-1 truncate", status === "deleted" && "text-muted-foreground line-through")}>{node.name}</span>
        {node.entry?.locked && (
          <span aria-hidden="true" className="text-muted-foreground" title="Locked">
            <LockIcon className="size-3.5" />
          </span>
        )}
        {node.entry?.unsaved && <span aria-hidden="true" title="Unsaved changes" className="size-2 shrink-0 rounded-full bg-foreground" />}
        {status && <FileStatusBadge status={status} labelled={false} />}
        {node.kind === "folder" && node.changes > 0 && !isOpen && (
          <span aria-hidden="true" data-count={node.changes} className="text-xs text-muted-foreground tabular-nums before:content-[attr(data-count)]" title={`${node.changes} changed`} />
        )}
      </div>,
    );
    if (editing?.mode === "create" && editing.parent === node.path && isOpen) content.push(editRow(level + 1, `create-${node.path}`, editing.kind));
  }

  return (
    <div data-slot="file-tree" className={cn("flex min-h-0 flex-col text-sm", className)}>
      {!hideHeader && (
        <div className="flex items-center gap-1 px-2 py-1">
          <h3 id={`${id}-label`} className="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {label}
          </h3>
          {onCreate && (
            <>
              <button type="button" aria-label="New file" title="New file" onClick={() => startCreate(contextFolder, "file")} className={cn(iconButton, "size-7", focusRing)}>
                <FilePlusIcon aria-hidden="true" />
              </button>
              <button type="button" aria-label="New folder" title="New folder" onClick={() => startCreate(contextFolder, "folder")} className={cn(iconButton, "size-7", focusRing)}>
                <FolderPlusIcon aria-hidden="true" />
              </button>
            </>
          )}
          <button type="button" aria-label="Collapse folders" title="Collapse folders" onClick={() => setExpanded(new Set())} className={cn(iconButton, "size-7", focusRing)}>
            <ChevronsDownUpIcon aria-hidden="true" />
          </button>
        </div>
      )}
      <ActionContextMenu items={menuItems(menuTarget)} onOpenChange={(open) => !open && setMenuTarget(null)} className="flex min-h-0 flex-1 flex-col">
        <div
          ref={treeRef}
          role="tree"
          aria-label={hideHeader ? label : undefined}
          aria-labelledby={hideHeader ? undefined : `${id}-label`}
          onKeyDown={onKeyDown}
          onContextMenu={(event) => {
            if (event.target === event.currentTarget) setMenuTarget(null);
          }}
          {...dropProps("")}
          className={cn("min-h-16 flex-1 overflow-auto p-1", dropTarget === "" && "bg-accent/40 ring-1 ring-ring ring-inset")}
        >
          {content}
          {rows.length === 0 && !editing && <p className="px-2 py-3 text-muted-foreground">No files yet.</p>}
        </div>
      </ActionContextMenu>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={deleting?.kind === "folder" ? "The folder and everything in it will be deleted." : "The file will be deleted."}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          await onDelete?.(deleting.path, deleting.kind);
          setAnnouncement(`Deleted ${deleting.path}`);
          const index = rows.findIndex((row) => row.node.path === deleting.path);
          const neighbour = rows[index + 1] ?? rows[index - 1];
          if (neighbour) setFocusedPath(neighbour.node.path);
        }}
      />
    </div>
  );
}
