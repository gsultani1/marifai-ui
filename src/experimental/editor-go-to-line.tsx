// packages/ai-ui/src/experimental/editor-go-to-line.tsx
"use client";

import { useId, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Button } from "../components/button.js";

export interface EditorGoToLineProps {
  /** Number of lines in the active document. Positions are one-based. */
  lineCount: number;
  onGoTo: (line: number, column?: number) => void;
  className?: string;
}

export function EditorGoToLine({ lineCount, onGoTo, className }: EditorGoToLineProps) {
  const id = useId();
  const [position, setPosition] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      aria-label="Go to source line"
      data-slot="editor-go-to-line"
      className={cn("space-y-1.5 text-sm", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const match = /^(\d+)(?::(\d+))?$/.exec(position.trim());
        const line = Number(match?.[1]);
        const column = match?.[2] === undefined ? undefined : Number(match[2]);
        if (!Number.isSafeInteger(line) || line < 1 || line > lineCount) {
          setError(`Enter a line from 1 to ${lineCount}. Use line:column to include a column.`);
          return;
        }
        if (column !== undefined && (!Number.isSafeInteger(column) || column < 1)) {
          setError("Enter a positive column number.");
          return;
        }
        setError("");
        onGoTo(line, column);
      }}
    >
      <label htmlFor={id} className="block text-xs font-medium">Line or line:column</label>
      <div className="flex gap-2">
        <input
          id={id}
          autoComplete="off"
          placeholder="42:8"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + "-error" : undefined}
          value={position}
          onChange={(event) => { setPosition(event.currentTarget.value); setError(""); }}
          className={cn("h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2", focusRing)}
        />
        <Button type="submit" size="sm" variant="outline" disabled={!position.trim() || lineCount < 1}>Go to line</Button>
      </div>
      {error && <p id={id + "-error"} role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
