// packages/ai-ui/src/components/barcode-scanner.tsx
"use client";

import { CameraIcon, CameraOffIcon, ScanLineIcon } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { cameraErrorMessage, openCamera, stopStream } from "../lib/camera.js";
import { button, buttonVariants, focusRing, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorInstance {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

export const RETAIL_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

const noopSubscribe = () => () => undefined;

function useBarcodeDetector(): BarcodeDetectorConstructor | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector ?? null,
    () => null,
  );
}

export interface BarcodeScannerProps {
  onDetect: (code: string, format: string) => void;
  formats?: string[];
  /** Ignores the same code seen again within this window. */
  dedupeMs?: number;
  allowManualEntry?: boolean;
  className?: string;
}

/**
 * Camera barcode scanning with the browser's BarcodeDetector: starts on
 * request with the rear camera (falling back to any camera), scans a few
 * times a second, ignores repeats, explains camera errors in plain words,
 * and always offers typed entry, which is also the path on browsers without
 * BarcodeDetector.
 */
export function BarcodeScanner({ onDetect, formats = RETAIL_BARCODE_FORMATS, dedupeMs = 1500, allowManualEntry = true, className }: BarcodeScannerProps) {
  const Detector = useBarcodeDetector();
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const id = useId();
  const formatKey = formats.join(",");

  useEffect(() => {
    onDetectRef.current = onDetect;
  });

  useEffect(() => {
    if (!active || !Detector) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let lastScanAt = 0;
    let lastSeen = { code: "", at: 0 };
    const detector = new Detector({ formats: formatKey.split(",") });

    const loop = async (time: number) => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && time - lastScanAt > 150) {
        lastScanAt = time;
        try {
          const [found] = await detector.detect(video);
          const now = Date.now();
          if (found && !stopped && !(found.rawValue === lastSeen.code && now - lastSeen.at < dedupeMs)) {
            lastSeen = { code: found.rawValue, at: now };
            setLastCode(found.rawValue);
            navigator.vibrate?.(60);
            onDetectRef.current(found.rawValue, found.format);
          }
        } catch {
          // A frame can fail to decode while the camera adjusts; keep scanning.
        }
      }
      frame = requestAnimationFrame((next) => void loop(next));
    };

    const start = async () => {
      try {
        stream = await openCamera("environment");
        if (stopped) return stopStream(stream);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        frame = requestAnimationFrame((next) => void loop(next));
      } catch (problem) {
        if (stopped) return;
        setError(cameraErrorMessage(problem, "Or type the code below."));
        setActive(false);
      }
    };

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stopStream(stream);
    };
  }, [active, Detector, formatKey, dedupeMs]);

  const submitManual = (event: FormEvent) => {
    event.preventDefault();
    const code = manual.trim();
    if (!code) return;
    setLastCode(code);
    onDetect(code, "manual");
    setManual("");
  };

  return (
    <div data-slot="barcode-scanner" className={cn("flex flex-col gap-3", className)}>
      {Detector ? (
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          <video ref={videoRef} muted playsInline aria-label="Camera preview" className={cn("size-full object-cover", !active && "hidden")} />
          {active ? (
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-[15%] top-1/2 h-0.5 -translate-y-1/2 rounded bg-destructive/80 shadow-[0_0_8px_var(--destructive)]" />
          ) : (
            <button type="button" onClick={() => {
                setError(null);
                setActive(true);
              }} className={cn(button, buttonVariants.primary, focusRing)}>
              <CameraIcon aria-hidden="true" />
              Start camera
            </button>
          )}
          {active && (
            <button type="button" onClick={() => setActive(false)} className={cn(button, buttonVariants.outline, "absolute right-2 bottom-2 bg-background/90", focusRing)}>
              <CameraOffIcon aria-hidden="true" />
              Stop
            </button>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <ScanLineIcon aria-hidden="true" className="size-4" />
          This browser can't scan with the camera. Use a handheld scanner or type the code.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <p role="status" className="text-sm empty:hidden">
        {lastCode ? (
          <>
            Scanned <span className="font-mono font-medium">{lastCode}</span>
          </>
        ) : (
          ""
        )}
      </p>
      {allowManualEntry && (
        <form onSubmit={submitManual} className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`${id}-manual`} className="text-xs font-medium text-muted-foreground">
              Barcode or SKU
            </label>
            <input id={`${id}-manual`} value={manual} onChange={(event) => setManual(event.target.value)} inputMode="numeric" autoComplete="off" spellCheck={false} className={cn(input, focusRing, "font-mono focus-visible:ring-offset-0")} />
          </div>
          <button type="submit" disabled={!manual.trim()} className={cn(button, buttonVariants.outline, "h-9", focusRing)}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}
