// packages/ai-ui/src/components/attachment.tsx
"use client";

import {
  FileCodeIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  ImageIcon,
  LoaderCircleIcon,
  MusicIcon,
  XIcon,
} from "lucide-react";
import { Children, type ComponentProps, type ReactNode } from "react";

import { useObjectUrl } from "../hooks/use-object-url.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { fileExtension, formatBytes } from "../lib/format.js";
import { safeUrl } from "../lib/safe-url.js";

const LINK_PROTOCOLS = ["http:", "https:", "blob:"];
const CODE_EXTENSIONS = new Set(["js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java", "c", "cpp", "cs", "php", "sh", "ps1", "sql", "json", "yaml", "yml", "html", "css"]);
const SHEET_EXTENSIONS = new Set(["csv", "tsv", "xls", "xlsx", "ods"]);

function attachmentIcon(mimeType: string, extension: string): ReactNode {
  if (mimeType.startsWith("image/")) return <ImageIcon aria-hidden="true" />;
  if (mimeType.startsWith("video/")) return <FileVideoIcon aria-hidden="true" />;
  if (mimeType.startsWith("audio/")) return <MusicIcon aria-hidden="true" />;
  if (SHEET_EXTENSIONS.has(extension)) return <FileSpreadsheetIcon aria-hidden="true" />;
  if (CODE_EXTENSIONS.has(extension)) return <FileCodeIcon aria-hidden="true" />;
  if (mimeType.startsWith("text/") || mimeType === "application/pdf" || extension === "md") {
    return <FileTextIcon aria-hidden="true" />;
  }
  return <FileIcon aria-hidden="true" />;
}

export function Attachments({ className, children, ...props }: ComponentProps<"ul">) {
  if (Children.toArray(children).length === 0) return null;
  return (
    <ul aria-label="Attachments" data-slot="attachments" className={cn("flex flex-wrap gap-2", className)} {...props}>
      {children}
    </ul>
  );
}

export interface AttachmentProps extends Omit<ComponentProps<"li">, "children"> {
  name: string;
  /** Size in bytes. Taken from `file` when omitted. */
  size?: number | undefined;
  mimeType?: string | undefined;
  /** Thumbnail URL. Image files passed as `file` get one automatically. */
  previewUrl?: string | undefined;
  file?: Blob | undefined;
  /** Makes the name a link that opens the file. Only relative, http, https and blob URLs are linked. */
  href?: string | undefined;
  /** Makes the name a button, e.g. to open the file in a FileViewer. Takes precedence over `href`. */
  onPreview?: () => void;
  uploading?: boolean;
  error?: ReactNode;
  onRemove?: () => void;
}

export function Attachment({
  name,
  size,
  mimeType,
  previewUrl,
  file,
  href,
  onPreview,
  uploading = false,
  error,
  onRemove,
  className,
  ...props
}: AttachmentProps) {
  const link = safeUrl(href, LINK_PROTOCOLS, { allowRelative: true });
  const type = mimeType ?? file?.type ?? "";
  const isImage = type.startsWith("image/");
  const generatedUrl = useObjectUrl(isImage && !previewUrl ? file : undefined);
  const thumbnail = previewUrl ?? generatedUrl;
  const bytes = size ?? file?.size;

  let meta: ReactNode = bytes !== undefined ? formatBytes(bytes) : fileExtension(name).toUpperCase() || null;
  if (uploading) meta = "Uploading";
  if (error) meta = error;

  return (
    <li
      data-slot="attachment"
      data-state={error ? "error" : uploading ? "uploading" : "ready"}
      className={cn(
        "flex max-w-64 min-w-0 items-center gap-2 rounded-lg border border-border bg-card p-1 pr-1.5 text-sm text-card-foreground data-[state=error]:border-destructive/50",
        className,
      )}
      {...props}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
        {thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" /> : attachmentIcon(type, fileExtension(name))}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {onPreview ? (
          <button
            type="button"
            onClick={onPreview}
            className={cn("truncate rounded-sm text-left font-medium hover:underline", focusRing)}
          >
            {name}
          </button>
        ) : link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className={cn("truncate rounded-sm font-medium hover:underline", focusRing)}>
            {name}
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : (
          <span className="truncate font-medium">{name}</span>
        )}
        {meta && (
          <span className={cn("truncate text-xs", error ? "text-destructive" : "text-muted-foreground")}>{meta}</span>
        )}
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className={cn(iconButton, "size-6 [&_svg]:size-3.5", focusRing)}
        >
          <XIcon aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
