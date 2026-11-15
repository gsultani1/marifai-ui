// packages/ai-ui/src/components/terminal-tabs.tsx
"use client";

import { PlusIcon, TerminalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type WorkspaceTab, WorkspaceTabs } from "./workspace-tabs.js";

export type TerminalSessionStatus = "running" | "idle" | "exited" | "error";

export interface TerminalSession {
  id: string;
  /** e.g. "bash" or "npm run dev". */
  title: string;
  status?: TerminalSessionStatus;
  exitCode?: number;
}

export interface TerminalTabsProps {
  sessions: TerminalSession[];
  activeId: string | null;
  onActiveChange: (id: string) => void;
  onNew?: () => void;
  onClose?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
  newLabel?: string;
  /** The active session's terminal. */
  children?: ReactNode;
  className?: string;
}

const DOT: Record<TerminalSessionStatus, string> = {
  running: "bg-success",
  idle: "bg-muted-foreground",
  exited: "bg-muted-foreground",
  error: "bg-destructive",
};

/** Spoken and hover text for a session's state, e.g. "exited with code 1". */
export function describeSession({ status, exitCode }: TerminalSession): string | undefined {
  if (status === "running") return "running";
  if (status === "exited" || status === "error") return exitCode === undefined ? (status === "error" ? "failed" : "exited") : `exited with code ${exitCode}`;
  return undefined;
}

/** Tabs for several terminal sessions with their run state, a new-terminal button and close on Delete or middle click. */
export function TerminalTabs({ sessions, activeId, onActiveChange, onNew, onClose, onReorder, newLabel = "New terminal", children, className }: TerminalTabsProps) {
  const tabs: WorkspaceTab[] = sessions.map((session) => {
    const description = describeSession(session);
    return {
      id: session.id,
      title: session.title,
      ...(description ? { description } : {}),
      icon: (
        <span className="relative inline-flex">
          <TerminalIcon aria-hidden="true" />
          {session.status && <span aria-hidden="true" className={cn("absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-1 ring-background", DOT[session.status])} />}
        </span>
      ),
    };
  });

  return (
    <WorkspaceTabs
      tabs={tabs}
      activeId={activeId}
      onActiveChange={onActiveChange}
      {...(onClose ? { onClose: (ids: string[]) => ids.forEach(onClose) } : {})}
      {...(onReorder ? { onReorder } : {})}
      actions={
        onNew && (
          <button type="button" aria-label={newLabel} title={newLabel} onClick={onNew} className={cn(iconButton, "size-7", focusRing)}>
            <PlusIcon aria-hidden="true" />
          </button>
        )
      }
      label="Terminals"
      className={className}
    >
      {children}
    </WorkspaceTabs>
  );
}
