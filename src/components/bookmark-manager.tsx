// packages/ai-ui/src/components/bookmark-manager.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AsyncForm, ChoiceField, ControlAction, ControlPanel, Field, fieldClass, ItemHeading, ItemList, matchesQuery, SearchField } from "../lib/component-controls.js";

export interface BrowserBookmark {
  id: string;
  title: string;
  address: string;
  folderId: string | null;
}

export interface BookmarkFolder { id: string; label: string }

export interface BookmarkManagerProps {
  bookmarks: readonly BrowserBookmark[];
  folders: readonly BookmarkFolder[];
  onOpen?: (id: string) => void;
  onSave?: (id: string, changes: { title: string; folderId: string | null }) => void | Promise<void>;
  onRemove?: (id: string) => void;
  className?: string;
}

function BookmarkEdit({ bookmark, folders, save, close }: {
  bookmark: BrowserBookmark; folders: readonly BookmarkFolder[];
  save: NonNullable<BookmarkManagerProps["onSave"]>; close: () => void;
}) {
  const [title, setTitle] = useState(bookmark.title);
  // A folder that no longer exists shows as "No folder", so the draft starts there too.
  const [folder, setFolder] = useState(bookmark.folderId && folders.some((item) => item.id === bookmark.folderId) ? bookmark.folderId : "");
  return <AsyncForm label={"Edit " + bookmark.title} submitLabel="Save bookmark"
    validate={() => !title.trim() ? "Enter a bookmark name." : folder && !folders.some((item) => item.id === folder) ? "Select an available folder." : undefined}
    onSubmit={async () => { await save(bookmark.id, { title: title.trim(), folderId: folder || null }); close(); }}>
    <Field label="Bookmark name"><input autoFocus className={fieldClass} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
    <ChoiceField label="Folder" value={folder} placeholder="No folder" options={folders.map(({ id, label }) => ({ value: id, label }))} onChange={setFolder} />
    <ControlAction label="Cancel editing" onClick={close} />
  </AsyncForm>;
}

export function BookmarkManager({ bookmarks, folders, onOpen, onSave, onRemove, className }: BookmarkManagerProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocus = useRef<string | null>(null);
  // Closing the editor removes the focused control, so focus goes back to the bookmark's Edit button.
  useEffect(() => {
    if (editing !== null || returnFocus.current === null) return;
    const id = returnFocus.current;
    returnFocus.current = null;
    editButtons.current.get(id)?.focus();
  }, [editing]);
  return <ControlPanel slot="bookmark-manager" title="Bookmarks" className={className}>
    <SearchField label="Search bookmarks" value={query} onChange={setQuery} />
    <div>
      <ItemList items={bookmarks.filter((item) => matchesQuery(query, item.title, item.address, folders.find((folder) => folder.id === item.folderId)?.label))}
        empty={bookmarks.length ? "No matching bookmarks." : "No bookmarks yet."} render={(item) => <>
          <ItemHeading title={item.title} detail={item.address}>
            <ControlAction label="Open" item={item.title} onClick={onOpen && (() => onOpen(item.id))} />
            <ControlAction label="Edit" item={item.title} onClick={onSave && (() => setEditing(item.id))} disabled={editing === item.id}
              ref={(button) => { if (button) editButtons.current.set(item.id, button); else editButtons.current.delete(item.id); }} />
            <ControlAction label="Remove" item={item.title} onClick={onRemove && (() => onRemove(item.id))} />
          </ItemHeading>
          {editing === item.id && onSave && <BookmarkEdit bookmark={item} folders={folders} save={onSave}
            close={() => { returnFocus.current = item.id; setEditing(null); }} />}
        </>} />
    </div>
  </ControlPanel>;
}
