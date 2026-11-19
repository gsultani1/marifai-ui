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
  const searched = query.trim() !== "";
  // Results arrive while focus stays in the search box, so the outcome is announced in a status that stays mounted.
  const summary = pending ? "Searching…"
    : error || !searched ? ""
    : results.length === 0 ? "No matching messages."
    : results.length === 1 ? "1 matching message" : results.length + " matching messages";
  return <ControlPanel slot="message-search-panel" title="Search messages" className={className}>
    <SearchField label="Search messages" value={query} onChange={onQueryChange} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p role="status" className="text-sm">{summary}</p>
    {results.length > 0
      ? <ItemList items={results} empty="No matching messages." render={(item) => <>
        <ItemHeading title={item.conversation} detail={item.author}>
          <ControlAction label="Open message" item={(item.author ? "from " + item.author + " " : "") + "in " + item.conversation} onClick={() => onOpen(item.id)} />
        </ItemHeading>
        <p className="text-sm break-words">{item.excerpt}</p>
      </>} />
      : !searched && !pending && !error && <p className="text-sm text-muted-foreground">Enter a word or phrase to search your conversations.</p>}
  </ControlPanel>;
}
