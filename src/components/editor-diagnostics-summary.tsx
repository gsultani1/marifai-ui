// packages/ai-ui/src/components/editor-diagnostics-summary.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export type EditorDiagnosticSeverity = "error" | "warning" | "info";
export interface DiagnosticCount { file: string; severity: EditorDiagnosticSeverity; count: number }

export interface EditorDiagnosticsSummaryProps {
  counts: readonly DiagnosticCount[];
  onOpen: (file: string | null, severity: EditorDiagnosticSeverity) => void;
  className?: string;
}

export function EditorDiagnosticsSummary({ counts, onOpen, className }: EditorDiagnosticsSummaryProps) {
  const severities: readonly EditorDiagnosticSeverity[] = ["error","warning","info"];
  const files = [...new Set(counts.map((item) => item.file))];
  return <ControlPanel slot="editor-diagnostics-summary" title="Diagnostics summary" className={className}>
    <div className="flex flex-wrap gap-2">{severities.map((severity) => {
      const count = counts.reduce((total,item) => item.severity === severity ? total + item.count : total, 0);
      return <ControlAction key={severity} label={count + " " + severity} disabled={!count} onClick={() => onOpen(null,severity)} />;
    })}</div>
    <ItemList items={files.map((file) => ({ id:file }))} empty="No diagnostics." render={({id:file}) => <ItemHeading title={file}>
      {severities.map((severity) => {
        const count = counts.reduce((total,item) => item.file === file && item.severity === severity ? total + item.count : total,0);
        return count > 0 && <ControlAction key={severity} label={count + " " + severity} item={file} onClick={() => onOpen(file,severity)} />;
      })}
    </ItemHeading>} />
  </ControlPanel>;
}
