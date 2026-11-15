// packages/ai-ui/src/components/outbox.tsx
"use client";

import { PencilIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { DELIVERY_STATES, type DeliveryState, DeliveryStatus } from "./delivery-status.js";
import { MessageEditor } from "./message-editor.js";

export interface OutboxItem {
  id: string;
  text: string;
  state: DeliveryState;
  createdAt?: Date | string | number;
  /** Why it needs attention. */
  error?: string;
}

export interface OutboxProps {
  items: OutboxItem[];
  /** Replaces the text of a queued message. */
  onEdit?: (id: string, text: string) => void | Promise<void>;
  /** Removes a queued or failed message without sending it. */
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onRetryAll?: () => void;
  /** Shown above the list, e.g. "Offline. Messages send when you reconnect." */
  notice?: ReactNode;
  title?: string;
  locale?: string;
  className?: string;
}

const ORDER = (state: DeliveryState) => (DELIVERY_STATES[state].attention ? 0 : state === "sending" || state === "working" || state === "retrying" ? 1 : state === "queued" || state === "delayed" ? 2 : 3);

/**
 * Messages waiting to go out, for offline use or while the assistant is
 * busy: failures needing attention first, then in-flight, queued and
 * delivered. Queued messages can be edited or cancelled; failed ones retried.
 */
export function Outbox({ items, onEdit, onCancel, onRetry, onRetryAll, notice, title = "Outbox", locale, className }: OutboxProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const id = useId();
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => ORDER(a.state) - ORDER(b.state));
  const attention = items.filter((item) => DELIVERY_STATES[item.state].attention).length;
  const queued = items.filter((item) => item.state === "queued" || item.state === "delayed").length;
  const summary = [queued ? `${queued} queued` : "", attention ? `${attention} need${attention === 1 ? "s" : ""} attention` : ""].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby={`${id}-title`} data-slot="outbox" className={cn(card, "flex flex-col gap-2 p-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        {summary && <span className="text-xs text-muted-foreground">{summary}</span>}
        {onRetryAll && attention > 1 && (
          <button type="button" onClick={onRetryAll} className={cn(button, buttonVariants.outline, "ml-auto h-7 px-2 text-xs", focusRing)}>
            <RefreshCwIcon aria-hidden="true" />
            Retry all
          </button>
        )}
      </div>
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {sorted.map((item) => {
          const meta = DELIVERY_STATES[item.state];
          const editable = item.state === "queued" || item.state === "delayed";
          const textId = `${id}-text-${item.id}`;
          return (
            <li key={item.id} data-state={item.state} className={cn("flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0", item.state === "delivered" && "[&>p]:text-muted-foreground")}>
              {editing === item.id && onEdit ? (
                <MessageEditor
                  label="Edit queued message"
                  defaultValue={item.text}
                  onCancel={() => setEditing(null)}
                  onSave={async (text) => {
                    await onEdit(item.id, text);
                    setEditing(null);
                  }}
                />
              ) : (
                <p id={textId} className="line-clamp-3 break-words whitespace-pre-wrap">
                  {item.text}
                </p>
              )}
              {editing !== item.id && (
                <div className="flex flex-wrap items-center gap-1">
                  <DeliveryStatus state={item.state} {...(item.createdAt !== undefined ? { at: item.createdAt } : {})} {...(item.error ? { detail: item.error } : {})} {...(locale ? { locale } : {})} className="mr-auto" />
                  {editable && onEdit && (
                    <button type="button" aria-describedby={textId} onClick={() => setEditing(item.id)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                      <PencilIcon aria-hidden="true" />
                      Edit
                    </button>
                  )}
                  {meta.attention && onRetry && (
                    <button type="button" aria-describedby={textId} onClick={() => onRetry(item.id)} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                      <RefreshCwIcon aria-hidden="true" />
                      Retry
                    </button>
                  )}
                  {(editable || meta.attention) && onCancel && (
                    <button type="button" aria-describedby={textId} onClick={() => onCancel(item.id)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                      <XIcon aria-hidden="true" />
                      {meta.attention ? "Discard" : "Cancel"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
