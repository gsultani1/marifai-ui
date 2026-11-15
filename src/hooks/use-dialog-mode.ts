// packages/ai-ui/src/hooks/use-dialog-mode.ts
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Drives one native <dialog> element between an inline, non-modal state and a
 * modal full-screen state without remounting its children, so editor state,
 * scroll position and iframes survive the switch. Escape (the dialog's
 * cancel event) or a browser-forced close calls `onExitModal`. Attach the
 * returned callback as the dialog's ref; the element is returned for use as
 * a portal container.
 */
export function useDialogMode(
  modal: boolean,
  onExitModal: () => void,
): [(element: HTMLDialogElement | null) => void, HTMLDialogElement | null] {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const isModal = useRef(false);
  const pendingCloses = useRef(0);
  const onExit = useRef(onExitModal);

  useEffect(() => {
    onExit.current = onExitModal;
  }, [onExitModal]);

  useLayoutEffect(() => {
    if (!dialog) return;
    if (modal && !isModal.current) {
      dialog.removeAttribute("open");
      isModal.current = true;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      return;
    }
    if (!modal && isModal.current) {
      isModal.current = false;
      if (typeof dialog.close === "function" && dialog.open) {
        pendingCloses.current++;
        dialog.close();
      }
    }
    if (!modal && !dialog.hasAttribute("open")) dialog.setAttribute("open", "");
  }, [modal, dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (isModal.current) onExit.current();
    };
    const onClose = () => {
      if (pendingCloses.current > 0) {
        pendingCloses.current--;
        return;
      }
      if (!isModal.current) return;
      isModal.current = false;
      dialog.setAttribute("open", "");
      onExit.current();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
  }, [dialog]);

  return [setDialog, dialog];
}
