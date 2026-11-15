// packages/ai-ui/src/components/stats-band.tsx
"use client";

import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";
import { SiteSection, type SiteSectionProps } from "./site-section.js";

export interface StatItem {
  /** Stable key; defaults to the label. */
  id?: string;
  /** A number formatted with Intl, or text shown as given, such as "24/7". */
  value: number | string;
  label: string;
  description?: ReactNode;
  /** Intl.NumberFormat options, such as `{ style: "percent" }` or `{ notation: "compact" }`. */
  format?: Intl.NumberFormatOptions;
  /** Text before the number, such as "~". */
  prefix?: string;
  /** Text after the number, such as "+". */
  suffix?: string;
}

/** The display text of a stat: its value formatted with Intl plus any prefix and suffix; empty for a non-finite number. */
export function formatStatValue(item: Pick<StatItem, "value" | "format" | "prefix" | "suffix">, locale?: string): string {
  const core = typeof item.value === "string" ? item.value : Number.isFinite(item.value) ? new Intl.NumberFormat(locale, item.format).format(item.value) : "";
  return core ? `${item.prefix ?? ""}${core}${item.suffix ?? ""}` : "";
}

export interface StatsBandProps extends Omit<SiteSectionProps, "children"> {
  items: StatItem[];
  locale?: string;
  /** Plain on the page background, or a tinted band. */
  variant?: "plain" | "band";
}

const columnClasses = (count: number) => (count >= 4 ? "grid-cols-2 lg:grid-cols-4" : count === 3 ? "sm:grid-cols-3" : count === 2 ? "grid-cols-2" : "grid-cols-1");

/** Row of headline numbers formatted with Intl, each with a label and an optional description, as a description list. */
export function StatsBand({ items, locale, variant = "plain", className, ...props }: StatsBandProps) {
  return (
    <SiteSection data-slot="stats-band" data-variant={variant} className={cn(variant === "band" && "bg-muted/50", className)} {...props}>
      {items.length > 0 && (
        <dl className={cn("grid gap-x-6 gap-y-10", columnClasses(items.length))}>
          {items.map((item) => (
            <div key={item.id ?? item.label} className="flex min-w-0 flex-col gap-1">
              <dt className="text-sm font-medium text-foreground">{item.label}</dt>
              <dd className="order-first text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">{formatStatValue(item, locale)}</dd>
              {item.description && <dd className="text-sm text-pretty text-muted-foreground">{item.description}</dd>}
            </div>
          ))}
        </dl>
      )}
    </SiteSection>
  );
}
