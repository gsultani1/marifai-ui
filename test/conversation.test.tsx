// packages/ai-ui/test/conversation.test.tsx
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AssistantPanel,
  type ChatHistoryItem,
  ChatHistory,
  ConversationTransfer,
  DateSeparator,
  DeliveryStatus,
  EarlierMessages,
  EmojiPicker,
  EmojiPickerPanel,
  exportConversation,
  FeedbackDialog,
  findEmoji,
  formatDayLabel,
  formatTypingNames,
  groupByRecency,
  groupMessages,
  MessageEditor,
  MessageReactions,
  messagesToMarkdown,
  Outbox,
  parseConversationImport,
  safeFileName,
  searchEmoji,
  stripSkinTone,
  ThreadReplies,
  toggleReaction,
  type Transcript,
  TypingIndicator,
  UnreadJump,
  useMessageWindow,
  useTypingIndicator,
  useTypingUsers,
  withSkinTone,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

const NOW = new Date(2026, 9, 24, 15, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;

const TRANSCRIPT: Transcript = {
  title: "Q3 / planning",
  messages: [
    { role: "user", content: "Summarize the Q3 numbers.", createdAt: NOW - 60_000 },
    { role: "assistant", content: "Revenue rose 12%.", author: "Marifai", attachments: [{ name: "q3.csv", url: "https://example.com/q3.csv" }] },
  ],
};

describe("conversation utilities", () => {
  it("buckets items by recency and keeps their order", () => {
    const groups = groupByRecency(
      [
        { id: "a", updatedAt: NOW - 1000 },
        { id: "b", updatedAt: NOW - DAY },
        { id: "c", updatedAt: NOW - 3 * DAY },
        { id: "d", updatedAt: NOW - 20 * DAY },
        { id: "e", updatedAt: new Date(2025, 0, 5) },
      ],
      NOW,
      "en-US",
    );
    expect(groups.map((group) => group.label)).toEqual(["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "January 2025"]);
  });

  it("labels days relative to now", () => {
    expect(formatDayLabel(NOW - 1000, NOW, "en-US")).toBe("Today");
    expect(formatDayLabel(NOW - DAY, NOW, "en-US")).toBe("Yesterday");
    expect(formatDayLabel(NOW - 3 * DAY, NOW, "en-US")).toBe("Wednesday");
    expect(formatDayLabel(new Date(2025, 0, 5), NOW, "en-US")).toBe("Sunday, January 5, 2025");
  });

  it("groups messages by sender, pause and day", () => {
    const groups = groupMessages(
      [
        { id: "1", sender: "ana", createdAt: NOW - DAY },
        { id: "2", sender: "ana", createdAt: NOW - 10 * 60_000 },
        { id: "3", sender: "ana", createdAt: NOW - 8 * 60_000 },
        { id: "4", sender: "ben", createdAt: NOW - 7 * 60_000 },
        { id: "5", sender: "ben", createdAt: NOW },
      ],
      { now: NOW, locale: "en-US" },
    );
    expect(groups.map((group) => [group.sender, group.messages.map((message) => message.id).join(""), group.day ?? ""])).toEqual([
      ["ana", "1", "Yesterday"],
      ["ana", "23", "Today"],
      ["ben", "4", ""],
      ["ben", "5", ""],
    ]);
  });

  it("writes a Markdown transcript", () => {
    const markdown = messagesToMarkdown(TRANSCRIPT, "en-US");
    expect(markdown.startsWith("# Q3 / planning\n\n## You · ")).toBe(true);
    expect(markdown).toContain("## Assistant (Marifai)\n\nRevenue rose 12%.\n\n- [q3.csv](https://example.com/q3.csv)");
  });

  it("round-trips the JSON export", () => {
    const result = parseConversationImport(exportConversation(TRANSCRIPT));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.title).toBe("Q3 / planning");
    expect(result.transcript.messages).toHaveLength(2);
    expect(result.transcript.messages[1]).toEqual({ role: "assistant", content: "Revenue rose 12%.", author: "Marifai" });
  });

  it("rejects files it should not import", () => {
    const error = (text: string, limits?: Parameters<typeof parseConversationImport>[1]) => {
      const result = parseConversationImport(text, limits);
      return result.ok ? "" : result.error;
    };
    expect(error("{oops")).toMatch(/isn't valid JSON/);
    expect(error(JSON.stringify({ format: "other", messages: [] }))).toMatch(/different app/);
    expect(error(JSON.stringify({ format: "marifai.conversation", version: 2, messages: [] }))).toMatch(/newer version/);
    expect(error(JSON.stringify({ title: "x" }))).toMatch(/no messages/);
    expect(error(JSON.stringify([{ role: "hacker", content: "x" }]))).toBe("Message 1 is not in a supported format.");
    expect(error(JSON.stringify([{ role: "user", content: { html: "<script>" } }]))).toBe("Message 1 is not in a supported format.");
    expect(error(JSON.stringify([{ role: "user", content: "a" }, { role: "user", content: "b" }]), { maxMessages: 1 })).toMatch(/more than 1 messages/);
    expect(error("x".repeat(2048), { maxBytes: 1024 })).toMatch(/larger than/);
  });

  it("accepts a bare message array and shortens long messages with a warning", () => {
    const result = parseConversationImport(JSON.stringify([{ role: "user", content: "abcdef" }]), { maxMessageLength: 3 });
    expect(result.ok && result.transcript.title).toBe("Imported conversation");
    expect(result.ok && result.transcript.messages[0]!.content).toBe("abc");
    expect(result.ok && result.warnings).toEqual(["Message 1 was shortened to 3 characters."]);
  });

  it("makes safe file names", () => {
    expect(safeFileName('Q3: "final" / v2?')).toBe("Q3- -final- - v2-");
    expect(safeFileName("  ", "conversation")).toBe("conversation");
  });
});

describe("emoji and reactions", () => {
  it("searches names and keywords", () => {
    expect(searchEmoji("thumbs up").map((emoji) => emoji.char)).toEqual(["👍"]);
    expect(searchEmoji("celebrate").map((emoji) => emoji.char)).toContain("🎉");
    expect(searchEmoji("")).toEqual([]);
  });

  it("applies and strips skin tones", () => {
    const thumbs = findEmoji("👍")!;
    expect(withSkinTone(thumbs, 3)).toBe("👍🏽");
    expect(withSkinTone(findEmoji("✌️")!, 5)).toBe("✌🏿");
    expect(withSkinTone(findEmoji("🚀")!, 3)).toBe("🚀");
    expect(stripSkinTone("👍🏽")).toBe("👍");
    expect(findEmoji("✌🏿")?.name).toBe("victory hand");
  });

  it("toggles reactions and drops empty ones", () => {
    const start = [{ emoji: "👍", count: 1, reacted: false, users: ["Ben"] }];
    const added = toggleReaction(start, "👍", "Ana");
    expect(added).toEqual([{ emoji: "👍", count: 2, reacted: true, users: ["Ben", "Ana"] }]);
    expect(toggleReaction(toggleReaction([], "🎉", "Ana"), "🎉", "Ana")).toEqual([]);
  });

  it("renders reaction chips with pressed state and names", () => {
    const onToggle = vi.fn();
    render(<MessageReactions reactions={[{ emoji: "👍", count: 3, reacted: true, users: ["Ana", "Ben", "Cy"] }, { emoji: "🎉", count: 1 }]} onToggle={onToggle} storageKey={false} />);
    const thumbs = screen.getByRole("button", { name: "thumbs up, 3 reactions, including you: Ana, Ben, Cy" });
    expect(thumbs.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^party popper, 1 reaction$/ }));
    expect(onToggle).toHaveBeenCalledWith("🎉");
    expect(screen.getByRole("button", { name: "Add reaction" })).toBeTruthy();
  });

  it("picks from search, remembers recent emoji and applies the skin tone", async () => {
    const onSelect = vi.fn();
    render(<EmojiPickerPanel onSelect={onSelect} />);
    fireEvent.change(screen.getByLabelText("Search emoji"), { target: { value: "rocket" } });
    fireEvent.click(screen.getByRole("button", { name: "rocket" }));
    expect(onSelect).toHaveBeenLastCalledWith("🚀");
    expect(JSON.parse(window.localStorage.getItem("ai-ui-emoji:recent")!)).toEqual(["🚀"]);
    fireEvent.change(screen.getByLabelText("Search emoji"), { target: { value: "" } });
    expect(await screen.findByRole("heading", { name: "Recently used" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    fireEvent.change(screen.getByLabelText("Search emoji"), { target: { value: "thumbs up" } });
    fireEvent.keyDown(screen.getByLabelText("Search emoji"), { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith("👍🏽");
    expect(window.localStorage.getItem("ai-ui-emoji:tone")).toBe("3");
  });

  it("moves through the grid with arrow keys using one tab stop", () => {
    render(<EmojiPickerPanel onSelect={() => undefined} storageKey={false} />);
    const first = screen.getByRole("button", { name: "grinning face" });
    expect(first.tabIndex).toBe(0);
    expect(screen.getByRole("button", { name: "grinning face with big eyes" }).tabIndex).toBe(-1);
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "grinning face with big eyes" }));
    expect(screen.getByRole("button", { name: "grinning face with big eyes" }).tabIndex).toBe(0);
  });

  it("opens in a popover and closes after a choice", async () => {
    const onSelect = vi.fn();
    render(<EmojiPicker onSelect={onSelect} storageKey={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Add emoji" }));
    fireEvent.click(await screen.findByRole("button", { name: "red heart" }));
    expect(onSelect).toHaveBeenCalledWith("❤️");
    await waitFor(() => expect(screen.queryByLabelText("Search emoji")).toBeNull());
  });
});

const CHATS: ChatHistoryItem[] = [
  { id: "1", title: "Pricing sheet", updatedAt: NOW - 1000, pinned: true },
  { id: "2", title: "Store hours", updatedAt: NOW - 2000, preview: "Holiday schedule", unread: true },
  { id: "3", title: "Supplier email", updatedAt: NOW - DAY },
  { id: "4", title: "Old audit", updatedAt: NOW - 2 * DAY, archived: true },
];

describe("ChatHistory", () => {
  it("shows pinned chats first, then recency groups, and filters locally", () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    render(<ChatHistory conversations={CHATS} onSelect={() => undefined} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Pinned", "Today", "Yesterday"]);
    expect(screen.getByRole("button", { name: /Unread: Store hours/ })).toBeTruthy();
    expect(screen.queryByText("Old audit")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search chats" }), { target: { value: "holiday" } });
    expect(screen.getByText("Store hours")).toBeTruthy();
    expect(screen.queryByText("Pricing sheet")).toBeNull();
  });

  it("switches to archived chats", () => {
    render(<ChatHistory conversations={CHATS} onSelect={() => undefined} />);
    fireEvent.click(screen.getByRole("radio", { name: "Archived" }));
    expect(screen.getByText("Old audit")).toBeTruthy();
    expect(screen.queryByText("Pricing sheet")).toBeNull();
  });

  it("navigates with arrows, renames with F2 and deletes after confirmation", async () => {
    const onSelect = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(<ChatHistory conversations={CHATS} onSelect={onSelect} onRename={onRename} onDelete={onDelete} />);
    const first = screen.getByRole("button", { name: /^Pricing sheet/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const second = screen.getByRole("button", { name: /^Unread: Store hours/ });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Supplier email/ }));

    fireEvent.keyDown(document.activeElement!, { key: "F2" });
    const field = screen.getByRole("textbox", { name: "Rename Supplier email" });
    fireEvent.change(field, { target: { value: "Orgill email" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("3", "Orgill email");

    const pricing = screen.getByRole("button", { name: /^Pricing sheet/ });
    pricing.focus();
    fireEvent.keyDown(pricing, { key: "Delete" });
    const dialog = await screen.findByRole("alertdialog", { name: 'Delete "Pricing sheet"?' });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(["1"]));
    fireEvent.click(screen.getByRole("button", { name: /^Unread: Store hours/ }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("archives several chats from select mode", () => {
    const onArchive = vi.fn();
    render(<ChatHistory conversations={CHATS} onSelect={() => undefined} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Pricing sheet" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Supplier email" }));
    const toolbar = screen.getByRole("toolbar", { name: "Selected chats" });
    expect(within(toolbar).getByText("2 selected")).toBeTruthy();
    fireEvent.click(within(toolbar).getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledWith(["1", "3"], true);
  });

  it("asks for more when there is more history", () => {
    const onLoadMore = vi.fn();
    render(<ChatHistory conversations={CHATS} onSelect={() => undefined} hasMore onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});

describe("ConversationTransfer", () => {
  it("copies the transcript as Markdown", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ConversationTransfer transcript={TRANSCRIPT} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy as Markdown" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# Q3 / planning")));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("previews a valid import before adding it", async () => {
    const onImport = vi.fn();
    const { container } = render(<ConversationTransfer onImport={onImport} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([exportConversation(TRANSCRIPT)], "q3.json", { type: "application/json" })] } });
    expect(await screen.findByText("Q3 / planning")).toBeTruthy();
    expect(screen.getByText(/2 messages from q3.json/)).toBeTruthy();
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ title: "Q3 / planning" }));
    expect(screen.getByText('Imported "Q3 / planning".').getAttribute("role")).toBe("status");
  });

  it("explains why a file can't be imported", async () => {
    const { container } = render(<ConversationTransfer onImport={() => undefined} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["not json"], "chat.json", { type: "application/json" })] } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/isn't valid JSON/);
  });
});

function WindowHarness({ total }: { total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const messages = Array.from({ length: total }, (_, index) => `m${index + 1}`);
  const { visible, hiddenCount, showEarlier } = useMessageWindow(messages, { initial: 50, step: 30, scrollRef: ref });
  return (
    <div ref={ref}>
      <EarlierMessages hiddenCount={hiddenCount} step={30} onShow={showEarlier} />
      <p data-testid="range">{`${visible[0]}-${visible[visible.length - 1]} (${visible.length})`}</p>
    </div>
  );
}

describe("message window", () => {
  it("shows the newest messages and reveals earlier ones in steps", () => {
    render(<WindowHarness total={120} />);
    expect(screen.getByTestId("range").textContent).toBe("m71-m120 (50)");
    fireEvent.click(screen.getByRole("button", { name: "Show 30 of 70 earlier messages" }));
    expect(screen.getByTestId("range").textContent).toBe("m41-m120 (80)");
    fireEvent.click(screen.getByRole("button", { name: "Show 30 of 40 earlier messages" }));
    fireEvent.click(screen.getByRole("button", { name: "Show 10 earlier messages" }));
    expect(screen.getByTestId("range").textContent).toBe("m1-m120 (120)");
    expect(screen.queryByRole("button", { name: /earlier/ })).toBeNull();
  });
});

describe("FeedbackDialog", () => {
  it("collects reasons, details and a correction", async () => {
    const onSubmit = vi.fn();
    const onOuterSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const onOpenChange = vi.fn();
    render(
      <form onSubmit={onOuterSubmit}>
        <FeedbackDialog open rating="down" onOpenChange={onOpenChange} onSubmit={onSubmit} shareLabel="Share this conversation to help improve answers" />
      </form>,
    );
    const dialog = await screen.findByRole("dialog", { name: "What went wrong?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Too long" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Wrong or broken code" }));
    fireEvent.change(within(dialog).getByLabelText(/Details/), { target: { value: " Missed the edge case. " } });
    fireEvent.change(within(dialog).getByLabelText(/What should the answer have said/), { target: { value: "Handle empty input." } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Share this conversation/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ rating: "down", categories: ["Too long", "Wrong or broken code"], comment: "Missed the edge case.", correction: "Handle empty input.", shareConversation: true }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with an error when sending fails", async () => {
    const onOpenChange = vi.fn();
    render(<FeedbackDialog open rating="up" onOpenChange={onOpenChange} onSubmit={() => Promise.reject(new Error("offline"))} />);
    const dialog = await screen.findByRole("dialog", { name: "What did you like?" });
    expect(within(dialog).queryByLabelText(/What should the answer have said/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Send feedback" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Couldn't send your feedback. Try again.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("delivery and outbox", () => {
  it("labels delivery states and offers retry on failure", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<DeliveryStatus state="delivered" />);
    expect(screen.getByText("Delivered")).toBeTruthy();
    rerender(<DeliveryStatus state="failed" detail="Network error" onRetry={onRetry} />);
    expect(screen.getByText("Not sent, Network error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<DeliveryStatus state="read" compact stale />);
    expect(screen.getByText("Read, may be out of date").className).toContain("sr-only");
  });

  it("lists failures first and lets queued messages be edited or cancelled", async () => {
    const onEdit = vi.fn();
    const onCancel = vi.fn();
    const onRetry = vi.fn();
    render(
      <Outbox
        items={[
          { id: "q", text: "Order 40 bags of mulch", state: "queued" },
          { id: "d", text: "Thanks!", state: "delivered" },
          { id: "f", text: "Send the invoice", state: "failed", error: "Offline" },
        ]}
        onEdit={onEdit}
        onCancel={onCancel}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("1 queued · 1 needs attention")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.dataset.state)).toEqual(["failed", "queued", "delivered"]);
    fireEvent.click(within(items[0]!).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("f");
    fireEvent.click(within(items[0]!).getByRole("button", { name: "Discard" }));
    expect(onCancel).toHaveBeenCalledWith("f");
    expect(within(items[2]!).queryByRole("button")).toBeNull();

    fireEvent.click(within(items[1]!).getByRole("button", { name: "Edit" }));
    const field = screen.getByRole("textbox", { name: "Edit queued message" });
    fireEvent.change(field, { target: { value: "Order 60 bags of mulch" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith("q", "Order 60 bags of mulch"));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Edit queued message" })).toBeNull());
  });
});

describe("MessageEditor", () => {
  it("saves on Enter, keeps Shift+Enter for new lines and cancels on Escape", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<MessageEditor defaultValue="Draft one" onSave={onSave} onCancel={onCancel} />);
    const field = screen.getByRole("textbox", { name: "Edit message" });
    expect(document.activeElement).toBe(field);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: "Draft two " } });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Draft two"));
    fireEvent.keyDown(field, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows the error when saving fails", async () => {
    render(<MessageEditor defaultValue="a" onSave={() => Promise.reject(new Error("Message is locked."))} onCancel={() => undefined} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Message is locked.");
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("threads and markers", () => {
  it("expands a thread and sends replies with Enter", async () => {
    const onReply = vi.fn();
    render(
      <ThreadReplies count={3} unread={1} participants={[{ id: "a", name: "Ana" }, { id: "b", name: "Ben" }]} onReply={onReply}>
        <p>Looks right to me.</p>
      </ThreadReplies>,
    );
    const trigger = screen.getByRole("button", { name: /3 replies 1 new from Ana, Ben/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(await screen.findByText("Looks right to me.")).toBeTruthy();
    const field = screen.getByRole("textbox", { name: "Reply in thread" });
    fireEvent.change(field, { target: { value: "Shipping it." } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(onReply).toHaveBeenCalledWith("Shipping it."));
    await waitFor(() => expect((field as HTMLTextAreaElement).value).toBe(""));
  });

  it("jumps to and dismisses unread messages", () => {
    const onJump = vi.fn();
    const onDismiss = vi.fn();
    const { rerender, container } = render(<UnreadJump count={3} onJump={onJump} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "3 new messages" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(onJump).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
    rerender(<UnreadJump count={1} direction="up" onJump={onJump} />);
    expect(screen.getByRole("button", { name: "1 unread message" })).toBeTruthy();
    rerender(<UnreadJump count={0} onJump={onJump} />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("labels date separators", () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    render(<DateSeparator date={NOW - DAY} locale="en-US" />);
    expect(screen.getByRole("note").textContent).toBe("Yesterday");
  });
});

describe("typing", () => {
  it("formats who is typing", () => {
    expect(formatTypingNames([])).toBe("");
    expect(formatTypingNames(["Ana"])).toBe("Ana is typing");
    expect(formatTypingNames(["Ana", "Ben"])).toBe("Ana and Ben are typing");
    expect(formatTypingNames(["Ana", "Ben", "Cy"])).toBe("Ana, Ben and 1 other are typing");
    expect(formatTypingNames(["Ana", "Ben", "Cy", "Di"], 1)).toBe("Ana and 3 others are typing");
  });

  it("keeps the live region mounted while nobody is typing", () => {
    const { rerender } = render(<TypingIndicator names={[]} />);
    expect(screen.getByRole("status").textContent).toBe("");
    rerender(<TypingIndicator names={["Marifai"]} />);
    expect(screen.getByRole("status").textContent).toBe("Marifai is typing");
  });

  it("reports start, refresh and stop after a quiet period", () => {
    vi.useFakeTimers();
    const onTypingChange = vi.fn();
    const { result, unmount } = renderHook(() => useTypingIndicator({ onTypingChange, idleMs: 3000, refreshMs: 5000 }));
    act(() => result.current.notifyTyping());
    act(() => result.current.notifyTyping());
    expect(onTypingChange.mock.calls).toEqual([[true]]);
    for (let step = 0; step < 3; step++) {
      act(() => vi.advanceTimersByTime(2000));
      act(() => result.current.notifyTyping());
    }
    expect(onTypingChange.mock.calls).toEqual([[true], [true]]);
    act(() => vi.advanceTimersByTime(3000));
    expect(onTypingChange.mock.calls).toEqual([[true], [true], [false]]);
    act(() => result.current.notifyTyping());
    unmount();
    expect(onTypingChange.mock.calls.at(-1)).toEqual([false]);
  });

  it("expires remote typists without a fresh signal", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypingUsers(5000));
    act(() => result.current.setTyping("Ana", true));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.setTyping("Ben", true));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.setTyping("Ana", true));
    expect(result.current.names).toEqual(["Ana", "Ben"]);
    act(() => vi.advanceTimersByTime(4500));
    expect(result.current.names).toEqual(["Ana"]);
    act(() => result.current.setTyping("Ana", false));
    expect(result.current.names).toEqual([]);
  });
});

describe("AssistantPanel", () => {
  it("opens from the launcher and hotkey without blocking the page", async () => {
    const onClearContext = vi.fn();
    const onModeChange = vi.fn();
    render(
      <>
        <button type="button">Page action</button>
        <AssistantPanel contextLabel="Q3 forecast.xlsx" onClearContext={onClearContext} mode="ask" onModeChange={onModeChange}>
          <label>
            Ask anything
            <textarea />
          </label>
        </AssistantPanel>
      </>,
    );
    const launcher = screen.getByRole("button", { name: "Ask the assistant" });
    expect(launcher.getAttribute("aria-keyshortcuts")).toBe("Control+J");
    fireEvent.click(launcher);
    const panel = await screen.findByRole("dialog", { name: "Assistant" });
    await waitFor(() => expect(document.activeElement).toBe(within(panel).getByRole("textbox", { name: "Ask anything" })));
    expect(within(panel).getByText("Q3 forecast.xlsx")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Remove context" }));
    expect(onClearContext).toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("radio", { name: "Edit" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");

    fireEvent.click(screen.getByRole("button", { name: "Page action" }));
    expect(screen.getByRole("dialog", { name: "Assistant" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Assistant" })).toBeNull());
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Assistant" })).toBeTruthy();
  });
});
