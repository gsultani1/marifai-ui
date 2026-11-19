// test/vibe-coding-editor.test.tsx
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  createBuilderDocument, VibeBuilderChangeReview, VibeBuilderComposer, VibeCodingEditor,
  type BuilderDocument, type VibeBuilderProposal, type VibeBuilderPromptRequest,
} from "../src/index.js";
import { isDisabled } from "./helpers.js";

afterEach(cleanup);

const design = createBuilderDocument("page", [
  { id: "hero", type: "heading", text: "Storefront", level: 1, align: "left", color: "#111111" },
]);

it("shares block selection and revision across layers, canvas edits and the assistant", () => {
  const request = vi.fn<(request: VibeBuilderPromptRequest) => void>();
  function Project() {
    const [document, setDocument] = useState<BuilderDocument>(design);
    const [revision, setRevision] = useState(1);
    return <VibeCodingEditor projectId="store" title="Store builder" revision={String(revision)} document={document}
      onDocumentChange={(next) => { setDocument(next); setRevision(revision + 1); }}
      onRequest={request} onApplyProposal={vi.fn()} />;
  }
  render(<Project />);
  fireEvent.click(screen.getByRole("treeitem", { name: /Storefront/ }));
  expect(screen.getByRole("complementary", { name: "Block properties" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add Image" }));

  const imageLayer = screen.getByRole("treeitem", { name: /Image/ });
  expect(imageLayer.getAttribute("aria-selected")).toBe("true");
  fireEvent.change(screen.getByRole("textbox", { name: "Describe a change" }), { target: { value: " Add descriptive alt text " } });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  expect(request.mock.calls[0]?.[0]).toMatchObject({
    prompt: "Add descriptive alt text", baseRevision: "2", scope: { kind: "block", blockId: expect.any(String) },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
  expect(screen.getByTitle("Project preview").getAttribute("srcdoc")).toContain("Storefront");
});

it("keeps failed prompts and lets the user switch from block scope to the whole page", async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(undefined);
  render(<VibeBuilderComposer revision="7" selectedBlock={{ id: "hero", label: "Storefront" }} onSubmit={send} />);
  const prompt = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Describe a change" });
  fireEvent.change(prompt, { target: { value: "Make it responsive" } });
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Connection lost");
  expect(prompt.value).toBe("Make it responsive");
  fireEvent.click(screen.getByRole("button", { name: "Use whole page" }));
  fireEvent.click(screen.getByRole("button", { name: "Send request" }));
  expect(send.mock.calls.flat()).toEqual([
    { prompt: "Make it responsive", scope: { kind: "block", blockId: "hero" }, baseRevision: "7" },
    { prompt: "Make it responsive", scope: { kind: "page" }, baseRevision: "7" },
  ]);
});

it("blocks stale proposals, shows file changes, and sends the expected revision on apply", () => {
  const apply = vi.fn();
  const proposal: VibeBuilderProposal = {
    id: "next", baseRevision: "1", summary: "Update the product page", document: design,
    files: [{ id: "app", path: "src/app.tsx", kind: "modified", before: "old", after: "new" }],
  };
  const { rerender } = render(<VibeBuilderChangeReview proposal={proposal} revision="2" onApply={apply} />);
  const button = screen.getByRole<HTMLButtonElement>("button", { name: "Apply changes" });
  expect(isDisabled(button)).toBe(true);
  fireEvent.submit(screen.getByRole("form", { name: "Apply proposal" }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Inspect source changes" }));
  expect(screen.getByText(/src\/app.tsx · modified/)).toBeTruthy();
  rerender(<VibeBuilderChangeReview proposal={proposal} revision="1" onApply={apply} />);
  fireEvent.click(screen.getByRole("button", { name: "Show visual comparison" }));
  expect(screen.getByTitle("Proposed design preview").getAttribute("sandbox")).toBe("");
  fireEvent.click(within(screen.getByRole("form", { name: "Apply proposal" })).getByRole("button", { name: "Apply changes" }));
  expect(apply).toHaveBeenCalledExactlyOnceWith({ proposalId: "next", expectedRevision: "1" });
});
