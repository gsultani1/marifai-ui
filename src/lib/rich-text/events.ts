// packages/ai-ui/src/lib/rich-text/events.ts
import type { EditorView } from "prosemirror-view";

/** DOM events the editor raises on its root element for UI that lives outside ProseMirror. */
export const RICH_TEXT_EVENTS = {
  openLink: "ai-ui-rich-text:open-link",
  openFind: "ai-ui-rich-text:open-find",
  openImage: "ai-ui-rich-text:open-image",
  openVideo: "ai-ui-rich-text:open-video",
} as const;

export function emitEditorEvent(view: EditorView | undefined, name: (typeof RICH_TEXT_EVENTS)[keyof typeof RICH_TEXT_EVENTS]): boolean {
  view?.dom.dispatchEvent(new CustomEvent(name, { bubbles: true }));
  return Boolean(view);
}
