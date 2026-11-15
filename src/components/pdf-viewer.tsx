// packages/ai-ui/src/components/pdf-viewer.tsx
"use client";

import { DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { safeUrl } from "../lib/safe-url.js";

export interface PdfViewerProps extends Omit<ComponentProps<"div">, "children"> {
  /** http(s), blob or relative URL of the PDF. */
  src: string;
  title: string;
  /** Opens at this page in viewers that support it. */
  page?: number;
  downloadName?: string;
  height?: number | string;
}

/**
 * Shows a PDF with the browser's built-in viewer (search, zoom, print) and
 * adds open and download controls. When a browser cannot embed PDFs the
 * fallback offers the same file as a link.
 */
export function PdfViewer({ src, title, page, downloadName, height = "36rem", className, ...props }: PdfViewerProps) {
  const url = safeUrl(src, ["http:", "https:", "blob:"], { allowRelative: true });
  const target = url ? `${url}${page ? `#page=${Math.max(1, Math.floor(page))}` : ""}` : undefined;
  return (
    <div data-slot="pdf-viewer" className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-card text-sm", className)} {...props}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <FileTextIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {url && (
          <>
            <a href={target} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className={cn(iconButton, focusRing)}>
              <ExternalLinkIcon aria-hidden="true" />
            </a>
            <a href={url} download={downloadName ?? `${title}.pdf`} aria-label="Download PDF" className={cn(iconButton, focusRing)}>
              <DownloadIcon aria-hidden="true" />
            </a>
          </>
        )}
      </div>
      {target ? (
        <object data={target} type="application/pdf" aria-label={title} className="w-full bg-muted" style={{ height }}>
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground" style={{ height }}>
            <p>This browser cannot show PDFs inline.</p>
            <a href={target} target="_blank" rel="noopener noreferrer" className={cn("rounded text-primary underline underline-offset-4", focusRing)}>
              Open {title}
            </a>
          </div>
        </object>
      ) : (
        <p className="p-4 text-muted-foreground">This file address is not allowed.</p>
      )}
    </div>
  );
}
