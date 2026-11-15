// packages/ai-ui/src/components/save-status.tsx
"use client";

import { CircleAlertIcon, CircleCheckIcon, HardDriveIcon, LoaderCircleIcon, LockIcon, PencilIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useNow } from "../hooks/use-now.js";
import { cn } from "../lib/cn.js";
import { formatRelativeTime } from "../lib/format.js";

export type SaveState = "saved" | "saving" | "unsaved" | "local" | "conflict" | "error";

const STATES: Record<SaveState, { label: string; icon: ReactNode; className?: string }> = {
  saved: { label: "All changes saved", icon: <CircleCheckIcon aria-hidden="true" className="text-success" /> },
  saving: { label: "Saving…", icon: <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> },
  unsaved: { label: "Unsaved changes", icon: <PencilIcon aria-hidden="true" /> },
  local: { label: "Changes kept on this device", icon: <HardDriveIcon aria-hidden="true" className="text-warning" /> },
  conflict: {
    label: "Someone else is editing. Your draft is kept on this device.",
    icon: <LockIcon aria-hidden="true" className="text-warning" />,
  },
  error: { label: "Could not save", icon: <CircleAlertIcon aria-hidden="true" className="text-destructive" />, className: "text-foreground" },
};

export interface SaveStatusProps extends Omit<ComponentProps<"div">, "children"> {
  state: SaveState;
  lastSavedAt?: Date | number | undefined;
  /** Overrides the default label for the state. */
  label?: ReactNode;
  /** E.g. Retry for errors or Take over for conflicts. */
  actions?: ReactNode;
}

/** Autosave line for documents and artifacts: saved, saving, unsaved, kept locally, edit conflict or error. */
export function SaveStatus({ state, lastSavedAt, label, actions, className, ...props }: SaveStatusProps) {
  const now = useNow(30_000, state === "saved" && lastSavedAt !== undefined);
  const config = STATES[state];
  const when =
    state === "saved" && lastSavedAt !== undefined
      ? ` · ${formatRelativeTime(lastSavedAt, Math.max(now, new Date(lastSavedAt).getTime()))}`
      : "";
  return (
    <div
      role="status"
      data-slot="save-status"
      data-state={state}
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5", config.className, className)}
      {...props}
    >
      {config.icon}
      <span>
        {label ?? config.label}
        {when}
      </span>
      {actions && <span className="ml-1 inline-flex items-center gap-2">{actions}</span>}
    </div>
  );
}
