// packages/ai-ui/test/edge-cases.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  DataTable,
  MessageContent,
  parseDelimited,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Suggestion,
} from "../src/index.js";

describe("MessageContent while streaming", () => {
  const source = [
    "Intro with **bold**, `code` and a [link](https://example.com).",
    "",
    "<img src=x onerror=alert(1)><script>alert(2)</script>",
    "",
    "```ts",
    "const fenced = `<b>${1}</b>`;",
    "```",
    "",
    "- [x] done",
    "- [ ] open",
  ].join("\n");

  it("never renders raw HTML for any streamed prefix and keeps fenced code intact", () => {
    const { container, rerender } = render(<MessageContent streaming>{""}</MessageContent>);
    for (let end = 1; end <= source.length; end++) {
      rerender(<MessageContent streaming>{source.slice(0, end)}</MessageContent>);
      expect(container.querySelector("script, img, b")).toBeNull();
    }
    rerender(<MessageContent>{source}</MessageContent>);
    expect(container.querySelector('[data-slot="code-block"] pre')?.textContent).toBe("const fenced = `<b>${1}</b>`;");
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });

  it("renders task lists as disabled checkboxes", () => {
    render(<MessageContent>{"- [x] done\n- [ ] open"}</MessageContent>);
    const boxes = screen.getAllByRole<HTMLInputElement>("checkbox");
    expect(boxes.map((box) => [box.checked, box.disabled])).toEqual([
      [true, true],
      [false, true],
    ]);
  });
});

describe("PromptInput edge cases", () => {
  it("lets a consumer key handler cancel submission", () => {
    const onSubmit = vi.fn();
    render(
      <PromptInput onSubmit={onSubmit} defaultValue="Draft">
        <PromptInputTextarea onKeyDown={(event) => event.key === "Enter" && event.preventDefault()} />
      </PromptInput>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Message" }), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only prompts unless empty sends are allowed", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PromptInput onSubmit={onSubmit} defaultValue="   ">
        <PromptInputTextarea />
        <PromptInputSubmit />
      </PromptInput>,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send message" }).disabled).toBe(true);
    rerender(
      <PromptInput onSubmit={onSubmit} defaultValue="   " allowEmpty>
        <PromptInputTextarea />
        <PromptInputSubmit />
      </PromptInput>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledWith("   ");
  });

  it("keeps suggestions from submitting a surrounding form", () => {
    const onFormSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onSelect = vi.fn();
    render(
      <form onSubmit={onFormSubmit}>
        <Suggestion suggestion="Summarize" onSelect={onSelect} />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Summarize" }));
    expect(onSelect).toHaveBeenCalledWith("Summarize");
    expect(onFormSubmit).not.toHaveBeenCalled();
  });
});

describe("Reasoning", () => {
  it("stays closed when the user closes it while it keeps streaming", () => {
    const tree = (text: string) => (
      <Reasoning streaming>
        <ReasoningTrigger />
        <ReasoningContent>{text}</ReasoningContent>
      </Reasoning>
    );
    const { rerender } = render(tree("Thinking"));
    const trigger = screen.getByRole("button", { name: /Thinking/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    rerender(tree("Thinking about more steps"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Conversation", () => {
  it("can start without following so a restored position is kept", () => {
    render(
      <Conversation initialFollow={false}>
        <ConversationContent>
          <p>History</p>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>,
    );
    const log = screen.getByRole("log", { name: "Conversation" });
    const scrollTo = vi.fn();
    log.scrollTo = scrollTo;
    Object.defineProperties(log, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 400, configurable: true },
      scrollTop: { value: 100, writable: true, configurable: true },
    });
    act(() => {
      fireEvent.scroll(log);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Scroll to latest message" })).toBeTruthy();
  });
});

describe("data handling", () => {
  it("sorts a table without mutating the caller's rows", () => {
    const rows = [
      { name: "Nails", qty: 120 },
      { name: "Hammer", qty: 14 },
    ];
    const snapshot = structuredClone(rows);
    render(<DataTable columns={[{ key: "qty", header: "Qty", type: "number" }]} rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /Qty/ }));
    expect(rows).toEqual(snapshot);
  });

  it("keeps quoted line breaks inside a CSV cell", () => {
    expect(parseDelimited('note,qty\n"line one\nline two",3\n')).toEqual([
      ["note", "qty"],
      ["line one\nline two", "3"],
    ]);
  });
});
