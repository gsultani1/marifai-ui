// packages/ai-ui/src/components/cost-approval.tsx
"use client";

import { CheckIcon, ClockIcon, CpuIcon, LoaderCircleIcon, ReceiptIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatAmount, formatDuration } from "../lib/format.js";
import { CodeBlock } from "./code-block.js";

export type CostApprovalState = "pending" | "approved" | "declined";

export interface CostApprovalProps extends Omit<ComponentProps<"section">, "title"> {
  title: ReactNode;
  /** What the user gets when the work finishes. */
  outcome?: ReactNode;
  included?: ReactNode[];
  /** Expected price of the run. */
  price: number;
  /** Hard cap; the run stops before spending more. */
  maxCost?: number;
  /** Current balance; shows the balance after the run and blocks approval when short. */
  balance?: number;
  unit?: string;
  etaMs?: number;
  hardware?: ReactNode;
  /** Script or plan the run will execute, shown on request. */
  script?: string;
  scriptLanguage?: string;
  state?: CostApprovalState;
  onApprove: () => void | Promise<void>;
  onDecline: () => void;
  onTopUp?: () => void;
  approveLabel?: string;
}

/**
 * Pre-run quote for paid work: outcome, what is included, price, cap, time and
 * hardware, with the balance after the run. Approval is blocked when the
 * balance cannot cover the cap.
 */
export function CostApproval({
  title,
  outcome,
  included,
  price,
  maxCost,
  balance,
  unit = "USD",
  etaMs,
  hardware,
  script,
  scriptLanguage = "python",
  state = "pending",
  onApprove,
  onDecline,
  onTopUp,
  approveLabel = "Approve and run",
  className,
  ...props
}: CostApprovalProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const id = useId();
  const worstCase = Math.max(price, maxCost ?? price);
  const short = balance !== undefined && balance < worstCase;

  const approve = () => {
    if (pending || short) return;
    setFailed(false);
    let result: void | Promise<void>;
    try {
      result = onApprove();
    } catch {
      setFailed(true);
      return;
    }
    if (!(result instanceof Promise)) return;
    setPending(true);
    result.then(
      () => setPending(false),
      () => {
        setPending(false);
        setFailed(true);
      },
    );
  };

  if (state !== "pending") {
    return (
      <section data-slot="cost-approval" data-state={state} className={cn(card, "flex items-center gap-2 px-3 py-2 text-sm [&_svg]:size-4", className)} {...props}>
        {state === "approved" ? <CheckIcon aria-hidden="true" className="text-success" /> : <ReceiptIcon aria-hidden="true" className="text-muted-foreground" />}
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">· {state === "approved" ? `Approved up to ${formatAmount(worstCase, unit)}` : "Declined"}</span>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} data-slot="cost-approval" data-state={state} className={cn(card, "flex flex-col gap-3 p-3 text-sm", className)} {...props}>
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-title`} className="font-medium">
          {title}
        </h3>
        {outcome && <p className="text-muted-foreground">{outcome}</p>}
      </div>
      {included && included.length > 0 && (
        <ul aria-label="Included" className="flex flex-col gap-1">
          {included.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border p-2 sm:grid-cols-4">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">Estimated price</dt>
          <dd className="font-medium tabular-nums">{formatAmount(price, unit)}</dd>
        </div>
        {maxCost !== undefined && (
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground">Maximum cost</dt>
            <dd className="tabular-nums">{formatAmount(maxCost, unit)}</dd>
          </div>
        )}
        {etaMs !== undefined && (
          <div className="flex flex-col">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <ClockIcon aria-hidden="true" className="size-3" />
              Time
            </dt>
            <dd className="tabular-nums">About {formatDuration(etaMs)}</dd>
          </div>
        )}
        {hardware && (
          <div className="flex flex-col">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <CpuIcon aria-hidden="true" className="size-3" />
              Hardware
            </dt>
            <dd>{hardware}</dd>
          </div>
        )}
      </dl>
      {balance !== undefined && (
        <p className={cn("text-xs tabular-nums", short ? "text-destructive" : "text-muted-foreground")}>
          {short
            ? `Your balance of ${formatAmount(balance, unit)} does not cover the ${maxCost !== undefined ? "maximum cost" : "price"} of ${formatAmount(worstCase, unit)}.`
            : `Balance after: ${formatAmount(balance - price, unit)}${maxCost !== undefined && maxCost > price ? ` (at least ${formatAmount(balance - maxCost, unit)})` : ""}`}
        </p>
      )}
      {script && showScript && <CodeBlock code={script} language={scriptLanguage} title="Script" />}
      {failed && (
        <p role="alert" className="text-destructive">
          The approval could not be confirmed. Nothing was charged; try again.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {script && (
          <button type="button" aria-expanded={showScript} onClick={() => setShowScript(!showScript)} className={cn(button, buttonVariants.ghost, "mr-auto", focusRing)}>
            {showScript ? "Hide script" : "View script"}
          </button>
        )}
        <button type="button" onClick={onDecline} disabled={pending} className={cn(button, buttonVariants.outline, focusRing)}>
          Decline
        </button>
        {short && onTopUp ? (
          <button type="button" onClick={onTopUp} className={cn(button, buttonVariants.primary, focusRing)}>
            Add funds
          </button>
        ) : (
          <button type="button" aria-disabled={short || pending || undefined} onClick={approve} className={cn(button, buttonVariants.primary, focusRing)}>
            {pending && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
            {failed ? "Retry approval" : `${approveLabel} · ${formatAmount(price, unit)}`}
          </button>
        )}
      </div>
    </section>
  );
}
