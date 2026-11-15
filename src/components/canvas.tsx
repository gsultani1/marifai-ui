// packages/ai-ui/src/components/canvas.tsx
"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type RefObject,
  use,
  useCallback,
  useId,
  useMemo,
  useRef,
} from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useDialogMode } from "../hooks/use-dialog-mode.js";
import { cn } from "../lib/cn.js";
import { PortalContainerContext } from "../lib/portal.js";

export type CanvasMode = "split" | "fullscreen";

interface CanvasContextValue {
  open: boolean;
  mode: CanvasMode;
  setMode: (mode: CanvasMode) => void;
  size: number;
  setSize: (size: number) => void;
  minSize: number;
  maxSize: number;
  panelId: string;
  rootRef: RefObject<HTMLDivElement | null>;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas(): CanvasContextValue {
  const context = use(CanvasContext);
  if (!context) throw new Error("Canvas parts must be rendered inside <Canvas>.");
  return context;
}

export interface CanvasProps extends ComponentProps<"div"> {
  /** Shows the workspace panel. */
  open?: boolean;
  mode?: CanvasMode;
  defaultMode?: CanvasMode;
  onModeChange?: (mode: CanvasMode) => void;
  /** Panel width as a percentage of the canvas. */
  size?: number;
  defaultSize?: number;
  onSizeChange?: (size: number) => void;
  minSize?: number;
  maxSize?: number;
}

/**
 * Split-view workspace: a main column (usually the conversation) beside a
 * resizable panel for long-form or interactive output. In "fullscreen" mode
 * the panel becomes a modal dialog covering the viewport. Below the md
 * breakpoint the split panel overlays the main column.
 */
export function Canvas({
  open = true,
  mode: modeProp,
  defaultMode = "split",
  onModeChange,
  size: sizeProp,
  defaultSize = 50,
  onSizeChange,
  minSize = 25,
  maxSize = 75,
  className,
  ...props
}: CanvasProps) {
  const [mode, setMode] = useControllableState({ value: modeProp, defaultValue: defaultMode, onChange: onModeChange });
  const [size, setSize] = useControllableState({ value: sizeProp, defaultValue: defaultSize, onChange: onSizeChange });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const context = useMemo(
    () => ({ open, mode, setMode, size, setSize, minSize, maxSize, panelId, rootRef }),
    [open, mode, setMode, size, setSize, minSize, maxSize, panelId],
  );

  return (
    <CanvasContext value={context}>
      <div
        ref={rootRef}
        data-slot="canvas"
        data-mode={mode}
        data-open={open || undefined}
        className={cn("relative flex h-full w-full min-w-0 overflow-hidden", className)}
        {...props}
      />
    </CanvasContext>
  );
}

export function CanvasMain({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="canvas-main" className={cn("flex min-w-0 flex-1 flex-col", className)} {...props} />;
}

export function CanvasPanel(props: ComponentProps<"dialog">) {
  const { open } = useCanvas();
  if (!open) return null;
  return <CanvasPanelDialog {...props} />;
}

function CanvasPanelDialog({ className, style, children, ...props }: ComponentProps<"dialog">) {
  const { mode, setMode, size, panelId } = useCanvas();
  const exitFullscreen = useCallback(() => setMode("split"), [setMode]);
  const [dialogRef, dialog] = useDialogMode(mode === "fullscreen", exitFullscreen);
  const parentContainer = use(PortalContainerContext);

  return (
    <dialog
      ref={dialogRef}
      id={panelId}
      aria-label="Workspace"
      data-slot="canvas-panel"
      data-mode={mode}
      style={{ "--canvas-panel-size": `${size}%`, ...style } as CSSProperties}
      className={cn(
        "m-0 hidden max-h-none max-w-none flex-col overflow-hidden border-0 bg-background p-0 text-foreground open:flex",
        mode === "split"
          ? "relative h-full shrink-0 basis-[var(--canvas-panel-size)] border-l border-border max-md:absolute max-md:inset-0 max-md:z-10 max-md:border-l-0"
          : "fixed inset-0 h-dvh w-dvw backdrop:bg-black/50",
        className,
      )}
      {...props}
    >
      <PortalContainerContext value={mode === "fullscreen" ? dialog : parentContainer}>{children}</PortalContainerContext>
    </dialog>
  );
}

const KEYBOARD_STEP = 5;

export function CanvasResizeHandle({ className, onKeyDown, ...props }: ComponentProps<"div">) {
  const { open, mode, size, setSize, minSize, maxSize, panelId, rootRef } = useCanvas();
  if (!open || mode !== "split") return null;

  const clamp = (value: number) => Math.round(Math.min(maxSize, Math.max(minSize, value)) * 10) / 10;
  const resizeTo = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setSize(clamp(((rect.right - clientX) / rect.width) * 100));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize workspace"
      aria-controls={panelId}
      aria-valuenow={Math.round(100 - size)}
      aria-valuemin={Math.round(100 - maxSize)}
      aria-valuemax={Math.round(100 - minSize)}
      aria-valuetext={`Chat ${Math.round(100 - size)}%, workspace ${Math.round(size)}%`}
      tabIndex={0}
      data-slot="canvas-resize-handle"
      className={cn(
        "group relative z-10 -mx-1 w-2 shrink-0 cursor-col-resize touch-none outline-none max-md:hidden",
        className,
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeTo(event.clientX);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const step = event.shiftKey ? KEYBOARD_STEP * 2 : KEYBOARD_STEP;
        if (event.key === "ArrowLeft") setSize(clamp(size + step));
        else if (event.key === "ArrowRight") setSize(clamp(size - step));
        else if (event.key === "Home") setSize(maxSize);
        else if (event.key === "End") setSize(minSize);
        else return;
        event.preventDefault();
      }}
      {...props}
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-ring group-focus-visible:w-0.5 group-focus-visible:bg-ring group-active:bg-ring" />
    </div>
  );
}
