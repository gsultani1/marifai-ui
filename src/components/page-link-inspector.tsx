// packages/ai-ui/src/components/page-link-inspector.tsx
"use client";

import { useState } from "react";
import { ControlAction, ControlPanel, ItemHeading, ItemList, matchesQuery, SearchField } from "../lib/component-controls.js";

export interface InspectedPageLink { id: string; label: string; address: string; domain: string }

export interface PageLinkInspectorProps {
  links: readonly InspectedPageLink[];
  onInspect: (id: string) => void;
  className?: string;
}

export function PageLinkInspector({ links, onInspect, className }: PageLinkInspectorProps) {
  const [query, setQuery] = useState("");
  const groups = new Map<string, InspectedPageLink[]>();
  for (const link of links) {
    if (!matchesQuery(query, link.label, link.address, link.domain)) continue;
    const group = groups.get(link.domain) ?? [];
    group.push(link);
    groups.set(link.domain, group);
  }
  return <ControlPanel slot="page-link-inspector" title="Page links" className={className}>
    <SearchField label="Search links" value={query} onChange={setQuery} />
    {groups.size ? [...groups].map(([domain, group]) => <details key={domain} open className="space-y-2">
      <summary className="cursor-pointer break-all text-sm font-medium">{domain} · {group.length}</summary>
      <ItemList items={group} empty="No links." render={(item) => <ItemHeading title={item.label} detail={item.address}>
        <ControlAction label="Inspect" item={item.label} onClick={() => onInspect(item.id)} />
      </ItemHeading>} />
    </details>) : <p className="text-sm text-muted-foreground">No matching links.</p>}
  </ControlPanel>;
}
