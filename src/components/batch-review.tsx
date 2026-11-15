// packages/ai-ui/src/components/batch-review.tsx
"use client";

import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount } from "../lib/format.js";

export interface BatchItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  /** Why this item clashes with existing data; conflicting items start excluded. */
  conflict?: ReactNode;
  cost?: number;
  /** Starts included unless it has a conflict. */
  defaultIncluded?: boolean;
}

export interface BatchGroup {
  id: string;
  label: ReactNode;
  items: BatchItem[];
}

export interface BatchReviewProps extends Omit<ComponentProps<"section">, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  groups: BatchGroup[];
  unit?: string;
  onApply: (ids: string[]) => void | Promise<void>;
  onCancel?: () => void;
  /** Notes such as gaps the proposal could not fill. */
  notes?: ReactNode;
  /** Noun for the button and summary, e.g. "shift" gives "Apply 3 shifts". */
  noun?: [singular: string, plural: string];
}

function GroupCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate: boolean; onChange: (checked: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} className={cn("size-4 accent-primary", focusRing)} />;
}

/**
 * Review of a batch of proposed changes grouped by day, file or owner: toggle
 * each item or a whole group, see conflicts and cost, then apply only what is
 * selected.
 */
export function BatchReview({
  title = "Review proposed changes",
  description,
  groups,
  unit = "USD",
  onApply,
  onCancel,
  notes,
  noun = ["change", "changes"],
  className,
  ...props
}: BatchReviewProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(groups.flatMap((group) => group.items.filter((item) => (item.defaultIncluded ?? true) && !item.conflict).map((item) => item.id))),
  );
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const items = groups.flatMap((group) => group.items);
  const chosen = items.filter((item) => selected.has(item.id));
  const cost = chosen.reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const hasCost = items.some((item) => item.cost !== undefined);
  const conflicts = items.filter((item) => item.conflict).length;
  const word = (count: number) => (count === 1 ? noun[0] : noun[1]);

  const set = (ids: string[], include: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const itemId of ids) {
        if (include) next.add(itemId);
        else next.delete(itemId);
      }
      return next;
    });

  const apply = () => {
    if (chosen.length === 0 || pending) return;
    setFailed(false);
    const ids = chosen.map((item) => item.id);
    let outcome: void | Promise<void>;
    try {
      outcome = onApply(ids);
    } catch {
      setFailed(true);
      return;
    }
    if (!(outcome instanceof Promise)) return;
    setPending(true);
    outcome.then(
      () => setPending(false),
      () => {
        setPending(false);
        setFailed(true);
      },
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="batch-review" className={cn(card, "flex flex-col gap-3 p-3 text-sm", className)} {...props}>
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        {description && <p className="text-muted-foreground">{description}</p>}
        {conflicts > 0 && (
          <p className="flex items-center gap-1.5 text-xs">
            <TriangleAlertIcon aria-hidden="true" className="size-3.5 text-warning" />
            {conflicts} {word(conflicts)} {conflicts === 1 ? "conflicts" : "conflict"} with existing data and {conflicts === 1 ? "starts" : "start"} excluded.
          </p>
        )}
      </div>
      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
        {groups.map((group) => {
          const ids = group.items.map((item) => item.id);
          const count = ids.filter((itemId) => selected.has(itemId)).length;
          return (
            <fieldset key={group.id} className="flex flex-col gap-1">
              <legend className="sr-only">{group.label}</legend>
              <div className="flex items-center gap-2 border-b border-border pb-1">
                <GroupCheckbox
                  label={`Include all in ${typeof group.label === "string" ? group.label : "group"}`}
                  checked={count === ids.length && ids.length > 0}
                  indeterminate={count > 0 && count < ids.length}
                  onChange={(checked) => set(ids, checked)}
                />
                <span aria-hidden="true" className="font-medium">
                  {group.label}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {count} of {ids.length}
                </span>
              </div>
              <ul className="flex flex-col">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <label className={cn("flex cursor-pointer items-start gap-2 rounded-md px-1 py-1.5 hover:bg-accent/50", !selected.has(item.id) && "text-muted-foreground")}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={(event) => set([item.id], event.target.checked)}
                        className={cn("mt-0.5 size-4 accent-primary", focusRing)}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-foreground">{item.title}</span>
                        {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
                        {item.conflict && (
                          <span className="flex items-center gap-1 text-xs text-foreground">
                            <TriangleAlertIcon aria-hidden="true" className="size-3 shrink-0 text-warning" />
                            {item.conflict}
                          </span>
                        )}
                      </span>
                      {item.cost !== undefined && <span className="shrink-0 text-xs tabular-nums">{formatAmount(item.cost, unit)}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          );
        })}
      </div>
      {notes && <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">{notes}</div>}
      {failed && (
        <p role="alert" className="text-destructive">
          The changes could not be applied. Nothing was changed; try again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
          {chosen.length} of {items.length} selected
          {hasCost && ` · ${formatAmount(cost, unit)}`}
        </span>
        <span className="ml-auto flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className={cn(button, buttonVariants.outline, focusRing)}>
              Cancel
            </button>
          )}
          <button type="button" aria-disabled={chosen.length === 0 || pending || undefined} onClick={apply} className={cn(button, buttonVariants.primary, focusRing)}>
            {pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
            Apply {chosen.length} {word(chosen.length)}
          </button>
        </span>
      </div>
    </section>
  );
}
