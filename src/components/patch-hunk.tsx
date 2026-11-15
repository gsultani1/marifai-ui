// packages/ai-ui/src/components/patch-hunk.tsx
import { useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { PatchHunk } from "../lib/patch.js";

export interface PatchHunkViewProps {
  hunk: PatchHunk;
  /** Lines shown before "Show more". */
  maxLines?: number;
  className?: string;
}

interface Row {
  kind: "context" | "added" | "removed";
  oldNumber?: number;
  newNumber?: number;
  text: string;
}

function toRows(hunk: PatchHunk): Row[] {
  const rows: Row[] = [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  for (const line of hunk.lines) {
    const marker = line[0];
    const text = line.slice(1);
    if (marker === "+") rows.push({ kind: "added", newNumber: newLine++, text });
    else if (marker === "-") rows.push({ kind: "removed", oldNumber: oldLine++, text });
    else if (marker === " ") rows.push({ kind: "context", oldNumber: oldLine++, newNumber: newLine++, text });
  }
  return rows;
}

const ROW_CLASS: Record<Row["kind"], string> = {
  context: "",
  added: "bg-[color-mix(in_oklab,var(--code-inserted)_14%,transparent)]",
  removed: "bg-[color-mix(in_oklab,var(--code-deleted)_14%,transparent)]",
};

/** One hunk of a unified diff with old and new line numbers and spoken change markers. */
export function PatchHunkView({ hunk, maxLines = 400, className }: PatchHunkViewProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = toRows(hunk);
  const shown = expanded ? rows : rows.slice(0, maxLines);
  return (
    <div data-slot="patch-hunk" className={cn("overflow-x-auto", className)}>
      <p className="bg-muted/60 px-3 py-0.5 font-mono text-xs text-muted-foreground">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </p>
      <table className="w-full border-collapse font-mono text-xs leading-5">
        <tbody>
          {shown.map((row, index) => (
            <tr key={index} data-kind={row.kind} className={ROW_CLASS[row.kind]}>
              <td className="w-10 pr-2 text-right align-top text-muted-foreground tabular-nums select-none">{row.oldNumber ?? ""}</td>
              <td className="w-10 pr-2 text-right align-top text-muted-foreground tabular-nums select-none">{row.newNumber ?? ""}</td>
              <td className="w-4 align-top select-none">
                <span aria-hidden="true">{row.kind === "added" ? "+" : row.kind === "removed" ? "−" : ""}</span>
                <span className="sr-only">{row.kind === "added" ? "Added:" : row.kind === "removed" ? "Removed:" : ""}</span>
              </td>
              <td className="pr-3 break-all whitespace-pre-wrap">{row.text || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <button type="button" onClick={() => setExpanded(true)} className={cn("w-full bg-muted/40 py-1 text-xs font-medium hover:bg-accent", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
          Show {rows.length - shown.length} more lines
        </button>
      )}
    </div>
  );
}
