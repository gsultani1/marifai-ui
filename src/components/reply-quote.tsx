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
    <blockquote className="border-s-2 border-border ps-2 text-sm break-words">
      <p className="font-medium">{author}</p>
      <p className="whitespace-pre-wrap">{quote}</p>
    </blockquote>
    <div className="flex flex-wrap gap-2">
      <ControlAction label="Open original message" onClick={onOpen && (() => onOpen(messageId))} />
      <ControlAction label="Clear quote" onClick={onClear} />
    </div>
  </ControlPanel>;
}
