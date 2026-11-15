// packages/ai-ui/src/components/binary-file-placeholder.tsx
import { DownloadIcon, FileWarningIcon } from "lucide-react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatBytes } from "../lib/format.js";

export interface BinaryFilePlaceholderProps {
  name?: string;
  /** Size in bytes. */
  size?: number;
  onDownload?: () => void;
  className?: string;
}

/** Stand-in for files that can't be shown as text, with an optional download. */
export function BinaryFilePlaceholder({ name, size, onDownload, className }: BinaryFilePlaceholderProps) {
  return (
    <div data-slot="binary-file-placeholder" className={cn("flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm", className)}>
      <FileWarningIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="font-medium">{name ? `${name} is a binary file` : "Binary file"}</p>
      <p className="text-muted-foreground">It can't be shown as text{size !== undefined ? ` (${formatBytes(size)})` : ""}.</p>
      {onDownload && (
        <button type="button" onClick={onDownload} className={cn(button, buttonVariants.outline, focusRing)}>
          <DownloadIcon aria-hidden="true" />
          Download
        </button>
      )}
    </div>
  );
}
