// packages/ai-ui/src/lib/portal.ts
import { createContext, use } from "react";

/**
 * Element that popups (tooltips, selects, preview cards) portal into. A modal
 * dialog makes everything outside it inert, so full-screen Artifact and Canvas
 * surfaces provide themselves here; elsewhere popups portal to document.body.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | undefined {
  return use(PortalContainerContext) ?? undefined;
}
