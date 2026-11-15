// packages/ai-ui/src/components/conversation-transfer.tsx
"use client";

import { CheckIcon, CopyIcon, FileJsonIcon, FileTextIcon } from "lucide-react";
import { useState } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { exportConversation, type ImportLimits, messagesToMarkdown, parseConversationImport, type Transcript } from "../lib/conversation.js";
import { downloadText, safeFileName } from "../lib/download.js";
import { FileDropzone } from "./file-dropzone.js";

export interface ConversationTransferProps {
  /** Conversation to export; omit to show import only. */
  transcript?: Transcript;
  /** Enables import; receives the validated conversation after the user confirms. */
  onImport?: (transcript: Transcript) => void;
  limits?: ImportLimits;
  className?: string;
}

/**
 * Export a conversation as Markdown or versioned JSON (download or copy),
 * and import one back: the file is validated against size and message caps
 * and previewed before anything is added.
 */
export function ConversationTransfer({ transcript, onImport, limits, className }: ConversationTransferProps) {
  const { copied, copy } = useCopyToClipboard();
  const [preview, setPreview] = useState<{ transcript: Transcript; warnings: string[]; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const base = transcript ? safeFileName(transcript.title, "conversation") : "conversation";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {transcript && (
        <section aria-label="Export" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Export "{transcript.title}"</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadText(`${base}.md`, messagesToMarkdown(transcript), "text/markdown;charset=utf-8")} className={cn(button, buttonVariants.outline, focusRing)}>
              <FileTextIcon aria-hidden="true" />
              Markdown
            </button>
            <button type="button" onClick={() => downloadText(`${base}.json`, exportConversation(transcript), "application/json")} className={cn(button, buttonVariants.outline, focusRing)}>
              <FileJsonIcon aria-hidden="true" />
              JSON
            </button>
            <button type="button" onClick={() => void copy(messagesToMarkdown(transcript))} className={cn(button, buttonVariants.ghost, focusRing)}>
              {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
              {copied ? "Copied" : "Copy as Markdown"}
            </button>
          </div>
        </section>
      )}
      {onImport && (
        <section aria-label="Import" className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Import a conversation</h3>
          <FileDropzone
            multiple={false}
            accept=".json,application/json"
            title="Drop an exported .json file, or"
            ignore={() => false}
            onFiles={(files, rejected) => {
              setDone(null);
              setPreview(null);
              const [file] = files;
              if (!file) {
                setError(rejected[0]?.reason ?? null);
                return;
              }
              void file.text().then((text) => {
                const result = parseConversationImport(text, limits);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setError(null);
                setPreview({ transcript: result.transcript, warnings: result.warnings, name: file.name });
              });
            }}
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {preview && (
            <div className={cn(card, "flex flex-col gap-2 p-3 text-sm")}>
              <p>
                <span className="font-medium">{preview.transcript.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {preview.transcript.messages.length} {preview.transcript.messages.length === 1 ? "message" : "messages"} from {preview.name}
                </span>
              </p>
              {preview.transcript.messages[0] && <p className="line-clamp-2 text-muted-foreground">{preview.transcript.messages[0].content}</p>}
              {preview.warnings.length > 0 && (
                <ul className="text-xs text-muted-foreground">
                  {preview.warnings.slice(0, 5).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPreview(null)} className={cn(button, buttonVariants.ghost, focusRing)}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onImport(preview.transcript);
                    setDone(`Imported "${preview.transcript.title}".`);
                    setPreview(null);
                  }}
                  className={cn(button, buttonVariants.primary, focusRing)}
                >
                  Import
                </button>
              </div>
            </div>
          )}
          <p role="status" className="text-sm empty:hidden">
            {done ?? ""}
          </p>
        </section>
      )}
    </div>
  );
}
