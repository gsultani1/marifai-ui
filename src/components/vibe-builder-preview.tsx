// src/components/vibe-builder-preview.tsx
"use client";

import { useMemo } from "react";

import { cn } from "../lib/cn.js";
import { builderToHtml, type BuilderDocument, type BuilderBlockDefinition } from "../lib/page-builder.js";
import { InteractivePreview } from "./interactive-preview.js";

export type VibeBuilderPreviewSource =
  | { kind: "design"; document: BuilderDocument }
  | { kind: "generated"; html: string; script?: string };

export interface VibeBuilderPreviewProps {
  source: VibeBuilderPreviewSource;
  title?: string;
  /** Enables opaque-origin scripts for a generated preview. Leave off for static HTML. */
  allowScripts?: boolean | undefined;
  onRuntimeError?: ((message: string) => void) | undefined;
  /** Origins from which the sandbox may load resources. */
  allowedOrigins?: readonly string[] | undefined;
  showToolbar?: boolean;
  registry?: readonly BuilderBlockDefinition[] | undefined;
  className?: string;
}

export function VibeBuilderPreview({ source, title = "Project preview", allowScripts = false, onRuntimeError, allowedOrigins, showToolbar = true, registry, className }: VibeBuilderPreviewProps) {
  const document = source.kind === "design" ? source.document : undefined;
  const designHtml = useMemo(() => document && builderToHtml(document, { target: "web", registry }), [document, registry]);
  const html = source.kind === "generated" ? source.html : designHtml;
  const script = source.kind === "generated" && allowScripts ? source.script : undefined;
  return (
    <div data-slot="vibe-builder-preview" className={cn("min-w-0", className)}>
      <InteractivePreview title={title} html={html} script={script} sandbox={[]} allowScripts={source.kind === "generated" && allowScripts}
        {...(allowedOrigins ? { allowedOrigins } : {})}
        onRuntimeError={onRuntimeError} toolbar={showToolbar} className="h-[min(29rem,60svh)] min-h-64 overflow-hidden rounded-md border border-border" />
    </div>
  );
}
