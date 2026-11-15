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

export function ContextItemOrderEditor({ items, onReorder, className }: ContextItemOrderEditorProps) {
  return <ControlPanel slot="context-item-order-editor" title="Context order" className={className}>
    <OrderedList items={items} label="Context items" itemLabel={(item) => item.title} onReorder={onReorder}
      render={(item) => item.title + (item.tokens === undefined ? " · Estimate unavailable" : " · " + item.tokens + " tokens")} />
    <p className="text-sm text-muted-foreground">{items.reduce((total,item) => total + (item.tokens ?? 0),0)} estimated tokens from known items</p>
  </ControlPanel>;
}
