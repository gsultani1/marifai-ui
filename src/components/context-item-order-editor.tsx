// packages/ai-ui/src/components/context-item-order-editor.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { OrderedList } from "../lib/collection-controls.js";
export interface OrderedContextItem { id: string; title: string; tokens?: number }

export interface ContextItemOrderEditorProps {
  items: readonly OrderedContextItem[];
  onReorder: (ids: string[]) => void;
  className?: string;
}

const tokenUnit = (tokens: number) => (tokens === 1 ? "token" : "tokens");

export function ContextItemOrderEditor({ items, onReorder, className }: ContextItemOrderEditorProps) {
  const total = items.reduce((sum, item) => sum + (item.tokens ?? 0), 0);
  return <ControlPanel slot="context-item-order-editor" title="Context order" className={className}>
    <OrderedList items={items} label="Context items" itemLabel={(item) => item.title} onReorder={onReorder}
      render={(item) => item.title + (item.tokens === undefined ? " · Estimate unavailable" : " · " + item.tokens + " " + tokenUnit(item.tokens))} />
    {items.length > 0 && <p className="text-sm text-muted-foreground">{total} estimated {tokenUnit(total)} from known items</p>}
  </ControlPanel>;
}
