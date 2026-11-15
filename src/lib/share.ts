// packages/ai-ui/src/lib/share.ts
export interface ShareContent {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** The text placed on the clipboard when the system share sheet is unavailable: the URL, else the text, else the title. */
export function shareFallbackText({ title, text, url }: ShareContent): string {
  if (url) return url;
  return text ?? title ?? "";
}

/**
 * Opens the system share sheet when the browser has one and can share this
 * content; otherwise copies the link or text. Dismissing the sheet reports
 * "cancelled" rather than falling back to the clipboard.
 */
export async function shareOrCopy(content: ShareContent): Promise<ShareOutcome> {
  const data: ShareData = {
    ...(content.title ? { title: content.title } : {}),
    ...(content.text ? { text: content.text } : {}),
    ...(content.url ? { url: content.url } : {}),
    ...(content.files?.length ? { files: content.files } : {}),
  };
  if (typeof navigator !== "undefined" && typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  const fallback = shareFallbackText(content);
  if (!fallback || typeof navigator === "undefined" || !navigator.clipboard) return "failed";
  try {
    await navigator.clipboard.writeText(fallback);
    return "copied";
  } catch {
    return "failed";
  }
}
