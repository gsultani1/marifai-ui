// packages/ai-ui/src/components/thread-replies.tsx
"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDownIcon, LoaderCircleIcon, SendHorizontalIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";

import { useAutosizeTextarea } from "../hooks/use-autosize-textarea.js";
import { useControllableState } from "../hooks/use-controllable-state.js";
import { useNow } from "../hooks/use-now.js";
import { collapsibleChevron, collapsiblePanel, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { toDate } from "../lib/dates.js";
import { formatRelativeTime } from "../lib/format.js";
import { PresenceAvatars, type PresenceUser } from "./presence-avatars.js";

export interface ThreadReplyBoxProps {
  onReply: (text: string) => void | Promise<void>;
  label?: string;
  placeholder?: string;
  className?: string;
}

/** Compact reply field: Enter sends, Shift+Enter adds a line, and the text clears once sent. */
export function ThreadReplyBox({ onReply, label = "Reply in thread", placeholder = "Reply…", className }: ThreadReplyBoxProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  useAutosizeTextarea(ref, value, { minRows: 1, maxRows: 6 });

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onReply(text);
      setValue("");
    } catch {
      setError("Couldn't send the reply. Try again.");
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  };

  return (
    <form onSubmit={(event) => void send(event)} className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-end gap-1 rounded-lg border border-input bg-background p-1 focus-within:ring-2 focus-within:ring-ring">
        <label htmlFor={`${id}-reply`} className="sr-only">
          {label}
        </label>
        <textarea
          ref={ref}
          id={`${id}-reply`}
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-8 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" aria-label="Send reply" disabled={!value.trim() || busy} className={cn(iconButton, "text-foreground", focusRing)}>
          {busy ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <SendHorizontalIcon aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

export interface ThreadRepliesProps {
  count: number;
  participants?: PresenceUser[];
  lastReplyAt?: Date | string | number;
  /** Replies the user hasn't seen. */
  unread?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Adds a reply box under the replies. */
  onReply?: (text: string) => void | Promise<void>;
  /** Replies are loading after the thread opens. */
  loading?: boolean;
  /** The rendered replies. */
  children?: ReactNode;
  locale?: string;
  className?: string;
}

/**
 * Collapsed thread under a message: participants, reply count, last
 * activity and unread count; expands to the replies and a reply box.
 */
export function ThreadReplies({ count, participants = [], lastReplyAt, unread = 0, open: openProp, defaultOpen = false, onOpenChange, onReply, loading = false, children, locale, className }: ThreadRepliesProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const now = useNow(60_000, lastReplyAt !== undefined);
  const id = useId();
  const replies = count === 0 ? "Reply" : `${count} ${count === 1 ? "reply" : "replies"}`;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} data-slot="thread-replies" className={cn("flex flex-col gap-2", className)}>
      <Collapsible.Trigger className={cn("group inline-flex max-w-full items-center gap-2 self-start rounded-md px-1.5 py-1 text-xs hover:bg-accent", focusRing)}>
        {participants.length > 0 && <PresenceAvatars aria-hidden="true" users={participants} max={3} className="[&>*]:size-5 [&>*]:text-[0.5625rem]" />}
        <span className="font-medium text-foreground">{replies}</span>
        {unread > 0 && <span className="rounded-full bg-primary px-1.5 font-medium text-primary-foreground">{unread} new</span>}
        {lastReplyAt !== undefined && count > 0 && <span className="truncate text-muted-foreground">Last reply {formatRelativeTime(toDate(lastReplyAt), now, locale)}</span>}
        {participants.length > 0 && <span className="sr-only">from {participants.map((user) => user.name).join(", ")}</span>}
        <ChevronDownIcon aria-hidden="true" className={collapsibleChevron} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={collapsiblePanel}>
        <div role="region" aria-label="Thread" id={`${id}-thread`} className="ml-3 flex flex-col gap-3 border-l-2 border-border pr-1 pb-1 pl-3">
          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon aria-hidden="true" className="size-4 motion-safe:animate-spin" />
              Loading replies
            </p>
          ) : (
            children
          )}
          {onReply && <ThreadReplyBox onReply={onReply} />}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
