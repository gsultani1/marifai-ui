// packages/ai-ui/src/components/run-timeline.tsx
"use client";

import { ChevronDownIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from "react";

import { badge, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatCompactNumber } from "../lib/format.js";
import { aggregateStatus, type StepStatus, StepStatusIcon, stepStatusLabel } from "../lib/step-status.js";

export interface TimelineFile {
  path: string;
  status: StepStatus;
  /** Lines this phase added to the file. */
  linesAdded?: number;
}

export interface TimelinePhase {
  id: string;
  title: ReactNode;
  status: StepStatus;
  description?: ReactNode;
  files?: TimelineFile[];
  errors?: number;
  warnings?: number;
}

export interface TimelineStage {
  id: string;
  title: ReactNode;
  status: StepStatus;
  description?: ReactNode;
  phases?: TimelinePhase[];
}

export interface RunTimelineProps extends Omit<ComponentProps<"div">, "children"> {
  stages: TimelineStage[];
  onFileClick?: (path: string) => void;
  /** Accessible name of the timeline. */
  label?: string;
}

const ACTIVE: StepStatus[] = ["running", "needs-input", "failed"];

function PhaseRow({ phase, onFileClick }: { phase: TimelinePhase; onFileClick: ((path: string) => void) | undefined }) {
  const active = ACTIVE.includes(phase.status);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? active;
  const files = phase.files ?? [];
  const panelId = `phase-${phase.id}`;

  return (
    <li data-status={phase.status} className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={files.length > 0 ? open : undefined}
        aria-controls={files.length > 0 ? panelId : undefined}
        disabled={files.length === 0}
        onClick={() => setToggled(!open)}
        className={cn("group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left disabled:cursor-default", focusRing)}
      >
        <StepStatusIcon status={phase.status} />
        <span className="min-w-0 flex-1 truncate">{phase.title}</span>
        {(phase.errors ?? 0) > 0 && <span className={cn(badge, "border-destructive/40 text-destructive")}>{phase.errors} errors</span>}
        {(phase.warnings ?? 0) > 0 && <span className={cn(badge, "border-warning/50")}>{phase.warnings} warnings</span>}
        {files.length > 0 && !open && <span className="text-xs text-muted-foreground">{files.length} files</span>}
        {files.length > 0 && (
          <ChevronDownIcon aria-hidden="true" className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        )}
      </button>
      {phase.description && <p className="pl-7 text-xs text-muted-foreground">{phase.description}</p>}
      {files.length > 0 && open && (
        <ul id={panelId} className="flex flex-col gap-0.5 pl-7">
          {files.map((file) => (
            <li key={file.path} className="flex min-w-0 items-center gap-2 text-xs">
              <StepStatusIcon status={file.status} className="size-3.5" />
              {onFileClick ? (
                <button type="button" onClick={() => onFileClick(file.path)} className={cn("min-w-0 truncate rounded-sm font-mono hover:underline", focusRing)}>
                  {file.path}
                </button>
              ) : (
                <span className="min-w-0 truncate font-mono">{file.path}</span>
              )}
              {file.linesAdded !== undefined && file.linesAdded > 0 && (
                <span className="ml-auto shrink-0 text-success tabular-nums">+{formatCompactNumber(file.linesAdded)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Vertical timeline of an agent run: stages, the phases inside them and the
 * files each phase touched. Only the active phase opens by itself. When the
 * timeline scrolls out of view a sticky summary shows the current phase.
 */
export function RunTimeline({ stages, onFileClick, label = "Run progress", className, ...props }: RunTimelineProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const phases = stages.flatMap((stage) => stage.phases ?? []);
  const current = phases.find((phase) => ACTIVE.includes(phase.status)) ?? [...phases].reverse().find((phase) => phase.status === "complete");
  const done = phases.filter((phase) => phase.status === "complete" || phase.status === "skipped").length;
  const overall = aggregateStatus(stages.map((stage) => stage.status));

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setSummaryVisible(entry ? !entry.isIntersecting : false));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div data-slot="run-timeline" data-status={overall} className={cn("relative flex flex-col text-sm", className)} {...props}>
      {summaryVisible && current && (
        <div
          aria-hidden="true"
          data-slot="run-timeline-summary"
          className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm"
        >
          <StepStatusIcon status={current.status} className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">{current.title}</span>
          <span className="text-muted-foreground tabular-nums">
            {done}/{phases.length}
          </span>
        </div>
      )}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <ol aria-label={label} className="flex flex-col">
        {stages.map((stage, index) => (
          <li key={stage.id} data-status={stage.status} className="relative flex gap-3 pb-4 last:pb-0">
            {index < stages.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-0 left-[9px] w-px bg-border" />}
            <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-background">
              <StepStatusIcon status={stage.status} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{stage.title}</span>
                <span className="text-xs text-muted-foreground">{stepStatusLabel(stage.status)}</span>
              </div>
              {stage.description && <p className="text-xs text-muted-foreground">{stage.description}</p>}
              {stage.phases && stage.phases.length > 0 && (
                <ol className="flex flex-col gap-1">
                  {stage.phases.map((phase) => (
                    <PhaseRow key={phase.id} phase={phase} onFileClick={onFileClick} />
                  ))}
                </ol>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
