// src/components/page-builder-inspector.tsx
"use client";

import { useId, useState } from "react";

import { cn } from "../lib/cn.js";
import {
  builderBlockLabel, findBuilderBlock, patchBuilderDocument, resolveBuilderBlockStyle, updateBuilderBlock,
  type BuilderBlockDefinition, type BuilderBlockStyle, type BuilderBreakpoint, type BuilderDesignToken, type BuilderDocument,
} from "../lib/page-builder.js";
import { safeCssColor } from "../lib/rich-text/html.js";
import { BlockSettings, DocumentSettings } from "./page-builder-panels.js";
import type { PageBuilderChange } from "./page-builder.js";
import { Button } from "./button.js";

export interface PageBuilderInspectorProps {
  document: BuilderDocument;
  onDocumentChange: (document: BuilderDocument, change?: PageBuilderChange) => void;
  selectedBlockId: string | null;
  breakpoint?: BuilderBreakpoint;
  registry?: readonly BuilderBlockDefinition[];
  tokens?: readonly BuilderDesignToken[];
  onImageUpload?: (file: File) => Promise<string>;
  className?: string;
}

const NUMERIC_STYLES = [
  { key: "padding", label: "Block padding", max: 200, step: 1 },
  { key: "marginTop", label: "Space before", max: 200, step: 1 },
  { key: "marginBottom", label: "Space after", max: 200, step: 1 },
  { key: "fontSize", label: "Font size", min: 8, max: 200, step: 1 },
  { key: "lineHeight", label: "Line height", min: 0.8, max: 3, step: 0.1 },
  { key: "borderRadius", label: "Border radius", max: 200, step: 1 },
  { key: "widthPercent", label: "Width percent", max: 100, step: 1 },
] as const;

function StyleColorField({ label, value, inherited, onCommit, className }: {
  label: string; value: string | undefined; inherited: string | undefined; onCommit: (value: string | undefined) => void; className: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [problem, setProblem] = useState("");
  const noteId = useId();
  return <label className="flex flex-col gap-1 text-xs font-medium">{label}
    <input className={className} value={draft} placeholder={inherited ?? "Inherited"} aria-invalid={Boolean(problem)}
      aria-describedby={problem ? noteId : undefined} onChange={(event) => { setDraft(event.target.value); setProblem(""); }}
      onBlur={() => {
        const color = draft.trim();
        if (!color) onCommit(undefined);
        else if (safeCssColor(color)) onCommit(color);
        else setProblem("Enter a valid CSS color.");
      }} />
    {problem && <span id={noteId} role="alert" className="text-destructive">{problem}</span>}
  </label>;
}

/** Controlled property editor that shares block selection and responsive values with the canvas. */
export function PageBuilderInspector({
  document, onDocumentChange, selectedBlockId, breakpoint = "desktop", registry, tokens, onImageUpload, className,
}: PageBuilderInspectorProps) {
  const [status, setStatus] = useState("");
  const prefix = useId();
  const block = selectedBlockId ? findBuilderBlock(document, selectedBlockId)?.block : undefined;
  const effective = block ? resolveBuilderBlockStyle(block, breakpoint) : {};
  const own = breakpoint === "desktop" ? block?.style ?? {} : block?.responsive?.[breakpoint] ?? {};
  const fieldClass = "h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function changeStyle(field: keyof BuilderBlockStyle, value: string | number | undefined) {
    if (!block) return;
    const next = { ...own };
    if (value === undefined) delete next[field];
    else Object.assign(next, { [field]: value });
    const patch = breakpoint === "desktop" ? { style: next } : { responsive: { ...block.responsive, [breakpoint]: next } };
    onDocumentChange(updateBuilderBlock(document, block.id, patch), {
      label: `Changed ${field} on ${builderBlockLabel(block)}`,
      mergeKey: `${block.id}:${breakpoint}:${field}`,
    });
  }

  return (
    <aside data-slot="page-builder-inspector" aria-label={block ? "Block settings" : "Design settings"}
      className={cn("flex min-w-0 flex-col gap-4 bg-background p-3 text-foreground", className)}>
      <h3 className="break-words text-sm font-semibold">{block ? builderBlockLabel(block) : "Page settings"}</h3>
      {block ? <>
        <BlockSettings key={block.id} block={block} settings={document.settings} mode="page" registry={registry}
          onImageUpload={onImageUpload} onStatus={setStatus} onChange={(patch, field) => onDocumentChange(updateBuilderBlock(document, block.id, patch), {
            label: `Edited ${builderBlockLabel(block)}`, ...(field ? { mergeKey: `${block.id}:${field}` } : {}),
          })} />
        <fieldset className="min-w-0 space-y-3 border-t border-border pt-3">
          <legend className="px-1 text-sm font-semibold">{breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)} styles</legend>
          <p className="text-xs text-muted-foreground">{breakpoint === "desktop" ? "Desktop values apply at every size unless overridden." : "Fields marked inherited use the larger breakpoint. Reset removes this breakpoint’s override."}</p>
          {NUMERIC_STYLES.map((field) => <div key={field.key} className="grid min-w-0 grid-cols-[1fr_auto] items-end gap-2">
            <label htmlFor={`${prefix}-${field.key}`} className="flex min-w-0 flex-col gap-1 text-xs font-medium">
              <span>{field.label} <span className="font-normal text-muted-foreground">{own[field.key] === undefined ? "inherited" : "override"}</span></span>
              <input id={`${prefix}-${field.key}`} type="number" className={fieldClass}
                min={"min" in field ? field.min : 0} max={field.max} step={field.step}
                value={own[field.key] ?? ""} placeholder={String(effective[field.key] ?? "Default")}
                onChange={(event) => {
                  if (event.target.value === "") return changeStyle(field.key, undefined);
                  const value = event.target.valueAsNumber;
                  const min = "min" in field ? field.min : 0;
                  if (Number.isFinite(value) && value >= min && value <= field.max) changeStyle(field.key, value);
                }} />
            </label>
            <Button type="button" variant="ghost" size="sm" disabled={own[field.key] === undefined}
              aria-label={`Reset ${field.label.toLowerCase()}`} onClick={() => changeStyle(field.key, undefined)}>Reset</Button>
          </div>)}
          <label className="flex flex-col gap-1 text-xs font-medium">Style alignment
            <select className={fieldClass} value={own.align ?? ""} onChange={(event) => changeStyle("align", event.target.value || undefined)}>
              <option value="">Inherited{effective.align ? ` (${effective.align})` : ""}</option>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </label>
          {(["color", "background"] as const).map((field) => <div key={field} className="space-y-1">
            <StyleColorField key={`${block.id}:${breakpoint}:${field}:${own[field] ?? ""}`} className={fieldClass}
              label={field === "color" ? "Style text color" : "Style background"} value={own[field]} inherited={effective[field]}
              onCommit={(value) => changeStyle(field, value)} />
            {tokens && tokens.length > 0 && <select className={cn(fieldClass, "w-full")} aria-label={`${field} design token`} value=""
              onChange={(event) => {
                const token = tokens.find((candidate) => candidate.id === event.target.value);
                if (token && safeCssColor(token.value)) changeStyle(field, token.value);
              }}>
              <option value="">Choose a design token</option>
              {tokens.filter((token) => safeCssColor(token.value)).map((token) => <option key={token.id} value={token.id}>{token.label}</option>)}
            </select>}
            <Button type="button" variant="ghost" size="sm" disabled={own[field] === undefined}
              onClick={() => changeStyle(field, undefined)}>Reset {field}</Button>
          </div>)}
        </fieldset>
      </> : <DocumentSettings doc={document} mode="page" onChange={(patch, field) => onDocumentChange(patchBuilderDocument(document, patch), {
        label: "Changed page settings", ...(field ? { mergeKey: `document:${field}` } : {}),
      })} />}
      {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
    </aside>
  );
}
