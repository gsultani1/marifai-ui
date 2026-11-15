// packages/ai-ui/src/components/chat-alert.tsx
"use client";

import { MonitorXIcon, SparklesIcon, TerminalSquareIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";

import { button, buttonVariants, focusRing, iconButton, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type ChatAlertSource = "preview" | "terminal" | "build";

const SOURCE: Record<ChatAlertSource, { label: string; icon: ReactNode }> = {
  preview: { label: "Preview error", icon: <MonitorXIcon aria-hidden="true" /> },
  terminal: { label: "Terminal error", icon: <TerminalSquareIcon aria-hidden="true" /> },
  build: { label: "Build error", icon: <TriangleAlertIcon aria-hidden="true" /> },
};

export interface ChatAlertProps extends Omit<ComponentProps<"div">, "title" | "content"> {
  source?: ChatAlertSource;
  title?: ReactNode;
  description?: ReactNode;
  /** Error output passed to the assistant when the user asks for a fix. */
  content: string;
  onAskToFix: (content: string) => void;
  onDismiss?: () => void;
  /** Characters of error output shown in the card. */
  maxPreview?: number;
}

/** Surfaces a preview, terminal or build error above the composer with "Ask AI to fix". */
export function ChatAlert({ source = "preview", title, description, content, onAskToFix, onDismiss, maxPreview = 600, className, ...props }: ChatAlertProps) {
  const id = useId();
  const config = SOURCE[source];
  const preview = content.length > maxPreview ? `${content.slice(0, maxPreview)}\n…` : content;

  return (
    <div role="alert" aria-labelledby={`${id}-title`} data-slot="chat-alert" data-source={source} className={cn("flex flex-col gap-2 rounded-lg border p-3 text-sm", toneSurface.danger, className)} {...props}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-destructive [&_svg]:size-4">{config.icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p id={`${id}-title`} className="font-medium">
            {title ?? config.label}
          </p>
          {description && <p className="text-foreground/90">{description}</p>}
        </div>
        {onDismiss && (
          <button type="button" aria-label="Dismiss error" onClick={onDismiss} className={cn(iconButton, "size-7", focusRing)}>
            <XIcon aria-hidden="true" />
          </button>
        )}
      </div>
      {preview && (
        <pre tabIndex={0} className={cn("max-h-32 overflow-auto rounded-md bg-background p-2 font-mono text-xs whitespace-pre-wrap", focusRing)}>
          {preview}
        </pre>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={() => onAskToFix(content)} className={cn(button, buttonVariants.primary, focusRing)}>
          <SparklesIcon aria-hidden="true" />
          Ask AI to fix
        </button>
      </div>
    </div>
  );
}
