// packages/ai-ui/src/components/artifact-card.tsx
"use client";

import { ChevronRightIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type ArtifactKind, artifactKindInfo } from "./artifact-viewer.js";

export type ArtifactCardStatus = "building" | "ready" | "failed";

export interface ArtifactCardProps extends Omit<ComponentProps<"button">, "title" | "children"> {
  title: string;
  kind: ArtifactKind;
  status?: ArtifactCardStatus;
  /** 1-based version shown as "Version 3". */
  version?: number;
  /** Replaces the kind and version line, e.g. "Writing 120 lines". */
  detail?: ReactNode;
  /** The artifact is showing in the panel now. */
  active?: boolean;
}

/**
 * Inline card for an artifact inside a message: its kind, title and
 * version, a spinner while it is being written and an error state; opens
 * the artifact panel.
 */
export function ArtifactCard({ title, kind, status = "ready", version, detail, active = false, className, ...props }: ArtifactCardProps) {
  const info = artifactKindInfo(kind);
  const statusText = status === "building" ? "Building…" : status === "failed" ? "Couldn't finish" : [info.label, version !== undefined && version > 1 ? `Version ${version}` : ""].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      aria-pressed={active}
      data-slot="artifact-card"
      data-status={status}
      className={cn(
        "group flex w-full max-w-md items-center gap-3 rounded-lg border border-border bg-card p-2 pr-3 text-left text-sm text-card-foreground transition-colors hover:bg-accent aria-pressed:border-ring aria-pressed:bg-accent",
        focusRing,
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted [&_svg]:size-5", status === "failed" ? "text-destructive" : "text-muted-foreground")}>
        {status === "building" ? <LoaderCircleIcon className="motion-safe:animate-spin" /> : status === "failed" ? <CircleAlertIcon /> : info.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {title}
          <span className="sr-only">, </span>
        </span>
        <span className={cn("truncate text-xs", status === "failed" ? "text-destructive" : "text-muted-foreground")}>{detail ?? statusText}</span>
      </span>
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </button>
  );
}
