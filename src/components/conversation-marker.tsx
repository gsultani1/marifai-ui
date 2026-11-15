// packages/ai-ui/src/components/conversation-marker.tsx
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn.js";

export interface ConversationMarkerProps extends ComponentProps<"div"> {
  icon?: ReactNode;
}

/**
 * Divider with a centered label inside a thread, e.g. "Switched to Marifai
 * Deep", "Today" or "Context compacted".
 */
export function ConversationMarker({ icon, className, children, ...props }: ConversationMarkerProps) {
  return (
    <div
      role="note"
      data-slot="conversation-marker"
      className={cn("flex items-center gap-3 text-xs text-muted-foreground [&_svg]:size-3.5", className)}
      {...props}
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span className="inline-flex max-w-[70%] items-center gap-1.5 text-center">
        {icon}
        {children}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
