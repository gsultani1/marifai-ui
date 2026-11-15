// packages/ai-ui/src/components/execution-output.tsx
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn.js";
import type { ExecutionOutput } from "../lib/execution.js";
import { AnsiText } from "./ansi-text.js";
import { JsonViewer } from "./json-viewer.js";

export interface ExecutionOutputViewProps {
  outputs: ExecutionOutput[];
  /** Lets HTML outputs run scripts inside their sandboxed frame (still without access to your page). */
  allowScripts?: boolean;
  className?: string;
}

type Block = { kind: "stream"; parts: Array<{ stream: "stdout" | "stderr"; text: string }> } | { kind: "single"; output: Exclude<ExecutionOutput, { type: "stdout" | "stderr" }> };

function toBlocks(outputs: ExecutionOutput[]): Block[] {
  const blocks: Block[] = [];
  for (const output of outputs) {
    if (output.type === "stdout" || output.type === "stderr") {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "stream") last.parts.push({ stream: output.type, text: output.text });
      else blocks.push({ kind: "stream", parts: [{ stream: output.type, text: output.text }] });
    } else blocks.push({ kind: "single", output });
  }
  return blocks;
}

/**
 * Results of running code: consecutive stdout and stderr merged into one
 * block with ANSI colors, images with alt text, HTML in a sandboxed frame,
 * JSON in a collapsible viewer and errors with their traceback.
 */
export function ExecutionOutputView({ outputs, allowScripts = false, className }: ExecutionOutputViewProps) {
  if (!outputs.length) return null;
  return (
    <div data-slot="execution-output" className={cn("flex min-w-0 flex-col gap-2", className)}>
      {toBlocks(outputs).map((block, index): ReactNode => {
        if (block.kind === "stream") {
          return (
            <pre key={index} tabIndex={0} aria-label="Output" className="max-h-96 overflow-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring bg-code-background px-3 py-2 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-code-foreground">
              {block.parts.map((part, partIndex) => (
                <span key={partIndex} data-stream={part.stream} className={part.stream === "stderr" ? "text-[var(--ansi-red)]" : undefined}>
                  <AnsiText text={part.text} />
                </span>
              ))}
            </pre>
          );
        }
        const { output } = block;
        switch (output.type) {
          case "image":
            return <img key={index} src={output.src} alt={output.alt} className="max-h-96 max-w-full self-start rounded-md border border-border bg-white object-contain" />;
          case "html":
            return (
              <iframe
                key={index}
                title={output.title ?? "HTML output"}
                srcDoc={output.html}
                sandbox={allowScripts ? "allow-scripts" : ""}
                referrerPolicy="no-referrer"
                className="h-56 w-full resize-y rounded-md border border-border bg-white"
              />
            );
          case "json":
            return <JsonViewer key={index} value={output.value} defaultExpandDepth={1} label={output.label ?? "JSON output"} />;
          case "error":
            return (
              <div key={index} role="alert" className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                <p className="flex items-center gap-1.5 font-medium [&_svg]:size-4 [&_svg]:text-destructive">
                  <TriangleAlertIcon aria-hidden="true" />
                  {output.name ? `${output.name}: ` : ""}
                  {output.message}
                </p>
                {output.traceback && (
                  <pre tabIndex={0} aria-label="Traceback" className="max-h-72 overflow-auto rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono text-xs leading-5 whitespace-pre-wrap">
                    <AnsiText text={output.traceback} />
                  </pre>
                )}
              </div>
            );
        }
      })}
    </div>
  );
}
