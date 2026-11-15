// packages/ai-ui/src/components/design-editor-panels.tsx
"use client";

import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalDistributeCenterIcon,
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
  UnlockIcon,
} from "lucide-react";
import { type ReactNode, useId } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type Alignment, type Arrange, type Design, type DesignElement, type DesignPage, isLinear } from "../lib/design/geometry.js";
import { DesignPageSvg } from "./design-page-svg.js";

export const DESIGN_SIZES: Array<{ id: string; label: string; width: number; height: number }> = [
  { id: "square", label: "Square post · 1080 × 1080", width: 1080, height: 1080 },
  { id: "story", label: "Story · 1080 × 1920", width: 1080, height: 1920 },
  { id: "slide", label: "Presentation · 1920 × 1080", width: 1920, height: 1080 },
  { id: "letter", label: "US Letter · 816 × 1056", width: 816, height: 1056 },
  { id: "a4", label: "A4 · 794 × 1123", width: 794, height: 1123 },
  { id: "banner", label: "Web banner · 1200 × 628", width: 1200, height: 628 },
  { id: "flyer", label: "Half-page flyer · 816 × 528", width: 816, height: 528 },
];

const KIND_LABEL: Record<DesignElement["kind"], string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  star: "Star",
  line: "Line",
  arrow: "Arrow",
  text: "Text",
  image: "Image",
};

/** Human label for an element in lists and announcements. */
export function elementLabel(element: DesignElement): string {
  if (element.name) return element.name;
  if (element.kind === "text" && element.text) return `Text: ${element.text.split("\n")[0]!.slice(0, 32)}`;
  if (element.kind === "image" && element.alt) return `Image: ${element.alt.slice(0, 32)}`;
  return KIND_LABEL[element.kind];
}

const panelHeading = "px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase";

export interface PagesPanelProps {
  design: Design;
  pageId: string;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PagesPanel({ design, pageId, readOnly, onSelect, onAdd, onDuplicate, onDelete }: PagesPanelProps) {
  return (
    <section aria-label="Pages" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className={panelHeading}>Pages</h3>
        {!readOnly && (
          <button type="button" aria-label="Add page" onClick={onAdd} className={cn(iconButton, "size-7", focusRing)}>
            <PlusIcon aria-hidden="true" />
          </button>
        )}
      </div>
      <ol className="flex flex-col gap-2">
        {design.pages.map((page, index) => (
          <li key={page.id} className="group relative">
            <button
              type="button"
              aria-current={page.id === pageId ? "page" : undefined}
              onClick={() => onSelect(page.id)}
              className={cn("block w-full overflow-hidden rounded-md border-2 bg-background", page.id === pageId ? "border-primary" : "border-border hover:border-muted-foreground", focusRing)}
            >
              <span className="sr-only">
                Page {index + 1}
                {page.name ? `: ${page.name}` : ""}
              </span>
              <DesignPageSvg page={page} width={design.width} height={design.height} className="block h-auto w-full" aria-hidden="true" />
            </button>
            <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-background/90 px-1 text-xs tabular-nums">{index + 1}</span>
            {!readOnly && (
              <span className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                <button type="button" aria-label={`Duplicate page ${index + 1}`} onClick={() => onDuplicate(page.id)} className={cn(iconButton, "size-6 bg-background/90", focusRing)}>
                  <CopyIcon aria-hidden="true" />
                </button>
                <button type="button" aria-label={`Delete page ${index + 1}`} disabled={design.pages.length <= 1} onClick={() => onDelete(page.id)} className={cn(iconButton, "size-6 bg-background/90", focusRing)}>
                  <Trash2Icon aria-hidden="true" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export interface LayersPanelProps {
  page: DesignPage;
  selection: ReadonlySet<string>;
  readOnly: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onToggle: (id: string, key: "hidden" | "locked") => void;
}

export function LayersPanel({ page, selection, readOnly, onSelect, onToggle }: LayersPanelProps) {
  const layers = [...page.elements].reverse();
  return (
    <section aria-label="Layers" className="flex min-h-0 flex-col gap-2">
      <h3 className={panelHeading}>Layers</h3>
      {layers.length === 0 && <p className="px-1 text-xs text-muted-foreground">Add a shape, text or image to start.</p>}
      <ul className="flex flex-col gap-0.5 overflow-y-auto">
        {layers.map((element) => (
          <li key={element.id} className={cn("flex items-center gap-0.5 rounded-md pr-0.5", selection.has(element.id) && "bg-accent")}>
            <button
              type="button"
              aria-pressed={selection.has(element.id)}
              onClick={(event) => onSelect(element.id, event.shiftKey || event.metaKey || event.ctrlKey)}
              className={cn("min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-xs", element.hidden && "text-muted-foreground line-through", focusRing)}
            >
              {elementLabel(element)}
            </button>
            {!readOnly && (
              <>
                <button type="button" aria-label={`${element.hidden ? "Show" : "Hide"} ${elementLabel(element)}`} aria-pressed={Boolean(element.hidden)} onClick={() => onToggle(element.id, "hidden")} className={cn(iconButton, "size-6", focusRing)}>
                  {element.hidden ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
                </button>
                <button type="button" aria-label={`${element.locked ? "Unlock" : "Lock"} ${elementLabel(element)}`} aria-pressed={Boolean(element.locked)} onClick={() => onToggle(element.id, "locked")} className={cn(iconButton, "size-6", focusRing)}>
                  {element.locked ? <LockIcon aria-hidden="true" /> : <UnlockIcon aria-hidden="true" />}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NumberField({ label, value, onChange, step = 1, min, max, suffix }: { label: string; value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">
        {label}
        {suffix && <span className="sr-only"> ({suffix})</span>}
      </span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ""}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (event.target.value !== "" && Number.isFinite(next)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? next, Math.max(min ?? next, next)) : next);
        }}
        className={cn("h-7 w-full min-w-0 rounded-md border border-input bg-background px-1.5 text-xs tabular-nums", focusRing)}
      />
    </label>
  );
}

function toHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map((char) => char + char).join("")}`;
  return fallback;
}

function ColorField({ label, value, onChange, allowNone = false }: { label: string; value: string | undefined; onChange: (value: string) => void; allowNone?: boolean }) {
  const id = useId();
  const none = !value || value === "none" || value === "transparent";
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input id={id} type="color" value={toHex(value, "#000000")} onChange={(event) => onChange(event.target.value)} className={cn("h-7 w-9 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5", focusRing)} />
        <input
          aria-label={`${label} value`}
          value={none ? "none" : value}
          onChange={(event) => onChange(event.target.value)}
          className={cn("h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 font-mono text-xs", focusRing)}
        />
        {allowNone && (
          <button type="button" aria-pressed={none} onClick={() => onChange("none")} className={cn("h-7 rounded-md px-1.5 text-xs hover:bg-accent aria-pressed:bg-accent", focusRing)}>
            None<span className="sr-only"> ({label.toLowerCase()})</span>
          </button>
        )}
      </div>
    </div>
  );
}

export interface PropertiesPanelProps {
  design: Design;
  page: DesignPage;
  selected: DesignElement[];
  onChange: (patch: Partial<DesignElement>) => void;
  onPageChange: (patch: Partial<DesignPage>) => void;
  onResizeDesign: (width: number, height: number) => void;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
  onArrange: (arrange: Arrange) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReplaceImage: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <legend className={cn(panelHeading, "mb-1")}>{title}</legend>
      {children}
    </fieldset>
  );
}

export function PropertiesPanel({ design, page, selected, onChange, onPageChange, onResizeDesign, onAlign, onDistribute, onArrange, onDuplicate, onDelete, onReplaceImage }: PropertiesPanelProps) {
  const single = selected.length === 1 ? selected[0]! : null;
  const sizeId = useId();
  const tool = cn(iconButton, "size-7", focusRing);

  if (selected.length === 0) {
    const preset = DESIGN_SIZES.find((size) => size.width === design.width && size.height === design.height)?.id ?? "custom";
    return (
      <div className="flex flex-col gap-3">
        <Section title="Page">
          <ColorField label="Background" value={page.background} onChange={(background) => onPageChange({ background })} />
          <label htmlFor={sizeId} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Size</span>
            <select
              id={sizeId}
              value={preset}
              onChange={(event) => {
                const size = DESIGN_SIZES.find((item) => item.id === event.target.value);
                if (size) onResizeDesign(size.width, size.height);
              }}
              className={cn("h-7 rounded-md border border-input bg-background px-1 text-xs", focusRing)}
            >
              {DESIGN_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
              {preset === "custom" && (
                <option value="custom">
                  Custom · {design.width} × {design.height}
                </option>
              )}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" suffix="pixels" value={design.width} min={16} max={8000} onChange={(width) => onResizeDesign(width, design.height)} />
            <NumberField label="Height" suffix="pixels" value={design.height} min={16} max={8000} onChange={(height) => onResizeDesign(design.width, height)} />
          </div>
          <p className="text-xs text-muted-foreground">Resizing scales everything on every page.</p>
        </Section>
      </div>
    );
  }

  const value = <K extends keyof DesignElement>(key: K) => (single ? single[key] : selected.every((element) => element[key] === selected[0]![key]) ? selected[0]![key] : undefined);
  const hasText = selected.every((element) => element.kind === "text");
  const hasFill = selected.every((element) => !isLinear(element) && element.kind !== "text" && element.kind !== "image");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-0.5" role="group" aria-label="Arrange">
        <button type="button" aria-label="Bring to front" onClick={() => onArrange("front")} className={tool}>
          <ArrowUpToLineIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Bring forward" onClick={() => onArrange("forward")} className={tool}>
          <ChevronUpIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Send backward" onClick={() => onArrange("backward")} className={tool}>
          <ChevronDownIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Send to back" onClick={() => onArrange("back")} className={tool}>
          <ArrowDownToLineIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Duplicate" onClick={onDuplicate} className={cn(tool, "ml-auto")}>
          <CopyIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Delete" onClick={onDelete} className={tool}>
          <Trash2Icon aria-hidden="true" />
        </button>
      </div>
      <Section title={selected.length > 1 ? `Align ${selected.length} elements` : "Align to page"}>
        <div className="flex flex-wrap gap-0.5">
          {(
            [
              ["left", "Align left", <AlignStartVerticalIcon key="l" aria-hidden="true" />],
              ["center", "Align centers horizontally", <AlignCenterVerticalIcon key="c" aria-hidden="true" />],
              ["right", "Align right", <AlignEndVerticalIcon key="r" aria-hidden="true" />],
              ["top", "Align top", <AlignStartHorizontalIcon key="t" aria-hidden="true" />],
              ["middle", "Align middles vertically", <AlignCenterHorizontalIcon key="m" aria-hidden="true" />],
              ["bottom", "Align bottom", <AlignEndHorizontalIcon key="b" aria-hidden="true" />],
            ] as const
          ).map(([alignment, label, icon]) => (
            <button key={alignment} type="button" aria-label={label} onClick={() => onAlign(alignment)} className={tool}>
              {icon}
            </button>
          ))}
          {selected.length >= 3 && (
            <>
              <button type="button" aria-label="Distribute horizontally" onClick={() => onDistribute("horizontal")} className={tool}>
                <AlignHorizontalDistributeCenterIcon aria-hidden="true" />
              </button>
              <button type="button" aria-label="Distribute vertically" onClick={() => onDistribute("vertical")} className={tool}>
                <AlignVerticalDistributeCenterIcon aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </Section>
      {single && (
        <Section title="Position and size">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="X" value={single.x} onChange={(x) => onChange({ x })} />
            <NumberField label="Y" value={single.y} onChange={(y) => onChange({ y })} />
            <NumberField label={isLinear(single) ? "Run" : "Width"} value={single.width} min={isLinear(single) ? undefined : 1} onChange={(width) => onChange({ width })} />
            <NumberField label={isLinear(single) ? "Rise" : "Height"} value={single.height} min={isLinear(single) ? undefined : 1} onChange={(height) => onChange({ height })} />
            {!isLinear(single) && <NumberField label="Rotation" suffix="degrees" value={single.rotation ?? 0} min={0} max={359} onChange={(rotation) => onChange({ rotation })} />}
            {single.kind === "rect" && <NumberField label="Corner radius" value={single.radius ?? 0} min={0} onChange={(radius) => onChange({ radius })} />}
          </div>
        </Section>
      )}
      <Section title="Appearance">
        {hasFill && <ColorField label="Fill" value={value("fill") as string | undefined} allowNone onChange={(fill) => onChange({ fill })} />}
        {!hasText && selected.every((element) => element.kind !== "image") && (
          <>
            <ColorField label="Stroke" value={value("stroke") as string | undefined} allowNone={hasFill} onChange={(stroke) => onChange({ stroke })} />
            <NumberField label="Stroke width" value={(value("strokeWidth") as number | undefined) ?? 0} min={0} max={200} onChange={(strokeWidth) => onChange({ strokeWidth })} />
          </>
        )}
        <label className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(((value("opacity") as number | undefined) ?? 1) * 100)}
            onChange={(event) => onChange({ opacity: Number(event.target.value) / 100 })}
            className={cn("accent-primary", focusRing)}
          />
        </label>
      </Section>
      {hasText && (
        <Section title="Text">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Font size" value={(value("fontSize") as number | undefined) ?? 24} min={4} max={800} onChange={(fontSize) => onChange({ fontSize })} />
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Weight</span>
              <select value={String(value("fontWeight") ?? 400)} onChange={(event) => onChange({ fontWeight: Number(event.target.value) })} className={cn("h-7 rounded-md border border-input bg-background px-1 text-xs", focusRing)}>
                <option value="300">Light</option>
                <option value="400">Regular</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">Extra bold</option>
              </select>
            </label>
          </div>
          <div className="flex gap-0.5" role="group" aria-label="Text alignment">
            {(["left", "center", "right"] as const).map((align) => (
              <button key={align} type="button" aria-pressed={(value("textAlign") ?? "left") === align} onClick={() => onChange({ textAlign: align })} className={cn("h-7 flex-1 rounded-md text-xs capitalize hover:bg-accent aria-pressed:bg-accent", focusRing)}>
                {align}
              </button>
            ))}
          </div>
          <ColorField label="Text color" value={value("color") as string | undefined} onChange={(color) => onChange({ color })} />
        </Section>
      )}
      {single?.kind === "image" && (
        <Section title="Image">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Description (alt text)</span>
            <input value={single.alt ?? ""} onChange={(event) => onChange({ alt: event.target.value })} className={cn("h-7 rounded-md border border-input bg-background px-1.5 text-xs", focusRing)} />
          </label>
          <button type="button" onClick={onReplaceImage} className={cn("h-7 rounded-md border border-border px-2 text-xs hover:bg-accent", focusRing)}>
            Replace image
          </button>
        </Section>
      )}
    </div>
  );
}
