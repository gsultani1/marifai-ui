// packages/ai-ui/src/components/artifact.tsx
"use client";

import { Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react";
import { type ComponentProps, createContext, use, useCallback, useId, useMemo } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useDialogMode } from "../hooks/use-dialog-mode.js";
import { focusRing, iconButton } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { PortalContainerContext } from "../lib/portal.js";

export type ArtifactMode = "panel" | "fullscreen";

interface ArtifactContextValue {
  mode: ArtifactMode;
  setMode: (mode: ArtifactMode) => void;
  close: (() => void) | undefined;
  titleId: string;
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export function useArtifact(): ArtifactContextValue {
  const context = use(ArtifactContext);
  if (!context) throw new Error("Artifact parts must be rendered inside <Artifact>.");
  return context;
}

export interface ArtifactProps extends Omit<ComponentProps<"dialog">, "open"> {
  /** Unmounts the artifact when false. */
  open?: boolean;
  /** Called with false by <ArtifactClose>. */
  onOpenChange?: (open: boolean) => void;
  mode?: ArtifactMode;
  defaultMode?: ArtifactMode;
  onModeChange?: (mode: ArtifactMode) => void;
}

/**
 * Container for a generated document, code file or interactive output. In
 * "panel" mode it sits in the page layout (e.g. as the side of a <Canvas>);
 * in "fullscreen" mode the same element becomes a modal dialog over the page,
 * so its content keeps its state. Escape leaves full screen.
 */
export function Artifact({
  open = true,
  onOpenChange,
  mode: modeProp,
  defaultMode = "panel",
  onModeChange,
  ...props
}: ArtifactProps) {
  if (!open) return null;
  return (
    <ArtifactRoot
      mode={modeProp}
      defaultMode={defaultMode}
      onModeChange={onModeChange}
      onOpenChange={onOpenChange}
      {...props}
    />
  );
}

function ArtifactRoot({
  mode: modeProp,
  defaultMode,
  onModeChange,
  onOpenChange,
  className,
  children,
  ...props
}: Omit<ArtifactProps, "open"> & { defaultMode: ArtifactMode }) {
  const [mode, setMode] = useControllableState({ value: modeProp, defaultValue: defaultMode, onChange: onModeChange });
  const exitFullscreen = useCallback(() => setMode("panel"), [setMode]);
  const [dialogRef, dialog] = useDialogMode(mode === "fullscreen", exitFullscreen);
  const parentContainer = use(PortalContainerContext);
  const titleId = useId();
  const close = useMemo(() => (onOpenChange ? () => onOpenChange(false) : undefined), [onOpenChange]);
  const context = useMemo(() => ({ mode, setMode, close, titleId }), [mode, setMode, close, titleId]);

  return (
    <ArtifactContext value={context}>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        data-slot="artifact"
        data-mode={mode}
        className={cn(
          "m-0 hidden max-h-none max-w-none flex-col overflow-hidden border-0 bg-background p-0 text-foreground open:flex",
          mode === "panel"
            ? "relative h-full w-full"
            : "fixed inset-0 h-dvh w-dvw backdrop:bg-black/50",
          className,
        )}
        {...props}
      >
        <PortalContainerContext value={mode === "fullscreen" ? dialog : parentContainer}>{children}</PortalContainerContext>
      </dialog>
    </ArtifactContext>
  );
}

export function ArtifactHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="artifact-header"
      className={cn("flex h-12 shrink-0 items-center gap-2 border-b border-border px-3", className)}
      {...props}
    />
  );
}

export function ArtifactTitle({ className, ...props }: ComponentProps<"h2">) {
  const { titleId } = useArtifact();
  return (
    <h2
      id={titleId}
      data-slot="artifact-title"
      className={cn("min-w-0 flex-1 truncate text-sm font-medium", className)}
      {...props}
    />
  );
}

export function ArtifactActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="artifact-actions" className={cn("flex shrink-0 items-center gap-0.5", className)} {...props} />;
}

export interface ArtifactActionProps extends ComponentProps<"button"> {
  /** Accessible name, also shown as the native tooltip. */
  label: string;
}

export function ArtifactAction({ label, className, ...props }: ArtifactActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-slot="artifact-action"
      className={cn(iconButton, focusRing, className)}
      {...props}
    />
  );
}

export function ArtifactModeToggle(props: Omit<ArtifactActionProps, "label" | "onClick">) {
  const { mode, setMode } = useArtifact();
  const fullscreen = mode === "fullscreen";
  return (
    <ArtifactAction
      label={fullscreen ? "Exit full screen" : "Full screen"}
      onClick={() => setMode(fullscreen ? "panel" : "fullscreen")}
      {...props}
    >
      {fullscreen ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
    </ArtifactAction>
  );
}

export function ArtifactClose(props: Omit<ArtifactActionProps, "label" | "onClick"> & { label?: string }) {
  const { close } = useArtifact();
  if (!close) return null;
  return (
    <ArtifactAction label="Close" onClick={close} {...props}>
      <XIcon aria-hidden="true" />
    </ArtifactAction>
  );
}

export function ArtifactContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="artifact-content" className={cn("min-h-0 flex-1 overflow-auto", className)} {...props} />;
}
