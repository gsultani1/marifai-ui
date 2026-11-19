// packages/ai-ui/test/chat-tools.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ChatAttachmentReview,
  ChatAudiencePicker,
  ChatDraftSwitcher,
  ChatRedactionReview,
  ChatTurnQueue,
  CitationNavigator,
  ContextItemOrderEditor,
  ConversationBookmarks,
  ConversationForkTree,
  ConversationSummaryEditor,
  MessageDeliveryStatus,
  MessageFeedbackForm,
  MessageSearchPanel,
  ReplyQuote,
  SlashCommandPicker,
  type ChatReviewAttachment,
  type ConversationFork,
  type MessageSearchHit,
} from "../src/index.js";

const checkbox = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("ChatAttachmentReview", () => {
  const attachments: ChatReviewAttachment[] = [
    { id: "a", name: "Q3 inventory.csv", status: "ready", included: true, detail: "48 KB" },
    { id: "b", name: "Shelf photo.jpg", status: "uploading", included: false, detail: "40%" },
    { id: "c", name: "Supplier contract.pdf", status: "failed", included: false, detail: "File too large" },
  ];

  it("lists each attachment with its status in words and reports include changes and removals by id", () => {
    const onIncludeChange = vi.fn();
    const onRemove = vi.fn();
    render(<ChatAttachmentReview attachments={attachments} onIncludeChange={onIncludeChange} onRemove={onRemove} />);
    const items = within(screen.getByRole("region", { name: "Attachments" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByText("Ready · 48 KB")).toBeTruthy();
    expect(within(items[1]!).getByText("Uploading · 40%")).toBeTruthy();
    expect(within(items[2]!).getByText("Upload failed · File too large")).toBeTruthy();

    expect(checkbox("Include Q3 inventory.csv").checked).toBe(true);
    fireEvent.click(checkbox("Include Q3 inventory.csv"));
    expect(onIncludeChange).toHaveBeenCalledWith("a", false);
    fireEvent.click(button("Remove Supplier contract.pdf"));
    expect(onRemove).toHaveBeenCalledWith("c");
  });

  it("only lets ready attachments be included and blocks both actions while a row is pending", () => {
    const onIncludeChange = vi.fn();
    const onRemove = vi.fn();
    render(<ChatAttachmentReview attachments={attachments} pendingIds={["a"]} onIncludeChange={onIncludeChange} onRemove={onRemove} />);
    expect(checkbox("Include Shelf photo.jpg").disabled).toBe(true);
    expect(checkbox("Include Supplier contract.pdf").disabled).toBe(true);
    expect(checkbox("Include Q3 inventory.csv").disabled).toBe(true);
    fireEvent.click(button("Remove Q3 inventory.csv"));
    expect(onRemove).not.toHaveBeenCalled();
    expect(button("Remove Shelf photo.jpg").disabled).toBe(false);
  });

  it("shows inclusion in text when it is read-only and shows the empty state", () => {
    const { rerender } = render(<ChatAttachmentReview attachments={attachments.slice(0, 2)} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Ready · 48 KB · Included")).toBeTruthy();
    expect(screen.getByText("Uploading · 40% · Not included")).toBeTruthy();
    rerender(<ChatAttachmentReview attachments={[]} />);
    expect(screen.getByText("No attachments.")).toBeTruthy();
  });
});

describe("ChatAudiencePicker", () => {
  const audiences = [
    { id: "me", title: "Just me", visibility: "Only you can see this conversation." },
    { id: "store", title: "Store team", visibility: "Visible to the 12 people on the Main Street store team." },
    { id: "public", title: "Public link", visibility: "Anyone with the link can read it.", unavailableReason: "Turned off by your admin" },
  ];

  it("reports a chosen audience, ignores unavailable ones and names why they are unavailable", () => {
    const onChange = vi.fn();
    render(<ChatAudiencePicker audiences={audiences} value={null} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Audience" });
    expect(screen.getByText("No audience chosen yet.")).toBeTruthy();
    const unavailable = screen.getByRole("option", { name: "Public link · Turned off by your admin" }) as HTMLOptionElement;
    expect(unavailable.disabled).toBe(true);
    fireEvent.change(select, { target: { value: "store" } });
    expect(onChange).toHaveBeenCalledWith("store");
    onChange.mockClear();
    fireEvent.change(select, { target: { value: "public" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("announces the chosen audience's visibility and stops offering the prompt once one is chosen", () => {
    const { rerender } = render(<ChatAudiencePicker audiences={audiences} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Choose an audience" })).toBeTruthy();
    rerender(<ChatAudiencePicker audiences={audiences} value="store" onChange={vi.fn()} />);
    expect((screen.getByRole("combobox", { name: "Audience" }) as HTMLSelectElement).value).toBe("store");
    expect(screen.queryByRole("option", { name: "Choose an audience" })).toBeNull();
    const visibility = screen.getByText("Visible to the 12 people on the Main Street store team.");
    expect(visibility.getAttribute("aria-live")).toBe("polite");
  });
});

describe("ChatDraftSwitcher", () => {
  const drafts = [
    { id: "d1", title: "Restock email", preview: "Ask the supplier to move the deck stain delivery to Monday.", updatedAt: "2 min ago" },
    { id: "d2", title: "Return policy answer", preview: "Opened paint can be returned within 30 days with a receipt." },
  ];

  it("opens and discards drafts by id and searches titles and previews", () => {
    const onOpen = vi.fn();
    const onDiscard = vi.fn();
    render(<ChatDraftSwitcher drafts={drafts} onOpen={onOpen} onDiscard={onDiscard} />);
    expect(screen.getByText("2 min ago")).toBeTruthy();
    fireEvent.click(button("Open Return policy answer"));
    expect(onOpen).toHaveBeenCalledWith("d2");
    fireEvent.click(button("Discard Restock email"));
    expect(onDiscard).toHaveBeenCalledWith("d1");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search drafts" }), { target: { value: "deck stain" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Restock email")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search drafts" }), { target: { value: "lumber" } });
    expect(screen.getByText("No drafts match your search.")).toBeTruthy();
  });

  it("blocks opening and discarding a draft that is pending and hides Discard without a handler", () => {
    const onOpen = vi.fn();
    const onDiscard = vi.fn();
    const { rerender } = render(<ChatDraftSwitcher drafts={drafts} pendingIds={["d1"]} onOpen={onOpen} onDiscard={onDiscard} />);
    fireEvent.click(button("Open Restock email"));
    fireEvent.click(button("Discard Restock email"));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
    rerender(<ChatDraftSwitcher drafts={drafts} onOpen={onOpen} />);
    expect(screen.queryByRole("button", { name: /^Discard/ })).toBeNull();
  });

  it("says there are no saved drafts when the list is empty", () => {
    render(<ChatDraftSwitcher drafts={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No saved drafts.")).toBeTruthy();
  });
});

describe("ChatRedactionReview", () => {
  const suggestions = [
    { id: "phone", label: "Customer phone number", before: "Call Dana at 555-0142 when it arrives.", after: "Call Dana at [phone] when it arrives." },
    { id: "card", label: "Card number", before: "Paid with card 4111 1111 1111 1111.", after: "Paid with card [card]." },
  ];

  it("labels the original and redacted text and submits the accepted ids in suggestion order", async () => {
    const onSubmit = vi.fn();
    render(<ChatRedactionReview suggestions={suggestions} initialAcceptedIds={["card"]} onSubmit={onSubmit} />);
    // Browsers name each figure from its caption; jsdom does not, so check the captions directly.
    const [original, redacted] = within(screen.getAllByRole("listitem")[0]!).getAllByRole("figure");
    expect(original!.querySelector("figcaption")?.textContent).toBe("Original");
    expect(original!.textContent).toContain("555-0142");
    expect(redacted!.querySelector("figcaption")?.textContent).toBe("Redacted");
    expect(redacted!.textContent).toContain("[phone]");
    expect(checkbox("Accept Card number").checked).toBe(true);
    expect(checkbox("Accept Customer phone number").checked).toBe(false);

    fireEvent.click(checkbox("Accept Customer phone number"));
    await act(async () => { fireEvent.click(button("Apply redactions")); });
    expect(onSubmit).toHaveBeenCalledWith(["phone", "card"]);

    fireEvent.click(checkbox("Accept Card number"));
    await act(async () => { fireEvent.click(button("Apply redactions")); });
    expect(onSubmit).toHaveBeenLastCalledWith(["phone"]);
  });

  it("shows a failed submission as an alert and keeps the choices", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Redaction service is unavailable."));
    render(<ChatRedactionReview suggestions={suggestions} initialAcceptedIds={["phone"]} onSubmit={onSubmit} />);
    await act(async () => { fireEvent.click(button("Apply redactions")); });
    expect(screen.getByRole("alert").textContent).toBe("Redaction service is unavailable.");
    expect(checkbox("Accept Customer phone number").checked).toBe(true);
  });

  it("shows the empty state and cannot be submitted without suggestions", async () => {
    const onSubmit = vi.fn();
    render(<ChatRedactionReview suggestions={[]} onSubmit={onSubmit} />);
    expect(screen.getByText("No suggested redactions.")).toBeTruthy();
    expect(button("Apply redactions").disabled).toBe(true);
    await act(async () => { fireEvent.submit(screen.getByRole("form", { name: "Review redactions" })); });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("ChatTurnQueue", () => {
  const turns = [
    { id: "t1", text: "Check stock for 2x4 studs." },
    { id: "t2", text: "Draft a reply to the contractor." },
    { id: "t3", text: "Summarize today's returns." },
  ];

  it("lists queued turns in order with a count and names each action after its message", () => {
    const onEdit = vi.fn();
    const onMoveNext = vi.fn();
    const onRemove = vi.fn();
    render(<ChatTurnQueue turns={turns} onEdit={onEdit} onMoveNext={onMoveNext} onRemove={onRemove} />);
    const region = screen.getByRole("region", { name: "Queued messages" });
    expect(within(region).getByRole("status").textContent).toBe("3 queued");
    expect(within(region).getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent)).toEqual(turns.map((turn) => turn.text));

    expect(button("Move message 1 to front").disabled).toBe(true);
    fireEvent.click(button("Move message 3 to front"));
    expect(onMoveNext).toHaveBeenCalledWith("t3");
    fireEvent.click(button("Edit queued message 2"));
    expect(onEdit).toHaveBeenCalledWith("t2");
    fireEvent.click(button("Remove queued message 1"));
    expect(onRemove).toHaveBeenCalledWith("t1");

    const describedBy = button("Edit queued message 2").getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toBe("Draft a reply to the contractor.");
    expect(within(screen.getByRole("group", { name: "Message 2 actions" })).getAllByRole("button")).toHaveLength(3);
  });

  it("shows no actions without handlers and an empty message with a zero count", () => {
    const { rerender } = render(<ChatTurnQueue turns={turns} />);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ChatTurnQueue turns={[]} onRemove={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("0 queued");
    expect(screen.getByText("No messages waiting to send.")).toBeTruthy();
  });
});

describe("CitationNavigator", () => {
  const citations = [
    { id: "c1", title: "Store returns policy", excerpt: "Unopened items can be returned within 90 days." },
    { id: "c2", title: "Deck stain coverage chart", excerpt: "One gallon covers about 250 square feet." },
    { id: "c3", title: "Supplier delivery schedule" },
  ];

  it("starts at the first citation and keeps Previous and Open source off until one is chosen", () => {
    const onChange = vi.fn();
    const onOpen = vi.fn();
    render(<CitationNavigator citations={citations} activeId={null} onChange={onChange} onOpen={onOpen} />);
    expect(screen.getByText("3 citations")).toBeTruthy();
    expect(button("Previous citation").disabled).toBe(true);
    expect(button("Open source").disabled).toBe(true);
    fireEvent.click(button("Next citation"));
    expect(onChange).toHaveBeenCalledWith("c1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("moves between citations, announces the position and opens the selected source", () => {
    const onChange = vi.fn();
    const onOpen = vi.fn();
    const { rerender } = render(<CitationNavigator citations={citations} activeId="c2" onChange={onChange} onOpen={onOpen} />);
    const position = screen.getByText(/^Citation 2 of 3/);
    expect(position.textContent).toBe("Citation 2 of 3: Deck stain coverage chart");
    expect(position.closest("[aria-live='polite']")).toBeTruthy();
    expect(screen.getByText("One gallon covers about 250 square feet.")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Choose a citation" })).toBeNull();

    fireEvent.click(button("Previous citation"));
    fireEvent.click(button("Next citation"));
    fireEvent.click(button("Open source"));
    fireEvent.change(screen.getByRole("combobox", { name: "Citation" }), { target: { value: "c1" } });
    expect(onChange.mock.calls.map(([id]) => id)).toEqual(["c1", "c3", "c1"]);
    expect(onOpen).toHaveBeenCalledWith("c2");

    rerender(<CitationNavigator citations={citations} activeId="c3" onChange={onChange} onOpen={onOpen} />);
    expect(button("Next citation").disabled).toBe(true);
  });

  it("shows an empty state without navigation when there are no citations", () => {
    render(<CitationNavigator citations={[]} activeId={null} onChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText("No citations.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("ContextItemOrderEditor", () => {
  const items = [
    { id: "policy", title: "Returns policy", tokens: 1200 },
    { id: "note", title: "Pinned note", tokens: 1 },
    { id: "sheet", title: "Inventory sheet" },
  ];

  it("shows each item's estimate, totals the known estimates and reports a keyboard reorder as ids", () => {
    const onReorder = vi.fn();
    render(<ContextItemOrderEditor items={items} onReorder={onReorder} />);
    expect(screen.getByRole("list", { name: "Context items" })).toBeTruthy();
    expect(screen.getByText("Returns policy · 1200 tokens")).toBeTruthy();
    expect(screen.getByText("Pinned note · 1 token")).toBeTruthy();
    expect(screen.getByText("Inventory sheet · Estimate unavailable")).toBeTruthy();
    expect(screen.getByText("1201 estimated tokens from known items")).toBeTruthy();

    const handle = button("Reorder Returns policy");
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: " " });
    expect(onReorder).toHaveBeenCalledWith(["note", "policy", "sheet"]);
  });

  it("shows the empty state without a token total", () => {
    render(<ContextItemOrderEditor items={[]} onReorder={vi.fn()} />);
    expect(screen.getByText("No items to order.")).toBeTruthy();
    expect(screen.queryByText(/estimated tokens/)).toBeNull();
  });
});

describe("ConversationBookmarks", () => {
  const bookmarks = [
    { id: "b1", messageId: "m42", title: "Deck stain quote", excerpt: "Three gallons of cedar stain, $96 total." },
    { id: "b2", messageId: "m57", title: "Delivery window" },
  ];

  it("opens the bookmarked message by message id and removes the bookmark by bookmark id", () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    render(<ConversationBookmarks bookmarks={bookmarks} onOpen={onOpen} onRemove={onRemove} />);
    expect(screen.getByText("Three gallons of cedar stain, $96 total.")).toBeTruthy();
    fireEvent.click(button("Open message Deck stain quote"));
    expect(onOpen).toHaveBeenCalledWith("m42");
    fireEvent.click(button("Remove bookmark Delivery window"));
    expect(onRemove).toHaveBeenCalledWith("b2");
  });

  it("hides removal without a handler and shows the empty state", () => {
    const { rerender } = render(<ConversationBookmarks bookmarks={bookmarks} onOpen={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^Remove bookmark/ })).toBeNull();
    rerender(<ConversationBookmarks bookmarks={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No saved messages.")).toBeTruthy();
  });
});

describe("ConversationForkTree", () => {
  const branches: ConversationFork[] = [
    { id: "main", label: "Main thread", children: [{ id: "cheaper", label: "Cheaper stain options", origin: "From message 6" }] },
    { id: "metric", label: "Metric measurements", origin: "From message 3" },
  ];

  it("shows forks as a tree with their origin, marks the active one and reports selection", () => {
    const onSelect = vi.fn();
    render(<ConversationForkTree branches={branches} activeId="metric" onSelect={onSelect} />);
    const tree = screen.getByRole("tree", { name: "Forks" });
    const metric = within(tree).getByRole("treeitem", { name: /^Metric measurements/ });
    expect(metric.getAttribute("aria-selected")).toBe("true");
    expect(within(metric).getByText("From message 3")).toBeTruthy();
    const main = within(tree).getByRole("treeitem", { name: /^Main thread/ });
    expect(main.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(main);
    expect(onSelect).toHaveBeenCalledWith("main");

    fireEvent.keyDown(main, { key: "ArrowRight" });
    fireEvent.click(within(tree).getByRole("treeitem", { name: /^Cheaper stain options/ }));
    expect(onSelect).toHaveBeenLastCalledWith("cheaper");
  });

  it("shows an empty state when there are no forks", () => {
    render(<ConversationForkTree branches={[]} activeId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("No forks yet.")).toBeTruthy();
    expect(screen.queryByRole("tree")).toBeNull();
  });
});

describe("ConversationSummaryEditor", () => {
  it("saves the trimmed summary and blocks saving a blank one", async () => {
    const onSubmit = vi.fn();
    render(<ConversationSummaryEditor initialSummary="Customer wants cedar stain." sourceRange="Messages 1–24" onSubmit={onSubmit} />);
    expect(screen.getByText("Messages 1–24")).toBeTruthy();
    const field = screen.getByRole("textbox", { name: "Summary" }) as HTMLTextAreaElement;
    expect(field.value).toBe("Customer wants cedar stain.");
    fireEvent.change(field, { target: { value: "   " } });
    expect(button("Save summary").disabled).toBe(true);
    fireEvent.change(field, { target: { value: "  Customer wants three gallons of cedar stain by Friday.  " } });
    await act(async () => { fireEvent.click(button("Save summary")); });
    expect(onSubmit).toHaveBeenCalledWith("Customer wants three gallons of cedar stain by Friday.");
  });

  it("shows a failed save as an alert and keeps the draft", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Could not save the summary."));
    render(<ConversationSummaryEditor initialSummary="Order pending." sourceRange="Messages 1–8" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Summary" }), { target: { value: "Order confirmed." } });
    await act(async () => { fireEvent.click(button("Save summary")); });
    expect(screen.getByRole("alert").textContent).toBe("Could not save the summary.");
    expect((screen.getByRole("textbox", { name: "Summary" }) as HTMLTextAreaElement).value).toBe("Order confirmed.");
  });

  it("starts a fresh draft when the summary or its source range changes, without remounting the field", () => {
    const { rerender } = render(<ConversationSummaryEditor initialSummary="Old summary." sourceRange="Messages 1–8" onSubmit={vi.fn()} />);
    const field = screen.getByRole("textbox", { name: "Summary" }) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Unsaved edit." } });
    rerender(<ConversationSummaryEditor initialSummary="Summary of the second chat." sourceRange="Messages 1–30" onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "Summary" })).toBe(field);
    expect(field.value).toBe("Summary of the second chat.");
    fireEvent.change(field, { target: { value: "Another edit." } });
    rerender(<ConversationSummaryEditor initialSummary="Summary of the second chat." sourceRange="Messages 1–31" onSubmit={vi.fn()} />);
    expect(field.value).toBe("Summary of the second chat.");
  });
});

describe("MessageDeliveryStatus", () => {
  it("names each state in words with its detail and offers Retry only on failure", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<MessageDeliveryStatus status="queued" detail="Waiting for connection" onRetry={onRetry} />);
    expect(screen.getByRole("status").textContent).toBe("Queued · Waiting for connection");
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<MessageDeliveryStatus status="sending" onRetry={onRetry} />);
    expect(screen.getByRole("status").textContent).toBe("Sending");
    rerender(<MessageDeliveryStatus status="sent" onRetry={onRetry} />);
    expect(screen.getByRole("status").textContent).toBe("Sent");
    rerender(<MessageDeliveryStatus status="failed" detail="Network error" onRetry={onRetry} />);
    expect(screen.getByRole("status").textContent).toBe("Failed to send · Network error");
    fireEvent.click(button("Retry message"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says it is retrying and blocks another retry while one is in flight", () => {
    const onRetry = vi.fn();
    render(<MessageDeliveryStatus status="failed" retrying onRetry={onRetry} />);
    expect(screen.getByRole("status").textContent).toBe("Retrying");
    fireEvent.click(button("Retry message"));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("shows no Retry button on failure without a handler", () => {
    render(<MessageDeliveryStatus status="failed" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("MessageFeedbackForm", () => {
  it("requires a rating, sends the trimmed comment for the message, clears and confirms", async () => {
    const onSubmit = vi.fn();
    render(<MessageFeedbackForm messageId="m9" onSubmit={onSubmit} />);
    expect(button("Send feedback").disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Rating" }), { target: { value: "negative" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Feedback (optional)" }), { target: { value: "  Quoted the wrong stain price.  " } });
    await act(async () => { fireEvent.click(button("Send feedback")); });
    expect(onSubmit).toHaveBeenCalledWith("m9", { rating: "negative", comment: "Quoted the wrong stain price." });
    expect((screen.getByRole("combobox", { name: "Rating" }) as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: "Feedback (optional)" }) as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("Feedback sent. Thank you.");
    expect(button("Send feedback").disabled).toBe(true);

    fireEvent.change(screen.getByRole("combobox", { name: "Rating" }), { target: { value: "positive" } });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps the draft and shows an alert when sending fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Feedback could not be sent."));
    render(<MessageFeedbackForm messageId="m9" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Rating" }), { target: { value: "positive" } });
    await act(async () => { fireEvent.click(button("Send feedback")); });
    expect(screen.getByRole("alert").textContent).toBe("Feedback could not be sent.");
    expect((screen.getByRole("combobox", { name: "Rating" }) as HTMLSelectElement).value).toBe("positive");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("starts a fresh draft for a different message", () => {
    const { rerender } = render(<MessageFeedbackForm messageId="m9" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Rating" }), { target: { value: "positive" } });
    rerender(<MessageFeedbackForm messageId="m10" onSubmit={vi.fn()} />);
    expect((screen.getByRole("combobox", { name: "Rating" }) as HTMLSelectElement).value).toBe("");
  });
});

describe("MessageSearchPanel", () => {
  const results: MessageSearchHit[] = [
    { id: "h1", conversation: "Spring restock", excerpt: "Order 40 bags of mulch.", author: "Dana" },
    { id: "h2", conversation: "Spring restock", excerpt: "Mulch delivery moved to Tuesday." },
  ];

  it("reports query changes, announces the result count and opens a hit by id with a distinct name", () => {
    const onQueryChange = vi.fn();
    const onOpen = vi.fn();
    render(<MessageSearchPanel results={results} query="mulch" onQueryChange={onQueryChange} onOpen={onOpen} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search messages" }), { target: { value: "mulch bags" } });
    expect(onQueryChange).toHaveBeenCalledWith("mulch bags");
    expect(screen.getByRole("status").textContent).toBe("2 matching messages");
    expect(screen.getByText("Mulch delivery moved to Tuesday.")).toBeTruthy();
    fireEvent.click(button("Open message from Dana in Spring restock"));
    expect(onOpen).toHaveBeenCalledWith("h1");
    fireEvent.click(button("Open message in Spring restock"));
    expect(onOpen).toHaveBeenLastCalledWith("h2");
  });

  it("announces searching, no matches and a single match", () => {
    const { rerender } = render(<MessageSearchPanel results={[]} query="mulch" pending onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Searching…");
    expect(screen.queryByRole("list")).toBeNull();
    rerender(<MessageSearchPanel results={[]} query="mulch" onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("No matching messages.");
    rerender(<MessageSearchPanel results={results.slice(0, 1)} query="mulch" onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("1 matching message");
  });

  it("shows a search error without claiming there were no matches", () => {
    render(<MessageSearchPanel results={[]} query="mulch" error="Search is unavailable." onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("Search is unavailable.");
    expect(screen.queryByText("No matching messages.")).toBeNull();
  });

  it("prompts for a search before one is entered", () => {
    render(<MessageSearchPanel results={[]} query="" onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText("Enter a word or phrase to search your conversations.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("ReplyQuote", () => {
  it("shows the quoted author and text and opens or clears the quote", () => {
    const onOpen = vi.fn();
    const onClear = vi.fn();
    render(<ReplyQuote messageId="m12" author="Dana Webb" quote={"Can you hold two\ngallons of cedar stain?"} onOpen={onOpen} onClear={onClear} />);
    const region = screen.getByRole("region", { name: "Replying to" });
    expect(within(region).getByRole("figure").querySelector("figcaption")?.textContent).toBe("Dana Webb");
    expect(region.querySelector("blockquote")?.textContent).toBe("Can you hold two\ngallons of cedar stain?");
    fireEvent.click(button("Open original message"));
    expect(onOpen).toHaveBeenCalledWith("m12");
    fireEvent.click(button("Clear quote"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders no actions without handlers", () => {
    render(<ReplyQuote messageId="m12" author="Dana Webb" quote="Thanks!" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SlashCommandPicker", () => {
  const commands = [
    { id: "restock", name: "/restock", description: "Draft a restock order", parameters: ["<sku>", "<quantity>"] },
    { id: "summarize", name: "summarize", description: "Summarize this conversation" },
  ];

  it("inserts the normalized command with its id and shows its description and parameters", () => {
    const onSelect = vi.fn();
    render(<SlashCommandPicker commands={commands} onSelect={onSelect} />);
    expect(screen.getByText("Draft a restock order · <sku> <quantity>")).toBeTruthy();
    fireEvent.click(button("Insert /summarize"));
    expect(onSelect).toHaveBeenCalledWith("summarize", "/summarize");
    fireEvent.click(button("Insert /restock"));
    expect(onSelect).toHaveBeenLastCalledWith("restock", "/restock");
  });

  it("filters by the typed command including its slash, by description and by parameter", () => {
    render(<SlashCommandPicker commands={commands} onSelect={vi.fn()} />);
    const filter = screen.getByRole("searchbox", { name: "Filter commands" });
    fireEvent.change(filter, { target: { value: "/sum" } });
    expect(screen.getAllByRole("listitem").map((item) => within(item).getByRole("button").getAttribute("aria-label"))).toEqual(["Insert /summarize"]);
    fireEvent.change(filter, { target: { value: "quantity" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(button("Insert /restock")).toBeTruthy();
    fireEvent.change(filter, { target: { value: "/refund" } });
    expect(screen.getByText("No matching commands.")).toBeTruthy();
  });

  it("says no commands are available when there are none", () => {
    render(<SlashCommandPicker commands={[]} onSelect={vi.fn()} />);
    expect(screen.getByText("No commands available.")).toBeTruthy();
  });
});
