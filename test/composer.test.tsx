// packages/ai-ui/test/composer.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CameraCapture,
  captureScreen,
  ComposerOptions,
  type ComposerTool,
  ContextChips,
  FileDropzone,
  filesFromDataTransfer,
  fillTemplate,
  filterFiles,
  findMention,
  isProbablyBinary,
  type MentionItem,
  PromptInput,
  PromptInputCounter,
  PromptInputEnhance,
  PromptInputMentions,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputVoice,
  ReadAloud,
  speechText,
  Suggestion,
  SuggestionRail,
  TemplateGallery,
  templateVariables,
  UrlContextButton,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const FILES: MentionItem[] = [
  { id: "a", label: "apps/web.ts", group: "Files" },
  { id: "b", label: "apps/api.ts", group: "Files" },
  { id: "c", label: "Ana Ruiz", group: "People" },
];

function typeInto(textarea: HTMLTextAreaElement, value: string) {
  fireEvent.input(textarea, { target: { value } });
  textarea.setSelectionRange(value.length, value.length);
  fireEvent.keyUp(textarea, { key: value.at(-1) ?? "" });
}

describe("mentions", () => {
  it("finds triggers at the start of a word before the caret", () => {
    expect(findMention("ask @ap", 7, ["@"])).toEqual({ trigger: "@", query: "ap", start: 4, end: 7 });
    expect(findMention("/fix", 4, ["@", "/"])).toEqual({ trigger: "/", query: "fix", start: 0, end: 4 });
    expect(findMention("mail@ap", 7, ["@"])).toBeNull();
    expect(findMention("@ap more", 8, ["@"])).toBeNull();
    expect(findMention("see @web.ts:10-20", 17, ["@"])?.query).toBe("web.ts:10-20");
  });

  it("filters, navigates with wrapping and inserts the choice while focus stays in the textarea", () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn();
    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea />
        <PromptInputMentions sources={{ "@": (query) => FILES.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), "/": () => [{ id: "fix", label: "fix", description: "Fix the selection" }] }} onSelect={onSelect} />
      </PromptInput>,
    );
    const textarea = screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
    textarea.focus();
    typeInto(textarea, "Look at @ap");
    const listbox = screen.getByRole("listbox", { name: "Mentions" });
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual(["apps/web.ts", "apps/api.ts"]);
    expect(within(listbox).getByRole("group", { name: "Files" })).toBeTruthy();
    expect(textarea.getAttribute("aria-activedescendant")).toBe(within(listbox).getAllByRole("option")[0]!.id);
    fireEvent.keyDown(textarea, { key: "ArrowUp" });
    expect(within(listbox).getAllByRole("option")[1]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("Look at @apps/api.ts ");
    expect(onSelect).toHaveBeenCalledWith(FILES[1], "@");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
    typeInto(textarea, "Look at @apps/api.ts /");
    expect(screen.getByRole("listbox", { name: "Commands" })).toBeTruthy();
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("drops stale async results", async () => {
    let resolveFirst: (items: MentionItem[]) => void = () => undefined;
    const source = vi.fn((query: string) => (query === "a" ? new Promise<MentionItem[]>((resolve) => (resolveFirst = resolve)) : Promise.resolve([{ id: "x", label: "apps" }])));
    render(
      <PromptInput onSubmit={vi.fn()}>
        <PromptInputTextarea />
        <PromptInputMentions sources={{ "@": source }} />
      </PromptInput>,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    typeInto(textarea, "@a");
    typeInto(textarea, "@ap");
    await screen.findByRole("option", { name: "apps" });
    await act(async () => resolveFirst([{ id: "y", label: "stale" }]));
    expect(screen.queryByRole("option", { name: "stale" })).toBeNull();
  });
});

describe("ContextChips", () => {
  it("removes chips and moves focus to the next one", async () => {
    function Demo() {
      const [items, setItems] = useState([
        { id: "1", label: "web.ts", detail: "L10–24" },
        { id: "2", label: "docs.example.com", kind: "url" as const },
      ]);
      return <ContextChips items={items} onRemove={(id) => setItems(items.filter((item) => item.id !== id))} />;
    }
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: "Remove web.ts L10–24" }));
    await vi.waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove docs.example.com"));
    render(<ContextChips label="Sent context" items={[{ id: "1", label: "frozen.ts" }]} />);
    expect(within(screen.getByRole("list", { name: "Sent context" })).queryByRole("button")).toBeNull();
  });
});

describe("PromptInput drafts, limits and Enter", () => {
  it("restores a draft per key and clears it after sending", () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const view = render(
      <PromptInput onSubmit={onSubmit} draftKey="draft:chat-1">
        <PromptInputTextarea />
      </PromptInput>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Half-written question" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(window.localStorage.getItem("draft:chat-1")).toBe("Half-written question");
    view.unmount();
    render(
      <PromptInput onSubmit={onSubmit} draftKey="draft:chat-1">
        <PromptInputTextarea />
      </PromptInput>,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Half-written question");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("Half-written question");
    expect(textarea.value).toBe("");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(window.localStorage.getItem("draft:chat-1")).toBeNull();
  });

  it("blocks sending past maxLength and follows the Enter rule", () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <PromptInput onSubmit={onSubmit} maxLength={5} submitOnEnter="never">
        <PromptInputTextarea />
        <PromptInputCounter />
        <PromptInputSubmit />
      </PromptInput>,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "too long" } });
    expect(screen.getByRole("button", { name: "Send message" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/3 over the limit/)).toBeTruthy();
    fireEvent.change(textarea, { target: { value: "ok" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith("ok");
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("pointer: coarse"), addEventListener: () => undefined, removeEventListener: () => undefined }));
    rerender(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea />
      </PromptInput>,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "on a phone" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("speech", () => {
  it("dictates into PromptInput and explains a blocked microphone", () => {
    const instances: Array<{ onresult: ((event: unknown) => void) | null; onerror: ((event: { error: string }) => void) | null; onstart: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }> = [];
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      constructor() {
        instances.push(this);
      }
      start() {
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    render(
      <PromptInput onSubmit={vi.fn()} defaultValue="Order">
        <PromptInputTextarea />
        <PromptInputVoice />
      </PromptInput>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start dictation" }));
    expect(screen.getByRole("button", { name: "Stop dictation" }).getAttribute("aria-pressed")).toBe("true");
    act(() => instances[0]!.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: " twelve hammers " } }] }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Order twelve hammers");
    act(() => instances[0]!.onerror?.({ error: "not-allowed" }));
    act(() => instances[0]!.onend?.());
    expect(screen.getByRole("alert").textContent).toMatch(/Microphone access is blocked/);
  });

  it("reads markdown aloud without code or link targets", () => {
    expect(speechText("# Title\n\nSee [docs](https://x.y) and `code`.\n\n```js\nlet a\n```\n- **bold** item")).toBe("Title See docs and code. (code block) bold item");
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel, pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    render(<ReadAloud text="**Hello** [there](https://example.com)" />);
    fireEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(speak.mock.calls[0]![0].text).toBe("Hello there");
    fireEvent.click(screen.getByRole("button", { name: "Pause reading" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop reading" }));
    expect(cancel).toHaveBeenCalled();
  });
});

const makeFile = (name: string, content: BlobPart = "text", path?: string) => {
  const file = new File([content], name, { type: "text/plain" });
  if (path) Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
};

describe("files", () => {
  it("filters ignored, binary, oversized and excess files with reasons", async () => {
    expect(await isProbablyBinary(makeFile("data.bin.txt", new Uint8Array([65, 0, 66])))).toBe(true);
    expect(await isProbablyBinary(makeFile("logo.png"))).toBe(true);
    expect(await isProbablyBinary(makeFile("index.ts", "export {}"))).toBe(false);
    const { accepted, rejected } = await filterFiles(
      [makeFile("index.ts", "a", "app/index.ts"), makeFile("x.js", "a", "app/node_modules/x.js"), makeFile("logo.png", "a", "app/logo.png"), makeFile("big.ts", "a".repeat(50), "app/big.ts"), makeFile("two.ts", "b", "app/two.ts"), makeFile("three.ts", "c", "app/three.ts")],
      { skipBinary: true, maxFileSize: 20, maxFiles: 2 },
    );
    expect(accepted.map((file) => file.name)).toEqual(["index.ts", "two.ts"]);
    expect(rejected).toEqual([
      { name: "app/logo.png", reason: "Binary files are skipped." },
      { name: "app/big.ts", reason: "The file is too large." },
      { name: "app/three.ts", reason: "Only 2 files can be added at once." },
    ]);
  });

  it("walks dropped folders, reading entries in batches", async () => {
    const fileEntry = (name: string, fullPath: string) => ({ isFile: true, isDirectory: false, name, fullPath, file: (done: (file: File) => void) => done(makeFile(name)) });
    const batches = [[fileEntry("a.ts", "/src/a.ts")], [fileEntry("b.ts", "/src/b.ts")], []];
    const folder = { isFile: false, isDirectory: true, name: "src", fullPath: "/src", createReader: () => ({ readEntries: (done: (entries: unknown[]) => void) => done(batches.shift() ?? []) }) };
    const transfer = { files: [] as File[], items: [{ kind: "file", webkitGetAsEntry: () => folder, getAsFile: () => null }] } as unknown as DataTransfer;
    const files = await filesFromDataTransfer(transfer);
    expect(files.map((file) => (file as File & { webkitRelativePath: string }).webkitRelativePath)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("passes picked files through the filters", async () => {
    const onFiles = vi.fn();
    const { container } = render(<FileDropzone onFiles={onFiles} accept=".csv" allowFolders />);
    expect(screen.getByText("Add folder")).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["a,b"], "prices.csv", { type: "text/csv" }), makeFile("notes.txt")] } });
    await vi.waitFor(() => expect(onFiles).toHaveBeenCalled());
    expect(onFiles.mock.calls[0]![0].map((file: File) => file.name)).toEqual(["prices.csv"]);
    expect(onFiles.mock.calls[0]![1]).toEqual([{ name: "notes.txt", reason: "This file type isn't accepted." }]);
  });
});

describe("capture", () => {
  it("treats a cancelled screen picker as no screenshot", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getDisplayMedia: () => Promise.reject(new DOMException("cancelled", "NotAllowedError")) } });
    await expect(captureScreen()).resolves.toBeNull();
  });

  it("explains camera errors in the capture dialog", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia: () => Promise.reject(new DOMException("busy", "NotReadableError")) } });
    render(<CameraCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Take photo" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The camera is in use by another app. Close it and try again.");
  });
});

describe("composer tools", () => {
  it("improves the prompt with undo until the user edits", async () => {
    render(
      <PromptInput onSubmit={vi.fn()} defaultValue="fix bug">
        <PromptInputTextarea />
        <PromptInputEnhance onEnhance={async (text) => `Find and fix the bug described here: ${text}`} />
      </PromptInput>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Improve prompt" }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await vi.waitFor(() => expect(textarea.value).toBe("Find and fix the bug described here: fix bug"));
    fireEvent.click(screen.getByRole("button", { name: "Undo prompt improvement" }));
    expect(textarea.value).toBe("fix bug");
    fireEvent.click(screen.getByRole("button", { name: "Improve prompt" }));
    await screen.findByRole("button", { name: "Undo prompt improvement" });
    fireEvent.change(textarea, { target: { value: "edited" } });
    expect(screen.getByRole("button", { name: "Improve prompt" })).toBeTruthy();
  });

  it("validates links and reports failures in place", async () => {
    const onAdd = vi.fn(async (url: string) => {
      if (url.includes("broken")) throw new Error("The page didn't respond.");
    });
    render(<UrlContextButton onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
    const field = await screen.findByLabelText("Add a link", { selector: "input" });
    fireEvent.change(field, { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Enter a web address/);
    fireEvent.change(field, { target: { value: "broken.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The page didn't respond.");
    fireEvent.change(field, { target: { value: "docs.example.com/guide" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await vi.waitFor(() => expect(onAdd).toHaveBeenLastCalledWith("https://docs.example.com/guide"));
  });

  it("does not submit an enclosing composer when a link is added", async () => {
    const onSubmit = vi.fn();
    render(
      <PromptInput onSubmit={onSubmit} defaultValue="draft">
        <PromptInputTextarea />
        <UrlContextButton onAdd={vi.fn()} />
      </PromptInput>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
    fireEvent.change(await screen.findByLabelText("Add a link", { selector: "input" }), { target: { value: "example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await vi.waitFor(() => expect(screen.queryByLabelText("Add a link", { selector: "input" })).toBeNull());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fills template variables before use", async () => {
    expect(templateVariables("Write to {{customer}} about {{ order id }} for {{customer}}")).toEqual(["customer", "order id"]);
    expect(fillTemplate("Hi {{name}}, re {{topic}}", { name: "Ana" })).toBe("Hi Ana, re {{topic}}");
    const onUse = vi.fn();
    render(
      <TemplateGallery
        onUse={onUse}
        templates={[
          { id: "reply", title: "Customer reply", prompt: "Reply to {{customer}} about {{issue}}.", category: "Support" },
          { id: "summary", title: "Summarize sales", prompt: "Summarize this week's sales.", category: "Reports" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Summarize sales/ }));
    expect(onUse).toHaveBeenLastCalledWith("Summarize this week's sales.", expect.objectContaining({ id: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: /Customer reply/ }));
    const dialog = await screen.findByRole("dialog", { name: "Customer reply" });
    expect(within(dialog).getByRole("button", { name: "Use prompt" })).toHaveProperty("disabled", true);
    fireEvent.change(within(dialog).getByLabelText("Customer"), { target: { value: "Ana" } });
    fireEvent.change(within(dialog).getByLabelText("Issue"), { target: { value: "a late delivery" } });
    expect(within(dialog).getByText("Reply to Ana about a late delivery.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Use prompt" }));
    expect(onUse).toHaveBeenLastCalledWith("Reply to Ana about a late delivery.", expect.objectContaining({ id: "reply" }));
  });

  it("changes effort, reasoning and tools from one popover", async () => {
    function Demo() {
      const [effort, setEffort] = useState("medium");
      const [reasoning, setReasoning] = useState(false);
      const [tools, setTools] = useState<ComposerTool[]>([
        { id: "web", label: "Web search", enabled: true },
        { id: "code", label: "Run code", enabled: false },
      ]);
      return <ComposerOptions effort={effort} onEffortChange={setEffort} reasoning={reasoning} onReasoningChange={setReasoning} tools={tools} onToolsChange={setTools} />;
    }
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: "Options: Medium · 1 tool" }));
    const popup = await screen.findByRole("dialog", { name: "Options" });
    fireEvent.click(within(popup).getByRole("radio", { name: "High" }));
    fireEvent.click(within(popup).getByRole("switch"));
    fireEvent.click(within(popup).getByRole("checkbox", { name: "Run code" }));
    expect(screen.getByRole("button", { name: "Options: High · Reasoning · 2 tools" })).toBeTruthy();
  });

  it("moves between rail suggestions with arrow keys", () => {
    render(
      <SuggestionRail source="Based on your recent orders">
        <Suggestion suggestion="Reorder paint" />
        <Suggestion suggestion="Check low stock" />
      </SuggestionRail>,
    );
    screen.getByRole("button", { name: "Reorder paint" }).focus();
    fireEvent.keyDown(screen.getByRole("group", { name: "Suggestions" }), { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toBe("Check low stock");
    expect(screen.getByText("Based on your recent orders")).toBeTruthy();
  });
});
