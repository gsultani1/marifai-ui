// packages/ai-ui/src/hooks/use-object-url.ts
import { useEffect, useState } from "react";

/** Object URL for a Blob or File, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | undefined {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is an external resource created and revoked with the effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return entry && entry.blob === blob ? entry.url : undefined;
}
