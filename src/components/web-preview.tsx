// packages/ai-ui/src/components/web-preview.tsx
"use client";

import { ExternalLinkIcon, LoaderCircleIcon, Maximize2Icon, Minimize2Icon, RectangleHorizontalIcon, RotateCcwIcon, RotateCwIcon, SmartphoneIcon, SquareDashedMousePointerIcon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useElementSize } from "../hooks/use-element-size.js";
import { useFullscreen } from "../hooks/use-fullscreen.js";
import { useUrlReadiness } from "../hooks/use-url-readiness.js";
import { button, buttonVariants, focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { safeUrl } from "../lib/safe-url.js";
import { InteractivePreview, type InteractivePreviewProps, openSandboxedWindow } from "./interactive-preview.js";

export interface PreviewServer {
  id: string;
  /** Base address, e.g. "http://localhost:5173". */
  url: string;
  /** e.g. "Vite" or "API docs"; defaults to the host and port. */
  label?: string;
}

export interface DevicePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  kind: "phone" | "tablet" | "laptop" | "desktop";
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667, kind: "phone" },
  { id: "iphone-15", label: "iPhone 15", width: 393, height: 852, kind: "phone" },
  { id: "pixel-8", label: "Pixel 8", width: 412, height: 915, kind: "phone" },
  { id: "ipad-mini", label: "iPad mini", width: 768, height: 1024, kind: "tablet" },
  { id: "ipad-pro", label: "iPad Pro", width: 1024, height: 1366, kind: "tablet" },
  { id: "laptop", label: "Laptop", width: 1280, height: 800, kind: "laptop" },
  { id: "desktop", label: "Desktop", width: 1440, height: 900, kind: "desktop" },
];

/** The device value that fills the available space and can be resized by dragging. */
export const RESPONSIVE_DEVICE = "responsive";

const MIN_SIZE = 200;
const BEZEL = 12;

/**
 * Where an address typed into the preview's address bar points: a path on
 * the current server, or a full address on one of the configured servers.
 * Anything else is null, so the preview never browses to unrelated sites.
 */
export function resolvePreviewAddress(input: string, servers: readonly PreviewServer[], currentId: string | undefined): { serverId: string; path: string } | null {
  const value = input.trim();
  const current = servers.find((server) => server.id === currentId) ?? servers[0];
  if (!current) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    const server = servers.find((item) => {
      try {
        return new URL(item.url).origin === url.origin;
      } catch {
        return false;
      }
    });
    return server ? { serverId: server.id, path: `${url.pathname}${url.search}${url.hash}` } : null;
  }
  const path = value.replace(/^\/*/, "/");
  return { serverId: current.id, path };
}

function serverName(server: PreviewServer): string {
  if (server.label) return server.label;
  try {
    return new URL(server.url).host;
  } catch {
    return server.url;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export interface WebPreviewProps extends Omit<InteractivePreviewProps, "src" | "toolbar" | "toolbarActions" | "className" | "style"> {
  /** Running servers to preview; omit to preview `html`. */
  servers?: readonly PreviewServer[];
  server?: string;
  defaultServer?: string;
  onServerChange?: (id: string) => void;
  path?: string;
  defaultPath?: string;
  onPathChange?: (path: string) => void;
  devices?: readonly DevicePreset[];
  /** A preset id or RESPONSIVE_DEVICE. */
  device?: string;
  defaultDevice?: string;
  onDeviceChange?: (device: string) => void;
  /** Holds the frame back until the server answers, with retry when it never does. */
  waitForServer?: boolean;
  /** Extra toolbar controls. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Browser-style preview of a running app or an HTML document: an address
 * bar with a port picker, device presets with landscape and a device
 * frame, drag or keyboard resizing in responsive mode, scale to fit,
 * element inspection, reload, open in a new tab and fullscreen.
 */
export function WebPreview({
  title,
  html,
  servers = [],
  server: serverProp,
  defaultServer,
  onServerChange,
  path: pathProp,
  defaultPath = "/",
  onPathChange,
  devices = DEVICE_PRESETS,
  device: deviceProp,
  defaultDevice = RESPONSIVE_DEVICE,
  onDeviceChange,
  waitForServer = false,
  actions,
  onInspect,
  inspecting: inspectingProp,
  defaultInspecting = false,
  onInspectingChange,
  allowScripts = true,
  script,
  allowedOrigins,
  allowEval,
  className,
  ...props
}: WebPreviewProps) {
  const [serverId, setServerId] = useControllableState({ value: serverProp, defaultValue: defaultServer ?? servers[0]?.id ?? "", onChange: onServerChange });
  const [path, setPath] = useControllableState({ value: pathProp, defaultValue: defaultPath, onChange: onPathChange });
  const [device, setDevice] = useControllableState({ value: deviceProp, defaultValue: defaultDevice, onChange: onDeviceChange });
  const [inspecting, setInspecting] = useControllableState({ value: inspectingProp, defaultValue: defaultInspecting, onChange: onInspectingChange });
  const [draft, setDraft] = useState({ for: path, value: path });
  const address = draft.for === path ? draft.value : path;
  const [addressError, setAddressError] = useState<string | null>(null);
  const [landscape, setLandscape] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState(true);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const { fullscreen, fallback, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const drag = useRef<{ axis: "x" | "y" | "both"; x: number; y: number; width: number; height: number } | null>(null);

  const server = servers.find((item) => item.id === serverId) ?? servers[0];
  let frameSrc: string | undefined;
  if (server) {
    try {
      frameSrc = safeUrl(new URL(path || "/", server.url).href, ["http:", "https:"]);
    } catch {
      frameSrc = undefined;
    }
  }
  const readiness = useUrlReadiness(server?.url, { enabled: waitForServer && Boolean(server) });
  const preset = devices.find((item) => item.id === device);
  const inspectable = Boolean(onInspect) && allowScripts;

  const navigate = (input: string) => {
    const target = resolvePreviewAddress(input, servers, server?.id);
    if (!target) {
      setAddressError(`Only addresses on ${servers.map(serverName).join(", ")} open here.`);
      return;
    }
    setAddressError(null);
    if (target.serverId !== server?.id) setServerId(target.serverId);
    setPath(target.path);
    setDraft({ for: target.path, value: target.path });
    setReloadKey((key) => key + 1);
  };

  const openInTab = () => {
    if (frameSrc) window.open(frameSrc, "_blank", "noopener,noreferrer");
    else if (html !== undefined) openSandboxedWindow(html, title, { allowScripts, ...(script ? { script } : {}), ...(allowedOrigins ? { allowedOrigins } : {}), ...(allowEval ? { allowEval } : {}) });
  };

  const available = { width: Math.max(MIN_SIZE, stage.width), height: Math.max(MIN_SIZE, stage.height) };
  const responsiveSize = size ? { width: clamp(size.width, MIN_SIZE, available.width), height: clamp(size.height, MIN_SIZE, available.height) } : null;

  const startDrag = (event: PointerEvent<HTMLElement>, axis: "x" | "y" | "both") => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    drag.current = { axis, x: event.clientX, y: event.clientY, width: responsiveSize?.width ?? box?.width ?? available.width, height: responsiveSize?.height ?? box?.height ?? available.height };
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const start = drag.current;
    if (!start) return;
    setSize({
      width: start.axis === "y" ? start.width : clamp(Math.round(start.width + (event.clientX - start.x) * 2), MIN_SIZE, available.width),
      height: start.axis === "x" ? start.height : clamp(Math.round(start.height + (event.clientY - start.y)), MIN_SIZE, available.height),
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const resizeWithKeys = (event: KeyboardEvent<HTMLElement>, axis: "x" | "y") => {
    const current = responsiveSize ?? available;
    const step = event.shiftKey ? 50 : 10;
    const limit = axis === "x" ? available.width : available.height;
    const value = axis === "x" ? current.width : current.height;
    let next: number | null = null;
    if (event.key === (axis === "x" ? "ArrowRight" : "ArrowDown")) next = value + step;
    else if (event.key === (axis === "x" ? "ArrowLeft" : "ArrowUp")) next = value - step;
    else if (event.key === "Home") next = MIN_SIZE;
    else if (event.key === "End") next = limit;
    if (next === null) return;
    event.preventDefault();
    next = clamp(next, MIN_SIZE, limit);
    setSize(axis === "x" ? { width: next, height: current.height } : { width: current.width, height: next });
  };

  const waiting = waitForServer && server && readiness.status !== "ready";
  const content = waiting ? (
    <div role="status" className="flex size-full flex-col items-center justify-center gap-3 bg-background p-6 text-center text-sm">
      {readiness.status === "failed" ? (
        <>
          <p className="font-medium">Couldn't reach {serverName(server)}</p>
          <p className="text-muted-foreground">Check that the server is running, then try again.</p>
          <button type="button" onClick={readiness.retry} className={cn(button, buttonVariants.outline, focusRing)}>
            <RotateCcwIcon aria-hidden="true" />
            Try again
          </button>
        </>
      ) : (
        <>
          <LoaderCircleIcon aria-hidden="true" className="size-5 text-muted-foreground motion-safe:animate-spin" />
          <p>Waiting for {serverName(server)} to start…</p>
          {readiness.attempts > 0 && <p className="text-xs text-muted-foreground">Checked {readiness.attempts} {readiness.attempts === 1 ? "time" : "times"}</p>}
        </>
      )}
    </div>
  ) : (
    <InteractivePreview
      key={`${reloadKey}:${frameSrc ?? ""}`}
      title={title}
      {...(frameSrc ? { src: frameSrc } : html !== undefined ? { html } : {})}
      allowScripts={allowScripts}
      {...(script ? { script } : {})}
      {...(allowedOrigins ? { allowedOrigins } : {})}
      {...(allowEval ? { allowEval } : {})}
      {...(onInspect ? { onInspect } : {})}
      inspecting={inspecting}
      onInspectingChange={setInspecting}
      toolbar={false}
      className="h-full min-h-0"
      {...props}
    />
  );

  let stageContent: ReactNode;
  let dimensions = "";
  if (preset) {
    const width = landscape ? preset.height : preset.width;
    const height = landscape ? preset.width : preset.height;
    const bezel = deviceFrame && (preset.kind === "phone" || preset.kind === "tablet") ? BEZEL : 0;
    const outer = { width: width + bezel * 2, height: height + bezel * 2 };
    const scale = stage.width > 0 && stage.height > 0 ? Math.min(1, stage.width / outer.width, stage.height / outer.height) : 1;
    dimensions = `${width} × ${height}${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}`;
    stageContent = (
      <div className="relative shrink-0" style={{ width: outer.width * scale, height: outer.height * scale }}>
        <div
          data-slot="web-preview-device"
          data-kind={preset.kind}
          className={cn("absolute top-0 left-0 origin-top-left", bezel ? cn("bg-foreground p-3 shadow-xl", preset.kind === "phone" ? "rounded-[2.5rem]" : "rounded-[1.75rem]") : "")}
          style={{ width: outer.width, height: outer.height, transform: scale < 1 ? `scale(${scale})` : undefined }}
        >
          <div className={cn("size-full overflow-hidden bg-background", bezel ? (preset.kind === "phone" ? "rounded-[1.75rem]" : "rounded-[1rem]") : "border border-border shadow-sm")}>{content}</div>
        </div>
      </div>
    );
  } else {
    const shown = responsiveSize ?? available;
    dimensions = responsiveSize ? `${responsiveSize.width} × ${responsiveSize.height}` : "";
    const handle = "absolute z-10 rounded-full bg-border outline-none hover:bg-ring focus-visible:bg-ring focus-visible:ring-2 focus-visible:ring-ring";
    stageContent = (
      <div className="relative shrink-0" style={responsiveSize ? { width: responsiveSize.width, height: responsiveSize.height } : { width: "100%", height: "100%" }}>
        <div className="size-full overflow-hidden border border-border bg-background shadow-sm">{content}</div>
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Preview width"
          aria-valuenow={Math.round(shown.width)}
          aria-valuemin={MIN_SIZE}
          aria-valuemax={Math.round(available.width)}
          onPointerDown={(event) => startDrag(event, "x")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={(event) => resizeWithKeys(event, "x")}
          onDoubleClick={() => setSize(null)}
          className={cn(handle, "top-1/2 -right-3 h-12 w-1.5 -translate-y-1/2 cursor-ew-resize touch-none")}
        />
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="horizontal"
          aria-label="Preview height"
          aria-valuenow={Math.round(shown.height)}
          aria-valuemin={MIN_SIZE}
          aria-valuemax={Math.round(available.height)}
          onPointerDown={(event) => startDrag(event, "y")}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onLostPointerCapture={endDrag}
          onKeyDown={(event) => resizeWithKeys(event, "y")}
          onDoubleClick={() => setSize(null)}
          className={cn(handle, "-bottom-3 left-1/2 h-1.5 w-12 -translate-x-1/2 cursor-ns-resize touch-none")}
        />
        <div aria-hidden="true" onPointerDown={(event) => startDrag(event, "both")} onPointerMove={moveDrag} onPointerUp={endDrag} onLostPointerCapture={endDrag} className="absolute -right-3 -bottom-3 z-10 size-3 cursor-nwse-resize touch-none" />
      </div>
    );
  }

  const toggleClass = cn(iconButton, "aria-pressed:bg-accent aria-pressed:text-accent-foreground", focusRing);
  const rotatable = Boolean(preset);
  const framable = preset?.kind === "phone" || preset?.kind === "tablet";

  return (
    <div ref={rootRef} data-slot="web-preview" className={cn("flex min-h-80 flex-col overflow-hidden rounded-lg border border-border bg-background text-sm", fallback && "fixed inset-0 z-50 rounded-none border-0", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <button type="button" aria-label="Reload preview" title="Reload preview" onClick={() => (waiting ? readiness.retry() : setReloadKey((key) => key + 1))} className={cn(iconButton, focusRing)}>
          <RotateCwIcon aria-hidden="true" />
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            navigate(address);
          }}
          className="flex h-8 min-w-48 flex-1 items-center overflow-hidden rounded-md border border-input bg-muted/40 focus-within:ring-2 focus-within:ring-ring"
        >
          {servers.length > 1 ? (
            <select
              aria-label="Server"
              value={server?.id}
              onChange={(event) => {
                setServerId(event.target.value);
                setReloadKey((key) => key + 1);
              }}
              className="h-full max-w-40 border-r border-input bg-background px-2 text-xs outline-none"
            >
              {servers.map((item) => (
                <option key={item.id} value={item.id}>
                  {serverName(item)}
                </option>
              ))}
            </select>
          ) : server ? (
            <span className="shrink-0 border-r border-input px-2 text-xs text-muted-foreground">{serverName(server)}</span>
          ) : null}
          {server ? (
            <input
              aria-label="Address"
              aria-invalid={addressError ? true : undefined}
              value={address}
              onChange={(event) => {
                setDraft({ for: path, value: event.target.value });
                setAddressError(null);
              }}
              spellCheck={false}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-xs outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate px-2 text-xs text-muted-foreground">{title}</span>
          )}
        </form>
        <select aria-label="Device" value={preset ? preset.id : RESPONSIVE_DEVICE} onChange={(event) => setDevice(event.target.value)} className={cn("h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs", focusRing)}>
          <option value={RESPONSIVE_DEVICE}>Responsive</option>
          {devices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label} ({item.width}×{item.height})
            </option>
          ))}
        </select>
        <button type="button" aria-label="Landscape" title="Rotate" aria-pressed={landscape} disabled={!rotatable} onClick={() => setLandscape(!landscape)} className={toggleClass}>
          <RectangleHorizontalIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label="Device frame" title="Device frame" aria-pressed={deviceFrame} disabled={!framable} onClick={() => setDeviceFrame(!deviceFrame)} className={toggleClass}>
          <SmartphoneIcon aria-hidden="true" />
        </button>
        {inspectable && (
          <button type="button" aria-label="Select an element" title="Select an element (Esc to stop)" aria-pressed={inspecting} disabled={Boolean(waiting)} onClick={() => setInspecting(!inspecting)} className={toggleClass}>
            <SquareDashedMousePointerIcon aria-hidden="true" />
          </button>
        )}
        {actions}
        <button type="button" aria-label="Open in new tab" title="Open in new tab" disabled={!frameSrc && html === undefined} onClick={openInTab} className={cn(iconButton, focusRing)}>
          <ExternalLinkIcon aria-hidden="true" />
        </button>
        <button type="button" aria-label={fullscreen ? "Exit full screen" : "Full screen"} title={fullscreen ? "Exit full screen" : "Full screen"} aria-pressed={fullscreen} onClick={toggleFullscreen} className={cn(iconButton, focusRing)}>
          {fullscreen ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
        </button>
      </div>
      {(addressError || dimensions) && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1 text-xs">
          {addressError && (
            <p role="alert" className="font-medium text-destructive">
              {addressError}
            </p>
          )}
          {dimensions && (
            <span className="ml-auto flex items-center gap-2 text-muted-foreground tabular-nums">
              {dimensions}
              {responsiveSize && (
                <button type="button" onClick={() => setSize(null)} className={cn("rounded-sm underline underline-offset-2 hover:text-foreground", focusRing)}>
                  Fill
                </button>
              )}
            </span>
          )}
        </div>
      )}
      <div ref={stageRef} className={cn("flex min-h-0 flex-1 items-start justify-center overflow-hidden bg-muted/40", preset ? "p-4" : "p-4 pr-5 pb-5")}>
        {stageContent}
      </div>
    </div>
  );
}
