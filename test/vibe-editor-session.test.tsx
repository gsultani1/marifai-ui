// test/vibe-editor-session.test.tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  createBuilderDocument, restoreVibeBuilderSession, VibeCodingEditor,
  type BuilderDocument, type VibeBuilderProposal, type VibeBuilderSession,
} from "../src/index.js";

afterEach(cleanup);
const initial = createBuilderDocument("page", [
  { id: "hero", type: "heading", text: "First heading", level: 1, align: "left" },
]);
const changed = { ...initial, blocks: [{ ...initial.blocks[0]!, text: "Proposed heading" }] } as BuilderDocument;

it("keeps a single undo history for manual edits, host proposals, and redo", async () => {
  function Host() {
    const [doc, setDoc] = useState(initial);
    const [revision, setRevision] = useState(1);
    const [proposal, setProposal] = useState<VibeBuilderProposal | null>(null);
    const update = (next: BuilderDocument) => { setDoc(next); setRevision(value => value + 1); };
    return <VibeCodingEditor projectId="history" title="History test" document={doc} revision={String(revision)}
      onDocumentChange={update} onRequest={() => setProposal({
        id: "proposal", baseRevision: String(revision), summary: "Change heading", document: changed, baseDocument: doc, files: [],
      })} proposal={proposal} onApplyProposal={() => { update(changed); setProposal(null); }} />;
  }
  render(<Host />);
  const edit = within(screen.getByRole("region", { name: "Page builder" }));
  fireEvent.click(edit.getByRole("button", { name: "Add Divider" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Describe a change" }), { target: { value: "Change heading" } });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  await screen.findByRole("button", { name: "Preview changes" });
  fireEvent.click(screen.getAllByRole("button", { name: "Apply changes" })[0]!);
  await screen.findByRole("heading", { name: "Proposed heading" });
  const editor = screen.getByRole("region", { name: "History test" });
  const undo = within(editor).getAllByRole("button", { name: "Undo" })[0]!;
  fireEvent.click(undo);
  await screen.findByRole("heading", { name: "First heading" });
  expect(editor.querySelectorAll('[data-block-id]').length).toBe(2);
  fireEvent.click(undo);
  await waitFor(() => expect(editor.querySelectorAll('[data-block-id]').length).toBe(1));
  fireEvent.click(within(editor).getAllByRole("button", { name: "Redo" })[0]!);
  await waitFor(() => expect(editor.querySelectorAll('[data-block-id]').length).toBe(2));
});

it("preserves drafts through tabs, a failed save, and retry and restores selection and undo", async () => {
  let latest: VibeBuilderSession | undefined;
  const save = vi.fn().mockRejectedValueOnce(new Error("Storage offline")).mockResolvedValueOnce(undefined);
  const onSessionChange = (session: VibeBuilderSession) => { latest = session; };
  const props = { projectId: "restore", title: "Restore test", document: initial, revision: "1",
    onDocumentChange: vi.fn(), onRequest: vi.fn(), onApplyProposal: vi.fn(), onSessionChange, onSaveSession: save };
  const view = render(<VibeCodingEditor {...props} />);
  fireEvent.click(screen.getByRole("treeitem", { name: /First heading/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Describe a change" }), { target: { value: "Keep my draft" } });
  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
  expect((screen.getByRole("textbox", { name: "Describe a change" }) as HTMLTextAreaElement).value).toBe("Keep my draft");
  fireEvent.click(screen.getByRole("button", { name: "Save session" }));
  await screen.findByText("Storage offline");
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await screen.findByText("Saved", { exact: true });
  expect(save).toHaveBeenCalledTimes(2);
  const restored = restoreVibeBuilderSession(JSON.parse(JSON.stringify(latest)), "restore");
  expect(restored?.draft).toBe("Keep my draft");
  expect(restored?.selectedBlockId).toBe("hero");
  view.unmount();
  render(<VibeCodingEditor {...props} initialSession={restored!} />);
  expect((screen.getByRole("textbox", { name: "Describe a change" }) as HTMLTextAreaElement).value).toBe("Keep my draft");
  expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("aria-selected")).toBe("true");
});

it("rejects a malformed or mismatched stored session", () => {
  expect(restoreVibeBuilderSession(null, "project")).toBeNull();
  expect(restoreVibeBuilderSession({ version: 1, projectId: "other" }, "project")).toBeNull();
  expect(restoreVibeBuilderSession({ version: 1, projectId: "project", history: { past: [{}] } }, "project")).toBeNull();
});
