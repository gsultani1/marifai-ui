// packages/ai-ui/src/components/faq.tsx
"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { SearchInput } from "./search-input.js";
import { childHeadingLevel, SiteSection, type SiteSectionProps } from "./site-section.js";

export interface FaqItem {
  id: string;
  question: string;
  answer: ReactNode;
  /** Plain-text answer for search and structured data when `answer` is not a string. */
  answerText?: string;
}

function answerOf(item: FaqItem): string | undefined {
  return item.answerText ?? (typeof item.answer === "string" ? item.answer : undefined);
}

/** Items whose question or plain-text answer contains every word of `query`, ignoring case and accents. */
export function filterFaqItems(items: FaqItem[], query: string): FaqItem[] {
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const haystack = fold(`${item.question} ${answerOf(item) ?? ""}`);
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * schema.org FAQPage JSON for the items that have a plain-text answer, with
 * `<`, `>`, `&` and line separators escaped so the JSON cannot close its
 * script tag or break out of it.
 */
export function faqJsonLd(items: FaqItem[]): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.flatMap((item) => {
      const text = answerOf(item);
      return text ? [{ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text } }] : [];
    }),
  };
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export interface FaqProps extends Omit<SiteSectionProps, "children"> {
  items: FaqItem[];
  /** Lets several answers stay open at once. */
  multiple?: boolean;
  /** Ids of the open items. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Shows a search field that filters the questions. */
  searchable?: boolean;
  searchLabel?: string;
  searchPlaceholder?: string;
  /** Shown when the search matches nothing; a function receives the query. */
  noResults?: ReactNode | ((query: string) => ReactNode);
  /** Emits FAQPage structured data as a JSON-LD script tag. */
  structuredData?: boolean;
}

/**
 * Questions and answers on Base UI Accordion (Enter and Space toggle, Tab
 * moves between questions), with one or several open at once, an optional
 * search filter with a no-results message and a spoken result count, and
 * optional FAQPage JSON-LD. Closed answers stay findable with the
 * browser's find in page.
 */
export function Faq({
  items,
  multiple = false,
  value,
  defaultValue = [],
  onValueChange,
  searchable = false,
  searchLabel = "Search questions",
  searchPlaceholder = "Search questions",
  noResults = (query: string) => `No questions match "${query}".`,
  structuredData = false,
  headingLevel = 2,
  align = "start",
  ...props
}: FaqProps) {
  const [open, setOpen] = useControllableState<string[]>({ value, defaultValue, onChange: onValueChange });
  const [query, setQuery] = useState("");
  const QuestionHeading = `h${childHeadingLevel(headingLevel)}` as const;
  const shown = searchable ? filterFaqItems(items, query) : items;

  return (
    <SiteSection data-slot="faq" headingLevel={headingLevel} align={align} {...props}>
      {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(items) }} />}
      <div className={cn("flex w-full max-w-3xl flex-col gap-6", align === "center" && "self-center")}>
        {searchable && <SearchInput value={query} onValueChange={setQuery} label={searchLabel} placeholder={searchPlaceholder} resultCount={shown.length} className="[&_input]:h-10" />}
        {shown.length === 0 ? (
          query.trim() !== "" && <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{typeof noResults === "function" ? noResults(query.trim()) : noResults}</p>
        ) : (
          <Accordion.Root multiple={multiple} value={open} onValueChange={(next) => setOpen(next as string[])} hiddenUntilFound className="flex flex-col border-y border-border">
            {shown.map((item) => (
              <Accordion.Item key={item.id} value={item.id} className="border-b border-border last:border-b-0">
                <Accordion.Header render={<QuestionHeading />} className="m-0">
                  <Accordion.Trigger className={cn("group flex w-full items-center justify-between gap-4 rounded-md py-4 text-left text-base font-medium text-foreground transition-colors hover:text-foreground/80", focusRing)}>
                    {item.question}
                    <ChevronDownIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180 motion-reduce:transition-none" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
                  <div className="pb-5 text-pretty text-muted-foreground">{typeof item.answer === "string" ? <p>{item.answer}</p> : item.answer}</div>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        )}
      </div>
    </SiteSection>
  );
}
