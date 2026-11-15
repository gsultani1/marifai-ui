// packages/ai-ui/src/lib/download.ts
/** Characters that are invalid in file names on common systems, replaced with "-". */
export function safeFileName(name: string, fallback = "download"): string {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || fallback;
}

/** Saves a Blob through a temporary object URL. */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves text as a file of the given MIME type. */
export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8"): void {
  downloadBlob(name, new Blob([text], { type }));
}
