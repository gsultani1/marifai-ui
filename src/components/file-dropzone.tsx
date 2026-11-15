// packages/ai-ui/src/components/file-dropzone.tsx
"use client";

import { FolderUpIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { button, buttonVariants } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { type FileFilterOptions, filesFromDataTransfer, filterFiles } from "../lib/file-import.js";
import type { RejectedFile } from "../lib/upload-queue.js";

export interface FileDropzoneProps extends FileFilterOptions {
  /** Accepted files, after ignore rules, type, binary and size limits. */
  onFiles: (files: File[], rejected: RejectedFile[]) => void;
  multiple?: boolean;
  /** Adds an "Add folder" button; dropped folders are always walked. */
  allowFolders?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Drop target with file and folder pickers. Dropped folders are walked
 * recursively and every file keeps its folder-relative path (read it with
 * `filePath`); version-control, dependency and build folders are skipped,
 * binary files can be left out, and count and size caps reject the rest
 * with reasons.
 */
export function FileDropzone({ onFiles, multiple = true, allowFolders = false, title = "Drop files here, or", description, disabled = false, className, ...filters }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const { accepted, rejected } = await filterFiles(files, filters);
      onFiles(accepted, rejected);
    } finally {
      setBusy(false);
    }
  };

  const picker = (folder: boolean) => (
    <label className={cn(button, buttonVariants.outline, "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50")}>
      {folder ? <FolderUpIcon aria-hidden="true" /> : <PaperclipIcon aria-hidden="true" />}
      {folder ? "Add folder" : "Add files"}
      <input
        type="file"
        multiple={folder || multiple}
        accept={folder ? undefined : filters.accept}
        disabled={disabled}
        className="sr-only"
        {...(folder ? { webkitdirectory: "" } : {})}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void handle(files);
        }}
      />
    </label>
  );

  return (
    <div
      data-slot="file-dropzone"
      data-dragging={dragging || undefined}
      aria-busy={busy || undefined}
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(false);
        void filesFromDataTransfer(event.dataTransfer).then(handle);
      }}
      className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-5 text-center text-sm transition-colors data-[dragging]:border-ring data-[dragging]:bg-accent/50", disabled && "opacity-60", className)}
    >
      <UploadIcon aria-hidden="true" className="size-5 text-muted-foreground" />
      <p className="text-muted-foreground">{title}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {picker(false)}
        {allowFolders && picker(true)}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <span role="status" className="sr-only">
        {busy ? "Reading files" : ""}
      </span>
    </div>
  );
}

