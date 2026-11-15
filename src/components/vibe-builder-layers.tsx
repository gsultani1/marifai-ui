// packages/ai-ui/src/components/vibe-builder-layers.tsx
"use client";

import { LabeledTree } from "../lib/collection-controls.js";
import { ControlAction, ControlPanel } from "../lib/component-controls.js";
import { builderBlockLabel, type BuilderBlock, type BuilderDocument } from "../lib/page-builder.js";

export interface VibeBuilderLayersProps {
  document: BuilderDocument;
  selectedBlockId: string | null;
  onSelectedBlockChange: (id: string | null) => void;
  className?: string;
}

interface Layer {
  id: string;
  label: string;
  children: Layer[];
}

function layers(blocks: readonly BuilderBlock[]): Layer[] {
  return blocks.map((block) => {
    const children = block.type === "section" ? block.blocks
      : block.type === "columns" ? block.columns.flatMap((column) => column.blocks)
      : [];
    return { id: block.id, label: builderBlockLabel(block), children: layers(children) };
  });
}

export function VibeBuilderLayers({ document, selectedBlockId, onSelectedBlockChange, className }: VibeBuilderLayersProps) {
  return (
    <ControlPanel slot="vibe-builder-layers" title="Layers" className={className}>
      <LabeledTree items={layers(document.blocks)} label="Page layers" activeId={selectedBlockId}
        onSelect={onSelectedBlockChange} searchable />
      <ControlAction label="Select page" disabled={selectedBlockId === null} onClick={() => onSelectedBlockChange(null)} />
    </ControlPanel>
  );
}
