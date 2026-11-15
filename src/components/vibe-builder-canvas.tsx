// packages/ai-ui/src/components/vibe-builder-canvas.tsx
"use client";

import type { BuilderDocument } from "../lib/page-builder.js";
import { cn } from "../lib/cn.js";
import { PageBuilder, type PageBuilderProps } from "./page-builder.js";

export interface VibeBuilderCanvasProps extends Pick<PageBuilderProps, "height" | "label" | "onImageUpload" | "className" | "layout" | "toolbar"> {
  document: BuilderDocument;
  onDocumentChange: (document: BuilderDocument) => void;
  selectedBlockId: string | null;
  onSelectedBlockChange: (id: string | null) => void;
}

/** The drag-and-drop page editor bound to a host document and shared block selection. */
export function VibeBuilderCanvas({
  document, onDocumentChange, selectedBlockId, onSelectedBlockChange, className, ...editorProps
}: VibeBuilderCanvasProps) {
  return (
    <div data-slot="vibe-builder-canvas" className={cn("min-w-0", className)}>
      <PageBuilder {...editorProps} mode="page" value={document} onValueChange={onDocumentChange}
        selectedBlockId={selectedBlockId} onSelectedBlockChange={onSelectedBlockChange} />
    </div>
  );
}
