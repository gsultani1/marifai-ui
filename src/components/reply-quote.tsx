// packages/ai-ui/src/components/reply-quote.tsx
"use client";

import { ControlAction, ControlPanel } from "../lib/component-controls.js";


export interface ReplyQuoteProps {
  messageId: string;
  author: string;
  quote: string;
  onOpen?: (id: string) => void;
  onClear?: () => void;
  className?: string;
}

export function ReplyQuote({ messageId, author, quote, onOpen, onClear, className }: ReplyQuoteProps) {
  return <ControlPanel slot="reply-quote" title="Replying to" className={className}>
    {/* The attribution sits outside the blockquote so it is not read as part of the quoted text. */}
    <figure className="border-s-2 border-border ps-2 text-sm break-words">
      <figcaption className="font-medium">{author}</figcaption>
      <blockquote className="whitespace-pre-wrap">{quote}</blockquote>
    </figure>
    {(onOpen || onClear) && <div className="flex flex-wrap gap-2">
      <ControlAction label="Open original message" onClick={onOpen && (() => onOpen(messageId))} />
      <ControlAction label="Clear quote" onClick={onClear} />
    </div>}
  </ControlPanel>;
}
