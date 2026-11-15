// packages/ai-ui/src/components/sub-agent-session.tsx
"use client";

import { ArrowDownIcon, BotIcon, WrenchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useNow } from "../hooks/use-now.js";
import { useStickToBottom } from "../hooks/use-stick-to-bottom.js";
import { badge, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatDuration } from "../lib/format.js";

export type SubAgentState = "active" | "done" | "failed";

export interface SubAgentSessionProps extends Omit<ComponentProps<"section">, "title"> {
  title: ReactNode;
  state: SubAgentState;
  startedAt?: number | undefined;
  endedAt?: number | undefined;
  toolCount?: number;
  /** Streamed output of the session; the panel follows it until the user scrolls up. */
  children: ReactNode;
  icon?: ReactNode;
  /** Height of the scroll area. */
  maxHeight?: number | string;
}

const STATE_STYLE: Record<SubAgentState, { label: string; className: string }> = {
  active: { label: "Running", className: "border-ring/50" },
  done: { label: "Finished", className: "border-success/40" },
  failed: { label: "Failed", className: "border-destructive/50" },
};

/** Card for a nested agent session (debugger, researcher) with its own following scroll area. */
export function SubAgentSession({
  title,
  state,
  startedAt,
  endedAt,
  toolCount,
  children,
  icon,
  maxHeight = "16rem",
  className,
  ...props
}: SubAgentSessionProps) {
  const now = useNow(1000, state === "active" && startedAt !== undefined);
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();
  const elapsed = startedAt !== undefined ? Math.max(0, (endedAt ?? (state === "active" ? now : startedAt)) - startedAt) : undefined;
  const style = STATE_STYLE[state];

  return (
    <section
      aria-label={typeof title === "string" ? title : undefined}
      data-slot="sub-agent-session"
      data-state={state}
      className={cn("relative flex flex-col rounded-lg border bg-card text-sm text-card-foreground", style.className, className)}
      {...props}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-muted-foreground [&_svg]:size-4">{icon ?? <BotIcon aria-hidden="true" />}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{style.label}</span>
        {elapsed !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(elapsed)}</span>}
        {toolCount !== undefined && (
          <span className={badge}>
            <WrenchIcon aria-hidden="true" />
            {toolCount} tool{toolCount === 1 ? "" : "s"}
          </span>
        )}
      </header>
      <div ref={scrollRef} role="log" tabIndex={0} aria-label="Session output" className={cn("overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")} style={{ maxHeight }}>
        <div ref={contentRef} className="flex flex-col gap-2 p-3">
          {children}
        </div>
      </div>
      {!isAtBottom && (
        <button
          type="button"
          aria-label="Scroll to latest output"
          onClick={() => scrollToBottom()}
          className={cn(iconButton, "absolute right-3 bottom-3 rounded-full border border-border bg-background shadow-sm", focusRing)}
        >
          <ArrowDownIcon aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
