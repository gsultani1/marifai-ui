// packages/ai-ui/src/lib/patch.ts
import { parsePatch, structuredPatch, type StructuredPatchHunk } from "diff";

import type { FileChangeStatus } from "./file-tree.js";

export type PatchHunk = StructuredPatchHunk;

export interface PatchFile {
  path: string;
  /** Previous path of a renamed file. */
  oldPath?: string;
  status: Extract<FileChangeStatus, "added" | "deleted" | "renamed" | "modified">;
  additions: number;
  deletions: number;
  hunks: PatchHunk[];
  binary: boolean;
}

const stripPrefix = (name: string | undefined) => (name && name !== "/dev/null" ? name.replace(/^[ab]\//, "") : undefined);

/** Lines added and removed in a hunk. */
export function hunkStats(hunk: PatchHunk): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of hunk.lines) {
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }
  return { additions, deletions };
}

/** Files in a unified diff (plain or `git diff` output) with status, line counts and hunks. */
export function parseUnifiedDiff(text: string): PatchFile[] {
  return parsePatch(text)
    .filter((patch) => patch.hunks.length > 0 || patch.isBinary || patch.isRename || patch.isCreate || patch.isDelete)
    .map((patch) => {
      const oldPath = stripPrefix(patch.oldFileName);
      const newPath = stripPrefix(patch.newFileName);
      const status: PatchFile["status"] = patch.isCreate || !oldPath ? "added" : patch.isDelete || !newPath ? "deleted" : patch.isRename || oldPath !== newPath ? "renamed" : "modified";
      const totals = patch.hunks.map(hunkStats).reduce((sum, item) => ({ additions: sum.additions + item.additions, deletions: sum.deletions + item.deletions }), { additions: 0, deletions: 0 });
      return {
        path: newPath ?? oldPath ?? "unknown",
        ...(status === "renamed" && oldPath ? { oldPath } : {}),
        status,
        ...totals,
        hunks: patch.hunks,
        binary: Boolean(patch.isBinary),
      };
    });
}

/** Hunks that turn `oldText` into `newText`, with `context` unchanged lines around each change. */
export function diffHunks(oldText: string, newText: string, context = 3): PatchHunk[] {
  return structuredPatch("a", "b", oldText, newText, "", "", { context }).hunks;
}

/**
 * Applies only the accepted hunks to `oldText`; rejected hunks keep the
 * original lines. Hunks must come from the same diff, in order.
 */
export function applyHunkSelection(oldText: string, hunks: PatchHunk[], accepted: boolean[]): string {
  const source = oldText.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const output: string[] = [];
  let cursor = 0;
  hunks.forEach((hunk, index) => {
    const start = Math.min(source.length, hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart - 1);
    while (cursor < start) output.push(source[cursor++]!);
    if (!accepted[index]) {
      for (let line = 0; line < hunk.oldLines; line++) output.push(source[cursor++] ?? "");
      return;
    }
    hunk.lines.forEach((line, position) => {
      const marker = line[0];
      if (marker === " ") output.push(source[cursor++] ?? "");
      else if (marker === "-") cursor++;
      else if (marker === "+") output.push(hunk.lines[position + 1]?.startsWith("\\") ? line.slice(1) : `${line.slice(1)}\n`);
    });
  });
  while (cursor < source.length) output.push(source[cursor++]!);
  return output.join("");
}
