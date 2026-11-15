// packages/ai-ui/src/components/image-gallery.tsx
"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ImageOffIcon, XIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { safeImageSrc } from "../lib/safe-url.js";

export interface GalleryImage {
  id: string;
  src: string;
  /** Describes the image; required for accessibility. */
  alt: string;
  /** Smaller image for the grid; defaults to `src`. */
  thumbnail?: string;
  caption?: string;
  /** Allows a download button in the lightbox. */
  downloadName?: string;
}

export interface LightboxProps {
  images: GalleryImage[];
  /** Index of the open image, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

const lightButton = cn("inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-40 [&_svg]:size-5", focusRing);

/** Full-screen image viewer: arrows wrap around, Escape closes, swipe on touch, zoom to actual size. */
export function Lightbox({ images, index, onIndexChange }: LightboxProps) {
  const container = usePortalContainer();
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const image = index !== null ? images[index] : undefined;
  const count = images.length;
  const src = image ? safeImageSrc(image.src) : undefined;

  const go = (delta: number) => {
    if (index === null || count === 0) return;
    setZoomed(false);
    onIndexChange((index + delta + count) % count);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setZoomed(false);
      onIndexChange(event.key === "Home" ? 0 : count - 1);
    }
  };

  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || event.pointerType === "mouse") return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  return (
    <Dialog.Root
      open={index !== null && Boolean(image)}
      onOpenChange={(open) => {
        if (!open) {
          setZoomed(false);
          onIndexChange(null);
        }
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/90" />
        <Dialog.Popup data-slot="lightbox" onKeyDown={onKeyDown} className="fixed inset-0 z-50 flex flex-col text-white outline-none">
          <div className="flex items-center gap-2 p-3">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm">{image?.caption ?? image?.alt}</Dialog.Title>
            <span aria-live="polite" className="text-sm tabular-nums">
              {(index ?? 0) + 1} / {count}
            </span>
            <button type="button" aria-label={zoomed ? "Fit to screen" : "Actual size"} aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)} className={lightButton}>
              {zoomed ? <ZoomOutIcon aria-hidden="true" /> : <ZoomInIcon aria-hidden="true" />}
            </button>
            {image?.downloadName && src && (
              <a href={src} download={image.downloadName} aria-label="Download image" className={lightButton}>
                <DownloadIcon aria-hidden="true" />
              </a>
            )}
            <Dialog.Close aria-label="Close" className={lightButton}>
              <XIcon aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div
            className={cn("relative flex min-h-0 flex-1 items-center justify-center", zoomed ? "overflow-auto" : "overflow-hidden")}
            onPointerDown={(event) => {
              swipe.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={onPointerUp}
          >
            {image && src && !failed.has(image.id) ? (
              <img
                key={image.id}
                src={src}
                alt={image.alt}
                onError={() => setFailed(new Set(failed).add(image.id))}
                onClick={() => setZoomed(!zoomed)}
                className={cn("select-none", zoomed ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain")}
                draggable={false}
              />
            ) : (
              <p className="flex items-center gap-2 text-sm text-white/80">
                <ImageOffIcon aria-hidden="true" className="size-5" />
                This image could not be loaded.
              </p>
            )}
            {count > 1 && (
              <>
                <button type="button" aria-label="Previous image" onClick={() => go(-1)} className={cn(lightButton, "absolute top-1/2 left-3 -translate-y-1/2")}>
                  <ChevronLeftIcon aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next image" onClick={() => go(1)} className={cn(lightButton, "absolute top-1/2 right-3 -translate-y-1/2")}>
                  <ChevronRightIcon aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {image?.caption && <p className="px-4 pb-4 text-center text-sm text-white/80">{image.alt}</p>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface ImageGalleryProps extends Omit<ComponentProps<"ul">, "children"> {
  images: GalleryImage[];
  /** Index open in the lightbox; null when closed. */
  openIndex?: number | null;
  onOpenIndexChange?: (index: number | null) => void;
  /** Minimum thumbnail width in pixels. */
  minThumbnailWidth?: number;
  emptyLabel?: string;
}

/** Responsive thumbnail grid that opens a Lightbox; broken images show a placeholder. */
export function ImageGallery({ images, openIndex, onOpenIndexChange, minThumbnailWidth = 140, emptyLabel = "No images", className, style, ...props }: ImageGalleryProps) {
  const [index, setIndex] = useControllableState<number | null>({ value: openIndex, defaultValue: null, onChange: onOpenIndexChange });
  const [failed, setFailed] = useState<Set<string>>(new Set());
  if (images.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <>
      <ul data-slot="image-gallery" className={cn("grid gap-2", className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minThumbnailWidth}px, 1fr))`, ...style }} {...props}>
        {images.map((image, position) => {
          const src = safeImageSrc(image.thumbnail ?? image.src);
          return (
            <li key={image.id}>
              <button type="button" onClick={() => setIndex(position)} className={cn("group relative block aspect-square w-full overflow-hidden rounded-md bg-muted", focusRing)}>
                {src && !failed.has(image.id) ? (
                  <img src={src} alt={image.alt} loading="lazy" onError={() => setFailed(new Set(failed).add(image.id))} className="size-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none" />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageOffIcon aria-hidden="true" className="size-6" />
                    <span className="sr-only">{image.alt} (unavailable)</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <Lightbox images={images} index={index ?? null} onIndexChange={setIndex} />
    </>
  );
}
