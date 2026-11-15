// packages/ai-ui/src/components/interactive-preview.tsx
"use client";

import { ExternalLinkIcon, MonitorIcon, RotateCwIcon, SmartphoneIcon, SquareDashedMousePointerIcon, TabletIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { DEFAULT_BABEL_URL, DEFAULT_PREVIEW_IMPORTS, escapeAttribute, escapeJson, type PreviewDocument, previewOrigins, scriptDataUrl } from "../lib/preview-documents.js";
import { type InspectedElement, PREVIEW_HOST_SOURCE, PREVIEW_INSPECTOR_SCRIPT, PREVIEW_MESSAGE_SOURCE, readInspectorMessage } from "../lib/preview-inspector.js";
import { safeUrl } from "../lib/safe-url.js";

const ERROR_BRIDGE = `<script>(function(){function send(message){try{parent.postMessage({source:"${PREVIEW_MESSAGE_SOURCE}",type:"error",message:String(message)},"*")}catch(e){}}addEventListener("error",function(e){send(e.message||e)});addEventListener("unhandledrejection",function(e){send(e.reason&&e.reason.message||e.reason)});var original=console.error;console.error=function(){send(Array.prototype.map.call(arguments,String).join(" "));original.apply(console,arguments)}})();</script>`;

const SANDBOX_TOKENS = [
  "allow-downloads",
  "allow-forms",
  "allow-modals",
  "allow-orientation-lock",
  "allow-pointer-lock",
  "allow-popups",
  "allow-presentation",
] as const;

/**
 * Sandbox tokens the preview accepts. `allow-scripts` is controlled by
 * `allowScripts`; `allow-same-origin` and the top-navigation tokens are never
 * accepted because they would let generated content reach the host page.
 */
export type PreviewSandboxToken = (typeof SANDBOX_TOKENS)[number];

const FRAME_PROTOCOLS = ["http:", "https:", "blob:"];
const DEFAULT_SANDBOX: readonly PreviewSandboxToken[] = ["allow-forms", "allow-popups", "allow-modals"];

interface DocumentOptions {
  allowScripts: boolean;
  origins: readonly string[];
  /** Precompiled module appended after the document when scripts run. */
  script?: string | undefined;
  /** Permits eval and WebAssembly compilation, which runtimes such as Pyodide need. */
  allowEval?: boolean;
  inspector?: boolean;
}

function contentSecurityPolicy({ allowScripts, origins, allowEval = false }: DocumentOptions): string {
  const remote = origins.join(" ");
  const withRemote = (base: string) => (remote ? `${base} ${remote}` : base);
  return [
    "default-src 'none'",
    `script-src ${allowScripts ? withRemote(`'unsafe-inline'${allowEval ? " 'unsafe-eval' 'wasm-unsafe-eval'" : ""} blob: data:`) : "'none'"}`,
    `style-src ${withRemote("'unsafe-inline'")}`,
    `img-src ${withRemote("data: blob:")}`,
    `font-src ${withRemote("data:")}`,
    `media-src ${withRemote("data: blob:")}`,
    `connect-src ${allowScripts && remote ? remote : "'none'"}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

/**
 * Where a leading doctype ends, read the way the HTML tokenizer reads it: only
 * ASCII whitespace and comments (including `<!-->`, `<!--->` and `--!>` ends)
 * may come first. Returns 0 when there is no such doctype, so a policy inserted
 * at the result always lands in `<head>`.
 */
function doctypeEnd(html: string): number {
  const space = /[\t\n\f\r ]*/y;
  const commentEnd = /--!?>/g;
  let index = 0;
  for (;;) {
    space.lastIndex = index;
    space.exec(html);
    index = space.lastIndex;
    if (!html.startsWith("<!--", index)) break;
    index += 4;
    if (html.startsWith(">", index)) index += 1;
    else if (html.startsWith("->", index)) index += 2;
    else {
      commentEnd.lastIndex = index;
      if (!commentEnd.exec(html)) return 0;
      index = commentEnd.lastIndex;
    }
  }
  const doctype = /<!doctype[^>]*>/iy;
  doctype.lastIndex = index;
  return doctype.test(html) ? doctype.lastIndex : 0;
}

/**
 * Places the policy (and the error bridge and inspector when scripts run)
 * before anything else the document parses, and loads `script` after it.
 */
function prepareDocument(html: string, options: DocumentOptions): string {
  const preamble = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(options)}">${options.allowScripts ? ERROR_BRIDGE + (options.inspector ? PREVIEW_INSPECTOR_SCRIPT : "") : ""}`;
  const module = options.allowScripts && options.script ? `<script type="module" src="${scriptDataUrl(options.script)}"></script>` : "";
  const body = module ? (/<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${module}</body>`) : html + module) : html;
  const end = doctypeEnd(body);
  return body.slice(0, end) + preamble + body.slice(end);
}

/**
 * The srcdoc an InteractivePreview would use for `html`: a Content Security
 * Policy limited to `allowedOrigins` and, when scripts run, the error bridge.
 * Use it for previews rendered outside InteractivePreview, such as
 * thumbnails or a sandboxed window.
 */
export function buildSandboxedDocument(html: string, { allowScripts = false, allowedOrigins, allowEval = false, script }: { allowScripts?: boolean; allowedOrigins?: readonly string[]; allowEval?: boolean; script?: string } = {}): string {
  return prepareDocument(html, { allowScripts, origins: previewOrigins(allowedOrigins), allowEval, script });
}

/**
 * Opens a document in a new tab inside a sandboxed frame with an opaque
 * origin, so generated content never runs with the host page's origin.
 * Scripts stay off unless `allowScripts` is set. Returns false when a popup
 * blocker stops the window.
 */
export function openSandboxedWindow(html: string, title: string, { allowScripts = false, allowedOrigins, allowEval = false, script }: { allowScripts?: boolean; allowedOrigins?: readonly string[]; allowEval?: boolean; script?: string } = {}): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.opener = null;
  const doc = win.document;
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/[<&]/g, (char) => (char === "<" ? "&lt;" : "&amp;"))}</title><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;display:block}</style></head><body><iframe sandbox="${allowScripts ? "allow-scripts " : ""}allow-forms allow-modals allow-popups allow-downloads" referrerpolicy="no-referrer"></iframe></body></html>`,
  );
  doc.close();
  const frame = doc.querySelector("iframe");
  if (frame) frame.srcdoc = buildSandboxedDocument(html, { allowScripts, allowEval, ...(script ? { script } : {}), ...(allowedOrigins ? { allowedOrigins } : {}) });
  return true;
}

/** Message the error bridge posts from a preview frame, or null for anything else. */
export function readPreviewError(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  return record.source === PREVIEW_MESSAGE_SOURCE && record.type === "error" && typeof record.message === "string" ? record.message : null;
}

const VIEWPORTS = {
  desktop: { label: "Desktop", width: undefined, icon: <MonitorIcon aria-hidden="true" /> },
  tablet: { label: "Tablet", width: 768, icon: <TabletIcon aria-hidden="true" /> },
  mobile: { label: "Mobile", width: 390, icon: <SmartphoneIcon aria-hidden="true" /> },
} as const;

export type PreviewViewport = keyof typeof VIEWPORTS;

export interface InteractivePreviewProps
  extends Omit<ComponentProps<"iframe">, "src" | "srcDoc" | "title" | "sandbox" | "allow"> {
  /** Accessible name of the frame. */
  title: string;
  /**
   * Document rendered through srcdoc under a Content Security Policy that
   * blocks every network request outside `allowedOrigins`. Script errors are
   * reported to `onRuntimeError`.
   */
  html?: string;
  /**
   * Page to load instead of `html` (relative, http, https or blob URL). Its
   * own server decides its policy; the sandbox still applies.
   */
  src?: string;
  /**
   * Runs scripts, in an opaque origin, so the preview cannot read the host
   * page's cookies, storage or DOM. Off by default: generated HTML stays
   * inert until you opt in. The preview builders return `allowScripts: true`
   * for documents that need it.
   */
  allowScripts?: boolean;
  /**
   * Precompiled JavaScript module run after `html` when `allowScripts` is
   * set. It loads as a UTF-8 data URL, so raw strings such as "</script>"
   * reach the code unchanged.
   */
  script?: string;
  /** Extra sandbox tokens. */
  sandbox?: readonly PreviewSandboxToken[];
  /** Origins `html` may load scripts, styles, images, fonts and media from and connect to. */
  allowedOrigins?: readonly string[];
  /** Lets `html` use eval and compile WebAssembly, for in-browser runtimes such as Pyodide. */
  allowEval?: boolean;
  onRuntimeError?: (message: string) => void;
  /**
   * Enables element picking: `html` previews get the inspector script (pages
   * loaded through `src` need PREVIEW_INSPECTOR_SCRIPT) and the toolbar a
   * "Select an element" toggle. Picking an element ends inspection.
   */
  onInspect?: (element: InspectedElement) => void;
  inspecting?: boolean;
  defaultInspecting?: boolean;
  onInspectingChange?: (inspecting: boolean) => void;
  /** Shows reload, viewport and open-in-tab controls. */
  toolbar?: boolean;
  toolbarActions?: ReactNode;
}

export function InteractivePreview({
  title,
  html,
  src,
  allowScripts = false,
  script,
  sandbox = DEFAULT_SANDBOX,
  allowedOrigins,
  allowEval = false,
  onRuntimeError,
  onInspect,
  inspecting: inspectingProp,
  defaultInspecting = false,
  onInspectingChange,
  toolbar = true,
  toolbarActions,
  className,
  ...props
}: InteractivePreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const originsKey = previewOrigins(allowedOrigins).join(" ");
  const inspectable = Boolean(onInspect) && allowScripts;
  const srcDoc = useMemo(
    () => (html === undefined ? undefined : prepareDocument(html, { allowScripts, origins: originsKey ? originsKey.split(" ") : [], allowEval, inspector: inspectable, script })),
    [html, allowScripts, originsKey, allowEval, inspectable, script],
  );
  const [inspectingValue, setInspecting] = useControllableState({ value: inspectingProp, defaultValue: defaultInspecting, onChange: onInspectingChange });
  const inspecting = inspectable && inspectingValue;
  const sandboxValue = [
    ...(allowScripts ? ["allow-scripts"] : []),
    ...SANDBOX_TOKENS.filter((token) => sandbox.includes(token)),
  ].join(" ");
  const frameUrl = safeUrl(src, FRAME_PROTOCOLS, { allowRelative: true });
  const handlers = useRef({ onRuntimeError, onInspect, setInspecting, inspecting });

  useEffect(() => {
    handlers.current = { onRuntimeError, onInspect, setInspecting, inspecting };
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame) return;
      const error = readPreviewError(event.data);
      if (error !== null) {
        handlers.current.onRuntimeError?.(error);
        return;
      }
      const message = readInspectorMessage(event.data);
      if (message?.type === "inspector-ready") frame.postMessage({ source: PREVIEW_HOST_SOURCE, type: "inspect", enabled: handlers.current.inspecting }, "*");
      else if (message?.type === "inspect-cancel") handlers.current.setInspecting(false);
      else if (message?.type === "inspect" && handlers.current.inspecting) {
        handlers.current.setInspecting(false);
        handlers.current.onInspect?.(message.element);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ source: PREVIEW_HOST_SOURCE, type: "inspect", enabled: inspecting }, "*");
  }, [inspecting]);

  const width = VIEWPORTS[viewport].width;

  return (
    <div data-slot="interactive-preview" className={cn("flex h-full min-h-64 flex-col bg-muted/40", className)}>
      {toolbar && (
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-background px-2">
          <button
            type="button"
            aria-label="Reload preview"
            title="Reload preview"
            onClick={() => setReloadKey((key) => key + 1)}
            className={cn(iconButton, focusRing)}
          >
            <RotateCwIcon aria-hidden="true" />
          </button>
          <div role="group" aria-label="Preview width" className="flex items-center gap-0.5">
            {(Object.keys(VIEWPORTS) as PreviewViewport[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-label={VIEWPORTS[key].label}
                title={VIEWPORTS[key].label}
                aria-pressed={viewport === key}
                onClick={() => setViewport(key)}
                className={cn(iconButton, "aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing)}
              >
                {VIEWPORTS[key].icon}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            {inspectable && (
              <button
                type="button"
                aria-label="Select an element"
                title="Select an element (Esc to stop)"
                aria-pressed={inspecting}
                onClick={() => setInspecting(!inspecting)}
                className={cn(iconButton, "aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing)}
              >
                <SquareDashedMousePointerIcon aria-hidden="true" />
              </button>
            )}
            {toolbarActions}
            {frameUrl && (
              <a
                href={frameUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open in new tab"
                title="Open in new tab"
                className={cn(iconButton, focusRing)}
              >
                <ExternalLinkIcon aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      )}
      <div
        role={width ? "region" : undefined}
        aria-label={width ? `${title} at ${VIEWPORTS[viewport].label.toLowerCase()} width` : undefined}
        tabIndex={width ? 0 : undefined}
        className="flex min-h-0 flex-1 justify-center overflow-x-auto overflow-y-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <iframe
          key={`${reloadKey}:${sandboxValue}`}
          ref={frameRef}
          title={title}
          src={frameUrl}
          srcDoc={srcDoc}
          sandbox={sandboxValue}
          referrerPolicy="no-referrer"
          data-slot="interactive-preview-frame"
          style={width ? { width } : undefined}
          className={cn("h-full w-full shrink-0 border-0 bg-white", width && "border-x border-border shadow-sm")}
          {...props}
        />
      </div>
    </div>
  );
}

export interface ReactPreviewOptions {
  /** Bare-specifier map for the preview document. React 19 from esm.sh by default. */
  imports?: Record<string, string>;
  /** Babel standalone build used to compile JSX and TypeScript in the frame. */
  babelUrl?: string;
  /** Adds the Tailwind CSS v4 browser build so generated class names render. */
  tailwind?: boolean | string;
  /** Extra markup for the document head, e.g. stylesheets. Their origins belong in `allowedOrigins`. */
  head?: string;
  /** Origins added to the ones derived from `imports`, `babelUrl` and `tailwind`. */
  allowedOrigins?: readonly string[];
}

export type ReactPreview = PreviewDocument;

const DEFAULT_TAILWIND_URL = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3";

/**
 * Builds a self-contained HTML document that compiles a React component
 * (JSX or TSX, `export default` required) inside the preview frame and mounts
 * it, plus the CDN origins the document needs. Spread the result into
 * `InteractivePreview`.
 */
export function createReactPreview(code: string, options: ReactPreviewOptions = {}): ReactPreview {
  const imports = { ...DEFAULT_PREVIEW_IMPORTS, ...options.imports };
  const babelUrl = options.babelUrl ?? DEFAULT_BABEL_URL;
  const tailwindUrl = options.tailwind === true ? DEFAULT_TAILWIND_URL : options.tailwind || null;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="importmap">${escapeJson({ imports })}</script>
<script src="${escapeAttribute(babelUrl)}"></script>
${tailwindUrl ? `<script src="${escapeAttribute(tailwindUrl)}"></script>` : ""}
${options.head ?? ""}
</head>
<body>
<div id="root"></div>
<script type="application/json" id="ai-ui-source">${escapeJson(code)}</script>
<script type="module">
const source = JSON.parse(document.getElementById("ai-ui-source").textContent);
const { code } = Babel.transform(source, { filename: "App.tsx", presets: [["react", { runtime: "automatic" }], "typescript"] });
const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
const [{ createElement }, { createRoot }, mod] = await Promise.all([import("react"), import("react-dom/client"), import(url)]);
if (typeof mod.default !== "function") throw new Error("The previewed module must export a default component.");
createRoot(document.getElementById("root")).render(createElement(mod.default));
</script>
</body>
</html>`;
  const allowedOrigins = previewOrigins([
    ...Object.values(imports),
    babelUrl,
    ...(tailwindUrl ? [tailwindUrl] : []),
    ...(options.allowedOrigins ?? []),
  ]);
  return { html, allowedOrigins, allowScripts: true };
}
