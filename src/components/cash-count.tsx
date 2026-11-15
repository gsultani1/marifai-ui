// packages/ai-ui/src/components/cash-count.tsx
"use client";

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { useId } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface Denomination {
  id: string;
  label: string;
  /** Value of one unit (a bill, a coin or a full roll) in cents. */
  cents: number;
  kind: "bill" | "roll" | "coin";
}

/** US bills high to low, standard coin rolls, then loose coin. */
export const US_DENOMINATIONS: Denomination[] = [
  { id: "100", label: "$100", cents: 10_000, kind: "bill" },
  { id: "50", label: "$50", cents: 5000, kind: "bill" },
  { id: "20", label: "$20", cents: 2000, kind: "bill" },
  { id: "10", label: "$10", cents: 1000, kind: "bill" },
  { id: "5", label: "$5", cents: 500, kind: "bill" },
  { id: "2", label: "$2", cents: 200, kind: "bill" },
  { id: "1", label: "$1", cents: 100, kind: "bill" },
  { id: "roll-quarters", label: "Quarters ($10 roll)", cents: 1000, kind: "roll" },
  { id: "roll-dimes", label: "Dimes ($5 roll)", cents: 500, kind: "roll" },
  { id: "roll-nickels", label: "Nickels ($2 roll)", cents: 200, kind: "roll" },
  { id: "roll-pennies", label: "Pennies (50¢ roll)", cents: 50, kind: "roll" },
  { id: "coin-dollar", label: "$1 coin", cents: 100, kind: "coin" },
  { id: "coin-quarter", label: "Quarter", cents: 25, kind: "coin" },
  { id: "coin-dime", label: "Dime", cents: 10, kind: "coin" },
  { id: "coin-nickel", label: "Nickel", cents: 5, kind: "coin" },
  { id: "coin-penny", label: "Penny", cents: 1, kind: "coin" },
];

/** Typed counts per denomination id; blank means zero. */
export type CashCounts = Record<string, string>;

/** Total in cents, plus ids whose count is not a whole number of zero or more. */
export function cashCountTotal(counts: CashCounts, denominations: Denomination[] = US_DENOMINATIONS): { totalCents: number; invalid: string[] } {
  let totalCents = 0;
  const invalid: string[] = [];
  for (const denomination of denominations) {
    const raw = (counts[denomination.id] ?? "").trim();
    if (!raw) continue;
    if (!/^\d+$/.test(raw)) {
      invalid.push(denomination.id);
      continue;
    }
    totalCents += Number(raw) * denomination.cents;
  }
  return { totalCents, invalid };
}

export interface CashCountProps {
  denominations?: Denomination[];
  counts?: CashCounts;
  defaultCounts?: CashCounts;
  onCountsChange?: (counts: CashCounts) => void;
  /** Expected drawer amount in cents; shows over or short. */
  expectedCents?: number;
  /** Variance beyond this (in cents) is flagged. Defaults to $5. */
  varianceThresholdCents?: number;
  currency?: string;
  locale?: string;
  onSubmit?: (result: { totalCents: number; varianceCents: number | null; counts: CashCounts }) => void;
  submitLabel?: string;
  className?: string;
}

const KIND_TITLES = { bill: "Bills", roll: "Rolled coin", coin: "Loose coin" } as const;

/**
 * Drawer count by denomination: bills high to low, rolled coin and loose
 * coin, numeric keypad on phones, blanks count as zero, invalid entries are
 * flagged instead of guessed, and the total is compared with the expected
 * amount, flagging variances past the threshold. All math is in cents.
 */
export function CashCount({ denominations = US_DENOMINATIONS, counts, defaultCounts = {}, onCountsChange, expectedCents, varianceThresholdCents = 500, currency = "USD", locale, onSubmit, submitLabel = "Submit count", className }: CashCountProps) {
  const [values, setValues] = useControllableState<CashCounts>({ value: counts, defaultValue: defaultCounts, onChange: onCountsChange });
  const id = useId();
  const money = new Intl.NumberFormat(locale, { style: "currency", currency });
  const format = (cents: number) => money.format(cents / 100);
  const { totalCents, invalid } = cashCountTotal(values, denominations);
  const varianceCents = expectedCents === undefined ? null : totalCents - expectedCents;
  const flagged = varianceCents !== null && Math.abs(varianceCents) > varianceThresholdCents;
  const groups = (["bill", "roll", "coin"] as const).map((kind) => ({ kind, items: denominations.filter((denomination) => denomination.kind === kind) })).filter((group) => group.items.length);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid.length === 0) onSubmit?.({ totalCents, varianceCents, counts: values });
      }}
      className={cn(card, "@container flex flex-col gap-4 p-4", className)}
    >
      <div className="grid gap-4 @2xl:grid-cols-3">
        {groups.map((group) => (
          <fieldset key={group.kind} className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{KIND_TITLES[group.kind]}</legend>
            {group.items.map((denomination) => {
              const raw = values[denomination.id] ?? "";
              const bad = invalid.includes(denomination.id);
              const subtotal = bad || !raw.trim() ? 0 : Number(raw) * denomination.cents;
              const inputId = `${id}-${denomination.id}`;
              return (
                <div key={denomination.id} className="grid grid-cols-[minmax(6rem,1fr)_4.5rem_5rem] items-center gap-2 text-sm">
                  <label htmlFor={inputId} className="truncate">
                    {denomination.label}
                  </label>
                  <input
                    id={inputId}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={raw}
                    aria-invalid={bad || undefined}
                    aria-describedby={bad ? `${inputId}-error` : undefined}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setValues({ ...values, [denomination.id]: event.target.value })}
                    className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-right tabular-nums aria-invalid:border-destructive", focusRing, "focus-visible:ring-offset-0")}
                  />
                  <span className="text-right text-muted-foreground tabular-nums">{subtotal ? format(subtotal) : "–"}</span>
                  {bad && (
                    <span id={`${inputId}-error`} className="col-span-3 text-xs font-medium text-destructive">
                      Enter a whole number.
                    </span>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
        <dt className="font-medium">Counted</dt>
        <dd className="text-right text-base font-semibold tabular-nums">{format(totalCents)}</dd>
        {expectedCents !== undefined && (
          <>
            <dt className="text-muted-foreground">Expected</dt>
            <dd className="text-right tabular-nums">{format(expectedCents)}</dd>
            <dt className="text-muted-foreground">Variance</dt>
            <dd className={cn("text-right font-medium tabular-nums", flagged && "text-destructive")}>{varianceCents === 0 ? "Even" : `${varianceCents! > 0 ? "Over" : "Short"} ${format(Math.abs(varianceCents!))}`}</dd>
          </>
        )}
      </dl>
      <p role="status" className="flex items-center gap-2 text-sm empty:hidden">
        {invalid.length > 0 ? (
          <>
            <AlertTriangleIcon aria-hidden="true" className="size-4 text-destructive" />
            Fix {invalid.length === 1 ? "1 entry" : `${invalid.length} entries`} before submitting.
          </>
        ) : flagged ? (
          <>
            <AlertTriangleIcon aria-hidden="true" className="size-4 text-destructive" />
            {varianceCents! > 0 ? "Over" : "Short"} by more than {format(varianceThresholdCents)}. Recount before submitting.
          </>
        ) : varianceCents === 0 ? (
          <>
            <CheckCircle2Icon aria-hidden="true" className="size-4 text-success" />
            Drawer balances.
          </>
        ) : (
          ""
        )}
      </p>
      {onSubmit && (
        <button type="submit" disabled={invalid.length > 0} className={cn(button, buttonVariants.primary, "self-end", focusRing)}>
          {submitLabel}
        </button>
      )}
    </form>
  );
}
