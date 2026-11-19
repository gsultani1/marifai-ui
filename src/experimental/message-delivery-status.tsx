// packages/ai-ui/src/experimental/message-delivery-status.tsx
"use client";

import { cn } from "../lib/cn.js";
import { ControlAction } from "../lib/component-controls.js";

export type ChatDeliveryState = "queued" | "sending" | "sent" | "failed";
export interface MessageDeliveryStatusProps {
  status: ChatDeliveryState;
  detail?: string;
  retrying?: boolean;
  onRetry?: () => void;
  className?: string;
}
const labels: Record<ChatDeliveryState, string> = { queued: "Queued", sending: "Sending", sent: "Sent", failed: "Failed to send" };
export function MessageDeliveryStatus({ status, detail, retrying, onRetry, className }: MessageDeliveryStatusProps) {
  return <span data-slot="message-delivery-status" className={cn("inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground", className)}>
    <span role="status">{labels[status]}{detail && " · " + detail}</span>
    {status === "failed" && <ControlAction label="Retry message" disabled={retrying} onClick={onRetry} />}
  </span>;
}
