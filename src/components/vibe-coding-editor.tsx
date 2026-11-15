// packages/ai-ui/src/components/vibe-coding-editor.tsx
"use client";

import { LayersIcon, SparklesIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useControllableState } from "../hooks/use-controllable-state.js";

import { builderBlockLabel, type BuilderBlock, type BuilderDocument, findBuilderBlock } from "../lib/page-builder.js";
import { VibeBuilderCanvas, type VibeBuilderCanvasProps } from "./vibe-builder-canvas.js";
import { VibeBuilderChangeReview, type VibeBuilderApplyRequest, type VibeBuilderProposal } from "./vibe-builder-change-review.js";
import { VibeBuilderCodePanel, type VibeBuilderCodePanelProps } from "./vibe-builder-code-panel.js";
import { VibeBuilderComposer, type VibeBuilderPromptRequest } from "./vibe-builder-composer.js";
import { VibeBuilderLayers } from "./vibe-builder-layers.js";
import { VibeBuilderPreview, type VibeBuilderPreviewSource } from "./vibe-builder-preview.js";
import { VibeBuilderWorkbench, type VibeBuilderView } from "./vibe-builder-workbench.js";

export interface VibeCodingEditorProps {
  projectId: string;
  title: string;
  /** Change this when the host commits an edit to the design or source. */
  revision: string;
  document: BuilderDocument;
  onDocumentChange: (document: BuilderDocument) => void;
  onRequest: (request: VibeBuilderPromptRequest) => void | Promise<void>;
  conversation?: ReactNode;
  generating?: boolean;
  onStop?: () => void;
  suggestions?: readonly string[];
  /** Prompt suggestions for the currently selected block. */
  getBlockSuggestions?: (block: BuilderBlock) => readonly string[];
  view?: VibeBuilderView;
  onViewChange?: (view: VibeBuilderView) => void;
  code?: VibeBuilderCodePanelProps;
  /** Defaults to a preview of the current visual design. */
  previewSource?: VibeBuilderPreviewSource;
  allowPreviewScripts?: boolean;
  /** Resource origins permitted in Preview and Review. */
  previewAllowedOrigins?: readonly string[];
  onPreviewError?: (message: string) => void;
  proposal?: VibeBuilderProposal | null;
  onApplyProposal: (request: VibeBuilderApplyRequest) => void | Promise<void>;
  onDiscardProposal?: (id: string) => void;
  onImageUpload?: VibeBuilderCanvasProps["onImageUpload"];
  toolbar?: ReactNode;
  className?: string;
}

export function VibeCodingEditor(props: VibeCodingEditorProps) {
  return <ProjectEditor key={props.projectId} {...props} />;
}

function ProjectEditor({
  title, revision, document, onDocumentChange, onRequest, conversation, generating, onStop, suggestions, getBlockSuggestions, view, onViewChange, code, previewSource,
  allowPreviewScripts, previewAllowedOrigins, onPreviewError, proposal, onApplyProposal, onDiscardProposal, onImageUpload, toolbar, className,
}: VibeCodingEditorProps) {
  const [selectedId, selectBlock] = useState<string | null>(null);
  const [activeView, changeView] = useControllableState<VibeBuilderView>({ value: view, defaultValue: "design", onChange: onViewChange });
  const selected = selectedId ? findBuilderBlock(document, selectedId)?.block : undefined;
  const selectedBlockId = selected?.id ?? null;

  return (
    <VibeBuilderWorkbench title={title} view={activeView} onViewChange={changeView} toolbar={toolbar}
      {...(className ? { className } : {})}
      assistant={<div className="flex h-full min-w-0 flex-col">
        <h3 className="flex items-center gap-2 border-b border-border px-4 py-3.5 text-sm font-semibold">
          <SparklesIcon className="size-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
          Assistant
        </h3>
        <div className="min-h-0 flex-1 p-4">{conversation}</div>
        <VibeBuilderComposer revision={revision} onSubmit={onRequest} generating={generating} onStop={onStop}
          suggestions={suggestions} blockSuggestions={selected && getBlockSuggestions?.(selected)}
          className="border-t border-border bg-background p-3.5"
          selectedBlock={selected ? { id: selected.id, label: builderBlockLabel(selected) } : null} />
      </div>}
      design={<VibeBuilderCanvas document={document} onDocumentChange={onDocumentChange} selectedBlockId={selectedBlockId}
        layout="workspace" height="clamp(24rem, calc(100svh - 17rem), 52rem)"
        onSelectedBlockChange={selectBlock} {...(onImageUpload ? { onImageUpload } : {})}
        toolbar={<details className="relative">
          <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <LayersIcon className="size-4" aria-hidden="true" />
            Layers
          </summary>
          <div className="absolute top-full left-0 z-30 mt-2 max-h-80 w-56 overflow-auto rounded-lg bg-background shadow-lg @sm:right-0 @sm:left-auto">
            <VibeBuilderLayers document={document} selectedBlockId={selectedBlockId} onSelectedBlockChange={selectBlock} />
          </div>
        </details>} />}
      code={code && <VibeBuilderCodePanel {...code} />}
      preview={<VibeBuilderPreview source={previewSource ?? { kind: "design", document }} allowScripts={allowPreviewScripts}
        onRuntimeError={onPreviewError} allowedOrigins={previewAllowedOrigins} />}
      review={proposal && <VibeBuilderChangeReview proposal={proposal} revision={revision}
        onApply={onApplyProposal} onDiscard={onDiscardProposal} allowedOrigins={previewAllowedOrigins} />}
    />
  );
}
