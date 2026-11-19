// packages/ai-ui/src/components/conversation-bookmarks.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ConversationBookmark { id: string; messageId: string; title: string; excerpt?: string }

export interface ConversationBookmarksProps {
  bookmarks: readonly ConversationBookmark[];
  onOpen: (messageId: string) => void;
  onRemove?: (bookmarkId: string) => void;
  className?: string;
}

export function ConversationBookmarks({ bookmarks, onOpen, onRemove, className }: ConversationBookmarksProps) {
  return <ControlPanel slot="conversation-bookmarks" title="Conversation bookmarks" className={className}>
    <ItemList items={bookmarks} empty="No saved messages." render={(item) => <ItemHeading title={item.title} detail={item.excerpt}>
      <ControlAction label="Open message" item={item.title} onClick={() => onOpen(item.messageId)} />
      <ControlAction label="Remove bookmark" item={item.title} onClick={onRemove && (() => onRemove(item.id))} />
    </ItemHeading>} />
  </ControlPanel>;
}
