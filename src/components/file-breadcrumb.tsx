// packages/ai-ui/src/components/file-breadcrumb.tsx
"use client";

import { ChevronRightIcon, FolderIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { buildFileTree, type FileTreeEntry, findNode, normalizePath } from "../lib/file-tree.js";
import { ActionMenu } from "./action-menu.js";
import { fileIcon } from "./file-tree.js";

export interface FileBreadcrumbProps extends Omit<ComponentProps<"nav">, "children"> {
  path: string;
  /** Workspace files; turns each segment into a menu of its siblings. */
  files?: FileTreeEntry[];
  /** Receives the file or folder picked from a segment menu. */
  onNavigate?: (path: string) => void;
  /** First crumb, e.g. the project name. */
  rootLabel?: string;
}

/** Path of the open file above an editor; each segment lists its siblings to jump between files. */
export function FileBreadcrumb({ path, files, onNavigate, rootLabel, className, ...props }: FileBreadcrumbProps) {
  const segments = normalizePath(path).split("/").filter(Boolean);
  const tree = files ? buildFileTree(files) : null;

  return (
    <nav aria-label="File path" data-slot="file-breadcrumb" className={cn("min-w-0 text-xs text-muted-foreground", className)} {...props}>
      <ol className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {rootLabel && (
          <li className="flex shrink-0 items-center gap-0.5">
            <span className="px-1">{rootLabel}</span>
            <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
          </li>
        )}
        {segments.map((segment, index) => {
          const current = index === segments.length - 1;
          const segmentPath = segments.slice(0, index + 1).join("/");
          const parent = segments.slice(0, index).join("/");
          const siblings = tree ? (parent ? (findNode(tree, parent)?.children ?? []) : tree) : [];
          const icon = current ? fileIcon(segment) : <FolderIcon aria-hidden="true" />;
          const label = (
            <>
              <span className="[&_svg]:size-3.5">{icon}</span>
              <span className="truncate">{segment}</span>
            </>
          );
          return (
            <li key={segmentPath} className={cn("flex min-w-0 items-center gap-0.5", !current && "shrink-0")}>
              {siblings.length > 1 && onNavigate ? (
                <ActionMenu
                  items={siblings.map((node) => ({ id: node.path, label: node.name, icon: node.kind === "folder" ? <FolderIcon aria-hidden="true" /> : fileIcon(node.name), checked: node.path === segmentPath, onSelect: () => onNavigate(node.path) }))}
                  trigger={
                    <button type="button" aria-current={current ? "page" : undefined} aria-label={`${segment}, show items in ${parent || "the root folder"}`} className={cn("inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 hover:bg-accent hover:text-foreground", current && "text-foreground", focusRing)}>
                      {label}
                    </button>
                  }
                />
              ) : (
                <span aria-current={current ? "page" : undefined} className={cn("inline-flex min-w-0 items-center gap-1 px-1 py-0.5", current && "text-foreground")}>
                  {label}
                </span>
              )}
              {!current && <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
