// packages/ai-ui/src/components/browser-reader-view.tsx
"use client";

import { type ReactNode, useState } from "react";
import { ChoiceField, ControlPanel } from "../lib/component-controls.js";
import { cn } from "../lib/cn.js";

export interface BrowserReaderViewProps {
  title: string;
  byline?: string;
  children: ReactNode;
  className?: string;
}

const sizes = [{ value: "normal", label: "Standard" }, { value: "large", label: "Large" }, { value: "xlarge", label: "Extra large" }] as const;
const widths = [{ value: "narrow", label: "Narrow" }, { value: "wide", label: "Wide" }] as const;

export function BrowserReaderView({ title, byline, children, className }: BrowserReaderViewProps) {
  const [size, setSize] = useState<(typeof sizes)[number]["value"]>("normal");
  const [width, setWidth] = useState<(typeof widths)[number]["value"]>("narrow");
  return <ControlPanel slot="browser-reader-view" title="Reader view" className={className}>
    <div className="flex flex-wrap gap-2">
      <ChoiceField label="Text size" value={size} options={sizes} onChange={(value) => { if (value) setSize(value); }} />
      <ChoiceField label="Reading width" value={width} options={widths} onChange={(value) => { if (value) setWidth(value); }} />
    </div>
    <article className={cn("mx-auto space-y-3 break-words", width === "narrow" ? "max-w-prose" : "max-w-5xl",
      size === "xlarge" ? "text-xl" : size === "large" ? "text-lg" : "text-base")}>
      <h4 className="text-2xl font-semibold">{title}</h4>
      {byline && <p className="text-sm text-muted-foreground">{byline}</p>}
      <div className="space-y-3 leading-relaxed">{children}</div>
    </article>
  </ControlPanel>;
}
