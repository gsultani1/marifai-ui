// packages/ai-ui/src/components/chat-turn-queue.tsx
"use client";

import { ArrowUpIcon, PencilIcon, XIcon } from "lucide-react";
import { useId } from "react";

import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

export interface QueuedChatTurn {
  id: string;
  text: string;
}

export interface ChatTurnQueueProps {
  /** Turns in send order. */
  turns: readonly QueuedChatTurn[];
  onEdit?: (id: string) => void;
  onMoveNext?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}

export function ChatTurnQueue({ turns, onEdit, onMoveNext, onRemove, className }: ChatTurnQueueProps) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} data-slot="chat-turn-queue" className={cn("min-w-0 rounded-lg border border-border bg-card p-3 text-card-foreground", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={heading} className="text-sm font-semibold">Queued messages</h3>
        <span role="status" className="text-xs tabular-nums text-muted-foreground">{turns.length} queued</span>
      </div>
      {turns.length ? (
        <ol className="mt-2 divide-y divide-border">
          {turns.map((turn, index) => {
            const position = index + 1;
            // Ids come from the position, not the turn id, so they stay valid whatever the ids contain.
            const textId = `${heading}-turn-${position}`;
            return (
              <li key={turn.id} className="flex items-start justify-between gap-2 py-2 last:pb-0">
                <p id={textId} className="min-w-0 text-sm whitespace-pre-wrap break-words">{turn.text}</p>
                {(onMoveNext || onEdit || onRemove) && <div role="group" aria-label={`Message ${position} actions`} className="flex shrink-0 items-center">
                  {onMoveNext && (
                    <Button type="button" size="icon" variant="ghost" aria-label={`Move message ${position} to front`} aria-describedby={textId} disabled={index === 0} onClick={() => onMoveNext(turn.id)}>
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                  )}
                  {onEdit && (
                    <Button type="button" size="icon" variant="ghost" aria-label={`Edit queued message ${position}`} aria-describedby={textId} onClick={() => onEdit(turn.id)}>
                      <PencilIcon aria-hidden="true" />
                    </Button>
                  )}
                  {onRemove && (
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove queued message ${position}`} aria-describedby={textId} onClick={() => onRemove(turn.id)}>
                      <XIcon aria-hidden="true" />
                    </Button>
                  )}
                </div>}
              </li>
            );
          })}
        </ol>
      ) : <p className="mt-2 text-sm text-muted-foreground">No messages waiting to send.</p>}
    </section>
  );
}
