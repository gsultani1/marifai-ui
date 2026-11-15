// packages/ai-ui/src/components/capture-controls.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CameraIcon, LoaderCircleIcon, MonitorIcon, RefreshCwIcon, SwitchCameraIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useObjectUrl } from "../hooks/use-object-url.js";
import { cameraErrorMessage, captureVideoFrame, isUserCancel, openCamera, stopStream } from "../lib/camera.js";
import { button, buttonVariants, focusRing, iconButton, modalBackdrop } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

const noopSubscribe = () => () => undefined;

function waitForFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth) return Promise.resolve();
  return new Promise((resolve) => video.addEventListener("loadeddata", () => resolve(), { once: true }));
}

/**
 * Asks the user to share a screen, tab or window and returns one PNG frame,
 * or null when they cancel the picker.
 */
export async function captureScreen(): Promise<File | null> {
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await waitForFrame(video);
    const blob = await captureVideoFrame(video, "image/png");
    return new File([blob], `screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`, { type: "image/png" });
  } catch (error) {
    if (isUserCancel(error)) return null;
    throw error;
  } finally {
    stopStream(stream);
  }
}

export interface ScreenshotButtonProps {
  onCapture: (file: File) => void;
  onError?: (error: unknown) => void;
  label?: string;
  className?: string;
}

/** Screenshot of a shared screen, tab or window as a PNG file; cancelling the picker is not an error. Hidden where screen capture is unavailable. */
export function ScreenshotButton({ onCapture, onError, label = "Take screenshot", className }: ScreenshotButtonProps) {
  const supported = useSyncExternalStore(noopSubscribe, () => Boolean(navigator.mediaDevices?.getDisplayMedia), () => false);
  const [busy, setBusy] = useState(false);
  if (!supported) return null;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const file = await captureScreen();
          if (file) onCapture(file);
        } catch (error) {
          onError?.(error);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(iconButton, "rounded-full", focusRing, className)}
    >
      {busy ? <LoaderCircleIcon aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <MonitorIcon aria-hidden="true" />}
    </button>
  );
}

export interface CameraCaptureProps {
  onCapture: (file: File) => void;
  label?: string;
  facingMode?: "environment" | "user";
  /** JPEG quality from 0 to 1. */
  quality?: number;
  className?: string;
}

/**
 * Photo capture in a dialog: live preview with a camera switch, then a
 * review step with Retake or Use photo. The camera turns off as soon as a
 * photo is taken or the dialog closes, and failures are explained plainly.
 */
export function CameraCapture({ onCapture, label = "Take photo", facingMode = "environment", quality = 0.8, className }: CameraCaptureProps) {
  const supported = useSyncExternalStore(noopSubscribe, () => Boolean(navigator.mediaDevices?.getUserMedia), () => false);
  const [open, setOpen] = useState(false);
  const [facing, setFacing] = useState(facingMode);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photoUrl = useObjectUrl(photo);
  const container = usePortalContainer();
  const live = open && !photo;

  useEffect(() => {
    if (!live) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    openCamera(facing)
      .then(async (opened) => {
        stream = opened;
        if (cancelled) return stopStream(opened);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = opened;
        await video.play().catch(() => undefined);
        await waitForFrame(video);
        if (!cancelled) setReady(true);
      })
      .catch((problem: unknown) => {
        if (!cancelled) setError(cameraErrorMessage(problem));
      });
    return () => {
      cancelled = true;
      setReady(false);
      stopStream(stream);
    };
  }, [live, facing]);

  if (!supported) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setPhoto(null);
        setError(null);
      }}
    >
      <Dialog.Trigger aria-label={label} title={label} className={cn(iconButton, "rounded-full", focusRing, className)}>
        <CameraIcon aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className={modalBackdrop} />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">{photo ? "Use this photo?" : label}</Dialog.Title>
            <Dialog.Close aria-label="Close" className={cn(iconButton, focusRing)}>
              <XIcon aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black">
            {photo && photoUrl ? (
              <img src={photoUrl} alt="Captured photo" className="size-full object-contain" />
            ) : error ? (
              <p role="alert" className="max-w-sm px-4 text-center text-sm text-white">
                {error}
              </p>
            ) : (
              <>
                <video ref={videoRef} muted playsInline aria-label="Camera preview" className="size-full object-contain" />
                {!ready && <LoaderCircleIcon aria-hidden="true" className="absolute size-6 animate-spin text-white motion-reduce:animate-none" />}
              </>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            {photo ? (
              <>
                <button type="button" onClick={() => setPhoto(null)} className={cn(button, buttonVariants.outline, focusRing)}>
                  <RefreshCwIcon aria-hidden="true" />
                  Retake
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCapture(new File([photo], `photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg" }));
                    setOpen(false);
                    setPhoto(null);
                  }}
                  className={cn(button, buttonVariants.primary, focusRing)}
                >
                  Use photo
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => {
                    setError(null);
                    setFacing(facing === "user" ? "environment" : "user");
                  }} className={cn(button, buttonVariants.outline, focusRing)}>
                  <SwitchCameraIcon aria-hidden="true" />
                  Switch camera
                </button>
                <button
                  type="button"
                  disabled={!ready}
                  onClick={async () => {
                    const video = videoRef.current;
                    if (!video) return;
                    try {
                      setPhoto(await captureVideoFrame(video, "image/jpeg", quality));
                    } catch (problem) {
                      setError(problem instanceof Error ? problem.message : "Couldn't capture the photo.");
                    }
                  }}
                  className={cn(button, buttonVariants.primary, focusRing)}
                >
                  <CameraIcon aria-hidden="true" />
                  Capture
                </button>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
