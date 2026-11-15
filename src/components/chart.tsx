// packages/ai-ui/src/components/chart.tsx
"use client";

import { TableIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId, useMemo, useState } from "react";

import { useElementSize } from "../hooks/use-element-size.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { DataTable, type DataTableColumn } from "./data-table.js";

/** Categorical slots in fixed order. Series past the eighth fall back to a neutral ink. */
const SERIES_COLORS = Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`);
const OVERFLOW_COLOR = "var(--muted-foreground)";
const MARGIN = { top: 12, right: 16, bottom: 28 };
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

export interface ChartSeries {
  /** Field of each datum holding this series' numeric value. */
  key: string;
  label: string;
  /** Overrides the categorical slot color. */
  color?: string;
}

export interface ChartProps<Datum extends object> extends Omit<ComponentProps<"figure">, "children" | "title"> {
  type: "bar" | "line" | "pie";
  data: Datum[];
  /** Category field: the x-axis label for bar and line charts, the slice label for pie charts. */
  categoryKey: keyof Datum & string;
  /** Pie charts plot the first series. */
  series: ChartSeries[];
  title?: ReactNode;
  description?: ReactNode;
  /** Plot height in pixels, excluding the axis band. */
  height?: number;
  formatValue?: (value: number) => string;
  /** Defaults to "table" above 2,000 categories, where a plot stops being readable. */
  defaultView?: "chart" | "table";
}

const MAX_CHART_POINTS = 2000;
const TABLE_PAGE_SIZE = 50;
const MAX_TICKS = 20;

/** Round tick values covering [min, max]; falls back to the bare range when the span defeats rounding. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const start = Math.floor(min / step) * step;
  const steps = Math.round((Math.ceil(max / step) * step - start) / step);
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(steps) || steps < 1 || steps > MAX_TICKS) return [min, max];
  const ticks: number[] = [];
  for (let index = 0; index <= steps; index++) ticks.push(Number((start + index * step).toPrecision(12)));
  return ticks[0] === ticks.at(-1) ? [min, max] : ticks;
}

function extent(values: number[]): [number, number] {
  let min = 0;
  let max = 0;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function roundedBar(x: number, y: number, width: number, height: number, up: boolean): string {
  const r = Math.min(RADIUS, width / 2, height);
  if (height <= 0) return "";
  if (up) {
    const base = y + height;
    return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${base}Z`;
  }
  const bottom = y + height;
  return `M${x},${y}V${bottom - r}Q${x},${bottom} ${x + r},${bottom}H${x + width - r}Q${x + width},${bottom} ${x + width},${bottom - r}V${y}Z`;
}

function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const sweep = end - start;
  if (sweep >= Math.PI * 2 - 1e-6) {
    return `M${cx - outer},${cy}A${outer},${outer} 0 1 1 ${cx + outer},${cy}A${outer},${outer} 0 1 1 ${cx - outer},${cy}M${cx - inner},${cy}A${inner},${inner} 0 1 0 ${cx + inner},${cy}A${inner},${inner} 0 1 0 ${cx - inner},${cy}Z`;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const point = (radius: number, angle: number) => `${cx + radius * Math.sin(angle)},${cy - radius * Math.cos(angle)}`;
  return `M${point(outer, start)}A${outer},${outer} 0 ${large} 1 ${point(outer, end)}L${point(inner, end)}A${inner},${inner} 0 ${large} 0 ${point(inner, start)}Z`;
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

export function Chart<Datum extends object>({
  type,
  data,
  categoryKey,
  series,
  title,
  description,
  height = 240,
  formatValue = (value) => value.toLocaleString(),
  defaultView,
  className,
  ...props
}: ChartProps<Datum>) {
  const [view, setView] = useState(defaultView ?? (data.length > MAX_CHART_POINTS ? "table" : "chart"));
  const [active, setActive] = useState<number | null>(null);
  const [plotRef, size] = useElementSize<HTMLDivElement>();
  const captionId = useId();
  const hintId = useId();
  const width = size.width || 600;

  const categories = useMemo(() => data.map((datum) => String(datum[categoryKey] ?? "")), [data, categoryKey]);
  const plotted = type === "pie" ? series.slice(0, 1) : series;
  const values = useMemo(
    () =>
      plotted.map((entry) =>
        data.map((datum) => {
          const value = Number((datum as Record<string, unknown>)[entry.key]);
          return Number.isFinite(value) ? value : null;
        }),
      ),
    [data, plotted],
  );
  const colorOf = (index: number) => plotted[index]?.color ?? SERIES_COLORS[index] ?? OVERFLOW_COLOR;
  const sliceColor = (index: number) => SERIES_COLORS[index] ?? OVERFLOW_COLOR;

  const tableColumns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      { key: "__category", header: "Category" },
      ...plotted.map((entry) => ({ key: entry.key, header: entry.label, type: "number" as const })),
    ],
    [plotted],
  );
  const tableRows = useMemo(
    () =>
      categories.map((category, row) => ({
        __category: category,
        ...Object.fromEntries(plotted.map((entry, index) => [entry.key, values[index]?.[row] ?? null])),
      })),
    [categories, plotted, values],
  );

  const readout = (index: number) =>
    type === "pie"
      ? `${categories[index]}: ${formatValue(values[0]?.[index] ?? 0)}`
      : `${categories[index]}: ${plotted.map((entry, s) => `${entry.label} ${values[s]?.[index] === null ? "no data" : formatValue(values[s]?.[index] ?? 0)}`).join(", ")}`;

  const legendItems =
    type === "pie"
      ? categories.map((label, index) => ({ label, color: sliceColor(index) }))
      : plotted.length > 1
        ? plotted.map((entry, index) => ({ label: entry.label, color: colorOf(index) }))
        : [];

  return (
    <figure
      data-slot="chart"
      data-type={type}
      aria-labelledby={title ? captionId : undefined}
      className={cn("flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground", className)}
      {...props}
    >
      <div className="flex items-start gap-2">
        <figcaption id={captionId} className="min-w-0 flex-1">
          {title && <div className="text-sm font-medium">{title}</div>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </figcaption>
        <button
          type="button"
          aria-label="Show as table"
          title="Show as table"
          aria-pressed={view === "table"}
          onClick={() => setView(view === "table" ? "chart" : "table")}
          className={cn(iconButton, "-mt-1 -mr-1 aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing)}
        >
          <TableIcon aria-hidden="true" />
        </button>
      </div>

      {legendItems.length > 0 && (
        <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legendItems.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("shrink-0", type === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-sm")}
                style={{ backgroundColor: item.color }}
              />
              {item.label}
              {type === "pie" && values[0] && (
                <span className="tabular-nums">
                  {(() => {
                    const total = values[0].reduce<number>((sum, value) => sum + Math.max(0, value ?? 0), 0);
                    return total > 0 ? `${Math.round((Math.max(0, values[0][index] ?? 0) / total) * 100)}%` : "";
                  })()}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {view === "table" ? (
        <DataTable
          columns={tableColumns}
          rows={tableRows}
          label={typeof title === "string" ? title : "Chart data"}
          pageSize={tableRows.length > TABLE_PAGE_SIZE * 2 ? TABLE_PAGE_SIZE : undefined}
          className="max-h-80"
        />
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          No data
        </div>
      ) : (
        <div
          ref={plotRef}
          role="group"
          tabIndex={0}
          aria-labelledby={title ? captionId : undefined}
          aria-label={title ? undefined : "Chart"}
          aria-describedby={hintId}
          className={cn("relative rounded-md", focusRing)}
          onFocus={() => setActive((current) => current ?? 0)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          onKeyDown={(event) => {
            const last = categories.length - 1;
            const current = active ?? 0;
            const next =
              event.key === "ArrowRight" || event.key === "ArrowDown"
                ? Math.min(last, current + 1)
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? Math.max(0, current - 1)
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? last
                      : null;
            if (next === null) return;
            event.preventDefault();
            setActive(next);
          }}
        >
          <span id={hintId} className="sr-only">
            Use the arrow keys to read values, or the table button for all data.
          </span>
          <span aria-live="polite" className="sr-only">
            {active !== null ? readout(active) : ""}
          </span>
          {type === "pie" ? (
            <PiePlot
              width={width}
              height={height}
              values={values[0] ?? []}
              categories={categories}
              active={active}
              setActive={setActive}
              colorOf={sliceColor}
              formatValue={formatValue}
            />
          ) : (
            <CartesianPlot
              type={type}
              width={width}
              height={height}
              values={values}
              categories={categories}
              series={plotted}
              active={active}
              setActive={setActive}
              colorOf={colorOf}
              formatValue={formatValue}
            />
          )}
        </div>
      )}
    </figure>
  );
}

interface PlotProps {
  width: number;
  height: number;
  categories: string[];
  active: number | null;
  setActive: (index: number | null) => void;
  colorOf: (index: number) => string;
  formatValue: (value: number) => string;
}

function CartesianPlot({
  type,
  width,
  height,
  values,
  categories,
  series,
  active,
  setActive,
  colorOf,
  formatValue,
}: PlotProps & { type: "bar" | "line"; values: Array<Array<number | null>>; series: ChartSeries[] }) {
  const flat = values.flat().filter((value): value is number => value !== null);
  const ticks = niceTicks(...extent(flat));
  const domainMin = ticks[0] ?? 0;
  const domainMax = ticks.at(-1) ?? 1;
  const tickLabels = ticks.map((tick) => compact.format(tick));
  const left = Math.max(...tickLabels.map((label) => label.length)) * 7 + 14;
  const plotWidth = Math.max(1, width - left - MARGIN.right);
  const band = plotWidth / categories.length;
  const y = (value: number) => MARGIN.top + ((domainMax - value) / (domainMax - domainMin || 1)) * height;
  const baseline = y(0);
  const centerOf = (index: number) => left + band * (index + 0.5);
  const longest = categories.reduce((length, category) => Math.max(length, category.length), 0);
  const labelEvery = Math.max(1, Math.ceil((longest * 6.5 + 8) / band));
  const count = series.length;
  const barWidth = Math.max(2, Math.min(MAX_BAR, (band * 0.72 - GAP * (count - 1)) / count));
  const groupWidth = barWidth * count + GAP * (count - 1);

  const linePath = (row: Array<number | null>) => {
    let path = "";
    let drawing = false;
    row.forEach((value, index) => {
      if (value === null) {
        drawing = false;
        return;
      }
      path += `${drawing ? "L" : "M"}${centerOf(index)},${y(value)}`;
      drawing = true;
    });
    return path;
  };

  const tooltipX = active !== null ? centerOf(active) : 0;

  return (
    <>
      <svg aria-hidden="true" width={width} height={height + MARGIN.top + MARGIN.bottom} className="block overflow-visible">
        {ticks.map((tick, index) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? "var(--input)" : "var(--border)"}
              shapeRendering="crispEdges"
            />
            <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {tickLabels[index]}
            </text>
          </g>
        ))}
        {categories.map((category, index) =>
          index % labelEvery === 0 ? (
            <text
              key={index}
              x={centerOf(index)}
              y={MARGIN.top + height + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {category}
            </text>
          ) : null,
        )}
        {active !== null && type === "bar" && (
          <rect x={left + band * active} y={MARGIN.top} width={band} height={height} fill="var(--muted)" opacity={0.6} />
        )}
        {active !== null && type === "line" && (
          <line
            x1={tooltipX}
            x2={tooltipX}
            y1={MARGIN.top}
            y2={MARGIN.top + height}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.5}
            shapeRendering="crispEdges"
          />
        )}
        {type === "bar" &&
          values.map((row, s) =>
            row.map((value, index) => {
              if (value === null || value === 0) return null;
              const x = centerOf(index) - groupWidth / 2 + s * (barWidth + GAP);
              const top = Math.min(y(value), baseline);
              return (
                <path
                  key={`${s}-${index}`}
                  d={roundedBar(x, top, barWidth, Math.abs(y(value) - baseline), value > 0)}
                  fill={colorOf(s)}
                />
              );
            }),
          )}
        {type === "line" &&
          values.map((row, s) => {
            let lastIndex = row.length - 1;
            while (lastIndex >= 0 && row[lastIndex] === null) lastIndex--;
            const lastValue = row[lastIndex];
            return (
              <g key={s}>
                <path
                  d={linePath(row)}
                  fill="none"
                  stroke={colorOf(s)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {lastValue !== null && lastValue !== undefined && (
                  <circle cx={centerOf(lastIndex)} cy={y(lastValue)} r={4} fill={colorOf(s)} stroke="var(--card)" strokeWidth={2} />
                )}
                {active !== null && row[active] !== null && row[active] !== undefined && (
                  <circle cx={centerOf(active)} cy={y(row[active])} r={4.5} fill={colorOf(s)} stroke="var(--card)" strokeWidth={2} />
                )}
              </g>
            );
          })}
        {categories.map((_, index) => (
          <rect
            key={index}
            x={left + band * index}
            y={MARGIN.top}
            width={band}
            height={height}
            fill="transparent"
            onPointerEnter={() => setActive(index)}
            onPointerMove={() => setActive(index)}
          />
        ))}
      </svg>
      {active !== null && (
        <ChartTooltip x={tooltipX} containerWidth={width} title={categories[active]}>
          {series.map((entry, s) => (
            <TooltipRow
              key={entry.key}
              color={colorOf(s)}
              line={type === "line"}
              label={entry.label}
              value={values[s]?.[active] === null ? "No data" : formatValue(values[s]?.[active] ?? 0)}
            />
          ))}
        </ChartTooltip>
      )}
    </>
  );
}

function PiePlot({ width, height, values, categories, active, setActive, colorOf, formatValue }: PlotProps & { values: Array<number | null> }) {
  const positive = values.map((value) => Math.max(0, value ?? 0));
  const total = positive.reduce((sum, value) => sum + value, 0);
  const outer = Math.min(width, height) / 2;
  const inner = outer * 0.62;
  const cx = width / 2;
  const cy = outer + MARGIN.top;
  const slices: Array<{ index: number; start: number; end: number; value: number }> = [];
  let angle = 0;
  for (const [index, value] of positive.entries()) {
    const start = angle;
    angle += total > 0 ? (value / total) * Math.PI * 2 : 0;
    slices.push({ index, start, end: angle, value });
  }
  const activeValue = active !== null ? (positive[active] ?? 0) : null;

  return (
    <div className="relative" style={{ height: outer * 2 + MARGIN.top * 2 }}>
      <svg aria-hidden="true" width={width} height={outer * 2 + MARGIN.top * 2} className="block">
        {slices.map((slice) =>
          slice.value > 0 ? (
            <path
              key={slice.index}
              d={arcPath(cx, cy, active === slice.index ? outer : outer - 3, inner, slice.start, slice.end)}
              fill={colorOf(slice.index)}
              stroke="var(--card)"
              strokeWidth={2}
              strokeLinejoin="round"
              onPointerEnter={() => setActive(slice.index)}
              onPointerMove={() => setActive(slice.index)}
            />
          ) : null,
        )}
      </svg>
      <div
        className="pointer-events-none absolute flex flex-col items-center justify-center text-center"
        style={{ left: cx - inner, top: cy - inner, width: inner * 2, height: inner * 2 }}
      >
        {activeValue !== null && active !== null ? (
          <>
            <span className="text-lg font-semibold">{formatValue(activeValue)}</span>
            <span className="max-w-full truncate px-2 text-xs text-muted-foreground">{categories[active]}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {total > 0 ? `${Math.round((activeValue / total) * 100)}%` : ""}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg font-semibold">{formatValue(total)}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </>
        )}
      </div>
    </div>
  );
}

function ChartTooltip({ x, containerWidth, title, children }: { x: number; containerWidth: number; title: ReactNode; children: ReactNode }) {
  const flip = x > containerWidth - 180;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md"
      style={flip ? { right: containerWidth - x + 10 } : { left: x + 10 }}
    >
      <div className="mb-1 text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function TooltipRow({ color, line, label, value }: { color: string; line: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className={cn("shrink-0", line ? "h-0.5 w-3 rounded-full" : "size-2 rounded-sm")} style={{ backgroundColor: color }} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
