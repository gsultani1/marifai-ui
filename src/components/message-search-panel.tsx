// packages/ai-ui/src/components/message-search-panel.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList, SearchField } from "../lib/component-controls.js";

export interface MessageSearchHit { id: string; conversation: string; excerpt: string; author?: string }

export interface MessageSearchPanelProps {
  results: readonly MessageSearchHit[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpen: (id: string) => void;
  pending?: boolean;
  error?: string;
  className?: string;
}

export function MessageSearchPanel({ results, query, onQueryChange, onOpen, pending, error, className }: MessageSearchPanelProps) {
  return <ControlPanel slot="message-search-panel" title="Search messages" className={className}>
    <SearchField label="Search messages" value={query} onChange={onQueryChange} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {pending && <p role="status" className="text-sm">Searching…</p>}
    {(!pending || results.length > 0) && <ItemList items={results} empty="No matching messages." render={(item) => <>
      <ItemHeading title={item.conversation} detail={item.author}>
        <ControlAction label="Open message" item={item.conversation} onClick={() => onOpen(item.id)} />
      </ItemHeading>
      <p className="text-sm break-words">{item.excerpt}</p>
    </>} />}
  </ControlPanel>;
}
