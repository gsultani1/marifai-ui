// packages/ai-ui/src/components/action-approval.tsx
"use client";

import { LoaderCircleIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useState } from "react";

import { badge, button, buttonVariants, focusRing, type Tone, toneIcon, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export type ActionRisk = "low" | "medium" | "high";
export type ApprovalState = "pending" | "approved" | "denied" | "expired";

const RISK: Record<ActionRisk, { label: string; tone: Tone; icon: ReactNode }> = {
  low: { label: "Read only", tone: "neutral", icon: <ShieldIcon aria-hidden="true" /> },
  medium: { label: "Changes data", tone: "warning", icon: <ShieldAlertIcon aria-hidden="true" /> },
  high: { label: "High impact", tone: "danger", icon: <ShieldAlertIcon aria-hidden="true" /> },
};

export interface ActionApprovalProps extends Omit<ComponentProps<"section">, "title"> {
  title: ReactNode;
  /** What will happen, in plain words. */
  description?: ReactNode;
  /** Exact preview of the action: the email body, the SQL, the files. */
  preview?: ReactNode;
  risk?: ActionRisk;
  /** What the action can touch, e.g. "Gmail: send", "Repo: write". */
  scopes?: string[];
  /** Fingerprint of the exact action. The approval covers this digest only. */
  digest?: string;
  /** Requires ticking "I reviewed this" before Approve. On by default for high risk. */
  requireReview?: boolean;
  /** Changes whenever the previewed action changes; a new key clears an earlier review. */
  reviewKey?: string;
  state?: ApprovalState;
  onApprove: () => void | Promise<void>;
  onDeny: (reason?: string) => void | Promise<void>;
  /** Asks for a reason before denying. */
  denyRequiresReason?: boolean;
  approveLabel?: string;
}

/**
 * Approval card for an agent action with risk tier, scopes, an exact preview
 * and an optional "I reviewed this" gate. Approval is bound to the shown
 * digest, a changed action clears the review, and a failed decision can be
 * retried without changing it.
 */
export function ActionApproval({
  title,
  description,
  preview,
  risk = "medium",
  scopes,
  digest,
  requireReview = risk === "high",
  reviewKey,
  state = "pending",
  onApprove,
  onDeny,
  denyRequiresReason = false,
  approveLabel = "Approve",
  className,
  ...props
}: ActionApprovalProps) {
  const [reviewedKey, setReviewedKey] = useState<string | null>(null);
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);
  const [failed, setFailed] = useState<"approve" | "deny" | null>(null);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const id = useId();
  const currentKey = reviewKey ?? digest ?? "review";
  const reviewed = reviewedKey === currentKey;
  const config = RISK[risk];

  const run = (decision: "approve" | "deny") => {
    if (pending) return;
    setFailed(null);
    let result: void | Promise<void>;
    try {
      result = decision === "approve" ? onApprove() : onDeny(denyRequiresReason ? reason.trim() : reason.trim() || undefined);
    } catch {
      setFailed(decision);
      return;
    }
    if (!(result instanceof Promise)) return;
    setPending(decision);
    result.then(
      () => setPending(null),
      () => {
        setPending(null);
        setFailed(decision);
      },
    );
  };

  if (state !== "pending") {
    const closed = {
      approved: { text: digest ? "Approved for this exact action" : "Approved", icon: <ShieldCheckIcon aria-hidden="true" className="text-success" /> },
      denied: { text: "Denied", icon: <ShieldIcon aria-hidden="true" className="text-muted-foreground" /> },
      expired: { text: "Closed without a decision. Ask the agent to propose it again.", icon: <ShieldIcon aria-hidden="true" className="text-muted-foreground" /> },
    }[state];
    return (
      <section data-slot="action-approval" data-state={state} className={cn("flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm [&_svg]:size-4", className)} {...props}>
        {closed.icon}
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">· {closed.text}</span>
      </section>
    );
  }

  const blocked = requireReview && !reviewed;
  const denyBlocked = denyRequiresReason && !reason.trim();

  return (
    <section
      aria-labelledby={`${id}-title`}
      data-slot="action-approval"
      data-state={state}
      data-risk={risk}
      className={cn("flex flex-col gap-3 rounded-lg border p-3 text-sm", toneSurface[config.tone], className)}
      {...props}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className={cn("mt-0.5 [&_svg]:size-4", toneIcon[config.tone])}>{config.icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 id={`${id}-title`} className="font-medium">
            {title}
          </h3>
          {description && <p className="text-foreground/90">{description}</p>}
        </div>
        <span className={cn(badge, "bg-background")}>{config.label}</span>
      </div>
      {scopes && scopes.length > 0 && (
        <ul aria-label="Access requested" className="flex flex-wrap gap-1.5">
          {scopes.map((scope) => (
            <li key={scope} className={cn(badge, "bg-background font-mono")}>
              {scope}
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div role="region" aria-label="Action preview" tabIndex={0} className={cn("max-h-72 overflow-auto rounded-md border border-border bg-background p-2", focusRing)}>
          {preview}
        </div>
      )}
      {digest && (
        <p className="text-xs text-muted-foreground">
          Approval covers this exact action only · <code className="font-mono">{digest.slice(0, 12)}</code>
        </p>
      )}
      {requireReview && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewedKey(event.target.checked ? currentKey : null)} className={cn("size-4 accent-primary", focusRing)} />
          I reviewed this action
        </label>
      )}
      {denying && (
        <label className="flex flex-col gap-1">
          <span>{denyRequiresReason ? "Reason (required)" : "Reason (optional)"}</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className={cn("rounded-md border border-input bg-background px-2 py-1", focusRing)} />
        </label>
      )}
      {failed && (
        <p role="alert" className="text-destructive">
          The decision could not be confirmed. Try again; the same decision will be sent.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {denying ? (
          <>
            <button type="button" onClick={() => setDenying(false)} className={cn(button, buttonVariants.ghost, focusRing)}>
              Back
            </button>
            <button type="button" aria-disabled={denyBlocked || pending !== null || undefined} onClick={() => !denyBlocked && run("deny")} className={cn(button, buttonVariants.destructive, focusRing)}>
              {pending === "deny" && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
              {failed === "deny" ? "Retry deny" : "Deny"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-disabled={pending !== null || undefined}
              onClick={() => (denyRequiresReason ? setDenying(true) : run("deny"))}
              className={cn(button, buttonVariants.outline, focusRing)}
            >
              {pending === "deny" && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
              {failed === "deny" ? "Retry deny" : "Deny"}
            </button>
            <button
              type="button"
              aria-disabled={blocked || pending !== null || undefined}
              aria-describedby={blocked ? `${id}-blocked` : undefined}
              onClick={() => !blocked && run("approve")}
              className={cn(button, buttonVariants.primary, focusRing)}
            >
              {pending === "approve" && <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />}
              {failed === "approve" ? "Retry approval" : approveLabel}
            </button>
          </>
        )}
      </div>
      {blocked && (
        <span id={`${id}-blocked`} className="sr-only">
          Tick "I reviewed this action" to enable approval.
        </span>
      )}
    </section>
  );
}
