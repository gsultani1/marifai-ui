// packages/ai-ui/src/components/stat-tile.tsx
"use client";

import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { Skeleton } from "./surface-state.js";

export type TrendDirection = "up" | "down" | "flat";

/**
 * Change from `previous` to `current`. Both zero is "flat" with 0%; a rise
 * from zero counts as +100% (and a fall from zero as -100%) so the badge
 * stays meaningful instead of showing infinity.
 */
export function computeTrend(current: number, previous: number): { direction: TrendDirection; percent: number } {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || current === previous) return { direction: "flat", percent: 0 };
  if (previous === 0) return { direction: current > 0 ? "up" : "down", percent: current > 0 ? 100 : -100 };
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return { direction: percent > 0 ? "up" : "down", percent };
}

export interface TrendIndicatorProps {
  current: number;
  previous: number;
  /** For costs, refunds or errors, where going down is good. */
  reverseColors?: boolean;
  /** What is shown: the percent change, or the absolute difference as a number or currency. */
  format?: "percent" | "number" | "currency";
  currency?: string;
  locale?: string;
  /** Spoken after the change, such as "vs last week". */
  comparisonLabel?: string;
  className?: string;
}

/** Arrow and change versus the previous period; color says good or bad, text says up or down. */
export function TrendIndicator({ current, previous, reverseColors = false, format = "percent", currency = "USD", locale, comparisonLabel = "from the previous period", className }: TrendIndicatorProps) {
  const { direction, percent } = computeTrend(current, previous);
  const good = direction === "flat" ? null : (direction === "up") !== reverseColors;
  const difference = current - previous;
  const text =
    direction === "flat"
      ? "No change"
      : format === "percent"
        ? `${percent > 0 ? "+" : ""}${new Intl.NumberFormat(locale, { maximumFractionDigits: Math.abs(percent) < 10 ? 1 : 0 }).format(percent)}%`
        : `${difference > 0 ? "+" : ""}${new Intl.NumberFormat(locale, format === "currency" ? { style: "currency", currency } : { maximumFractionDigits: 2 }).format(difference)}`;
  const Icon = direction === "up" ? ArrowUpRightIcon : direction === "down" ? ArrowDownRightIcon : ArrowRightIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium text-foreground tabular-nums", good === null ? "border-border bg-muted/50" : good ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10", className)}>
      <Icon aria-hidden="true" className={cn("size-3.5", good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive")} />
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{direction === "flat" ? `No change ${comparisonLabel}` : `${direction === "up" ? "Up" : "Down"} ${text.replace(/^[+-]/, "")} ${comparisonLabel}`}</span>
    </span>
  );
}

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  /** Fills the area under the line. */
  area?: boolean;
  /** CSS color; defaults to the chart-1 token. */
  color?: string;
  /** Accessible summary; defaults to first, last, high and low. */
  label?: string;
  /** Stretches to the container's width (the end dot is left out so it doesn't distort). */
  fill?: boolean;
  className?: string;
}

/** Tiny line chart with an end dot, described for screen readers by its first, last, highest and lowest values. */
export function Sparkline({ values, width = 96, height = 28, area = true, color = "var(--chart-1)", label, fill = false, className }: SparklineProps) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  const pad = 2;
  const points = finite.map((value, index) => [pad + (index / (finite.length - 1)) * (width - pad * 2), pad + (1 - (value - min) / span) * (height - pad * 2)] as const);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const [lastX, lastY] = points[points.length - 1]!;
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const summary = label ?? `Trend from ${format.format(finite[0]!)} to ${format.format(finite[finite.length - 1]!)}, high ${format.format(max)}, low ${format.format(min)}`;
  return (
    <svg role="img" aria-label={summary} viewBox={`0 0 ${width} ${height}`} width={fill ? "100%" : width} height={height} preserveAspectRatio={fill ? "none" : undefined} className={cn("overflow-visible", className)}>
      {area && <path d={`${line}L${lastX.toFixed(1)} ${height}L${pad} ${height}Z`} fill={color} opacity={0.15} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {!fill && <circle cx={lastX} cy={lastY} r={2.5} fill={color} />}
    </svg>
  );
}

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** With `previous`, shows a TrendIndicator. */
  current?: number;
  previous?: number;
  reverseColors?: boolean;
  comparisonLabel?: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  sparkline?: number[];
  /** Makes the whole tile a link to the detail view. */
  href?: string;
  renderLink?: RenderLink;
  loading?: boolean;
  className?: string;
}

/** KPI tile: label, value, change versus the previous period, subtitle and optional sparkline; can link to its detail page. */
export function StatTile({ label, value, current, previous, reverseColors, comparisonLabel, subtitle, icon, sparkline, href, renderLink = defaultRenderLink, loading = false, className }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      {loading ? (
        <Skeleton lines={2} className="mt-1" />
      ) : (
        <>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
          {sparkline && <Sparkline values={sparkline} label={`${label} trend`} fill height={24} />}
          {(subtitle || (current !== undefined && previous !== undefined)) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {current !== undefined && previous !== undefined && <TrendIndicator current={current} previous={previous} {...(reverseColors !== undefined ? { reverseColors } : {})} {...(comparisonLabel ? { comparisonLabel } : {})} />}
              {subtitle}
            </div>
          )}
        </>
      )}
    </>
  );
  const classes = cn(card, "flex flex-col gap-2 p-4", className);
  if (href && !loading) return renderLink({ href, className: cn(classes, "transition-colors hover:bg-accent/40", focusRing), children: body });
  return (
    <div aria-busy={loading || undefined} className={classes}>
      {body}
    </div>
  );
}

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  /** Formats the center text and the spoken value. */
  formatValue?: (value: number) => string;
  /** Value where the arc turns warning and danger colors; set danger below warning for "low is bad". */
  warning?: number;
  danger?: number;
  size?: number;
  className?: string;
}

/** Semicircle meter with optional warning and danger thresholds. */
export function Gauge({ value, min = 0, max = 100, label, formatValue = (number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number), warning, danger, size = 140, className }: GaugeProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const fraction = (clamped - min) / (max - min || 1);
  const radius = 40;
  const circumference = Math.PI * radius;
  const ascending = warning === undefined || danger === undefined || danger >= warning;
  const level = danger !== undefined && (ascending ? value >= danger : value <= danger) ? "danger" : warning !== undefined && (ascending ? value >= warning : value <= warning) ? "warning" : "ok";
  const stroke = level === "danger" ? "var(--destructive)" : level === "warning" ? "var(--warning)" : "var(--success)";
  return (
    <div role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={clamped} aria-valuetext={`${formatValue(value)}${level === "ok" ? "" : `, ${level}`}`} data-level={level} className={cn("inline-flex flex-col items-center", className)} style={{ width: size }}>
      <svg viewBox="0 0 100 56" aria-hidden="true" className="w-full overflow-visible">
        <path d="M10 50a40 40 0 0 1 80 0" fill="none" stroke="var(--muted)" strokeWidth={9} strokeLinecap="round" />
        <path d="M10 50a40 40 0 0 1 80 0" fill="none" stroke={stroke} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${circumference * fraction} ${circumference}`} className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none" />
      </svg>
      <span aria-hidden="true" className="-mt-7 text-xl font-semibold tabular-nums">
        {formatValue(value)}
      </span>
      <span aria-hidden="true" className="text-xs text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
