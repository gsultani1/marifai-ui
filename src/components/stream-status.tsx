// packages/ai-ui/src/components/stream-status.tsx
"use client";

import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn.js";
import { Shimmer, TypingDots } from "./shimmer.js";

export interface StreamStatusProps extends Omit<ComponentProps<"div">, "children"> {
  /** What the model is doing, e.g. "Reading sources" or "Writing". */
  stage?: ReactNode;
  /** Position in the provider queue before generation starts. */
  queuePosition?: number | undefined;
  /** Estimated seconds until the queued request starts. */
  etaSeconds?: number | undefined;
  /** The stream dropped and is resuming the same reply rather than resending the request. */
  reconnecting?: boolean;
  /** Text so far may still change, e.g. while citations are verified. */
  provisional?: boolean;
}

/**
 * One-line status under a streaming reply: queue position, current stage,
 * reconnection, or a note that the partial answer is provisional.
 */
export function StreamStatus({ stage, queuePosition, etaSeconds, reconnecting = false, provisional = false, className, ...props }: StreamStatusProps) {
  let content: ReactNode;
  if (reconnecting) {
    content = (
      <>
        <RefreshCwIcon aria-hidden="true" className="motion-safe:animate-spin" />
        <span>Reconnecting to the same reply…</span>
      </>
    );
  } else if (queuePosition !== undefined && queuePosition > 0) {
    content = (
      <>
        <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />
        <span>
          Position {queuePosition} in queue{etaSeconds !== undefined ? ` · about ${Math.max(1, Math.round(etaSeconds))}s` : ""}
        </span>
      </>
    );
  } else if (stage) {
    content = (
      <>
        <TypingDots />
        <Shimmer>{stage}</Shimmer>
      </>
    );
  } else if (!provisional) {
    return null;
  }

  return (
    <div
      role="status"
      data-slot="stream-status"
      className={cn("flex flex-wrap items-center gap-2 text-xs text-muted-foreground [&_svg]:size-3.5", className)}
      {...props}
    >
      {content}
      {provisional && <span className="rounded-full border border-border px-2 py-0.5">Writing · may still change</span>}
    </div>
  );
}
