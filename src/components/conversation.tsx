// packages/ai-ui/src/components/conversation.tsx
"use client";

import { ArrowDownIcon } from "lucide-react";
import { type ComponentProps, createContext, type ReactNode, use } from "react";

import { useStickToBottom, type UseStickToBottomResult } from "../hooks/use-stick-to-bottom.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

const ConversationContext = createContext<UseStickToBottomResult | null>(null);

export function useConversation(): UseStickToBottomResult {
  const context = use(ConversationContext);
  if (!context) throw new Error("Conversation parts must be rendered inside <Conversation>.");
  return context;
}

export interface ConversationProps extends ComponentProps<"div"> {
  /** Distance in pixels from the bottom that still counts as following the output. */
  threshold?: number;
  /** Starts pinned to the latest message. Pass false to keep a restored scroll position. */
  initialFollow?: boolean;
}

export function Conversation({ threshold, initialFollow, className, ...props }: ConversationProps) {
  const state = useStickToBottom({ threshold, initialFollow });
  return (
    <ConversationContext value={state}>
      <div
        data-slot="conversation"
        className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
        {...props}
      />
    </ConversationContext>
  );
}

export interface ConversationContentProps extends ComponentProps<"div"> {
  /** Classes for the inner wrapper that holds the messages. */
  contentClassName?: string;
}

export function ConversationContent({ contentClassName, className, children, ...props }: ConversationContentProps) {
  const { scrollRef, contentRef } = useConversation();
  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      data-slot="conversation-content"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
      {...props}
    >
      <div ref={contentRef} className={cn("flex flex-col gap-6 p-4", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function ConversationScrollButton({ className, onClick, children, ...props }: ComponentProps<"button">) {
  const { isAtBottom, scrollToBottom, scrollElement } = useConversation();
  if (isAtBottom) return null;
  return (
    <button
      type="button"
      aria-label="Scroll to latest message"
      data-slot="conversation-scroll-button"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        scrollToBottom();
        scrollElement?.focus({ preventScroll: true });
      }}
      className={cn(
        "absolute bottom-4 left-1/2 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors hover:bg-accent [&_svg]:size-4",
        focusRing,
        className,
      )}
      {...props}
    >
      {children ?? <ArrowDownIcon aria-hidden="true" />}
    </button>
  );
}

export interface ConversationEmptyStateProps extends Omit<ComponentProps<"div">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

export function ConversationEmptyState({
  title = "How can I help?",
  description,
  icon,
  className,
  children,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      data-slot="conversation-empty-state"
      className={cn("flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center", className)}
      {...props}
    >
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}
