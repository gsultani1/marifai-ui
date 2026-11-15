// packages/ai-ui/src/components/file-viewer.tsx
"use client";

import { DownloadIcon, FileIcon, LoaderCircleIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useMemo, useState } from "react";

import { useObjectUrl } from "../hooks/use-object-url.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { parseDelimited } from "../lib/csv.js";
import { fileExtension, formatBytes } from "../lib/format.js";
import { CodeBlock } from "./code-block.js";
import { DataTable, type DataTableColumn } from "./data-table.js";
import { MessageContent } from "./message-content.js";

export type FileKind = "image" | "pdf" | "video" | "audio" | "csv" | "tsv" | "json" | "markdown" | "text" | "unknown";

const MAX_TABLE_ROWS = 1000;
const TABLE_PAGE_SIZE = 100;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

const TEXT_LANGUAGES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  html: "xml",
  css: "css",
  scss: "scss",
  swift: "swift",
  lua: "lua",
  r: "r",
  ini: "ini",
  toml: "ini",
  diff: "diff",
  txt: "plaintext",
  log: "plaintext",
};

function nameFromUrl(src: string): string | undefined {
  try {
    return decodeURIComponent(new URL(src, "http://localhost/").pathname.split("/").pop() ?? "") || undefined;
  } catch {
    return undefined;
  }
}

export function detectFileKind(name: string | undefined, mimeType: string | undefined): FileKind {
  const type = mimeType ?? "";
  const extension = fileExtension(name);
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || extension === "pdf") return "pdf";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "text/csv" || extension === "csv") return "csv";
  if (type === "text/tab-separated-values" || extension === "tsv") return "tsv";
  if (type === "application/json" || extension === "json") return "json";
  if (type === "text/markdown" || extension === "md" || extension === "markdown") return "markdown";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(extension)) return "image";
  if (["mp4", "webm", "mov"].includes(extension)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(extension)) return "audio";
  if (type.startsWith("text/") || extension in TEXT_LANGUAGES) return "text";
  return "unknown";
}

type TextState = { status: "loading" } | { status: "ready"; text: string } | { status: "error"; message: string };

function tooLarge(maxBytes: number): Error {
  return new Error(`it is larger than ${formatBytes(maxBytes)}`);
}

/** Reads a response body as text, failing as soon as it passes `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) throw tooLarge(maxBytes);
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw tooLarge(maxBytes);
    }
    text += decoder.decode(value, { stream: true });
  }
}

function useFileText(file: Blob | undefined, src: string | undefined, enabled: boolean, maxBytes: number): TextState {
  const [state, setState] = useState<{ key: unknown; value: TextState } | null>(null);
  const key = file ?? src;

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    const read = async () => {
      if (file) {
        if (file.size > maxBytes) throw tooLarge(maxBytes);
        return file.text();
      }
      const response = await fetch(src!);
      if (!response.ok) throw new Error(`the request failed with status ${response.status}`);
      return readCapped(response, maxBytes);
    };
    read().then(
      (text) => !cancelled && setState({ key, value: { status: "ready", text } }),
      (error: unknown) =>
        !cancelled &&
        setState({ key, value: { status: "error", message: error instanceof Error ? error.message : String(error) } }),
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, key, file, src, maxBytes]);

  return state && state.key === key ? state.value : { status: "loading" };
}

type PdfCheck = "pending" | "valid" | "invalid";

/**
 * A blob URL renders in the page's own origin, so a blob is shown as a PDF
 * only when its bytes carry the PDF signature; an HTML file named .pdf
 * must never reach the frame.
 */
function usePdfSignature(file: Blob | undefined): PdfCheck {
  const [state, setState] = useState<{ file: Blob; valid: boolean } | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    file
      .slice(0, 1024)
      .text()
      .then(
        (head) => !cancelled && setState({ file, valid: head.includes("%PDF-") }),
        () => !cancelled && setState({ file, valid: false }),
      );
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) return "valid";
  if (state?.file !== file) return "pending";
  return state.valid ? "valid" : "invalid";
}

export interface FileViewerProps extends Omit<ComponentProps<"div">, "children"> {
  /** Local file or blob. Takes precedence over `src`. */
  file?: Blob | undefined;
  src?: string | undefined;
  /** Display name; also used to infer the type from its extension. */
  name?: string | undefined;
  mimeType?: string | undefined;
  /** Overrides type detection. */
  kind?: FileKind | undefined;
  /** Shows the name, size and a download link. */
  header?: boolean;
  headerActions?: ReactNode;
  /** Largest text, CSV or JSON file read for preview. */
  maxBytes?: number;
}

export function FileViewer({
  file,
  src,
  name: nameProp,
  mimeType,
  kind: kindProp,
  header = true,
  headerActions,
  maxBytes = DEFAULT_MAX_BYTES,
  className,
  ...props
}: FileViewerProps) {
  const name = nameProp ?? (file instanceof File ? file.name : undefined) ?? (src ? nameFromUrl(src) : undefined) ?? "File";
  const kind = kindProp ?? detectFileKind(name, mimeType ?? file?.type);
  const pdfBlob = useMemo(
    () => (file && kind === "pdf" ? new Blob([file], { type: "application/pdf" }) : undefined),
    [file, kind],
  );
  const pdfCheck = usePdfSignature(kind === "pdf" ? file : undefined);
  const objectUrl = useObjectUrl(pdfBlob ?? file);
  const url = file ? objectUrl : src;
  const textual = kind === "csv" || kind === "tsv" || kind === "json" || kind === "markdown" || kind === "text";
  const text = useFileText(file, src, textual, maxBytes);

  return (
    <div
      data-slot="file-viewer"
      data-kind={kind}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground", className)}
      {...props}
    >
      {header && (
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border pr-1.5 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
          {file && <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>}
          {headerActions}
          {url && (
            <a
              href={url}
              download={name}
              aria-label={`Download ${name}`}
              title="Download"
              className={cn(iconButton, focusRing)}
            >
              <DownloadIcon aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <FileBody key={url} kind={kind} name={name} url={url} text={text} pdfCheck={pdfCheck} />
      </div>
    </div>
  );
}

interface FileBodyProps {
  kind: FileKind;
  name: string;
  url: string | undefined;
  text: TextState;
  pdfCheck: PdfCheck;
}

function DownloadLink({ url, name }: { url: string | undefined; name: string }) {
  if (!url) return null;
  return (
    <a href={url} download={name} className={cn("font-medium text-primary underline underline-offset-4", focusRing)}>
      Download {name}
    </a>
  );
}

function FileBody({ kind, name, url, text, pdfCheck }: FileBodyProps) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!url && !(kind === "csv" || kind === "tsv" || kind === "json" || kind === "markdown" || kind === "text")) {
    return <Centered>No file</Centered>;
  }
  switch (kind) {
    case "image":
      if (imageFailed) {
        return (
          <Centered>
            <span>This image could not be displayed.</span>
            <DownloadLink url={url} name={name} />
          </Centered>
        );
      }
      return (
        <div className="flex h-full items-center justify-center bg-muted/40 p-4">
          <img
            src={url}
            alt={name}
            onError={() => setImageFailed(true)}
            className="max-h-full max-w-full rounded-md object-contain"
          />
        </div>
      );
    case "pdf":
      if (pdfCheck === "pending") return <Spinner name={name} />;
      if (pdfCheck === "invalid") return <Centered>This file is not a valid PDF.</Centered>;
      return (
        <object data={url} type="application/pdf" title={name} aria-label={name} className="h-full min-h-96 w-full">
          <Centered>
            <span>This browser cannot show PDFs inline.</span>
            <DownloadLink url={url} name={name} />
          </Centered>
        </object>
      );
    case "video":
      return (
        <div className="flex h-full items-center justify-center bg-black">
          <video src={url} controls className="max-h-full max-w-full" />
        </div>
      );
    case "audio":
      return (
        <Centered>
          <audio src={url} controls className="w-full max-w-md" />
        </Centered>
      );
    case "unknown":
      return (
        <Centered>
          <FileIcon aria-hidden="true" className="size-8 text-muted-foreground" />
          <span>No preview for this file type.</span>
          <DownloadLink url={url} name={name} />
        </Centered>
      );
    default:
      return <TextBody kind={kind} name={name} text={text} />;
  }
}

function TextBody({ kind, name, text }: { kind: FileKind; name: string; text: TextState }) {
  const table = useMemo(() => {
    if (text.status !== "ready" || (kind !== "csv" && kind !== "tsv")) return null;
    const [head = [], ...body] = parseDelimited(text.text, kind === "tsv" ? "\t" : ",", MAX_TABLE_ROWS + 2);
    const keys = head.map((_, index) => `c${index}`);
    const rows = body
      .slice(0, MAX_TABLE_ROWS)
      .map((cells) => Object.fromEntries(keys.map((key, index) => [key, cells[index] ?? ""])));
    const columns: DataTableColumn<Record<string, string>>[] = keys.map((key, index) => ({
      key,
      header: head[index] || `Column ${index + 1}`,
      type: rows.length > 0 && rows.every((row) => row[key] === "" || Number.isFinite(Number(row[key]))) ? "number" : "text",
    }));
    return { columns, rows, truncated: body.length > MAX_TABLE_ROWS };
  }, [kind, text]);

  if (text.status === "loading") return <Spinner name={name} />;
  if (text.status === "error") return <Centered>Could not preview {name} because {text.message}.</Centered>;

  if (table) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <DataTable
          columns={table.columns}
          rows={table.rows}
          label={name}
          searchable={table.rows.length > 10}
          pageSize={TABLE_PAGE_SIZE}
          className="max-h-[70vh]"
        />
        {table.truncated && (
          <p className="text-xs text-muted-foreground">Showing the first {MAX_TABLE_ROWS.toLocaleString()} rows.</p>
        )}
      </div>
    );
  }
  if (kind === "markdown") return <MessageContent className="mx-auto max-w-3xl px-6 py-6">{text.text}</MessageContent>;
  if (kind === "json") {
    let pretty = text.text;
    try {
      pretty = JSON.stringify(JSON.parse(text.text), null, 2);
    } catch {
      pretty = text.text;
    }
    return <CodeBlock code={pretty} language="json" showLineNumbers className="min-h-full rounded-none border-0" />;
  }
  return (
    <CodeBlock
      code={text.text}
      language={TEXT_LANGUAGES[fileExtension(name)]}
      showLineNumbers
      className="min-h-full rounded-none border-0"
    />
  );
}

function Spinner({ name }: { name: string }) {
  return (
    <Centered>
      <LoaderCircleIcon aria-hidden="true" className="size-5 motion-safe:animate-spin" />
      <span className="sr-only">Loading {name}</span>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
