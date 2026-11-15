// packages/ai-ui/src/components/reasoning.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { createContext, type ReactNode, use, useEffect, useMemo, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { collapsibleChevron, collapsiblePanel, focusRing, shimmerText } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { WithClassName } from "../lib/types.js";
import { MessageContent } from "./message-content.js";

const AUTO_CLOSE_DELAY_MS = 800;

interface ReasoningContextValue {
  streaming: boolean;
  duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

function useReasoning(): ReasoningContextValue {
  const context = use(ReasoningContext);
  if (!context) throw new Error("Reasoning parts must be rendered inside <Reasoning>.");
  return context;
}

export interface ReasoningProps
  extends WithClassName<Omit<Collapsible.Root.Props, "open" | "defaultOpen" | "onOpenChange">> {
  /** Opens the panel while true; closes it shortly after it turns false unless the user toggled it. */
  streaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Thinking time in seconds. Measured from `streaming` when omitted. */
  duration?: number;
  autoClose?: boolean;
}

export function Reasoning({
  streaming = false,
  open: openProp,
  defaultOpen,
  onOpenChange,
  duration: durationProp,
  autoClose = true,
  className,
  ...props
}: ReasoningProps) {
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen ?? streaming,
    onChange: onOpenChange,
  });
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const startedAt = useRef<number | null>(null);
  const userToggled = useRef(false);

  useEffect(() => {
    if (streaming) {
      startedAt.current ??= Date.now();
      if (!userToggled.current && defaultOpen !== false) setOpen(true);
      return;
    }
    if (startedAt.current === null) return;
    setMeasured(Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    startedAt.current = null;
    if (!autoClose || userToggled.current) return;
    const timer = setTimeout(() => setOpen(false), AUTO_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [streaming, autoClose, defaultOpen, setOpen]);

  const context = useMemo(
    () => ({ streaming, duration: durationProp ?? measured }),
    [streaming, durationProp, measured],
  );

  return (
    <ReasoningContext value={context}>
      <Collapsible.Root
        data-slot="reasoning"
        data-streaming={streaming || undefined}
        open={open}
        onOpenChange={(next) => {
          userToggled.current = true;
          setOpen(next);
        }}
        className={cn("w-full text-sm", className)}
        {...props}
      />
    </ReasoningContext>
  );
}

export interface ReasoningTriggerProps extends WithClassName<Collapsible.Trigger.Props> {
  /** Replaces the default "Thinking" / "Thought for N seconds" label. */
  children?: ReactNode;
}

export function ReasoningTrigger({ className, children, ...props }: ReasoningTriggerProps) {
  const { streaming, duration } = useReasoning();
  let label: ReactNode = "Reasoning";
  if (streaming) label = <span className={shimmerText}>Thinking</span>;
  else if (duration !== undefined) label = `Thought for ${duration} ${duration === 1 ? "second" : "seconds"}`;

  return (
    <Collapsible.Trigger
      data-slot="reasoning-trigger"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md py-1 text-muted-foreground transition-colors hover:text-foreground",
        focusRing,
        className,
      )}
      {...props}
    >
      <BrainIcon aria-hidden="true" className="size-4 shrink-0" />
      <span>{children ?? label}</span>
      <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
    </Collapsible.Trigger>
  );
}

export interface ReasoningContentProps extends WithClassName<Omit<Collapsible.Panel.Props, "children">> {
  /** Reasoning text as markdown. */
  children: string;
}

export function ReasoningContent({ className, children, ...props }: ReasoningContentProps) {
  const { streaming } = useReasoning();
  return (
    <Collapsible.Panel data-slot="reasoning-content" className={collapsiblePanel} {...props}>
      <MessageContent
        streaming={streaming}
        className={cn("mt-2 border-l-2 border-border pl-4 text-sm text-muted-foreground", className)}
      >
        {children}
      </MessageContent>
    </Collapsible.Panel>
  );
}
