// packages/ai-ui/src/components/message.tsx
"use client";

import { Avatar } from "@base-ui/react/avatar";
import { Toolbar } from "@base-ui/react/toolbar";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  CheckIcon,
  CircleAlertIcon,
  CopyIcon,
  GitBranchIcon,
  PencilIcon,
  RefreshCwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton, tooltipPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";
import { usePortalContainer } from "../lib/portal.js";
import type { WithClassName } from "../lib/types.js";

export type MessageRole = "user" | "assistant" | "system";

const ROLE_LABELS: Record<MessageRole, string> = {
  user: "User message",
  assistant: "Assistant message",
  system: "System message",
};

export interface MessageProps extends ComponentProps<"article"> {
  from: MessageRole;
}

export function Message({ from, className, ...props }: MessageProps) {
  return (
    <article
      data-slot="message"
      data-role={from}
      aria-label={ROLE_LABELS[from]}
      className={cn(
        "group/message flex w-full items-start gap-3",
        from === "user" && "flex-row-reverse",
        from === "system" && "justify-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface MessageAvatarProps extends WithClassName<Omit<Avatar.Root.Props, "children">> {
  name: string;
  src?: string | undefined;
  fallback?: ReactNode;
}

export function MessageAvatar({ name, src, fallback, className, ...props }: MessageAvatarProps) {
  return (
    <Avatar.Root
      role="img"
      aria-label={name}
      data-slot="message-avatar"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground select-none [&_svg]:size-4",
        className,
      )}
      {...props}
    >
      {src && <Avatar.Image src={src} alt="" className="size-full object-cover" />}
      <Avatar.Fallback aria-hidden="true">{fallback ?? initials(name)}</Avatar.Fallback>
    </Avatar.Root>
  );
}


export function MessageBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-body"
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2",
        "group-data-[role=user]/message:items-end",
        className,
      )}
      {...props}
    />
  );
}

export function MessageBubble({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-bubble"
      className={cn(
        "min-w-0 max-w-full",
        "group-data-[role=user]/message:max-w-[85%] group-data-[role=user]/message:rounded-2xl group-data-[role=user]/message:bg-secondary group-data-[role=user]/message:px-4 group-data-[role=user]/message:py-2.5 group-data-[role=user]/message:text-secondary-foreground",
        "group-data-[role=system]/message:rounded-lg group-data-[role=system]/message:border group-data-[role=system]/message:border-border group-data-[role=system]/message:px-3 group-data-[role=system]/message:py-2",
        className,
      )}
      {...props}
    />
  );
}

export function MessageActions({ className, ...props }: WithClassName<Toolbar.Root.Props>) {
  return (
    <Toolbar.Root
      aria-label="Message actions"
      data-slot="message-actions"
      className={cn("-ml-1.5 flex items-center gap-0.5 group-data-[role=user]/message:-mr-1.5", className)}
      {...props}
    />
  );
}

export interface MessageActionProps extends WithClassName<Toolbar.Button.Props> {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  tooltip?: boolean;
}

export function MessageAction({ label, tooltip = true, className, ...props }: MessageActionProps) {
  const container = usePortalContainer();
  const button = (
    <Toolbar.Button
      aria-label={label}
      data-slot="message-action"
      className={cn(iconButton, focusRing, className)}
      {...props}
    />
  );
  if (!tooltip) return button;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={button} />
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner sideOffset={6} className="z-50">
          <Tooltip.Popup className={tooltipPopup}>
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type PresetActionProps = Omit<MessageActionProps, "label"> & { label?: string };

export interface MessageCopyActionProps extends Omit<PresetActionProps, "onClick"> {
  text: string;
  onCopyError?: (error: unknown) => void;
}

export function MessageCopyAction({ text, label = "Copy", onCopyError, children, ...props }: MessageCopyActionProps) {
  const { status, copy } = useCopyToClipboard({ onError: onCopyError });
  let icon = <CopyIcon aria-hidden="true" />;
  if (status === "copied") icon = <CheckIcon aria-hidden="true" />;
  if (status === "error") icon = <CircleAlertIcon aria-hidden="true" className="text-destructive" />;
  return (
    <MessageAction
      label={status === "copied" ? "Copied" : status === "error" ? "Copy failed" : label}
      onClick={() => void copy(text)}
      {...props}
    >
      {children ?? icon}
      <span aria-live="polite" className="sr-only">
        {status === "copied" ? "Copied to clipboard" : status === "error" ? "Could not copy to the clipboard" : ""}
      </span>
    </MessageAction>
  );
}

export function MessageRegenerateAction({ label = "Regenerate", children, ...props }: PresetActionProps) {
  return (
    <MessageAction label={label} {...props}>
      {children ?? <RefreshCwIcon aria-hidden="true" />}
    </MessageAction>
  );
}

export function MessageEditAction({ label = "Edit", children, ...props }: PresetActionProps) {
  return (
    <MessageAction label={label} {...props}>
      {children ?? <PencilIcon aria-hidden="true" />}
    </MessageAction>
  );
}

export function MessageBranchAction({ label = "Branch from here", children, ...props }: PresetActionProps) {
  return (
    <MessageAction label={label} {...props}>
      {children ?? <GitBranchIcon aria-hidden="true" />}
    </MessageAction>
  );
}

export type MessageFeedbackValue = "up" | "down" | null;

export interface MessageFeedbackActionsProps {
  value: MessageFeedbackValue;
  onValueChange: (value: MessageFeedbackValue) => void;
  upLabel?: string;
  downLabel?: string;
}

/** Thumbs up and down toggles; pressing the active one clears it. */
export function MessageFeedbackActions({
  value,
  onValueChange,
  upLabel = "Good response",
  downLabel = "Bad response",
}: MessageFeedbackActionsProps) {
  return (
    <>
      <MessageAction
        label={upLabel}
        aria-pressed={value === "up"}
        onClick={() => onValueChange(value === "up" ? null : "up")}
        className="aria-pressed:text-foreground"
      >
        <ThumbsUpIcon aria-hidden="true" className={cn(value === "up" && "fill-current")} />
      </MessageAction>
      <MessageAction
        label={downLabel}
        aria-pressed={value === "down"}
        onClick={() => onValueChange(value === "down" ? null : "down")}
        className="aria-pressed:text-foreground"
      >
        <ThumbsDownIcon aria-hidden="true" className={cn(value === "down" && "fill-current")} />
      </MessageAction>
    </>
  );
}
