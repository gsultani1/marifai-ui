// packages/ai-ui/src/lib/safe-url.ts
const WEB_PROTOCOLS = ["http:", "https:"];
const RELATIVE_BASE = "https://relative.invalid/";

export interface SafeUrlOptions {
  /** Accepts paths such as `/files/a.pdf` and returns them unchanged. */
  allowRelative?: boolean;
}

/**
 * Returns the normalized URL when it uses an allowed protocol and carries no
 * embedded credentials; otherwise undefined. Use it for any link that comes
 * from model output or tool results.
 */
export function safeUrl(
  value: string | undefined,
  protocols: readonly string[] = WEB_PROTOCOLS,
  { allowRelative = false }: SafeUrlOptions = {},
): string | undefined {
  if (!value) return undefined;
  try {
    const url = allowRelative ? new URL(value, RELATIVE_BASE) : new URL(value);
    if (!protocols.includes(url.protocol) || url.username || url.password) return undefined;
    return url.href.startsWith(RELATIVE_BASE) ? value : url.href;
  } catch {
    return undefined;
  }
}

const LINK_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];
const IMAGE_PROTOCOLS = ["http:", "https:", "blob:"];

/** Allowed link target, or undefined. Relative links are kept. */
export function safeLinkHref(value: string | null | undefined): string | undefined {
  return safeUrl(value ?? undefined, LINK_PROTOCOLS, { allowRelative: true });
}

/** Allowed image source: http(s), blob, relative, or a raster/SVG data URI. */
export function safeImageSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  return safeUrl(value, IMAGE_PROTOCOLS, { allowRelative: true });
}
