// packages/ai-ui/src/experimental/tool-result-export-menu.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { ActionMenu } from "../components/action-menu.js";
import { Button } from "../components/button.js";
export interface ToolResultExportFormat { id: string; label: string; disabled?: boolean }

export interface ToolResultExportMenuProps {
  formats: readonly ToolResultExportFormat[];
  onExport: (id: string) => void;
  className?: string;
}

export function ToolResultExportMenu({ formats, onExport, className }: ToolResultExportMenuProps) {
  return <ControlPanel slot="tool-result-export-menu" title="Export tool result" className={className}>
    {formats.length ? <ActionMenu trigger={<Button type="button" size="sm" variant="outline">Export formats</Button>} items={formats.map((item) => ({
      id:item.id,label:item.label,disabled:item.disabled,onSelect:() => onExport(item.id),
    }))} /> : <p className="text-sm text-muted-foreground">No export formats available.</p>}
  </ControlPanel>;
}
