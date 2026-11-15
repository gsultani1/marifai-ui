// packages/ai-ui/test/component-submission.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AgentSteeringInput, AssistantFollowUpComposer, ToolCallBatchReview } from "../src/index.js";

it("dispatches steering once while the request is pending and preserves the draft on rejection", async () => {
  let reject: (reason: Error) => void = () => undefined;
  const send = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
  render(<AgentSteeringInput initialMessage="Check the source" onSend={send} />);
  const form = screen.getByRole("form", { name: "Send steering message" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(send).toHaveBeenCalledExactlyOnceWith("Check the source");

  await act(async () => { reject(new Error("Agent disconnected")); });
  expect(screen.getByRole("alert").textContent).toBe("Agent disconnected");
  expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Check the source");
});

it("keeps a new follow-up draft when a save for the previous source completes", async () => {
  let finish: () => void = () => undefined;
  const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const { rerender } = render(<AssistantFollowUpComposer sourceId="a" sourceLabel="First source" people={[]} onSubmit={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "First draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save follow-up" }));
  rerender(<AssistantFollowUpComposer sourceId="b" sourceLabel="Second source" people={[]} onSubmit={save} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Second draft" } });
  await act(async () => { finish(); });

  expect(save).toHaveBeenCalledExactlyOnceWith({ sourceId: "a", title: "First draft", personId: null, dueDate: null });
  expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Second draft");
});

it("submits decisions for the current tool calls only, in display order", () => {
  const submit = vi.fn();
  const first = { id: "first", tool: "Read", summary: "Read files" };
  const second = { id: "second", tool: "Write", summary: "Write a file" };
  const { rerender } = render(<ToolCallBatchReview calls={[first, second]} onSubmit={submit} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Decision for Read" }), { target: { value: "approve" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Decision for Write" }), { target: { value: "deny" } });
  rerender(<ToolCallBatchReview calls={[second]} onSubmit={submit} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit decisions" }));
  expect(submit).toHaveBeenCalledExactlyOnceWith([{ id: "second", decision: "deny" }]);
});
