// packages/ai-ui/src/components/chat-draft-switcher.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface ChatDraft { id: string; title: string; preview: string; updatedAt?: string }

export interface ChatDraftSwitcherProps {
  drafts: readonly ChatDraft[];
  onOpen: (id: string) => void;
  onDiscard?: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function ChatDraftSwitcher({ drafts, onOpen, onDiscard, pendingIds = [], className }: ChatDraftSwitcherProps) {
  return <ControlPanel slot="chat-draft-switcher" title="Chat drafts" className={className}>
    <FilteredList items={drafts} searchLabel="Search drafts" searchText={(draft) => [draft.title, draft.preview]}
      empty="No saved drafts." noMatches="No drafts match your search." render={(draft) => {
        const pending = pendingIds.includes(draft.id);
        return <>
          <ItemHeading title={draft.title} detail={draft.updatedAt}>
            <ControlAction label="Open" item={draft.title} disabled={pending} onClick={() => onOpen(draft.id)} />
            <ControlAction label="Discard" item={draft.title} disabled={pending} onClick={onDiscard && (() => onDiscard(draft.id))} />
          </ItemHeading>
          <p className="text-sm break-words">{draft.preview}</p>
        </>;
      }} />
  </ControlPanel>;
}
