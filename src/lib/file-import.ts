// packages/ai-ui/src/lib/file-import.ts
import { fileMatchesAccept, type RejectedFile } from "./upload-queue.js";

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "tif", "tiff", "heic", "psd",
  "pdf", "zip", "gz", "tgz", "bz2", "xz", "7z", "rar", "jar", "war",
  "exe", "dll", "so", "dylib", "bin", "class", "o", "a", "wasm", "pyc",
  "mp3", "mp4", "mov", "avi", "mkv", "webm", "wav", "flac", "ogg", "m4a",
  "woff", "woff2", "ttf", "otf", "eot", "sqlite", "db", "xls", "xlsx", "doc", "docx", "ppt", "pptx",
]);

const DEFAULT_IGNORED = /(^|\/)(\.git|node_modules|\.next|dist|build|__pycache__|\.venv)(\/|$)|(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/;

/** Skips version-control folders, dependency and build output folders, and OS clutter. */
export function defaultIgnore(path: string): boolean {
  return DEFAULT_IGNORED.test(path);
}

/** Relative path recorded for a file: the folder path for folder imports, otherwise the name. */
export function filePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function withPath(file: File, path: string): File {
  if (path !== file.name) Object.defineProperty(file, "webkitRelativePath", { value: path, configurable: true });
  return file;
}

interface Entry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (success: (file: File) => void, failure: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (success: (entries: Entry[]) => void, failure: (error: unknown) => void) => void };
}

async function readEntry(entry: Entry, files: File[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
    files.push(withPath(file, entry.fullPath.replace(/^\//, "")));
    return;
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    // readEntries returns results in batches; keep reading until it returns none.
    for (;;) {
      const batch = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      for (const child of batch) await readEntry(child, files);
    }
  }
}

/** Files from a drop, walking dropped folders and recording each file's folder-relative path. */
export async function filesFromDataTransfer(transfer: DataTransfer): Promise<File[]> {
  const items = [...transfer.items].filter((item) => item.kind === "file");
  const entries = items.map((item) => (item as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.() ?? null);
  if (entries.every((entry) => !entry || entry.isFile)) return [...transfer.files];
  const files: File[] = [];
  for (const [index, entry] of entries.entries()) {
    if (entry) await readEntry(entry, files);
    else {
      const file = items[index]!.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

/** Binary by extension, or by a NUL byte in the first 8 KB. */
export async function isProbablyBinary(file: File): Promise<boolean> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BINARY_EXTENSIONS.has(extension)) return true;
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  return head.includes(0);
}

export interface FileFilterOptions {
  accept?: string;
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  skipBinary?: boolean;
  /** Paths to leave out silently; defaults to `defaultIgnore`. Pass `() => false` to keep everything. */
  ignore?: (path: string) => boolean;
}

/** Applies ignore rules, type, binary and size limits; returns accepted files and reasons for the rest. */
export async function filterFiles(files: File[], { accept, maxFiles, maxFileSize, maxTotalSize, skipBinary = false, ignore = defaultIgnore }: FileFilterOptions = {}): Promise<{ accepted: File[]; rejected: RejectedFile[] }> {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];
  let total = 0;
  for (const file of files) {
    const path = filePath(file);
    if (ignore(path)) continue;
    if (!fileMatchesAccept(file, accept)) rejected.push({ name: path, reason: "This file type isn't accepted." });
    else if (maxFileSize !== undefined && file.size > maxFileSize) rejected.push({ name: path, reason: "The file is too large." });
    else if (skipBinary && (await isProbablyBinary(file))) rejected.push({ name: path, reason: "Binary files are skipped." });
    else if (maxFiles !== undefined && accepted.length >= maxFiles) rejected.push({ name: path, reason: `Only ${maxFiles} files can be added at once.` });
    else if (maxTotalSize !== undefined && total + file.size > maxTotalSize) rejected.push({ name: path, reason: "The total size limit was reached." });
    else {
      accepted.push(file);
      total += file.size;
    }
  }
  return { accepted, rejected };
}
