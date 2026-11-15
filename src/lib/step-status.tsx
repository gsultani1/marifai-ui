// packages/ai-ui/src/lib/step-status.tsx
import { BanIcon, CircleCheckIcon, CircleDashedIcon, CircleDotIcon, CircleSlashIcon, CircleXIcon, LoaderCircleIcon, MessageCircleQuestionIcon, TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "./cn.js";

/** Lifecycle shared by plan steps, actions, tasks and timeline phases. */
export type StepStatus = "pending" | "running" | "complete" | "skipped" | "failed" | "aborted" | "warning" | "blocked" | "needs-input";

const STEP_STATUS: Record<StepStatus, { label: string; icon: (className?: string) => ReactNode }> = {
  pending: { label: "Pending", icon: (className) => <CircleDashedIcon aria-hidden="true" className={cn("text-muted-foreground", className)} /> },
  running: {
    label: "In progress",
    icon: (className) => <LoaderCircleIcon aria-hidden="true" className={cn("text-foreground motion-safe:animate-spin", className)} />,
  },
  complete: { label: "Done", icon: (className) => <CircleCheckIcon aria-hidden="true" className={cn("text-success", className)} /> },
  skipped: { label: "Skipped", icon: (className) => <CircleSlashIcon aria-hidden="true" className={cn("text-muted-foreground", className)} /> },
  failed: { label: "Failed", icon: (className) => <CircleXIcon aria-hidden="true" className={cn("text-destructive", className)} /> },
  aborted: { label: "Stopped", icon: (className) => <BanIcon aria-hidden="true" className={cn("text-muted-foreground", className)} /> },
  warning: { label: "Needs review", icon: (className) => <TriangleAlertIcon aria-hidden="true" className={cn("text-warning", className)} /> },
  blocked: { label: "Blocked", icon: (className) => <CircleDotIcon aria-hidden="true" className={cn("text-warning", className)} /> },
  "needs-input": {
    label: "Needs your input",
    icon: (className) => <MessageCircleQuestionIcon aria-hidden="true" className={cn("text-warning", className)} />,
  },
};

export function stepStatusLabel(status: StepStatus): string {
  return STEP_STATUS[status].label;
}

/** Status glyph with a visually hidden label, so state never depends on color alone. */
export function StepStatusIcon({ status, className }: { status: StepStatus; className?: string }) {
  return (
    <span data-slot="step-status" data-status={status} className="inline-flex shrink-0 items-center [&_svg]:size-4">
      {STEP_STATUS[status].icon(className)}
      <span className="sr-only">{STEP_STATUS[status].label}</span>
    </span>
  );
}

/** Overall status of a group: failed wins, then running, then needs-input, then complete when every step is done or skipped. */
export function aggregateStatus(statuses: readonly StepStatus[], closed = true): StepStatus {
  if (statuses.length === 0) return "pending";
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("aborted")) return "aborted";
  if (statuses.includes("needs-input")) return "needs-input";
  if (statuses.includes("running")) return "running";
  if (statuses.includes("blocked")) return "blocked";
  const finished = statuses.every((status) => status === "complete" || status === "skipped" || status === "warning");
  if (finished) return closed ? (statuses.includes("warning") ? "warning" : "complete") : "running";
  return statuses.some((status) => status !== "pending") ? "running" : "pending";
}
