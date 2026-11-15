// packages/ai-ui/src/components/artifact-thumbnail.tsx
"use client";

import { type ComponentProps, useEffect, useRef, useState } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { safeImageSrc } from "../lib/safe-url.js";
import { type ArtifactKind, artifactDocument } from "./artifact-viewer.js";
import { buildSandboxedDocument, type ReactPreviewOptions } from "./interactive-preview.js";

export interface ArtifactThumbnailProps extends Omit<ComponentProps<"button">, "content" | "title"> {
  title: string;
  kind: ArtifactKind;
  content: string;
  subtitle?: string;
  /** Width of the virtual page the preview lays out at before scaling down. */
  pageWidth?: number;
  /** Aspect ratio of the card, width over height. */
  aspectRatio?: number;
  reactOptions?: ReactPreviewOptions;
  allowedOrigins?: string[];
}

/**
 * Card with a live, scaled-down preview of an artifact for galleries and
 * history. Runnable kinds render in a sandboxed frame only once the card
 * scrolls near the viewport; the preview ignores the pointer and is hidden
 * from assistive tech, so the card reads as its title.
 */
export function ArtifactThumbnail({ title, kind, content, subtitle, pageWidth = 1280, aspectRatio = 16 / 10, reactOptions, allowedOrigins, className, ...props }: ArtifactThumbnailProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => setWidth(element.clientWidth));
    resize?.observe(element);
    if (typeof IntersectionObserver === "undefined") {
      setWidth(element.clientWidth);
      return () => resize?.disconnect();
    }
    const intersect = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          intersect.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    intersect.observe(element);
    return () => {
      intersect.disconnect();
      resize?.disconnect();
    };
  }, []);

  const runnable = kind === "html" || kind === "react" || kind === "mermaid" ? artifactDocument(kind, content, { ...(reactOptions ? { reactOptions } : {}), ...(allowedOrigins ? { allowedOrigins } : {}) }) : null;
  const scale = width > 0 ? width / pageWidth : 0.25;
  const image = kind === "image" ? safeImageSrc(content) : kind === "svg" ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}` : undefined;

  return (
    <button ref={ref} type="button" data-slot="artifact-thumbnail" className={cn("group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left text-card-foreground hover:border-muted-foreground", focusRing, className)} {...props}>
      <span aria-hidden="true" className="relative block w-full overflow-hidden bg-muted" style={{ aspectRatio }}>
        {runnable && visible ? (
          <iframe
            title=""
            tabIndex={-1}
            sandbox={runnable.allowScripts ? "allow-scripts" : ""}
            referrerPolicy="no-referrer"
            srcDoc={buildSandboxedDocument(runnable.html, { allowScripts: runnable.allowScripts, allowedOrigins: runnable.allowedOrigins })}
            className="pointer-events-none absolute top-0 left-0 origin-top-left border-0 bg-white"
            style={{ width: pageWidth, height: pageWidth / aspectRatio, transform: `scale(${scale})` }}
          />
        ) : image ? (
          <img src={image} alt="" className="absolute inset-0 size-full object-contain p-2" loading="lazy" />
        ) : (
          <span className="absolute inset-0 overflow-hidden p-3 font-mono text-[10px] leading-4 whitespace-pre text-muted-foreground">{content.slice(0, 1200)}</span>
        )}
      </span>
      <span className="flex flex-col gap-0.5 px-3 py-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  );
}
