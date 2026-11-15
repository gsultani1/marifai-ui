// packages/ai-ui/src/components/artifact-viewer.tsx
"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileCodeIcon,
  FileJsonIcon,
  FileTextIcon,
  ImageIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  Minimize2Icon,
  NetworkIcon,
  RotateCwIcon,
  Share2Icon,
  SheetIcon,
  XIcon,
} from "lucide-react";
import { type ComponentProps, type ReactNode, useMemo, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useAutoFix } from "../hooks/use-auto-fix.js";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { useFullscreen } from "../hooks/use-fullscreen.js";
import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadText, safeFileName } from "../lib/download.js";
import { createSvgPreview, escapeJson, previewOrigins } from "../lib/preview-documents.js";
import { safeImageSrc } from "../lib/safe-url.js";
import { CodeBlock } from "./code-block.js";
import { CsvExplorer } from "./csv-explorer.js";
import { createReactPreview, InteractivePreview, openSandboxedWindow, type ReactPreview, type ReactPreviewOptions } from "./interactive-preview.js";
import { JsonViewer } from "./json-viewer.js";
import { MessageContent } from "./message-content.js";
import { PreviewErrorBanner } from "./preview-error-banner.js";

export type ArtifactKind = "html" | "react" | "svg" | "mermaid" | "markdown" | "code" | "csv" | "json" | "image" | "text";

export interface ArtifactVersion {
  id: string;
  content: string;
  createdAt?: number;
  label?: string;
}

const KINDS: Record<ArtifactKind, { label: string; icon: ReactNode; language?: string; extension: string; preview: boolean; runs?: boolean }> = {
  html: { label: "Web page", icon: <FileCodeIcon aria-hidden="true" />, language: "html", extension: "html", preview: true, runs: true },
  react: { label: "React component", icon: <FileCodeIcon aria-hidden="true" />, language: "tsx", extension: "tsx", preview: true, runs: true },
  svg: { label: "SVG image", icon: <ImageIcon aria-hidden="true" />, language: "xml", extension: "svg", preview: true },
  mermaid: { label: "Diagram", icon: <NetworkIcon aria-hidden="true" />, extension: "mmd", preview: true, runs: true },
  markdown: { label: "Document", icon: <FileTextIcon aria-hidden="true" />, language: "markdown", extension: "md", preview: true },
  code: { label: "Code", icon: <CodeIcon aria-hidden="true" />, extension: "txt", preview: false },
  csv: { label: "Table", icon: <SheetIcon aria-hidden="true" />, extension: "csv", preview: true },
  json: { label: "JSON", icon: <FileJsonIcon aria-hidden="true" />, language: "json", extension: "json", preview: true },
  image: { label: "Image", icon: <ImageIcon aria-hidden="true" />, extension: "png", preview: true },
  text: { label: "Text", icon: <FileTextIcon aria-hidden="true" />, extension: "txt", preview: false },
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: "js", js: "js", typescript: "ts", ts: "ts", tsx: "tsx", jsx: "jsx", python: "py", py: "py", ruby: "rb", go: "go", rust: "rs", java: "java", kotlin: "kt", swift: "swift",
  c: "c", cpp: "cpp", "c++": "cpp", csharp: "cs", "c#": "cs", php: "php", shell: "sh", bash: "sh", sh: "sh", powershell: "ps1", sql: "sql", yaml: "yml", yml: "yml", toml: "toml",
  css: "css", scss: "scss", html: "html", xml: "xml", markdown: "md", md: "md", json: "json", dockerfile: "Dockerfile", r: "r", lua: "lua", dart: "dart", scala: "scala",
};

/** Display name and icon for an artifact kind. */
export function artifactKindInfo(kind: ArtifactKind): { label: string; icon: ReactNode } {
  return { label: KINDS[kind].label, icon: KINDS[kind].icon };
}

/** File extension for an artifact download, from its kind and code language. */
export function artifactExtension(kind: ArtifactKind, language?: string): string {
  if (kind === "code" && language) return LANGUAGE_EXTENSIONS[language.toLowerCase()] ?? "txt";
  return KINDS[kind].extension;
}

const DEFAULT_MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";

/**
 * Builds a document that renders a Mermaid diagram in the preview frame
 * with Mermaid's strict security level; syntax errors reach `onRuntimeError`.
 */
export function createMermaidPreview(code: string, { mermaidUrl = DEFAULT_MERMAID_URL, theme = "default" }: { mermaidUrl?: string; theme?: "default" | "dark" | "neutral" | "forest" } = {}): ReactPreview {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;background:#fff}body{display:flex;justify-content:center;padding:24px;font-family:system-ui,sans-serif}#out{max-width:100%}#out svg{max-width:100%;height:auto}</style>
</head>
<body>
<div id="out" role="img" aria-label="Diagram"></div>
<script type="application/json" id="ai-ui-source">${escapeJson(code)}</script>
<script type="module">
import mermaid from ${escapeJson(mermaidUrl)};
const source = JSON.parse(document.getElementById("ai-ui-source").textContent);
mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: ${escapeJson(theme)} });
try {
  const { svg } = await mermaid.render("ai-ui-diagram", source);
  document.getElementById("out").innerHTML = svg;
} catch (error) {
  document.getElementById("out").textContent = "This diagram has a syntax error.";
  console.error(error && error.message ? error.message : String(error));
}
</script>
</body>
</html>`;
  return { html, allowedOrigins: previewOrigins([mermaidUrl]), allowScripts: true };
}

/** The runnable document and origins for kinds that execute in a frame, or null. */
export function artifactDocument(kind: ArtifactKind, content: string, { reactOptions, mermaidUrl, allowedOrigins = [] }: { reactOptions?: ReactPreviewOptions; mermaidUrl?: string; allowedOrigins?: string[] } = {}): ReactPreview | null {
  if (kind === "html") return { html: content, allowedOrigins, allowScripts: true };
  if (kind === "react") {
    const preview = createReactPreview(content, reactOptions);
    return { html: preview.html, allowedOrigins: [...preview.allowedOrigins, ...allowedOrigins], allowScripts: true };
  }
  if (kind === "mermaid") return createMermaidPreview(content, mermaidUrl ? { mermaidUrl } : {});
  if (kind === "svg") return createSvgPreview(content, { background: "white" });
  return null;
}

export type ArtifactView = "preview" | "code";

export interface ArtifactViewerProps extends Omit<ComponentProps<"section">, "title" | "content"> {
  title: string;
  kind: ArtifactKind;
  /** Code language for "code" artifacts. */
  language?: string;
  /** Content of a single-version artifact. */
  content?: string;
  /** All versions, oldest first. The latest shows by default. */
  versions?: ArtifactVersion[];
  version?: string;
  defaultVersion?: string;
  onVersionChange?: (id: string) => void;
  /** Makes the shown older version the latest. */
  onRestoreVersion?: (id: string) => void;
  /** The content is still arriving: runnable kinds stay in code view and show "Building…". */
  streaming?: boolean;
  view?: ArtifactView;
  defaultView?: ArtifactView;
  onViewChange?: (view: ArtifactView) => void;
  /** Shown as "Fix it" when the preview reports runtime errors. */
  onFix?: (errors: string[]) => void;
  /** Calls `onFix` on its own when errors appear, up to three times. */
  autoFix?: boolean;
  onClose?: () => void;
  onShare?: () => void;
  /** Origins HTML artifacts may load from. */
  allowedOrigins?: string[];
  reactOptions?: ReactPreviewOptions;
  mermaidUrl?: string;
  /** Download name without extension; defaults to the title. */
  fileName?: string;
}

const MAX_ERRORS = 4;

/**
 * Claude-style artifact panel: renders web pages, React components, SVG,
 * Mermaid diagrams, markdown, code, CSV, JSON and images; switches between
 * preview and code; steps through versions and restores older ones; reloads,
 * copies, downloads, opens in a sandboxed tab and goes full screen; and
 * offers "Fix it" when the running preview throws.
 */
export function ArtifactViewer({
  title,
  kind,
  language,
  content,
  versions: versionsProp,
  version: versionProp,
  defaultVersion,
  onVersionChange,
  onRestoreVersion,
  streaming = false,
  view: viewProp,
  defaultView,
  onViewChange,
  onFix,
  autoFix = false,
  onClose,
  onShare,
  allowedOrigins,
  reactOptions,
  mermaidUrl,
  fileName,
  className,
  ...props
}: ArtifactViewerProps) {
  const versions = useMemo(() => versionsProp ?? [{ id: "current", content: content ?? "" }], [versionsProp, content]);
  const latest = versions.at(-1)!;
  const [versionId, setVersionId] = useControllableState({ value: versionProp, defaultValue: defaultVersion ?? latest.id, onChange: onVersionChange });
  const versionIndex = Math.max(0, versions.findIndex((item) => item.id === versionId));
  const current = versions.findIndex((item) => item.id === versionId) === -1 ? latest : versions[versionIndex]!;
  const config = KINDS[kind];
  const [view, setView] = useControllableState<ArtifactView>({ value: viewProp, defaultValue: defaultView ?? (config.preview ? "preview" : "code"), onChange: onViewChange });
  const building = streaming && Boolean(config.runs || kind === "svg");
  const effectiveView: ArtifactView = !config.preview || building ? "code" : view;
  const [reloadKey, setReloadKey] = useState(0);
  const [errors, setErrors] = useState<{ content: string; messages: string[] }>({ content: "", messages: [] });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLElement>(null);
  const { fullscreen, fallback: fallbackFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const { status: copyStatus, copy } = useCopyToClipboard();
  const lines = current.content ? current.content.split("\n").length : 0;
  const runnable = useMemo(() => (config.runs || kind === "svg" ? artifactDocument(kind, current.content, { ...(reactOptions ? { reactOptions } : {}), ...(mermaidUrl ? { mermaidUrl } : {}), ...(allowedOrigins ? { allowedOrigins } : {}) }) : null), [config.runs, kind, current.content, reactOptions, mermaidUrl, allowedOrigins]);
  const visibleErrors = errors.content === current.content && dismissed !== current.content ? errors.messages : [];
  const autoFixState = useAutoFix({ errors: visibleErrors, onFix: (messages) => onFix?.(messages), enabled: autoFix && Boolean(onFix), busy: streaming });

  const onRuntimeError = (message: string) =>
    setErrors((state) => {
      const messages = state.content === current.content ? state.messages : [];
      if (messages.includes(message) || messages.length >= MAX_ERRORS) return state.content === current.content ? state : { content: current.content, messages };
      return { content: current.content, messages: [...messages, message.slice(0, 3000)] };
    });

  const download = () => {
    const name = `${safeFileName(fileName ?? title, "artifact")}.${artifactExtension(kind, language)}`;
    if (kind === "image") {
      const src = safeImageSrc(current.content);
      if (!src) return;
      const anchor = document.createElement("a");
      anchor.href = src;
      anchor.download = name;
      anchor.rel = "noopener";
      anchor.click();
      return;
    }
    downloadText(name, current.content, kind === "svg" ? "image/svg+xml" : kind === "html" ? "text/html" : "text/plain");
  };

  const openInTab = () => {
    if (!runnable) return;
    const opened = openSandboxedWindow(runnable.html, title, { allowedOrigins: runnable.allowedOrigins, allowScripts: runnable.allowScripts });
    if (!opened) setNotice("Your browser blocked the new tab. Allow pop-ups for this site and try again.");
  };

  const codeLanguage = kind === "code" ? language : config.language;
  let preview: ReactNode = null;
  if (effectiveView === "preview") {
    switch (kind) {
      case "html":
      case "react":
      case "mermaid":
        preview = runnable && (
          <InteractivePreview key={`${current.id}:${reloadKey}`} title={title} html={runnable.html} allowScripts={runnable.allowScripts} allowedOrigins={runnable.allowedOrigins} onRuntimeError={onRuntimeError} toolbar={false} className="min-h-full" />
        );
        break;
      case "svg":
        preview = (
          <div className="flex min-h-full items-center justify-center bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-6">
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(current.content)}`} alt={title} className="max-h-full max-w-full" />
          </div>
        );
        break;
      case "markdown":
        preview = <MessageContent className="mx-auto max-w-3xl px-6 py-8">{current.content}</MessageContent>;
        break;
      case "csv":
        preview = <CsvExplorer text={current.content} label={title} className="p-3" />;
        break;
      case "json":
        preview = <JsonViewer json={current.content} label={title} className="h-full p-3" />;
        break;
      case "image": {
        const src = safeImageSrc(current.content);
        preview = src ? (
          <div className="flex min-h-full items-center justify-center p-4">
            <img src={src} alt={title} className="max-h-full max-w-full rounded-md" />
          </div>
        ) : (
          <p className="p-4 text-muted-foreground">This image address is not allowed.</p>
        );
        break;
      }
      default:
        preview = null;
    }
  }

  const headerButton = cn(iconButton, focusRing);

  return (
    <section
      ref={rootRef}
      aria-label={title}
      data-slot="artifact-viewer"
      data-kind={kind}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-sm text-foreground", fallbackFullscreen && "fixed inset-0 z-50 rounded-none", className)}
      {...props}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-muted-foreground [&_svg]:size-4">{config.icon}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate font-medium">{title}</h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {building ? (
              <>
                <LoaderCircleIcon aria-hidden="true" className="size-3 motion-safe:animate-spin" />
                Building…
              </>
            ) : (
              <>
                {kind === "code" && language ? language : config.label} · {lines} {lines === 1 ? "line" : "lines"}
              </>
            )}
          </span>
        </div>
        {config.preview && (
          <div role="group" aria-label="View" className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            <button type="button" aria-pressed={effectiveView === "preview"} disabled={building} title={building ? "Preview is available when the artifact finishes" : undefined} onClick={() => setView("preview")} className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs aria-pressed:bg-background aria-pressed:shadow-sm disabled:opacity-50", focusRing)}>
              <EyeIcon aria-hidden="true" className="size-3.5" />
              Preview
            </button>
            <button type="button" aria-pressed={effectiveView === "code"} onClick={() => setView("code")} className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs aria-pressed:bg-background aria-pressed:shadow-sm", focusRing)}>
              <CodeIcon aria-hidden="true" className="size-3.5" />
              Code
            </button>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          {config.runs && effectiveView === "preview" && (
            <button type="button" aria-label="Reload preview" title="Reload preview" onClick={() => setReloadKey((key) => key + 1)} className={headerButton}>
              <RotateCwIcon aria-hidden="true" />
            </button>
          )}
          <button type="button" aria-label={copyStatus === "copied" ? "Copied" : "Copy"} title="Copy" onClick={() => void copy(current.content)} className={headerButton}>
            <CopyIcon aria-hidden="true" />
          </button>
          <button type="button" aria-label="Download" title="Download" onClick={download} className={headerButton}>
            <DownloadIcon aria-hidden="true" />
          </button>
          {runnable && !building && (
            <button type="button" aria-label="Open in new tab" title="Open in new tab" onClick={openInTab} className={headerButton}>
              <ExternalLinkIcon aria-hidden="true" />
            </button>
          )}
          {onShare && (
            <button type="button" aria-label="Share" title="Share" onClick={onShare} className={headerButton}>
              <Share2Icon aria-hidden="true" />
            </button>
          )}
          <button type="button" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} aria-pressed={fullscreen} onClick={toggleFullscreen} className={headerButton}>
            {fullscreen ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
          </button>
          {onClose && (
            <button type="button" aria-label="Close artifact" title="Close" onClick={onClose} className={headerButton}>
              <XIcon aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      {versions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-1 text-xs">
          <button type="button" aria-label="Previous version" disabled={versionIndex === 0} onClick={() => setVersionId(versions[versionIndex - 1]!.id)} className={cn(iconButton, "size-6", focusRing)}>
            <ChevronLeftIcon aria-hidden="true" />
          </button>
          <span aria-live="polite" className="tabular-nums">
            Version {versionIndex + 1} of {versions.length}
            {current.label && ` · ${current.label}`}
          </span>
          <button type="button" aria-label="Next version" disabled={versionIndex >= versions.length - 1} onClick={() => setVersionId(versions[versionIndex + 1]!.id)} className={cn(iconButton, "size-6", focusRing)}>
            <ChevronRightIcon aria-hidden="true" />
          </button>
          {current.id === latest.id ? (
            <span className="rounded-full border border-border px-2 text-muted-foreground">Latest</span>
          ) : (
            <span className="ml-auto flex gap-1">
              <button type="button" onClick={() => setVersionId(latest.id)} className={cn(button, buttonVariants.ghost, "h-6 px-2 text-xs", focusRing)}>
                View latest
              </button>
              {onRestoreVersion && (
                <button type="button" onClick={() => onRestoreVersion(current.id)} className={cn(button, buttonVariants.outline, "h-6 px-2 text-xs", focusRing)}>
                  Restore this version
                </button>
              )}
            </span>
          )}
        </div>
      )}
      <PreviewErrorBanner
        errors={visibleErrors}
        {...(onFix ? { onFix } : {})}
        onDismiss={() => setDismissed(current.content)}
        note={autoFix && onFix && autoFixState.attempts > 0 ? (autoFixState.exhausted ? `Auto-fix stopped after ${autoFixState.maxAttempts} attempts.` : `Auto-fix attempt ${autoFixState.attempts} of ${autoFixState.maxAttempts}.`) : undefined}
      />
      <div className="relative min-h-0 flex-1 overflow-auto">
        {effectiveView === "code" ? <CodeBlock code={current.content} language={codeLanguage} showLineNumbers className="min-h-full rounded-none border-0" /> : preview}
      </div>
      <p role="status" className="sr-only">
        {notice || (copyStatus === "copied" ? "Copied to clipboard" : "")}
      </p>
    </section>
  );
}
