// packages/ai-ui/src/components/claim-ledger.tsx
"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useId, useState } from "react";

import { badge, button, buttonVariants, card, focusRing, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { SegmentedControl } from "./segmented-control.js";

/** Supported and contradicted come from checking sources; accepted and rejected are a reviewer's decision. */
export type ClaimStatus = "supported" | "contradicted" | "unverified" | "accepted" | "rejected";

export interface Claim {
  id: string;
  text: string;
  status: ClaimStatus;
  /** Citation numbers backing or contradicting the claim. */
  sources?: number[];
  /** 0 to 1. */
  confidence?: number;
  note?: string;
}

const STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  supported: { label: "Supported", tone: "success" },
  contradicted: { label: "Contradicted", tone: "danger" },
  unverified: { label: "Unverified", tone: "warning" },
  accepted: { label: "Accepted", tone: "info" },
  rejected: { label: "Rejected", tone: "neutral" },
};

/** Share of claims that are supported or accepted, and whether every claim has been settled. */
export function claimCoverage(claims: readonly Claim[]): { covered: number; settled: boolean } {
  if (claims.length === 0) return { covered: 1, settled: true };
  const covered = claims.filter((claim) => claim.status === "supported" || claim.status === "accepted").length / claims.length;
  return { covered, settled: claims.every((claim) => claim.status !== "unverified" && claim.status !== "contradicted") };
}

export interface ClaimLedgerProps {
  claims: Claim[];
  /** A reviewer accepts an unverified or contradicted claim, or rejects one. */
  onDecide?: (id: string, decision: "accepted" | "rejected") => void;
  /** Shows a citation; numbers match the evidence list. */
  onCite?: (n: number) => void;
  className?: string;
}

type Filter = "all" | "open" | "settled";

/**
 * Every factual claim in an answer with what the sources say about it:
 * supported, contradicted or unverified, with confidence and citations; a
 * reviewer accepts or rejects open claims, and the coverage bar shows when
 * the answer is ready to use.
 */
export function ClaimLedger({ claims, onDecide, onCite, className }: ClaimLedgerProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const id = useId();
  const { covered, settled } = claimCoverage(claims);
  const open = claims.filter((claim) => claim.status === "unverified" || claim.status === "contradicted").length;
  const shown = claims.filter((claim) => filter === "all" || (filter === "open" ? claim.status === "unverified" || claim.status === "contradicted" : claim.status !== "unverified" && claim.status !== "contradicted"));

  return (
    <section aria-labelledby={`${id}-title`} data-slot="claim-ledger" className={cn(card, "flex flex-col text-sm", className)}>
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`${id}-title`} className="font-medium">
            Claims
          </h3>
          <span role="status" className={cn("text-xs", settled ? "" : "text-muted-foreground")}>
            {settled ? "Every claim is settled" : `${open} still need a decision`}
          </span>
          <SegmentedControl
            label="Show claims"
            size="sm"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: `Open (${open})` },
              { value: "settled", label: "Settled" },
            ]}
            className="ml-auto"
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div role="meter" aria-label="Claims supported or accepted" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(covered * 100)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className={cn("block h-full rounded-full", settled ? "bg-success" : "bg-primary")} style={{ width: `${Math.round(covered * 100)}%` }} />
          </div>
          <span className="tabular-nums">{Math.round(covered * 100)}% supported or accepted</span>
        </div>
      </div>
      <ol className="divide-y divide-border">
        {shown.map((claim) => {
          const status = STATUS[claim.status];
          const needsDecision = claim.status === "unverified" || claim.status === "contradicted";
          return (
            <li key={claim.id} data-status={claim.status} className="flex flex-col gap-1.5 px-3 py-2">
              <p className={cn(claim.status === "rejected" && "text-muted-foreground line-through")}>{claim.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={badge}>
                  <span aria-hidden="true" className={cn("size-2 rounded-full", toneDot[status.tone])} />
                  {status.label}
                </span>
                {claim.confidence !== undefined && <span className="text-muted-foreground tabular-nums">{Math.round(claim.confidence * 100)}% confidence</span>}
                {claim.sources && claim.sources.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">Sources</span>
                    {claim.sources.map((n) =>
                      onCite ? (
                        <button key={n} type="button" aria-label={`Source ${n}`} onClick={() => onCite(n)} className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium tabular-nums hover:bg-accent", focusRing)}>
                          {n}
                        </button>
                      ) : (
                        <span key={n} className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-medium tabular-nums">
                          {n}
                        </span>
                      ),
                    )}
                  </span>
                )}
                {claim.note && <span className="text-muted-foreground">{claim.note}</span>}
                {needsDecision && onDecide && (
                  <span className="ml-auto flex gap-1">
                    <button type="button" aria-label={`Accept: ${claim.text}`} onClick={() => onDecide(claim.id, "accepted")} className={cn(button, buttonVariants.outline, "h-6 px-2 text-xs", focusRing)}>
                      <CheckIcon aria-hidden="true" />
                      Accept
                    </button>
                    <button type="button" aria-label={`Reject: ${claim.text}`} onClick={() => onDecide(claim.id, "rejected")} className={cn(button, buttonVariants.ghost, "h-6 px-2 text-xs", focusRing)}>
                      <XIcon aria-hidden="true" />
                      Reject
                    </button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {shown.length === 0 && <p className="px-3 py-3 text-muted-foreground">{filter === "open" ? "Nothing left to decide." : "No claims."}</p>}
    </section>
  );
}
