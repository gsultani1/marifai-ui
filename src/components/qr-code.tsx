// packages/ai-ui/src/components/qr-code.tsx
"use client";

import { DownloadIcon } from "lucide-react";
import { type ComponentProps, useMemo } from "react";

import { button, buttonVariants, focusRing, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { downloadBlob, downloadText, safeFileName } from "../lib/download.js";
import { encodeQR, type QRCodeMatrix, type QRErrorCorrectionLevel, qrSvgPath, qrToSvgString } from "../lib/qr-code.js";

export interface QRCodeProps extends Omit<ComponentProps<"div">, "children"> {
  /** Text or URL to encode. */
  value: string;
  /** Accessible name; defaults to "QR code for" followed by the value. */
  label?: string;
  /** Defaults to "M". Use "H" when a logo or wear may cover part of the code. */
  ecLevel?: QRErrorCorrectionLevel;
  /** Smallest version (1 to 40) to use. */
  minVersion?: number;
  /** Rendered width and height in pixels. */
  size?: number;
  /** Quiet zone in modules; scanners expect at least 4. */
  margin?: number;
  /** Dark module color. Black on white scans most reliably, in either theme. */
  foreground?: string;
  background?: string;
  /** Shows buttons that save the code as SVG and PNG. */
  downloadable?: boolean;
  /** File name without extension for downloads. */
  fileName?: string;
  /** Pixels per module in the PNG download. */
  pngScale?: number;
}

const BLACK = "#000000";
const WHITE = "#ffffff";

function savePng(matrix: QRCodeMatrix, margin: number, scale: number, foreground: string, background: string, name: string): void {
  const extent = (matrix.size + margin * 2) * scale;
  const canvas = document.createElement("canvas");
  canvas.width = extent;
  canvas.height = extent;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = background;
  context.fillRect(0, 0, extent, extent);
  context.fillStyle = foreground;
  matrix.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) context.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
    });
  });
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(name, blob);
  }, "image/png");
}

/**
 * QR Code drawn as crisp SVG from the built-in encoder, with a quiet zone and
 * black-on-white defaults for reliable scanning in light and dark themes.
 * Input that does not fit shows an inline error instead of throwing.
 */
export function QRCode({
  value,
  label,
  ecLevel = "M",
  minVersion,
  size = 160,
  margin = 4,
  foreground = BLACK,
  background = WHITE,
  downloadable = false,
  fileName = "qr-code",
  pngScale = 8,
  className,
  ...props
}: QRCodeProps) {
  const result = useMemo((): { matrix: QRCodeMatrix } | { error: string } => {
    try {
      return { matrix: encodeQR(value, { ecLevel, ...(minVersion !== undefined ? { minVersion } : {}) }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [value, ecLevel, minVersion]);
  const name = label ?? `QR code for ${value}`;

  if ("error" in result) {
    return (
      <div role="alert" data-slot="qr-code" data-error="" className={cn("flex max-w-xs flex-col gap-1 rounded-lg border p-3 text-sm", toneSurface.danger, className)} {...props}>
        <span className="font-medium">This text is too long for a QR code.</span>
        <span className="text-muted-foreground">{result.error}</span>
      </div>
    );
  }

  const { matrix } = result;
  const extent = matrix.size + margin * 2;
  const base = safeFileName(fileName, "qr-code");
  return (
    <div data-slot="qr-code" data-version={matrix.version} className={cn("inline-flex flex-col items-center gap-2", className)} {...props}>
      <svg role="img" aria-label={name} viewBox={`0 0 ${extent} ${extent}`} width={size} height={size} shapeRendering="crispEdges" className="block max-w-full rounded-sm">
        <rect width={extent} height={extent} fill={background} />
        <path d={qrSvgPath(matrix.modules, margin)} fill={foreground} />
      </svg>
      {downloadable && (
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" aria-label={`Download ${name} as SVG`} onClick={() => downloadText(`${base}.svg`, qrToSvgString(matrix, { margin, foreground, background, size }), "image/svg+xml")} className={cn(button, buttonVariants.outline, focusRing)}>
            <DownloadIcon aria-hidden="true" />
            SVG
          </button>
          <button type="button" aria-label={`Download ${name} as PNG`} onClick={() => savePng(matrix, margin, pngScale, foreground, background, `${base}.png`)} className={cn(button, buttonVariants.outline, focusRing)}>
            <DownloadIcon aria-hidden="true" />
            PNG
          </button>
        </div>
      )}
    </div>
  );
}
