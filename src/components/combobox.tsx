// packages/ai-ui/src/components/combobox.tsx
"use client";

import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronsUpDownIcon, LoaderCircleIcon, PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { type FieldSize, fieldSizes, OptionContent, optionItem, optionPopup } from "./select.js";

export interface ComboboxOption<T extends string = string> {
  value: T;
  /** Plain text: shown in the input once chosen and matched by the filter. */
  label: string;
  icon?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** Decides whether an option stays in the list for the typed query. */
export type ComboboxFilter<T extends string = string> = (option: ComboboxOption<T>, query: string) => boolean;

interface Entry<T extends string> {
  key: string;
  label: string;
  /** Null for the "Create" entry. */
  option: ComboboxOption<T> | null;
}

const CREATE_KEY = "\u0000create";

const inputGroup =
  "flex w-full min-w-0 items-center rounded-md border border-input bg-background text-foreground focus-within:ring-2 focus-within:ring-ring has-[[aria-invalid=true]]:border-destructive data-[invalid]:border-destructive";

const iconButton =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:cursor-not-allowed [&_svg]:size-4";

function toEntry<T extends string>(option: ComboboxOption<T>): Entry<T> {
  return { key: option.value, label: option.label, option };
}

/** Wraps the option filter: the "Create" entry always shows, and the full list shows while the query is the chosen label. */
function useEntryFilter<T extends string>(filter: ComboboxFilter<T> | null | undefined, selectedLabel: string | null) {
  const { contains } = BaseCombobox.useFilter();
  return useMemo(() => {
    if (filter === null) return null;
    return (entry: Entry<T>, rawQuery: string) => {
      const query = rawQuery.trim();
      if (!entry.option || !query) return true;
      if (selectedLabel && selectedLabel.length === query.length && contains(selectedLabel, query)) return true;
      return filter ? filter(entry.option, query) : contains(entry.label, query);
    };
  }, [filter, selectedLabel, contains]);
}

function OptionRow<T extends string>({ entry, disabled, createLabel = String }: { entry: Entry<T>; disabled?: boolean | undefined; createLabel?: (label: string) => ReactNode }) {
  if (!entry.option) {
    return (
      <BaseCombobox.Item value={CREATE_KEY} className={optionItem}>
        <PlusIcon aria-hidden="true" className="mt-0.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{createLabel(entry.label)}</span>
      </BaseCombobox.Item>
    );
  }
  return (
    <BaseCombobox.Item value={entry.key} disabled={disabled ?? entry.option.disabled} className={optionItem}>
      <OptionContent icon={entry.option.icon} label={entry.option.label} description={entry.option.description} />
      <BaseCombobox.ItemIndicator className="absolute top-2 right-2 flex">
        <CheckIcon aria-hidden="true" />
      </BaseCombobox.ItemIndicator>
    </BaseCombobox.Item>
  );
}

interface SharedProps<T extends string> {
  options: ComboboxOption<T>[];
  placeholder?: string;
  /** Shown when nothing matches the query. */
  emptyMessage?: ReactNode;
  /** Custom matching; `null` turns client-side filtering off, as for server results. */
  filter?: ComboboxFilter<T> | null;
  /** Called as the user types, such as to fetch matching options. */
  onInputValueChange?: (query: string) => void;
  /** Shows `loadingMessage` in a live status row and marks the list busy. */
  loading?: boolean;
  loadingMessage?: ReactNode;
  size?: FieldSize;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  /** Accessible name when there is no visible label or surrounding FormField. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  contentClassName?: string;
}

export interface ComboboxProps<T extends string = string> extends SharedProps<T> {
  value?: T | null;
  defaultValue?: T | null;
  onValueChange?: (value: T | null) => void;
  /** Adds a "Create" entry for text that matches no option; return the new option to select it. */
  onCreate?: (label: string) => ComboboxOption<T> | void;
  createLabel?: (label: string) => ReactNode;
  /** Shows a button that clears the selection. */
  clearable?: boolean;
}

function StatusRow({ loading, message }: { loading: boolean; message: ReactNode }) {
  return (
    <BaseCombobox.Status className="flex items-center gap-2 px-2 text-sm text-muted-foreground empty:hidden [&:not(:empty)]:py-1.5">
      {loading && (
        <>
          <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {message}
        </>
      )}
    </BaseCombobox.Status>
  );
}

/**
 * Typeahead single select on Base UI Combobox: typing filters the list (or
 * your `filter`, or the server when `filter` is null), arrows move through
 * matches, Enter picks, Escape closes and then clears. Optional async loading
 * status and a "Create" entry for new values.
 */
export function Combobox<T extends string = string>({
  options,
  value,
  defaultValue = null,
  onValueChange,
  onCreate,
  createLabel = (label) => `Create "${label}"`,
  clearable = true,
  placeholder = "Search",
  emptyMessage = "No results",
  filter,
  onInputValueChange,
  loading = false,
  loadingMessage = "Loading",
  size = "md",
  disabled,
  readOnly,
  required,
  name,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  className,
  contentClassName,
}: ComboboxProps<T>) {
  const [selected, setSelected] = useControllableState<T | null>({ value, defaultValue, onChange: onValueChange });
  const [query, setQuery] = useState("");
  const [remembered, setRemembered] = useState<ComboboxOption<T> | null>(null);
  const container = usePortalContainer();
  const selectedOption = selected === null ? null : (options.find((option) => option.value === selected) ?? (remembered?.value === selected ? remembered : null));
  const trimmed = query.trim();
  const canCreate = onCreate !== undefined && trimmed !== "" && !options.some((option) => option.label.localeCompare(trimmed, undefined, { sensitivity: "accent" }) === 0);

  const createText = canCreate ? trimmed : null;
  const entries = useMemo(() => {
    const list = options.map(toEntry);
    if (selectedOption && !options.includes(selectedOption)) list.push(toEntry(selectedOption));
    if (createText !== null) list.push({ key: CREATE_KEY, label: createText, option: null });
    return list;
  }, [options, selectedOption, createText]);
  const items = useMemo(() => BaseCombobox.createItems(entries, { getValue: (entry) => entry.key, getLabel: (entry) => entry.label }), [entries]);
  const entryFilter = useEntryFilter(filter, selectedOption?.label ?? null);

  return (
    <BaseCombobox.Root<string, false, Entry<T>>
      items={items}
      value={selected}
      onValueChange={(next) => {
        if (next === CREATE_KEY) {
          const created = onCreate?.(trimmed);
          if (created) {
            setRemembered(created);
            setSelected(created.value);
          }
          return;
        }
        const option = next === null ? null : (entries.find((entry) => entry.key === next)?.option ?? null);
        if (option) setRemembered(option);
        setSelected(option?.value ?? null);
      }}
      onInputValueChange={(next) => {
        setQuery(next);
        onInputValueChange?.(next);
      }}
      filter={entryFilter}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      name={name}
      id={id}
    >
      <BaseCombobox.InputGroup data-slot="combobox" className={cn(inputGroup, "pr-1", fieldSizes[size], disabled && "cursor-not-allowed opacity-50", className)}>
        <BaseCombobox.Input
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          className="h-full min-w-0 flex-1 self-stretch bg-transparent pl-3 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {clearable && selected !== null && !readOnly && (
          <BaseCombobox.Clear aria-label="Clear selection" className={iconButton}>
            <XIcon aria-hidden="true" />
          </BaseCombobox.Clear>
        )}
        <BaseCombobox.Trigger aria-label="Show options" className={iconButton}>
          <ChevronsUpDownIcon aria-hidden="true" />
        </BaseCombobox.Trigger>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal container={container}>
        <BaseCombobox.Positioner sideOffset={4} align="start" className="z-50">
          <BaseCombobox.Popup aria-busy={loading || undefined} className={cn(optionPopup, "w-[var(--anchor-width)]", contentClassName)}>
            <StatusRow loading={loading} message={loadingMessage} />
            {!loading && <BaseCombobox.Empty className="px-2 text-sm text-muted-foreground empty:hidden [&:not(:empty)]:py-1.5">{emptyMessage}</BaseCombobox.Empty>}
            <BaseCombobox.List>{(entry: Entry<T>) => <OptionRow key={entry.key} entry={entry} createLabel={createLabel} />}</BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}

export interface MultiSelectProps<T extends string = string> extends SharedProps<T> {
  value?: T[];
  defaultValue?: T[];
  onValueChange?: (value: T[]) => void;
  /** Most options that can be chosen; the rest are disabled once reached. */
  max?: number;
  /** Text shown in the list once `max` is reached. */
  maxMessage?: (max: number) => ReactNode;
}

/**
 * Multiple selection on Base UI Combobox: chosen options become chips, each
 * with a named remove button; Backspace in the empty input removes the last
 * chip, Left Arrow from the start of the input moves through the chips, and
 * the list stays open while picking several. `max` caps the selection.
 */
export function MultiSelect<T extends string = string>({
  options,
  value,
  defaultValue = [],
  onValueChange,
  max,
  maxMessage = (limit) => `You can choose up to ${limit}.`,
  placeholder = "Search",
  emptyMessage = "No results",
  filter,
  onInputValueChange,
  loading = false,
  loadingMessage = "Loading",
  size = "md",
  disabled,
  readOnly,
  required,
  name,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  className,
  contentClassName,
}: MultiSelectProps<T>) {
  const [selected, setSelected] = useControllableState<T[]>({ value, defaultValue, onChange: onValueChange });
  const container = usePortalContainer();
  const entries = useMemo(() => options.map(toEntry), [options]);
  const items = useMemo(() => BaseCombobox.createItems(entries, { getValue: (entry) => entry.key, getLabel: (entry) => entry.label }), [entries]);
  const entryFilter = useEntryFilter(filter, null);
  const full = max !== undefined && selected.length >= max;
  const labelFor = (key: string) => options.find((option) => option.value === key)?.label ?? key;

  return (
    <BaseCombobox.Root<string, true, Entry<T>>
      items={items}
      multiple
      value={selected}
      onValueChange={(next) => {
        if (max !== undefined && next.length > max) return;
        setSelected(
          next.flatMap((key) => {
            const known = options.find((option) => option.value === key)?.value ?? selected.find((existing) => existing === key);
            return known === undefined ? [] : [known];
          }),
        );
      }}
      onOpenChange={(open, details) => {
        if (!open && details.reason === "item-press") details.cancel();
      }}
      onInputValueChange={(next) => onInputValueChange?.(next)}
      filter={entryFilter}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      name={name}
      id={id}
    >
      <BaseCombobox.InputGroup data-slot="multi-select" className={cn(inputGroup, "flex-wrap gap-1 py-1 pr-1 pl-1.5", fieldSizes[size], disabled && "cursor-not-allowed opacity-50", className)}>
        <BaseCombobox.Chips aria-label={selected.length ? "Selected options" : undefined} className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selected.map((key) => {
            const label = labelFor(key);
            return (
              <BaseCombobox.Chip key={key} aria-label={label} className="flex h-6 max-w-full items-center gap-1 rounded-md bg-muted pr-0.5 pl-2 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring data-[highlighted]:ring-2 data-[highlighted]:ring-ring">
                <span className="truncate">{label}</span>
                {!readOnly && !disabled && (
                  <BaseCombobox.ChipRemove aria-label={`Remove ${label}`} className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground">
                    <XIcon aria-hidden="true" className="size-3" />
                  </BaseCombobox.ChipRemove>
                )}
              </BaseCombobox.Chip>
            );
          })}
          <BaseCombobox.Input
            placeholder={selected.length ? "" : placeholder}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            aria-description={selected.length ? `${selected.length} selected. From the start of the field, press Left Arrow to reach them, Backspace removes the last one.` : undefined}
            className="h-6 min-w-20 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </BaseCombobox.Chips>
        <BaseCombobox.Trigger aria-label="Show options" className={cn(iconButton, "self-center")}>
          <ChevronsUpDownIcon aria-hidden="true" />
        </BaseCombobox.Trigger>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal container={container}>
        <BaseCombobox.Positioner sideOffset={4} align="start" className="z-50">
          <BaseCombobox.Popup aria-busy={loading || undefined} className={cn(optionPopup, "w-[var(--anchor-width)]", contentClassName)}>
            <StatusRow loading={loading} message={loadingMessage} />
            {full && max !== undefined && <p className="px-2 py-1.5 text-xs text-muted-foreground">{maxMessage(max)}</p>}
            {!loading && <BaseCombobox.Empty className="px-2 text-sm text-muted-foreground empty:hidden [&:not(:empty)]:py-1.5">{emptyMessage}</BaseCombobox.Empty>}
            <BaseCombobox.List>
              {(entry: Entry<T>) => <OptionRow key={entry.key} entry={entry} disabled={entry.option?.disabled || (full && !selected.some((existing) => existing === entry.key)) || undefined} />}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
