// packages/ai-ui/src/components/description-list.tsx
"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface DescriptionItem {
  /** Stable key; defaults to the position. */
  id?: string;
  term: ReactNode;
  details: ReactNode;
  /** Text the copy button copies; the button shows only when this is set. */
  copyValue?: string;
  /** Accessible name of the copy button; defaults to "Copy" plus the term when it is a string. */
  copyLabel?: string;
}

export type DescriptionListLayout = "stacked" | "inline" | "grid";

export interface DescriptionListProps extends Omit<ComponentProps<"dl">, "children"> {
  items: DescriptionItem[];
  /** Term above details, term beside details, or stacked pairs in columns. Defaults to "inline". */
  layout?: DescriptionListLayout;
  /** Columns for the grid layout on wider screens. */
  columns?: 1 | 2 | 3 | 4;
  /** Lines between rows in the stacked and inline layouts. */
  dividers?: boolean;
}

const GRID_COLUMNS: Record<1 | 2 | 3 | 4, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const { status, copy } = useCopyToClipboard();
  return (
    <>
      <button type="button" aria-label={label} title={label} onClick={() => void copy(value)} className={cn(iconButton, "size-7", focusRing)}>
        {status === "copied" ? <CheckIcon aria-hidden="true" className="text-success" /> : <CopyIcon aria-hidden="true" />}
      </button>
      <span role="status" className="sr-only">
        {status === "copied" ? "Copied" : status === "error" ? "Could not copy" : ""}
      </span>
    </>
  );
}

/**
 * Term and detail pairs such as store hours, addresses or account details,
 * as a semantic `dl` with `dt` and `dd`. Layouts: stacked, inline (term
 * beside details from the small breakpoint) and grid with up to four
 * columns. Items with `copyValue` get a copy button that confirms politely.
 */
export function DescriptionList({ items, layout = "inline", columns = 2, dividers = true, className, ...props }: DescriptionListProps) {
  const grid = layout === "grid";
  return (
    <dl
      data-slot="description-list"
      data-layout={layout}
      className={cn("text-sm", grid ? cn("grid gap-x-6 gap-y-4", GRID_COLUMNS[columns]) : cn("flex flex-col", dividers && "divide-y divide-border"), className)}
      {...props}
    >
      {items.map((item, index) => {
        const copyLabel = item.copyLabel ?? (typeof item.term === "string" ? `Copy ${item.term}` : "Copy value");
        return (
          <div
            key={item.id ?? index}
            data-slot="description-item"
            className={cn(
              layout === "inline" ? "grid gap-1 py-2.5 sm:grid-cols-[minmax(8rem,1fr)_2fr] sm:gap-4" : layout === "stacked" ? "flex flex-col gap-1 py-2.5" : "flex min-w-0 flex-col gap-1",
              !grid && !dividers && "py-1.5",
            )}
          >
            <dt className="text-muted-foreground">{item.term}</dt>
            <dd className="flex min-w-0 items-start gap-1 font-medium text-foreground">
              <span className="min-w-0 flex-1 break-words">{item.details}</span>
              {item.copyValue !== undefined && <CopyButton value={item.copyValue} label={copyLabel} />}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
