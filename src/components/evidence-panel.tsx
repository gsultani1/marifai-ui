// packages/ai-ui/src/components/evidence-panel.tsx
"use client";

import { ChevronDownIcon, ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { Fragment, useId, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { splitCitationNumbers } from "../lib/citations.js";
import { cn } from "../lib/cn.js";
import { displayHost } from "../lib/format.js";
import { safeUrl } from "../lib/safe-url.js";

export interface Evidence {
  id: string;
  title: string;
  url?: string;
  /** The passage the answer relies on. */
  quote?: string;
  /** False when the quoted text was not found in the source, which the panel flags. */
  quoteVerified?: boolean;
  /** e.g. "page 4" or "section 2.1". */
  location?: string;
}

export interface EvidencePanelProps {
  /** In citation order: the first is [1]. */
  evidence: Evidence[];
  /** Shown before the rest fold under "Show N more". */
  inlineCount?: number;
  /** 0 to 1: share of the answer's claims backed by a source. */
  coverage?: number;
  /** What the sources don't cover or can't confirm. */
  limitations?: string[];
  /** Id prefix shared with CitedText so citation numbers can jump to their source. */
  idPrefix?: string;
  className?: string;
}

/** Element id of evidence number `n` (1-based) under `prefix`. */
export function evidenceElementId(prefix: string, n: number): string {
  return `${prefix}-evidence-${n}`;
}

/**
 * The sources behind an answer: numbered so citations match, each with the
 * quoted passage and where it is, a warning when a quote couldn't be found
 * in its source, how much of the answer the sources cover, and the
 * answer's limitations; sources past the first few fold away.
 */
export function EvidencePanel({ evidence, inlineCount = 3, coverage, limitations = [], idPrefix, className }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const generated = useId();
  const prefix = idPrefix ?? generated;
  const shown = expanded ? evidence : evidence.slice(0, inlineCount);
  const hidden = evidence.length - shown.length;
  const unverified = evidence.filter((item) => item.quoteVerified === false).length;

  return (
    <section aria-labelledby={`${prefix}-title`} data-slot="evidence-panel" className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${prefix}-title`} className="font-medium">
          Evidence
        </h3>
        <span className="text-xs text-muted-foreground">
          {evidence.length} {evidence.length === 1 ? "source" : "sources"}
        </span>
        {coverage !== undefined && (
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span
              role="meter"
              aria-label="Claims backed by sources"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(coverage * 100)}
              aria-valuetext={`${Math.round(coverage * 100)}% of claims backed by sources`}
              className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
            >
              <span className={cn("block h-full rounded-full", coverage >= 0.8 ? "bg-success" : coverage >= 0.5 ? "bg-warning" : "bg-destructive")} style={{ width: `${Math.round(coverage * 100)}%` }} />
            </span>
            <span className="tabular-nums">{Math.round(coverage * 100)}% covered</span>
          </span>
        )}
      </div>
      {unverified > 0 && (
        <p role="note" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-xs">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {unverified === 1 ? "One quote wasn't found in its source." : `${unverified} quotes weren't found in their sources.`} Check them before relying on them.
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {shown.map((item, index) => {
          const href = safeUrl(item.url, ["http:", "https:"]);
          const number = index + 1;
          return (
            <li key={item.id} id={evidenceElementId(prefix, number)} tabIndex={-1} className={cn("flex gap-2 rounded-md border border-border p-2 outline-none target:ring-2 target:ring-ring focus-visible:ring-2 focus-visible:ring-ring", item.quoteVerified === false && "border-warning/60")}>
              <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                {number}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="sr-only">Source {number}: </span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline", focusRing)}>
                      {item.title}
                      <ExternalLinkIcon aria-hidden="true" className="size-3" />
                    </a>
                  ) : (
                    <span className="font-medium">{item.title}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{[href ? displayHost(href) : "", item.location ?? ""].filter(Boolean).join(" · ")}</span>
                </span>
                {item.quote && (
                  <blockquote className="border-l-2 border-border pl-2 text-xs text-muted-foreground">
                    “{item.quote}”
                    {item.quoteVerified === false && <span className="ml-1 font-medium text-foreground">(not found in source)</span>}
                  </blockquote>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {(hidden > 0 || expanded) && evidence.length > inlineCount && (
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className={cn("inline-flex items-center gap-1 self-start rounded-sm text-xs font-medium underline-offset-2 hover:underline", focusRing)}>
          {expanded ? "Show fewer" : `Show ${hidden} more`}
          <ChevronDownIcon aria-hidden="true" className={cn("size-3.5 transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
        </button>
      )}
      {limitations.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-medium">Limitations</h4>
          <ul className="list-disc pl-5 text-xs text-muted-foreground">
            {limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export interface CitedTextProps {
  /** Text with `[n]` citation numbers, e.g. from rewriteCitations. */
  text: string;
  /** Titles in citation order, used to name the citation buttons. */
  sourceTitles: string[];
  /** The EvidencePanel's idPrefix; citation buttons move focus to their source. */
  idPrefix: string;
  /** Called instead of focusing when a source is folded away or lives elsewhere. */
  onCite?: (n: number) => void;
  className?: string;
}

/** Paragraph text whose `[n]` markers become small numbered buttons that move focus to the matching source. */
export function CitedText({ text, sourceTitles, idPrefix, onCite, className }: CitedTextProps) {
  return (
    <p data-slot="cited-text" className={cn("leading-7", className)}>
      {splitCitationNumbers(text).map((part, index) =>
        "text" in part ? (
          <Fragment key={index}>{part.text}</Fragment>
        ) : sourceTitles[part.citation - 1] !== undefined ? (
          <button
            key={index}
            type="button"
            aria-label={`Source ${part.citation}: ${sourceTitles[part.citation - 1]}`}
            onClick={() => {
              const target = document.getElementById(evidenceElementId(idPrefix, part.citation));
              if (target) target.focus();
              onCite?.(part.citation);
            }}
            className={cn("mx-0.5 inline-flex h-4 min-w-4 -translate-y-1 items-center justify-center rounded bg-muted px-1 align-baseline text-[10px] font-medium tabular-nums hover:bg-accent", focusRing, "focus-visible:ring-offset-0")}
          >
            {part.citation}
          </button>
        ) : (
          <Fragment key={index}>[{part.citation}]</Fragment>
        ),
      )}
    </p>
  );
}
