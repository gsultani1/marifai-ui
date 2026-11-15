// packages/ai-ui/src/components/bookmark-manager.tsx
"use client";

import { useState } from "react";
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
  const [folder, setFolder] = useState(bookmark.folderId ?? "");
  return <AsyncForm label={"Edit " + bookmark.title} submitLabel="Save bookmark"
    validate={() => !title.trim() ? "Enter a bookmark name." : folder && !folders.some((item) => item.id === folder) ? "Select an available folder." : undefined}
    onSubmit={async () => { await save(bookmark.id, { title: title.trim(), folderId: folder || null }); close(); }}>
    <Field label="Bookmark name"><input className={fieldClass} value={title} onChange={(event) => setTitle(event.currentTarget.value)} /></Field>
    <ChoiceField label="Folder" value={folder} placeholder="No folder" options={folders.map(({ id, label }) => ({ value: id, label }))} onChange={setFolder} />
    <ControlAction label="Cancel editing" onClick={close} />
  </AsyncForm>;
}

export function BookmarkManager({ bookmarks, folders, onOpen, onSave, onRemove, className }: BookmarkManagerProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  return <ControlPanel slot="bookmark-manager" title="Bookmarks" className={className}>
    <SearchField label="Search bookmarks" value={query} onChange={setQuery} />
    <ItemList items={bookmarks.filter((item) => matchesQuery(query, item.title, item.address, folders.find((folder) => folder.id === item.folderId)?.label))}
      empty="No matching bookmarks." render={(item) => <>
        <ItemHeading title={item.title} detail={item.address}>
          <ControlAction label="Open" item={item.title} onClick={onOpen && (() => onOpen(item.id))} />
          <ControlAction label="Edit" item={item.title} onClick={onSave && (() => setEditing(item.id))} disabled={editing === item.id} />
          <ControlAction label="Remove" item={item.title} onClick={onRemove && (() => onRemove(item.id))} />
        </ItemHeading>
        {editing === item.id && onSave && <BookmarkEdit bookmark={item} folders={folders} save={onSave} close={() => setEditing(null)} />}
      </>} />
  </ControlPanel>;
}
