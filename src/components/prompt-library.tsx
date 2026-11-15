// packages/ai-ui/src/components/prompt-library.tsx
"use client";

import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";

import { badge, button, buttonVariants, card, focusRing, iconButton, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { ConfirmDialog } from "./confirm-dialog.js";
import { FilterChips } from "./filter-chips.js";
import { SearchInput } from "./search-input.js";

export interface SavedPrompt {
  id: string;
  title: string;
  /** Text with `{{variable}}` placeholders filled in before use. */
  body: string;
  tags?: string[];
  favorite?: boolean;
  updatedAt?: number;
}

const VARIABLE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Placeholder names in a prompt, in order of first appearance. */
export function promptVariables(body: string): string[] {
  return [...new Set([...body.matchAll(VARIABLE)].map((match) => match[1]!))];
}

/** Replaces `{{name}}` placeholders with values; missing values leave the placeholder in place. */
export function fillPrompt(body: string, values: Record<string, string>): string {
  return body.replace(VARIABLE, (match, name: string) => (values[name]?.trim() ? values[name]! : match));
}

export interface PromptLibraryProps {
  prompts: SavedPrompt[];
  /** Receives the prompt with its variables filled. */
  onUse: (text: string, prompt: SavedPrompt) => void;
  /** Creates (no id match) or updates a prompt. */
  onSave?: (prompt: SavedPrompt) => void | Promise<void>;
  onDelete?: (id: string) => void;
  onFavoriteChange?: (id: string, favorite: boolean) => void;
  className?: string;
}

type Draft = { id: string; title: string; body: string; tags: string };

function PromptEditor({ draft, onCancel, onSave }: { draft: Draft; onCancel: () => void; onSave: (draft: Draft) => void | Promise<void> }) {
  const [value, setValue] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.title.trim() || !value.body.trim()) {
      setError("Give the prompt a title and some text.");
      return;
    }
    try {
      await onSave(value);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn't save the prompt.");
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} aria-label={draft.title ? `Edit ${draft.title}` : "New prompt"} className={cn(card, "flex flex-col gap-2 p-3")}>
      <label htmlFor={`${id}-title`} className="text-xs font-medium">
        Title
      </label>
      <input id={`${id}-title`} value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} className={cn(input, focusRing, "focus-visible:ring-offset-0")} />
      <label htmlFor={`${id}-body`} className="text-xs font-medium">
        Prompt
      </label>
      <textarea
        id={`${id}-body`}
        aria-describedby={`${id}-hint`}
        rows={5}
        value={value.body}
        onChange={(event) => setValue({ ...value, body: event.target.value })}
        className={cn("w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs", focusRing, "focus-visible:ring-offset-0")}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Write {"{{name}}"} where a value goes; it is asked for when the prompt is used.
      </p>
      <label htmlFor={`${id}-tags`} className="text-xs font-medium">
        Tags, separated by commas
      </label>
      <input id={`${id}-tags`} value={value.tags} onChange={(event) => setValue({ ...value, tags: event.target.value })} className={cn(input, focusRing, "focus-visible:ring-offset-0")} />
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={cn(button, buttonVariants.ghost, focusRing)}>
          Cancel
        </button>
        <button type="submit" className={cn(button, buttonVariants.primary, focusRing)}>
          Save prompt
        </button>
      </div>
    </form>
  );
}

function PromptRunner({ prompt, onUse, onClose }: { prompt: SavedPrompt; onUse: (text: string) => void; onClose: () => void }) {
  const variables = promptVariables(prompt.body);
  const [values, setValues] = useState<Record<string, string>>({});
  const id = useId();
  const missing = variables.filter((name) => !values[name]?.trim());

  return (
    <form
      aria-label={`Use ${prompt.title}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!missing.length) onUse(fillPrompt(prompt.body, values));
      }}
      className="flex flex-col gap-2 border-t border-border px-3 py-2"
    >
      {variables.map((name, index) => (
        <div key={name} className="flex flex-col gap-1">
          <label htmlFor={`${id}-${name}`} className="font-mono text-xs font-medium">
            {name}
          </label>
          <input id={`${id}-${name}`} autoFocus={index === 0} value={values[name] ?? ""} onChange={(event) => setValues({ ...values, [name]: event.target.value })} className={cn(input, "h-8", focusRing, "focus-visible:ring-offset-0")} />
        </div>
      ))}
      <pre aria-label="Preview" tabIndex={0} className={cn("max-h-40 overflow-auto rounded-md bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap", focusRing)}>
        {fillPrompt(prompt.body, values)}
      </pre>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
          Close
        </button>
        <button type="submit" disabled={missing.length > 0} className={cn(button, buttonVariants.primary, "h-7 px-2 text-xs", focusRing)}>
          Use prompt
        </button>
      </div>
    </form>
  );
}

/**
 * Saved prompts: search, tag filters and favorites first; Use fills any
 * `{{variables}}` with a live preview; prompts can be created, edited and
 * deleted after confirmation.
 */
export function PromptLibrary({ prompts, onUse, onSave, onDelete, onFavoriteChange, className }: PromptLibraryProps) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [using, setUsing] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<SavedPrompt | null>(null);
  const id = useId();
  const allTags = useMemo(() => [...new Set(prompts.flatMap((prompt) => prompt.tags ?? []))].sort(), [prompts]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return prompts
      .filter((prompt) => (!tags.length || tags.every((tag) => prompt.tags?.includes(tag))) && (!needle || `${prompt.title}\n${prompt.body}\n${(prompt.tags ?? []).join(" ")}`.toLowerCase().includes(needle)))
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.title.localeCompare(b.title));
  }, [prompts, query, tags]);

  const save = async (draft: Draft) => {
    const existing = prompts.find((prompt) => prompt.id === draft.id);
    await onSave?.({
      ...existing,
      id: draft.id,
      title: draft.title.trim(),
      body: draft.body,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setEditing(null);
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="prompt-library" className={cn("flex flex-col gap-3 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${id}-title`} className="font-medium">
          Prompt library
        </h3>
        {onSave && !editing && (
          <button type="button" onClick={(event) => setEditing({ id: `prompt-${Math.round(event.timeStamp).toString(36)}`, title: "", body: "", tags: "" })} className={cn(button, buttonVariants.outline, "ml-auto h-7 px-2 text-xs", focusRing)}>
            <PlusIcon aria-hidden="true" />
            New prompt
          </button>
        )}
      </div>
      {editing && <PromptEditor draft={editing} onCancel={() => setEditing(null)} onSave={save} />}
      <SearchInput label="Search prompts" value={query} onValueChange={setQuery} placeholder="Search prompts" resultCount={shown.length} />
      {allTags.length > 0 && <FilterChips label="Tags" value={tags} onValueChange={setTags} options={allTags.map((tag) => ({ value: tag, label: tag, count: prompts.filter((prompt) => prompt.tags?.includes(tag)).length }))} />}
      <ul className="flex flex-col gap-2">
        {shown.map((prompt) => (
          <li key={prompt.id} className={cn(card, "flex flex-col")}>
            <div className="flex items-start gap-2 px-3 py-2">
              {onFavoriteChange && (
                <button type="button" aria-label={`Favorite ${prompt.title}`} aria-pressed={Boolean(prompt.favorite)} onClick={() => onFavoriteChange(prompt.id, !prompt.favorite)} className={cn(iconButton, "size-7 aria-pressed:text-warning", focusRing)}>
                  <StarIcon aria-hidden="true" className={cn(prompt.favorite && "fill-current")} />
                </button>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{prompt.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{prompt.body}</span>
                {(prompt.tags?.length ?? 0) > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {prompt.tags!.map((tag) => (
                      <span key={tag} className={badge}>
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-0.5">
                {onSave && (
                  <button type="button" aria-label={`Edit ${prompt.title}`} title="Edit" onClick={() => setEditing({ id: prompt.id, title: prompt.title, body: prompt.body, tags: (prompt.tags ?? []).join(", ") })} className={cn(iconButton, "size-7", focusRing)}>
                    <PencilIcon aria-hidden="true" />
                  </button>
                )}
                {onDelete && (
                  <button type="button" aria-label={`Delete ${prompt.title}`} title="Delete" onClick={() => setDeleting(prompt)} className={cn(iconButton, "size-7 hover:text-destructive", focusRing)}>
                    <Trash2Icon aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Use ${prompt.title}`}
                  aria-expanded={promptVariables(prompt.body).length ? using === prompt.id : undefined}
                  onClick={() => (promptVariables(prompt.body).length ? setUsing(using === prompt.id ? null : prompt.id) : onUse(prompt.body, prompt))}
                  className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}
                >
                  Use
                </button>
              </span>
            </div>
            {using === prompt.id && (
              <PromptRunner
                prompt={prompt}
                onClose={() => setUsing(null)}
                onUse={(text) => {
                  onUse(text, prompt);
                  setUsing(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-muted-foreground">{prompts.length ? "No prompts match." : "No saved prompts yet."}</p>}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="The prompt is removed from your library."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => {
          if (deleting) onDelete?.(deleting.id);
        }}
      />
    </section>
  );
}
