// packages/ai-ui/src/components/vibe-builder-code-panel.tsx
"use client";

import { useMemo } from "react";

import { cn } from "../lib/cn.js";
import type { FileTreeEntry } from "../lib/file-tree.js";
import { Button } from "./button.js";
import { CodeEditor } from "./code-editor.js";
import { FileTree } from "./file-tree.js";

export interface VibeBuilderSourceFile extends FileTreeEntry {
  /** Omit until the host has loaded this file. */
  content?: string;
  language?: string;
}

export interface VibeBuilderCodePanelProps {
  files: readonly VibeBuilderSourceFile[];
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onEditFile?: ((path: string, content: string) => void) | undefined;
  onSaveFile?: ((path: string, content: string) => void) | undefined;
  className?: string;
}

export function VibeBuilderCodePanel({ files, activePath, onOpenFile, onEditFile, onSaveFile, className }: VibeBuilderCodePanelProps) {
  const entries = useMemo(() => [...files], [files]);
  const active = files.find((file) => file.path === activePath);
  const editable = Boolean(active && !active.locked && onEditFile);
  const save = active && editable && onSaveFile ? (text: string) => onSaveFile(active.path, text) : undefined;
  return (
    <section aria-label="Project source" data-slot="vibe-builder-code-panel"
      className={cn("grid min-w-0 gap-3 md:grid-cols-[minmax(10rem,15rem)_minmax(0,1fr)]", className)}>
      <div className="max-h-52 min-w-0 overflow-auto rounded-md border border-border md:max-h-96">
        <FileTree files={entries} selectedPath={activePath} onSelect={onOpenFile} label="Project files" />
      </div>
      <div className="min-w-0">
        {!active && <p className="text-sm text-muted-foreground">Select a file to view its source.</p>}
        {active && active.content === undefined && <p role="status" className="text-sm text-muted-foreground">Loading {active.path}…</p>}
        {active?.content !== undefined && (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm break-all">{active.path}</p>
              {save && <Button type="button" size="sm" variant="outline" onClick={() => { if (active.content !== undefined) save(active.content); }}>Save file</Button>}
            </div>
            <CodeEditor key={active.path} aria-label={active.path} value={active.content}
              language={active.language ?? active.path.split(".").at(-1)} readOnly={!editable}
              {...(editable && onEditFile ? { onValueChange: (text: string) => onEditFile(active.path, text) } : {})}
              {...(save ? { onSave: save } : {})} className="h-80" />
          </>
        )}
      </div>
    </section>
  );
}
