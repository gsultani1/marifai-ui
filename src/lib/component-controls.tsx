// packages/ai-ui/src/lib/component-controls.tsx
"use client";

import { type ReactNode, useId, useRef, useState } from "react";

import { Button } from "../components/button.js";
import { focusRing } from "./classes.js";
import { cn } from "./cn.js";

export const fieldClass = cn("block min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm", focusRing);

export function ControlPanel({ slot, title, className, children }: {
  slot: string; title: string; className?: string | undefined; children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-slot={slot} className={cn("min-w-0 space-y-3 rounded-lg border border-border bg-card p-3 text-card-foreground", className)}>
      <h3 id={id} className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1 text-sm"><span className="block font-medium">{label}</span>{children}</label>;
}

export function SearchField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><input type="search" value={value} onChange={(event) => onChange(event.currentTarget.value)} className={fieldClass} /></Field>;
}

export function matchesQuery(query: string, ...values: Array<string | undefined>) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return values.some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function ItemList<T extends { id: string }>({ items, empty, render }: {
  items: readonly T[]; empty: string; render: (item: T) => ReactNode;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="divide-y divide-border">{items.map((item) => <li key={item.id} className="min-w-0 space-y-1 py-2 first:pt-0 last:pb-0">{render(item)}</li>)}</ul>;
}

export function ItemHeading({ title, detail, children }: { title: string; detail?: string | undefined; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium break-words">{title}</p>
        {detail && <p className="text-xs break-words text-muted-foreground">{detail}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-1">{children}</div>}
    </div>
  );
}

export function ControlAction({ label, item, onClick, disabled }: {
  label: string; item?: string | undefined; onClick?: (() => void) | undefined; disabled?: boolean | undefined;
}) {
  if (!onClick) return null;
  return <Button type="button" size="sm" variant="outline" aria-label={item ? label + " " + item : undefined} disabled={disabled} focusableWhenDisabled onClick={onClick}>{label}</Button>;
}

export function ChoiceField<T extends string>({ label, value, options, onChange, placeholder, disabled }: {
  label: string; value: T | ""; options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T | "") => void; placeholder?: string; disabled?: boolean;
}) {
  const selected = options.some((option) => option.value === value) ? value : "";
  return (
    <Field label={label}>
      <select className={fieldClass} value={selected} disabled={disabled} onChange={(event) => {
        const next = options.find((option) => option.value === event.currentTarget.value);
        if (next && !next.disabled) onChange(next.value);
        else if (placeholder && event.currentTarget.value === "") onChange("");
      }}>
        {(placeholder || !selected) && <option value="" disabled={!placeholder}>{placeholder ?? "Choose an option"}</option>}
        {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
    </Field>
  );
}

export function AsyncForm({ label, submitLabel, children, validate, onSubmit, disabled }: {
  label: string; submitLabel: string; children: ReactNode; validate?: () => string | undefined;
  onSubmit: () => void | Promise<void>; disabled?: boolean;
}) {
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    if (active.current || disabled) return;
    const invalid = validate?.();
    if (invalid) { setError(invalid); return; }
    active.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit();
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "The action failed. Try again.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return (
    <form aria-label={label} className="space-y-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={busy} className="min-w-0 space-y-2">{children}</fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" loading={busy} disabled={disabled} focusableWhenDisabled>{submitLabel}</Button>
    </form>
  );
}

export const comparisonGrid = "grid min-w-0 gap-2 sm:grid-cols-2";
export const contentBlock = "min-w-0 rounded border border-border bg-muted/30 p-2 text-sm whitespace-pre-wrap break-words";

export function optionalNumber(value: string, label: string, minimum: number, integer = false) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || (integer && !Number.isSafeInteger(number))) {
    throw new Error(label + " must be " + (integer ? "a whole number" : "a number") + " of at least " + minimum + ".");
  }
  return number;
}

export function requiredNumber(value: string, label: string, minimum: number, integer = false) {
  const number = optionalNumber(value, label, minimum, integer);
  if (number === undefined) throw new Error(label + " is required.");
  return number;
}
