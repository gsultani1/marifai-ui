// packages/ai-ui/test/components.test.tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CodeBlock,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  InlineCitation,
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageBody,
  MessageBubble,
  MessageContent,
  PromptInput,
  PromptInputAttachButton,
  PromptInputSubmit,
  PromptInputTextarea,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
  Suggestion,
  Suggestions,
  ToolCall,
  ToolCallContent,
  ToolCallInput,
  ToolCallResult,
  ToolCallTrigger,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("Message", () => {
  it("labels the message by role and exposes actions as a toolbar", () => {
    render(
      <Message from="user">
        <MessageAvatar name="Ada Lovelace" />
        <MessageBody>
          <MessageBubble>Hello</MessageBubble>
          <MessageActions>
            <MessageAction label="Copy">c</MessageAction>
            <MessageAction label="Edit" tooltip={false}>
              e
            </MessageAction>
          </MessageActions>
        </MessageBody>
      </Message>,
    );
    expect(screen.getByRole("article", { name: "User message" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ada Lovelace" }).textContent).toBe("AL");
    const toolbar = screen.getByRole("toolbar", { name: "Message actions" });
    expect(toolbar.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });
});

describe("MessageContent", () => {
  it("renders GFM markdown and routes fenced code to CodeBlock", () => {
    const markdown = "# Title\n\nSome **bold** text\n\n```py\nprint(1)\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |";
    const { container } = render(<MessageContent>{markdown}</MessageContent>);
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    const code = container.querySelector('[data-slot="code-block"]');
    expect(code?.getAttribute("data-language")).toBe("py");
    expect(code?.querySelector("pre")?.textContent).toBe("print(1)");
    expect(screen.getByRole("table")).toBeTruthy();
    const region = screen.getByRole("region", { name: "Table" });
    expect(region.tabIndex).toBe(0);
  });

  it("shows image placeholders unless images are allowed", () => {
    const markdown = "![Revenue chart](https://tracker.example.com/pixel.png?q=secret)";
    const { container, rerender } = render(<MessageContent>{markdown}</MessageContent>);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("[Image: Revenue chart]")).toBeTruthy();
    rerender(<MessageContent allowImages>{markdown}</MessageContent>);
    const image = screen.getByRole("img", { name: "Revenue chart" });
    expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(image.getAttribute("loading")).toBe("lazy");
  });

  it("drops script URLs from links", () => {
    render(<MessageContent>{"[click](javascript:alert(1))"}</MessageContent>);
    expect(screen.getByText("click").closest("a")?.getAttribute("href")).toBe("");
  });

  it("repairs partial tokens only while streaming", () => {
    const { container, rerender } = render(<MessageContent streaming>{"Done.\n\nHello **wor"}</MessageContent>);
    expect(container.querySelector("strong")?.textContent).toBe("wor");
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    rerender(<MessageContent>{"Done.\n\nHello **wor"}</MessageContent>);
    expect(container.querySelector("strong")).toBeNull();
  });

  it("opens external links in a new tab", () => {
    render(<MessageContent>{"[site](https://example.com) and [anchor](#top)"}</MessageContent>);
    const external = screen.getByRole("link", { name: "site (opens in new tab)" });
    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: "anchor" }).getAttribute("target")).toBeNull();
  });
});

describe("CodeBlock", () => {
  it("highlights known languages with token classes", () => {
    const { container } = render(<CodeBlock code="const answer = 42;" language="ts" />);
    expect(container.querySelector(".text-code-keyword")?.textContent).toBe("const");
    expect(container.querySelector(".text-code-number")?.textContent).toBe("42");
    expect(screen.getByText("ts")).toBeTruthy();
  });

  it("renders unknown languages as plain text with optional line numbers", () => {
    const { container } = render(<CodeBlock code={"a\nb\nc"} language="not-a-language" showLineNumbers />);
    expect(container.querySelector("pre")?.textContent).toBe("a\nb\nc");
    const gutter = container.querySelector('[data-slot="code-block-line-numbers"]');
    expect(gutter?.getAttribute("aria-hidden")).toBe("true");
    expect(gutter?.textContent).toBe("123");
  });

  it("copies the code and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CodeBlock code="echo hi" language="bash" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copied")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith("echo hi");
  });

  it("reports a failed copy", async () => {
    const failure = new Error("denied");
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(failure) },
      configurable: true,
    });
    const onCopyError = vi.fn();
    render(<CodeBlock code="echo hi" onCopyError={onCopyError} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copy failed")).toBeTruthy();
    expect(onCopyError).toHaveBeenCalledWith(failure);
  });
});

describe("PromptInput", () => {
  function renderInput(props: Partial<Parameters<typeof PromptInput>[0]> = {}) {
    const onSubmit = vi.fn();
    render(
      <PromptInput onSubmit={onSubmit} {...props}>
        <PromptInputTextarea />
        <PromptInputAttachButton />
        <PromptInputSubmit />
      </PromptInput>,
    );
    return { onSubmit, textarea: screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" }) };
  }

  it("submits on Enter, keeps Shift+Enter and IME composition for editing, then clears", () => {
    const { onSubmit, textarea } = renderInput();
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("Hello");
    expect(textarea.value).toBe("");
  });

  it("disables sending when empty", () => {
    const { onSubmit, textarea } = renderInput();
    const send = screen.getByRole<HTMLButtonElement>("button", { name: "Send message" });
    expect(send.disabled).toBe(true);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a stop button while streaming and blocks submission", () => {
    const onStop = vi.fn();
    const { onSubmit, textarea } = renderInput({ status: "streaming", onStop, defaultValue: "Next" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("keeps the text and says so when an async submit rejects", async () => {
    const failure = new Error("offline");
    const onSubmit = vi.fn().mockRejectedValue(failure);
    const onSubmitError = vi.fn();
    render(
      <PromptInput onSubmit={onSubmit} onSubmitError={onSubmitError} defaultValue="Keep me">
        <PromptInputTextarea />
      </PromptInput>,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter" });
    });
    expect(onSubmit).toHaveBeenCalledWith("Keep me");
    expect(textarea.value).toBe("Keep me");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Unable to send. Your draft has been kept.");
    expect(textarea.getAttribute("aria-describedby")).toBe(alert.id);
    expect(onSubmitError).toHaveBeenCalledWith(failure);
    fireEvent.change(textarea, { target: { value: "Keep me!" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores repeat submits while a submit is pending", async () => {
    let resolve: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    const { textarea } = renderInput({ onSubmit, defaultValue: "Once" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sending message" }).getAttribute("aria-disabled")).toBe("true");
    await act(async () => resolve());
    expect(textarea.value).toBe("");
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
  });

  it("keeps the text when onSubmit throws", () => {
    const { textarea } = renderInput({
      onSubmit: () => {
        throw new Error("invalid");
      },
      defaultValue: "Draft",
    });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("Draft");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("forwards pasted files to onAttach and disables attaching without it", () => {
    const onAttach = vi.fn();
    const { textarea } = renderInput({ onAttach });
    const file = new File(["data"], "notes.txt", { type: "text/plain" });
    fireEvent.paste(textarea, { clipboardData: { files: [file] } });
    expect(onAttach).toHaveBeenCalledWith([file]);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Attach files" }).disabled).toBe(false);
  });

  it("leaves controlled values to the caller", () => {
    const onSubmit = vi.fn();
    render(
      <PromptInput onSubmit={onSubmit} value="Controlled" onValueChange={() => undefined}>
        <PromptInputTextarea />
      </PromptInput>,
    );
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("Controlled");
    expect(textarea.value).toBe("Controlled");
  });
});

describe("ToolCall", () => {
  it("shows the status and reveals input and result when expanded", () => {
    const { container } = render(
      <ToolCall name="search_web" status="completed">
        <ToolCallTrigger />
        <ToolCallContent>
          <ToolCallInput input={{ query: "weather" }} />
          <ToolCallResult result={{ temperature: 72 }} />
        </ToolCallContent>
      </ToolCall>,
    );
    const trigger = screen.getByRole("button", { name: /search_web/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Completed")).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain('"query": "weather"');
    expect(container.textContent).toContain('"temperature": 72');
  });

  it("renders errors in place of the result", () => {
    render(
      <ToolCall name="fetch_page" status="error" defaultOpen>
        <ToolCallTrigger />
        <ToolCallContent>
          <ToolCallResult error="Timed out after 30s" />
        </ToolCallContent>
      </ToolCall>,
    );
    expect(screen.getAllByText("Error").length).toBeGreaterThan(0);
    expect(screen.getByText("Timed out after 30s")).toBeTruthy();
  });
});

describe("Reasoning", () => {
  it("opens while streaming, then reports the duration and closes", () => {
    vi.useFakeTimers();
    const tree = (streaming: boolean) => (
      <Reasoning streaming={streaming}>
        <ReasoningTrigger />
        <ReasoningContent>Step one</ReasoningContent>
      </Reasoning>
    );
    const { rerender } = render(tree(true));
    const trigger = screen.getByRole("button", { name: /Thinking/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(tree(false));
    expect(screen.getByRole("button", { name: /Thought for 3 seconds/ })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button", { name: /Thought for 3 seconds/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("does not auto-close after the user toggles it", () => {
    vi.useFakeTimers();
    const tree = (streaming: boolean) => (
      <Reasoning streaming={streaming}>
        <ReasoningTrigger />
        <ReasoningContent>Step one</ReasoningContent>
      </Reasoning>
    );
    const { rerender } = render(tree(true));
    const trigger = screen.getByRole("button", { name: /Thinking/ });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    rerender(tree(false));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Sources", () => {
  it("lists sources as safe external links", () => {
    render(
      <Sources defaultOpen>
        <SourcesTrigger count={2} />
        <SourcesContent>
          <Source href="https://www.example.com/a" title="Example A" index={1} />
          <Source href="https://docs.example.org/b" index={2} />
        </SourcesContent>
      </Sources>,
    );
    expect(screen.getByRole("button", { name: "Used 2 sources" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /Example A/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("example.com")).toBeTruthy();
    expect(screen.getAllByText("docs.example.org")).toHaveLength(2);
  });

  it("renders sources with unsafe URLs without a link", () => {
    render(
      <>
        <Source href="javascript:alert(1)" title="Injected" />
        <Source href="https://user:pass@example.com/" title="Credentials" />
        <InlineCitation index={3} source={{ url: "data:text/html,<p>x</p>", title: "Data" }} />
      </>,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByText("Link unavailable")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Source 3: Data (link unavailable)" })).toBeTruthy();
  });

  it("renders inline citations with an accessible name", () => {
    render(
      <p>
        Claim
        <InlineCitation index={1} source={{ url: "https://example.com/report", title: "Annual report" }} />
      </p>,
    );
    const link = screen.getByRole("link", { name: "Source 1: Annual report (opens in new tab)" });
    expect(link.getAttribute("href")).toBe("https://example.com/report");
    expect(link.textContent).toBe("1");
  });
});

describe("Suggestion", () => {
  it("passes the suggestion to onSelect", () => {
    const onSelect = vi.fn();
    render(
      <Suggestions>
        <Suggestion suggestion="Plan a trip" onSelect={onSelect} />
        <Suggestion suggestion="Summarize this" description="Paste a document" onSelect={onSelect} />
      </Suggestions>,
    );
    expect(screen.getByRole("group", { name: "Suggestions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Plan a trip" }));
    fireEvent.click(screen.getByRole("button", { name: /Summarize this/ }));
    expect(onSelect.mock.calls).toEqual([["Plan a trip"], ["Summarize this"]]);
  });
});

describe("Conversation", () => {
  it("offers a scroll button once the user leaves the bottom and follows again on click", () => {
    render(
      <Conversation>
        <ConversationContent>
          <p>First</p>
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
      scrollTop: { value: 600, writable: true, configurable: true },
    });

    fireEvent.scroll(log);
    expect(screen.queryByRole("button", { name: "Scroll to latest message" })).toBeNull();

    log.scrollTop = 200;
    fireEvent.scroll(log);
    fireEvent.click(screen.getByRole("button", { name: "Scroll to latest message" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
    expect(screen.queryByRole("button", { name: "Scroll to latest message" })).toBeNull();
  });
});
