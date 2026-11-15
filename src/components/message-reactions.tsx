// packages/ai-ui/src/components/message-reactions.tsx
"use client";

import type { ComponentProps } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { findEmoji } from "../lib/emoji.js";
import { EmojiPicker } from "./emoji-picker.js";

export interface Reaction {
  emoji: string;
  count: number;
  /** The current user reacted with this emoji. */
  reacted?: boolean;
  /** Names of people who reacted, shown on hover. */
  users?: string[];
}

export interface MessageReactionsProps extends Omit<ComponentProps<"div">, "children" | "onToggle"> {
  reactions: Reaction[];
  /** Adds or removes the current user's reaction. */
  onToggle: (emoji: string) => void;
  /** Shows an "Add reaction" picker; set false to hide it. */
  allowAdd?: boolean;
  /** localStorage prefix shared with EmojiPicker for recent emoji. */
  storageKey?: string | false;
}

function describe({ emoji, count, reacted, users }: Reaction): string {
  const name = findEmoji(emoji)?.name ?? emoji;
  const who = users?.length ? `: ${users.slice(0, 10).join(", ")}${users.length > 10 ? ` and ${users.length - 10} more` : ""}` : "";
  return `${name}, ${count} ${count === 1 ? "reaction" : "reactions"}${reacted ? ", including you" : ""}${who}`;
}

/** Emoji reaction chips under a message: click to toggle your own, or add a new one from the picker. */
export function MessageReactions({ reactions, onToggle, allowAdd = true, storageKey, className, ...props }: MessageReactionsProps) {
  const shown = reactions.filter((reaction) => reaction.count > 0);
  if (!shown.length && !allowAdd) return null;

  return (
    <div role="group" aria-label="Reactions" data-slot="message-reactions" className={cn("flex flex-wrap items-center gap-1", className)} {...props}>
      {shown.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          aria-pressed={Boolean(reaction.reacted)}
          aria-label={describe(reaction)}
          title={describe(reaction)}
          onClick={() => onToggle(reaction.emoji)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full border border-border bg-background px-2 text-xs font-medium tabular-nums hover:bg-accent aria-pressed:border-ring/60 aria-pressed:bg-accent",
            focusRing,
          )}
        >
          <span aria-hidden="true" className="text-sm leading-none">
            {reaction.emoji}
          </span>
          <span aria-hidden="true">{reaction.count}</span>
        </button>
      ))}
      {allowAdd && <EmojiPicker triggerLabel="Add reaction" onSelect={onToggle} triggerClassName="size-7 rounded-full" {...(storageKey !== undefined ? { storageKey } : {})} />}
    </div>
  );
}

/** Applies a toggle to a reaction list: adds the user's reaction or removes it, dropping empty entries. */
export function toggleReaction(reactions: Reaction[], emoji: string, userName?: string): Reaction[] {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) return [...reactions, { emoji, count: 1, reacted: true, ...(userName ? { users: [userName] } : {}) }];
  return reactions
    .map((reaction) => {
      if (reaction.emoji !== emoji) return reaction;
      const reacted = !reaction.reacted;
      const users = userName && reaction.users ? (reacted ? [...reaction.users, userName] : reaction.users.filter((name) => name !== userName)) : reaction.users;
      return { ...reaction, reacted, count: reaction.count + (reacted ? 1 : -1), ...(users ? { users } : {}) };
    })
    .filter((reaction) => reaction.count > 0);
}
