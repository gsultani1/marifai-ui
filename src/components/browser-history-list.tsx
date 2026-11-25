// packages/ai-ui/src/components/browser-history-list.tsx
"use client";

import { useState } from "react";
import { ControlAction, ControlPanel, ItemHeading, ItemList, matchesQuery, SearchField } from "../lib/component-controls.js";

export interface BrowserVisit {
  id: string;
  title: string;
  address: string;
  visitedAt: string;
}

export interface BrowserHistoryListProps {
  visits: readonly BrowserVisit[];
  onOpen: (id: string) => void;
  className?: string;
}

export function BrowserHistoryList({ visits, onOpen, className }: BrowserHistoryListProps) {
  const [query, setQuery] = useState("");
  return <ControlPanel slot="browser-history-list" title="Browser history" className={className}>
    <SearchField label="Search visits" value={query} onChange={setQuery} />
    <ItemList items={visits.filter((visit) => matchesQuery(query, visit.title, visit.address))} empty={visits.length ? "No matching visits." : "No browsing history."} render={(visit) =>
      <ItemHeading title={visit.title} detail={visit.address + " · " + visit.visitedAt}>
        <ControlAction label="Open" item={visit.title} onClick={() => onOpen(visit.id)} />
      </ItemHeading>
    } />
  </ControlPanel>;
}
