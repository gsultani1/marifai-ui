// packages/ai-ui/src/components/search-results.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookOpenIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, GlobeIcon, HardDriveIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { badge, button, buttonVariants, card, focusRing, iconButton, modalBackdrop, modalPopup } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { displayHost } from "../lib/format.js";
import { highlightTerms } from "../lib/fuzzy.js";
import { usePortalContainer } from "../lib/portal.js";
import { safeUrl } from "../lib/safe-url.js";
import { SegmentedControl } from "./segmented-control.js";

export type SearchScopeValue = "local" | "web" | "both";

export interface SearchScopeProps {
  value: SearchScopeValue;
  onValueChange: (value: SearchScopeValue) => void;
  /** Disables web search, e.g. when the workspace forbids it. */
  webDisabled?: boolean;
  className?: string;
}

/** Where to search: your files and knowledge, the web, or both. */
export function SearchScope({ value, onValueChange, webDisabled = false, className }: SearchScopeProps) {
  return (
    <SegmentedControl
      label="Search in"
      size="sm"
      value={value}
      onValueChange={onValueChange}
      options={[
        { value: "local", label: "Your files" },
        { value: "web", label: "Web", disabled: webDisabled },
        { value: "both", label: "Both", disabled: webDisabled },
      ]}
      {...(className ? { className } : {})}
    />
  );
}

export interface SearchPassage {
  id: string;
  text: string;
  /** e.g. "page 4". */
  location?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url?: string;
  /** "local" for your files and knowledge, "web" for the internet. */
  source: "local" | "web";
  snippet: string;
  /** 0 to 1 relevance. */
  score?: number;
  publishedAt?: string;
  passages?: SearchPassage[];
}

function Highlighted({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {highlightTerms(text, terms).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-accent px-0.5 text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Words of a query worth highlighting: quoted phrases kept whole, other words of two letters or more. */
export function queryTerms(query: string): string[] {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
  const words = query
    .replace(/"[^"]*"/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
  return [...phrases, ...words];
}

export interface SearchResultCardProps {
  result: SearchResult;
  /** Highlighted in the title and snippet. */
  query?: string;
  /** The result is attached to the conversation. */
  added?: boolean;
  onAddedChange?: (added: boolean) => void;
  /** Opens the passages before citing; defaults to the built-in preview. */
  onReadPassage?: (result: SearchResult) => void;
  className?: string;
}

/**
 * One search result: title, source (your files or the web) and site,
 * date and relevance, a snippet with the query highlighted, passages to
 * read before citing, and add to or remove from the conversation.
 */
export function SearchResultCard({ result, query = "", added = false, onAddedChange, onReadPassage, className }: SearchResultCardProps) {
  const [previewing, setPreviewing] = useState(false);
  const href = safeUrl(result.url, ["http:", "https:"]);
  const terms = queryTerms(query);
  const passages = result.passages ?? [];

  return (
    <article data-slot="search-result-card" data-source={result.source} className={cn(card, "flex flex-col gap-1.5 p-3 text-sm", added && "border-ring", className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={badge}>
          {result.source === "web" ? <GlobeIcon aria-hidden="true" /> : <HardDriveIcon aria-hidden="true" />}
          {result.source === "web" ? "Web" : "Your files"}
        </span>
        {href && <span>{displayHost(href)}</span>}
        {result.publishedAt && <span>{result.publishedAt}</span>}
        {result.score !== undefined && (
          <span className="ml-auto flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1 w-12 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(result.score * 100)}%` }} />
            </span>
            <span className="tabular-nums">{Math.round(result.score * 100)}% match</span>
          </span>
        )}
      </div>
      <h4 className="font-medium">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cn("rounded-sm underline-offset-2 hover:underline", focusRing)}>
            <Highlighted text={result.title} terms={terms} />
          </a>
        ) : (
          <Highlighted text={result.title} terms={terms} />
        )}
      </h4>
      <p className="text-muted-foreground">
        <Highlighted text={result.snippet} terms={terms} />
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {passages.length > 0 && (
          <button type="button" aria-label={`Read ${passages.length === 1 ? "passage" : `${passages.length} passages`} from ${result.title}`} onClick={() => (onReadPassage ? onReadPassage(result) : setPreviewing(true))} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
            <BookOpenIcon aria-hidden="true" />
            Read {passages.length === 1 ? "passage" : `${passages.length} passages`}
          </button>
        )}
        {onAddedChange && (
          <button type="button" aria-pressed={added} aria-label={`${added ? "Added" : "Add"} to context: ${result.title}`} onClick={() => onAddedChange(!added)} className={cn(button, added ? buttonVariants.primary : buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
            {added ? <CheckIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
            {added ? "Added" : "Add"} to context
          </button>
        )}
      </div>
      {!onReadPassage && passages.length > 0 && <PassagePreview open={previewing} onOpenChange={setPreviewing} result={result} query={query} added={added} {...(onAddedChange ? { onAddedChange } : {})} />}
    </article>
  );
}

export interface PassagePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SearchResult;
  query?: string;
  added?: boolean;
  onAddedChange?: (added: boolean) => void;
  footer?: ReactNode;
}

/** The passages a result would be cited from, one at a time with the query highlighted, so they can be read before citing. */
export function PassagePreview({ open, onOpenChange, result, query = "", added = false, onAddedChange, footer }: PassagePreviewProps) {
  const container = usePortalContainer();
  const [index, setIndex] = useState(0);
  const passages = result.passages ?? [];
  const current = passages[Math.min(index, Math.max(0, passages.length - 1))];
  const href = safeUrl(result.url, ["http:", "https:"]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setIndex(0);
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={modalBackdrop} />
        <Dialog.Popup data-slot="passage-preview" className={cn(modalPopup, "w-[min(36rem,calc(100vw-2rem))]")}>
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <Dialog.Title className="text-base font-semibold">{result.title}</Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                {[result.source === "web" ? "Web" : "Your files", href ? displayHost(href) : "", current?.location ?? "", passages.length > 1 ? `Passage ${index + 1} of ${passages.length}` : ""].filter(Boolean).join(" · ")}
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className={cn(iconButton, focusRing)}>
              <XIcon aria-hidden="true" />
            </Dialog.Close>
          </div>
          {current && (
            <blockquote tabIndex={0} aria-label="Passage" className={cn("max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm leading-6", focusRing)}>
              <Highlighted text={current.text} terms={queryTerms(query)} />
            </blockquote>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {passages.length > 1 && (
              <span className="flex gap-1">
                <button type="button" aria-label="Previous passage" disabled={index === 0} onClick={() => setIndex(index - 1)} className={cn(iconButton, focusRing)}>
                  <ChevronLeftIcon aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next passage" disabled={index >= passages.length - 1} onClick={() => setIndex(index + 1)} className={cn(iconButton, focusRing)}>
                  <ChevronRightIcon aria-hidden="true" />
                </button>
              </span>
            )}
            {footer}
            <span className="ml-auto flex gap-2">
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" className={cn(button, buttonVariants.ghost, focusRing)}>
                  <ExternalLinkIcon aria-hidden="true" />
                  Open source
                </a>
              )}
              {onAddedChange && (
                <button type="button" aria-pressed={added} onClick={() => onAddedChange(!added)} className={cn(button, added ? buttonVariants.outline : buttonVariants.primary, focusRing)}>
                  {added ? <CheckIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
                  {added ? "Added to context" : "Add to context"}
                </button>
              )}
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface QueryExpansionTerm {
  term: string;
  /** Why it was added, e.g. "synonym" or "brand name". */
  reason?: string;
  enabled: boolean;
}

export interface QueryExpansionProps {
  query: string;
  terms: QueryExpansionTerm[];
  onToggle: (term: string, enabled: boolean) => void;
  /** Searches the exact query only. */
  onSearchExact?: () => void;
  className?: string;
}

/** The terms AI added to a search, each switchable off, with a way back to the exact query. */
export function QueryExpansion({ query, terms, onToggle, onSearchExact, className }: QueryExpansionProps) {
  if (terms.length === 0) return null;
  return (
    <div data-slot="query-expansion" className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}>
      <SparklesIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">
        Also searched for <span className="sr-only">alongside "{query}"</span>
      </span>
      <ul aria-label="Added search terms" className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <li key={term.term}>
            <button
              type="button"
              aria-pressed={term.enabled}
              title={term.reason}
              onClick={() => onToggle(term.term, !term.enabled)}
              className={cn("inline-flex h-6 items-center gap-1 rounded-full border px-2 aria-pressed:border-ring aria-pressed:bg-accent", !term.enabled && "border-dashed border-border text-muted-foreground line-through", focusRing)}
            >
              {term.enabled && <CheckIcon aria-hidden="true" className="size-3" />}
              {term.term}
            </button>
          </li>
        ))}
      </ul>
      {onSearchExact && (
        <button type="button" onClick={onSearchExact} className={cn("rounded-sm underline underline-offset-2", focusRing)}>
          Search only "{query}"
        </button>
      )}
    </div>
  );
}
