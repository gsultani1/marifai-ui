// packages/ai-ui/src/components/spreadsheet-parts.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { type KeyboardEvent, type ReactElement, useId, useState } from "react";

import { focusRing, iconButton, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import type { SpreadsheetSheet } from "../lib/sheet-ops.js";
import { ActionMenu } from "./action-menu.js";

const INVALID_NAME = /[[\]:*?/\\]/;

/** Why a sheet name cannot be used, or null when it can. */
export function sheetNameProblem(name: string, sheets: SpreadsheetSheet[], currentId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name.";
  if (trimmed.length > 31) return "Use 31 characters or fewer.";
  if (INVALID_NAME.test(trimmed)) return "Names cannot contain [ ] : * ? / \\.";
  if (sheets.some((sheet) => sheet.id !== currentId && sheet.name.toLowerCase() === trimmed.toLowerCase())) return "Another sheet has this name.";
  return null;
}

export interface SheetTabsProps {
  sheets: SpreadsheetSheet[];
  activeId: string;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  panelId: string;
}

export function SheetTabs({ sheets, activeId, readOnly, onSelect, onAdd, onRename, onDuplicate, onDelete, panelId }: SheetTabsProps) {
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const id = useId();
  const problem = renaming ? sheetNameProblem(renaming.value, sheets, renaming.id) : null;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const target = event.key === "Home" ? sheets[0] : event.key === "End" ? sheets.at(-1) : delta ? sheets[(index + delta + sheets.length) % sheets.length] : undefined;
    if (target) {
      event.preventDefault();
      onSelect(target.id);
      document.getElementById(`${id}-${target.id}`)?.focus();
    } else if (event.key === "F2" && !readOnly) {
      event.preventDefault();
      setRenaming({ id: sheets[index]!.id, value: sheets[index]!.name });
    }
  };

  const commitRename = () => {
    if (renaming && !problem) onRename(renaming.id, renaming.value.trim());
    setRenaming(null);
  };

  return (
    <div className="flex min-w-0 items-center gap-1 border-t border-border bg-muted/40 px-1 py-1">
      {!readOnly && (
        <button type="button" aria-label="Add sheet" onClick={onAdd} className={cn(iconButton, "size-7", focusRing)}>
          <PlusIcon aria-hidden="true" />
        </button>
      )}
      <div role="tablist" aria-label="Sheets" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {sheets.map((sheet, index) =>
          renaming?.id === sheet.id ? (
            <span key={sheet.id} className="flex flex-col">
              <input
                autoFocus
                aria-label="Sheet name"
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${id}-problem` : undefined}
                value={renaming.value}
                maxLength={31}
                onChange={(event) => setRenaming({ id: sheet.id, value: event.target.value })}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") setRenaming(null);
                }}
                className={cn("h-7 w-32 rounded-md border bg-background px-2 text-sm", problem ? "border-destructive" : "border-input", focusRing)}
              />
              {problem && (
                <span id={`${id}-problem`} role="alert" className="sr-only">
                  {problem}
                </span>
              )}
            </span>
          ) : (
            <button
              key={sheet.id}
              id={`${id}-${sheet.id}`}
              type="button"
              role="tab"
              aria-selected={sheet.id === activeId}
              aria-controls={panelId}
              tabIndex={sheet.id === activeId ? 0 : -1}
              onClick={() => onSelect(sheet.id)}
              onDoubleClick={() => !readOnly && setRenaming({ id: sheet.id, value: sheet.name })}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "h-7 shrink-0 rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-selected:bg-background aria-selected:font-medium aria-selected:text-foreground aria-selected:shadow-sm",
                focusRing,
              )}
            >
              {sheet.name}
            </button>
          ),
        )}
      </div>
      {!readOnly && (
        <ActionMenu
          side="top"
          align="end"
          trigger={
            <button type="button" aria-label="Sheet options" className={cn(iconButton, "size-7", focusRing)}>
              <MoreHorizontalIcon aria-hidden="true" />
            </button>
          }
          items={[
            { id: "rename", label: "Rename", shortcut: "F2", onSelect: () => setRenaming({ id: activeId, value: sheets.find((sheet) => sheet.id === activeId)?.name ?? "" }) },
            { id: "duplicate", label: "Duplicate", onSelect: () => onDuplicate(activeId) },
            { type: "separator", id: "sep" },
            { id: "delete", label: "Delete sheet", destructive: true, disabled: sheets.length <= 1, onSelect: () => onDelete(activeId) },
          ]}
        />
      )}
    </div>
  );
}

export interface ValueFilterProps {
  trigger: ReactElement;
  columnLabel: string;
  values: string[];
  /** Currently allowed values, or undefined when the column is not filtered. */
  allowed: string[] | undefined;
  onApply: (allowed: string[] | undefined) => void;
}

/** Popover listing a column's distinct values as checkboxes, with search. */
export function ValueFilter({ trigger, columnLabel, values, allowed, onApply }: ValueFilterProps) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const shown = values.filter((value) => value.toLowerCase().includes(query.toLowerCase())).slice(0, 500);
  const label = (value: string) => (value === "" ? "(Blank)" : value);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setChecked(new Set(allowed ?? values));
          setQuery("");
        }
      }}
    >
      <Popover.Trigger render={trigger} />
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className={cn(popupSurface, "flex w-64 flex-col gap-2 p-3 text-sm outline-none")}>
            <Popover.Title className="font-medium">Filter column {columnLabel}</Popover.Title>
            <input
              type="search"
              aria-label="Search values"
              placeholder="Search values"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn("h-8 rounded-md border border-input bg-background px-2", focusRing)}
            />
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setChecked(new Set(values))} className={cn("rounded underline-offset-2 hover:underline", focusRing)}>
                Select all
              </button>
              <button type="button" onClick={() => setChecked(new Set())} className={cn("rounded underline-offset-2 hover:underline", focusRing)}>
                Clear
              </button>
            </div>
            <ul aria-label="Values" className="flex max-h-56 flex-col overflow-y-auto">
              {shown.map((value) => (
                <li key={value}>
                  <label className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={checked.has(value)}
                      onChange={(event) => {
                        const next = new Set(checked);
                        if (event.target.checked) next.add(value);
                        else next.delete(value);
                        setChecked(next);
                      }}
                      className={cn("size-4 accent-primary", focusRing)}
                    />
                    <span className={cn("truncate", value === "" && "text-muted-foreground italic")}>{label(value)}</span>
                  </label>
                </li>
              ))}
              {shown.length === 0 && <li className="px-1 py-2 text-muted-foreground">No matching values</li>}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onApply(undefined);
                  setOpen(false);
                }}
                className={cn("h-8 rounded-md px-3 text-muted-foreground hover:bg-accent", focusRing)}
              >
                Remove filter
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(checked.size === values.length ? undefined : [...checked]);
                  setOpen(false);
                }}
                className={cn("h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground", focusRing)}
              >
                Apply
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
