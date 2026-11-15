// packages/ai-ui/src/components/connection-status.tsx
"use client";

import { LoaderCircleIcon, PlugZapIcon, RefreshCwIcon, WifiIcon, WifiOffIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useNow } from "../hooks/use-now.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "failed" | "offline";

const STATES: Record<ConnectionState, { label: string; icon: ReactNode }> = {
  connecting: { label: "Connecting", icon: <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> },
  connected: { label: "Connected", icon: <WifiIcon aria-hidden="true" className="text-success" /> },
  reconnecting: { label: "Reconnecting", icon: <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> },
  failed: { label: "Connection lost", icon: <PlugZapIcon aria-hidden="true" className="text-destructive" /> },
  offline: { label: "Offline", icon: <WifiOffIcon aria-hidden="true" className="text-warning" /> },
};

export interface ConnectionStatusProps extends Omit<ComponentProps<"div">, "children"> {
  state: ConnectionState;
  /** Epoch ms of the next automatic retry; shows a countdown. */
  retryAt?: number | undefined;
  attempt?: number | undefined;
  onRetry?: () => void;
  /** Renders nothing while connected unless set. */
  showConnected?: boolean;
  /** Extra context, e.g. "Your reply will resume where it stopped." */
  detail?: ReactNode;
}

/** Live-connection indicator for streaming sessions with retry countdown and manual retry. */
export function ConnectionStatus({
  state,
  retryAt,
  attempt,
  onRetry,
  showConnected = false,
  detail,
  className,
  ...props
}: ConnectionStatusProps) {
  const now = useNow(1000, retryAt !== undefined && state === "reconnecting");
  if (state === "connected" && !showConnected) return null;
  const config = STATES[state];
  const seconds = retryAt !== undefined ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : undefined;

  return (
    <div
      role="status"
      data-slot="connection-status"
      data-state={state}
      className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground [&_svg]:size-3.5", className)}
      {...props}
    >
      {config.icon}
      <span className="font-medium text-foreground">{config.label}</span>
      {state === "reconnecting" && seconds !== undefined && (
        <span>
          retrying in {seconds}s{attempt !== undefined ? ` (attempt ${attempt})` : ""}
        </span>
      )}
      {detail && <span>{detail}</span>}
      {onRetry && (state === "failed" || state === "reconnecting" || state === "offline") && (
        <button
          type="button"
          onClick={onRetry}
          className={cn("inline-flex items-center gap-1 rounded-sm font-medium text-foreground hover:underline", focusRing)}
        >
          <RefreshCwIcon aria-hidden="true" />
          Retry now
        </button>
      )}
    </div>
  );
}
