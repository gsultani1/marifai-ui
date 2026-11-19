// packages/ai-ui/test/browser-panels.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BookmarkManager,
  BrowserConsolePanel,
  BrowserDownloadList,
  BrowserHistoryList,
  BrowserNavigationBar,
  BrowserPageDiff,
  BrowserProfilePicker,
  BrowserReaderView,
  BrowserRequestTable,
  BrowserSessionRestore,
  BrowserSitePermissions,
  OpenTabPicker,
  PageCaptureReview,
  PageFindBar,
  PageLinkInspector,
  PageSelectionToolbar,
  type BrowserBookmark,
  type BrowserConsoleEntry,
  type BrowserDownload,
  type BrowserRestoreWindow,
  type BrowserSitePermission,
  type InspectedBrowserRequest,
  type OpenBrowserTab,
} from "../src/index.js";

const listTexts = (container: HTMLElement) => within(container).getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent);

describe("BookmarkManager", () => {
  const bookmarks: BrowserBookmark[] = [
    { id: "drill", title: "Cordless drill specs", address: "hardware.example.com/drills/cd-20", folderId: "tools" },
    { id: "returns", title: "Return policy", address: "hardware.example.com/help/returns", folderId: null },
  ];
  const folders = [{ id: "tools", label: "Power tools" }, { id: "help", label: "Store help" }];

  it("opens and removes bookmarks by id with item-named buttons and searches title, address and folder", () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    render(<BookmarkManager bookmarks={bookmarks} folders={folders} onOpen={onOpen} onRemove={onRemove} />);
    const panel = screen.getByRole("region", { name: "Bookmarks" });
    expect(listTexts(panel)).toEqual(["Cordless drill specs", "Return policy"]);
    expect(screen.queryByRole("button", { name: /^Edit/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Cordless drill specs" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Return policy" }));
    expect(onOpen).toHaveBeenCalledWith("drill");
    expect(onRemove).toHaveBeenCalledWith("returns");

    const search = screen.getByRole("searchbox", { name: "Search bookmarks" });
    fireEvent.change(search, { target: { value: "power" } });
    expect(listTexts(panel)).toEqual(["Cordless drill specs"]);
    fireEvent.change(search, { target: { value: "help/returns" } });
    expect(listTexts(panel)).toEqual(["Return policy"]);
    fireEvent.change(search, { target: { value: "lumber" } });
    expect(screen.getByText("No matching bookmarks.")).toBeTruthy();
  });

  it("says there are no bookmarks yet when the list is empty", () => {
    render(<BookmarkManager bookmarks={[]} folders={folders} />);
    expect(screen.getByText("No bookmarks yet.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("edits one bookmark at a time, saves a trimmed name and folder, then returns focus to its Edit button", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BookmarkManager bookmarks={bookmarks} folders={folders} onSave={onSave} />);
    const edit = screen.getByRole("button", { name: "Edit Return policy" });
    fireEvent.click(edit);
    const form = screen.getByRole("form", { name: "Edit Return policy" });
    const name = within(form).getByRole("textbox", { name: "Bookmark name" });
    expect(document.activeElement).toBe(name);
    expect((edit as HTMLButtonElement).disabled).toBe(true);
    expect((within(form).getByRole("combobox", { name: "Folder" }) as HTMLSelectElement).value).toBe("");

    fireEvent.change(name, { target: { value: "  Returns and exchanges  " } });
    fireEvent.change(within(form).getByRole("combobox", { name: "Folder" }), { target: { value: "help" } });
    await act(async () => { fireEvent.click(within(form).getByRole("button", { name: "Save bookmark" })); });
    expect(onSave).toHaveBeenCalledWith("returns", { title: "Returns and exchanges", folderId: "help" });
    expect(screen.queryByRole("form")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit Return policy" }));
  });

  it("saves a bookmark whose folder was deleted as having no folder, matching what the editor shows", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<BookmarkManager bookmarks={[{ id: "old", title: "Clearance list", address: "hardware.example.com/clearance", folderId: "archived" }]}
      folders={folders} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Clearance list" }));
    expect((screen.getByRole("combobox", { name: "Folder" }) as HTMLSelectElement).value).toBe("");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save bookmark" })); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onSave).toHaveBeenCalledWith("old", { title: "Clearance list", folderId: null });
  });

  it("requires a name, keeps the editor open with an alert when saving fails and closes on cancel", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Bookmark sync is offline."));
    render(<BookmarkManager bookmarks={bookmarks} folders={folders} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Cordless drill specs" }));
    const form = screen.getByRole("form", { name: "Edit Cordless drill specs" });
    expect((within(form).getByRole("combobox", { name: "Folder" }) as HTMLSelectElement).value).toBe("tools");
    fireEvent.change(within(form).getByRole("textbox", { name: "Bookmark name" }), { target: { value: "   " } });
    fireEvent.click(within(form).getByRole("button", { name: "Save bookmark" }));
    expect(within(form).getByRole("alert").textContent).toBe("Enter a bookmark name.");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByRole("textbox", { name: "Bookmark name" }), { target: { value: "Drill specs" } });
    fireEvent.change(within(form).getByRole("combobox", { name: "Folder" }), { target: { value: "" } });
    await act(async () => { fireEvent.click(within(form).getByRole("button", { name: "Save bookmark" })); });
    expect(onSave).toHaveBeenCalledWith("drill", { title: "Drill specs", folderId: null });
    expect(within(form).getByRole("alert").textContent).toBe("Bookmark sync is offline.");

    fireEvent.click(within(form).getByRole("button", { name: "Cancel editing" }));
    expect(screen.queryByRole("form")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit Cordless drill specs" }));
  });
});

describe("BrowserConsolePanel", () => {
  const entries: BrowserConsoleEntry[] = [
    { id: "1", level: "info", text: "Cart restored with 3 items" },
    { id: "2", level: "warning", text: "Image missing alt text", source: { address: "shop.example.com/app.js", line: 88 } },
    { id: "3", level: "error", text: "TypeError: price is undefined", source: { address: "shop.example.com/cart.js", line: 42, column: 17 } },
  ];

  it("shows each entry's level and source location in text and opens the source", () => {
    const onOpenSource = vi.fn();
    render(<BrowserConsolePanel entries={entries} onOpenSource={onOpenSource} />);
    expect(screen.getByText("Info", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Warning · shop.example.com/app.js:88")).toBeTruthy();
    expect(screen.getByText("Error · shop.example.com/cart.js:42:17")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open source Cart restored with 3 items" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open source TypeError: price is undefined" }));
    expect(onOpenSource).toHaveBeenCalledWith({ address: "shop.example.com/cart.js", line: 42, column: 17 });
  });

  it("filters by level and text and distinguishes an empty console from no matches", () => {
    const { rerender } = render(<BrowserConsolePanel entries={entries} />);
    const panel = screen.getByRole("region", { name: "Browser console" });
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Level" }), { target: { value: "error" } });
    expect(listTexts(panel)).toEqual(["TypeError: price is undefined"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Level" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search console" }), { target: { value: "app.js" } });
    expect(listTexts(panel)).toEqual(["Image missing alt text"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search console" }), { target: { value: "checkout" } });
    expect(screen.getByText("No matching console entries.")).toBeTruthy();
    rerender(<BrowserConsolePanel entries={[]} />);
    expect(screen.getByText("The console is empty.")).toBeTruthy();
  });
});

describe("BrowserDownloadList", () => {
  const MB = 1024 * 1024;
  const downloads: BrowserDownload[] = [
    { id: "manual", name: "drill-manual.pdf", status: "downloading", receivedBytes: 5 * MB, totalBytes: 10 * MB },
    { id: "catalog", name: "catalog.zip", status: "paused", receivedBytes: 3 * MB, totalBytes: 12 * MB, detail: "Paused by you" },
    { id: "stream", name: "inventory.csv", status: "downloading", receivedBytes: 512 * 1024 },
    { id: "queued", name: "price-list.xlsx", status: "queued", receivedBytes: 0 },
    { id: "done", name: "receipt.pdf", status: "completed", receivedBytes: 200 * 1024, totalBytes: 200 * 1024 },
    { id: "failed", name: "brochure.pdf", status: "failed", receivedBytes: 0, detail: "Network error" },
    { id: "canceled", name: "warranty.pdf", status: "canceled", receivedBytes: 0 },
  ];

  it("states status and bytes in text, shows progress and offers only the actions each status allows", () => {
    const onAction = vi.fn();
    render(<BrowserDownloadList downloads={downloads} onAction={onAction} />);
    expect(screen.getByText("Downloading · 5.0 MB of 10 MB")).toBeTruthy();
    expect(screen.getByText("Paused · 3.0 MB of 12 MB · Paused by you")).toBeTruthy();
    expect(screen.getByText("Downloading · 512 KB")).toBeTruthy();
    expect(screen.getByText("Completed · 200 KB")).toBeTruthy();
    expect(screen.getByText("Failed · Network error")).toBeTruthy();
    const manual = screen.getByRole("progressbar", { name: "drill-manual.pdf progress" }) as HTMLProgressElement;
    expect([manual.value, manual.max]).toEqual([5 * MB, 10 * MB]);
    expect(screen.getByRole("progressbar", { name: "inventory.csv progress" }).hasAttribute("value")).toBe(false);
    expect(screen.queryByRole("progressbar", { name: "receipt.pdf progress" })).toBeNull();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /receipt\.pdf/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Pause drill-manual.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume catalog.zip" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel price-list.xlsx" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry brochure.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry warranty.pdf" }));
    expect(onAction.mock.calls).toEqual([["manual", "pause"], ["catalog", "resume"], ["queued", "cancel"], ["failed", "retry"], ["canceled", "retry"]]);
  });

  it("disables the actions of pending downloads", () => {
    const onAction = vi.fn();
    render(<BrowserDownloadList downloads={downloads} onAction={onAction} pendingIds={["manual"]} />);
    const pause = screen.getByRole("button", { name: "Pause drill-manual.pdf" }) as HTMLButtonElement;
    expect(pause.disabled).toBe(true);
    fireEvent.click(pause);
    fireEvent.click(screen.getByRole("button", { name: "Cancel drill-manual.pdf" }));
    expect(onAction).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Pause inventory.csv" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows status without actions when there is no handler, and an empty message", () => {
    const { rerender } = render(<BrowserDownloadList downloads={downloads.slice(0, 1)} />);
    expect(screen.getByText("Downloading · 5.0 MB of 10 MB")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<BrowserDownloadList downloads={[]} />);
    expect(screen.getByText("No downloads.")).toBeTruthy();
  });
});

describe("BrowserHistoryList", () => {
  const visits = [
    { id: "v1", title: "Deck stain buying guide", address: "hardware.example.com/guides/deck-stain", visitedAt: "Today, 9:41 AM" },
    { id: "v2", title: "Order #4821 status", address: "hardware.example.com/orders/4821", visitedAt: "Yesterday, 4:15 PM" },
  ];

  it("lists visits with address and time, opens a visit by id and filters by title or address", () => {
    const onOpen = vi.fn();
    render(<BrowserHistoryList visits={visits} onOpen={onOpen} />);
    const panel = screen.getByRole("region", { name: "Browser history" });
    expect(screen.getByText("hardware.example.com/orders/4821 · Yesterday, 4:15 PM")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Order #4821 status" }));
    expect(onOpen).toHaveBeenCalledWith("v2");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search visits" }), { target: { value: "guides" } });
    expect(listTexts(panel)).toEqual(["Deck stain buying guide"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search visits" }), { target: { value: "invoice" } });
    expect(screen.getByText("No matching visits.")).toBeTruthy();
  });

  it("says there is no history when there are no visits", () => {
    render(<BrowserHistoryList visits={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("No browsing history.")).toBeTruthy();
  });
});

describe("BrowserNavigationBar", () => {
  it("reports typing and navigates to the trimmed address on submit", () => {
    const onAddressChange = vi.fn();
    const onNavigate = vi.fn();
    render(<BrowserNavigationBar address="  hardware.example.com/deals " onAddressChange={onAddressChange} onNavigate={onNavigate} />);
    const input = screen.getByRole("textbox", { name: "Browser address" });
    fireEvent.change(input, { target: { value: "hardware.example.com/paint" } });
    expect(onAddressChange).toHaveBeenCalledWith("hardware.example.com/paint");
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onNavigate).toHaveBeenCalledWith("hardware.example.com/deals");
  });

  it("does not navigate to a blank address", () => {
    const onNavigate = vi.fn();
    render(<BrowserNavigationBar address="   " onAddressChange={vi.fn()} onNavigate={onNavigate} addressLabel="Agent browser address" />);
    expect((screen.getByRole("button", { name: "Go" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("search", { name: "Agent browser address" }));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("enables back, forward and reload only with handlers and swaps reload for stop while loading", () => {
    const onBack = vi.fn();
    const onReload = vi.fn();
    const onStop = vi.fn();
    const props = { address: "hardware.example.com", onAddressChange: vi.fn(), onNavigate: vi.fn() };
    const { rerender } = render(<BrowserNavigationBar {...props} onBack={onBack} onReload={onReload} onStop={onStop} />);
    expect((screen.getByRole("button", { name: "Go forward" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);

    rerender(<BrowserNavigationBar {...props} onReload={onReload} onStop={onStop} loading />);
    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop loading" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Go back" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(<BrowserNavigationBar {...props} onReload={onReload} loading />);
    expect((screen.getByRole("button", { name: "Stop loading" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("BrowserPageDiff", () => {
  const before = { label: "Monday 9:00", text: "Deck stain\n$34.99\nIn stock\n" };
  const after = { label: "Tuesday 9:00", text: "Deck stain\n$29.99\nIn stock\n" };

  it("shows labelled changes and switches between unified and side-by-side layouts", () => {
    const { container } = render(<BrowserPageDiff before={before} after={after} />);
    const diff = container.querySelector("[data-slot='diff-view']")!;
    expect(diff.getAttribute("data-mode")).toBe("unified");
    expect(container.querySelector("caption")?.textContent).toBe("Changes from Monday 9:00 to Tuesday 9:00: 1 lines added, 1 lines removed");
    const lines = screen.getByRole("region", { name: "Diff lines" });
    expect(lines.textContent).toContain("Removed: $34.99");
    expect(lines.textContent).toContain("Added: $29.99");
    fireEvent.change(screen.getByRole("combobox", { name: "Diff layout" }), { target: { value: "split" } });
    expect(container.querySelector("[data-slot='diff-view']")?.getAttribute("data-mode")).toBe("split");
  });

  it("says there are no changes when both snapshots match", () => {
    render(<BrowserPageDiff before={before} after={{ label: "Tuesday 9:00", text: before.text }} />);
    expect(screen.getByText("No changes between Monday 9:00 and Tuesday 9:00.")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Diff layout" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Diff lines" })).toBeNull();
  });
});

describe("BrowserProfilePicker", () => {
  const profiles = [
    { id: "work", name: "Store operations", session: "Signed in as ops@hardware.example.com", storage: "Cookies kept for this profile" },
    { id: "guest", name: "Guest", session: "Signed out", storage: "Cleared when the run ends" },
    { id: "admin", name: "Admin", session: "Signed in", storage: "Shared", unavailableReason: "Locked by another run" },
  ];

  it("reports an available profile and shows the selected profile's session and storage", () => {
    const onChange = vi.fn();
    render(<BrowserProfilePicker profiles={profiles} value="work" onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Profile" }) as HTMLSelectElement;
    expect(select.value).toBe("work");
    expect((screen.getByRole("option", { name: "Admin · Locked by another run" }) as HTMLOptionElement).disabled).toBe(true);
    const details = screen.getByRole("region", { name: "Browser profile" }).querySelector("dl")!;
    expect(details.textContent).toBe("SessionSigned in as ops@hardware.example.comStorage scopeCookies kept for this profile");
    fireEvent.change(select, { target: { value: "guest" } });
    expect(onChange).toHaveBeenCalledWith("guest");
  });

  it("ignores unavailable profiles and the placeholder and hides details until a profile is chosen", () => {
    const onChange = vi.fn();
    render(<BrowserProfilePicker profiles={profiles} value={null} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Profile" }) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.queryByText("Session")).toBeNull();
    fireEvent.change(select, { target: { value: "admin" } });
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says when no profiles are available", () => {
    render(<BrowserProfilePicker profiles={[]} value={null} onChange={vi.fn()} />);
    expect(screen.getByText("No browser profiles are available.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("BrowserReaderView", () => {
  it("renders the article with its byline and changes text size and reading width", () => {
    render(<BrowserReaderView title="How to choose a deck stain" byline="Garden Center Team · 6 min read">
      <p>Start with the wood species and how much sun the deck gets.</p>
    </BrowserReaderView>);
    const article = screen.getByRole("article");
    expect(within(article).getByRole("heading", { name: "How to choose a deck stain" })).toBeTruthy();
    expect(within(article).getByText("Garden Center Team · 6 min read")).toBeTruthy();
    expect(within(article).getByText(/wood species/)).toBeTruthy();
    expect(article.className).toContain("text-base");
    expect(article.className).toContain("max-w-prose");
    fireEvent.change(screen.getByRole("combobox", { name: "Text size" }), { target: { value: "xlarge" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Reading width" }), { target: { value: "wide" } });
    expect(article.className).toContain("text-xl");
    expect(article.className).toContain("max-w-5xl");
  });

  it("omits the byline when none is given", () => {
    render(<BrowserReaderView title="Store hours"><p>Open daily from 7 AM.</p></BrowserReaderView>);
    expect(screen.getByRole("article").querySelectorAll("p")).toHaveLength(1);
  });
});

describe("BrowserRequestTable", () => {
  const requests: InspectedBrowserRequest[] = [
    { id: "r1", address: "api.hardware.example.com/cart", method: "GET", status: "200", type: "fetch", durationMs: 84 },
    { id: "r2", address: "api.hardware.example.com/checkout", method: "POST", status: "500", type: "fetch", durationMs: 1210 },
    { id: "r3", address: "cdn.hardware.example.com/logo.svg", method: "GET", status: "200", type: "image" },
  ];

  it("lists requests in a table, inspects a row by id and filters by method, status and type", () => {
    const onInspect = vi.fn();
    render(<BrowserRequestTable requests={requests} onInspect={onInspect} />);
    const table = screen.getByRole("table", { name: "Recorded requests" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByRole("rowheader", { name: /cdn\.hardware\.example\.com\/logo\.svg/ })).toBeTruthy();
    expect(within(table).getByText("Unavailable")).toBeTruthy();
    expect(within(table).getByText("1210 ms")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Showing 3 of 3 requests");
    fireEvent.click(screen.getByRole("button", { name: "Inspect request api.hardware.example.com/checkout" }));
    expect(onInspect).toHaveBeenCalledWith("r2");

    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), { target: { value: "GET" } });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    fireEvent.change(screen.getByRole("combobox", { name: "Request type" }), { target: { value: "image" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("Showing 1 of 3 requests");
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "500" } });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No matching requests.")).toBeTruthy();
  });

  it("stops applying a filter whose value is no longer in the requests", () => {
    const { rerender } = render(<BrowserRequestTable requests={requests} onInspect={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "500" } });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    rerender(<BrowserRequestTable requests={requests.filter((request) => request.status !== "500")} onInspect={vi.fn()} />);
    expect((screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement).value).toBe("");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  });

  it("says when nothing has been recorded", () => {
    render(<BrowserRequestTable requests={[]} onInspect={vi.fn()} />);
    expect(screen.getByText("No requests recorded.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("BrowserSessionRestore", () => {
  const windows: BrowserRestoreWindow[] = [
    { id: "w1", title: "Supplier research", tabs: [{ id: "t1", title: "Lumber prices" }, { id: "t2", title: "Freight quote" }] },
    { id: "w2", title: "Store admin", tabs: [{ id: "t3", title: "Inventory dashboard" }] },
    { id: "w3", title: "Closed window", tabs: [] },
  ];

  it("restores the checked tabs grouped by window and clears the selection afterwards", async () => {
    const onRestore = vi.fn().mockResolvedValue(undefined);
    render(<BrowserSessionRestore windows={windows} onRestore={onRestore} />);
    const submit = screen.getByRole("button", { name: "Restore selected tabs" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByRole("treeitem", { name: "Closed window" }).getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("treeitem", { name: "Supplier research" }));
    expect(screen.getByRole("treeitem", { name: "Supplier research" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(screen.getByRole("treeitem", { name: "Store admin" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("treeitem", { name: "Inventory dashboard" }));
    expect(submit.disabled).toBe(false);

    await act(async () => { fireEvent.click(submit); });
    expect(onRestore).toHaveBeenCalledWith([{ windowId: "w1", tabIds: ["t1", "t2"] }, { windowId: "w2", tabIds: ["t3"] }]);
    expect(screen.getByRole("treeitem", { name: "Supplier research" }).getAttribute("aria-checked")).toBe("false");
    expect(submit.disabled).toBe(true);
  });

  it("restores a single tab and keeps the selection with an alert when restoring fails", async () => {
    const onRestore = vi.fn().mockRejectedValue(new Error("The browser closed."));
    render(<BrowserSessionRestore windows={windows} onRestore={onRestore} />);
    fireEvent.keyDown(screen.getByRole("treeitem", { name: "Supplier research" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("treeitem", { name: "Freight quote" }));
    expect(screen.getByRole("treeitem", { name: "Supplier research" }).getAttribute("aria-checked")).toBe("mixed");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Restore selected tabs" })); });
    expect(onRestore).toHaveBeenCalledWith([{ windowId: "w1", tabIds: ["t2"] }]);
    expect(screen.getByRole("alert").textContent).toBe("The browser closed.");
    expect(screen.getByRole("treeitem", { name: "Freight quote" }).getAttribute("aria-checked")).toBe("true");
  });

  it("says when there are no windows to restore", () => {
    render(<BrowserSessionRestore windows={[]} onRestore={vi.fn()} />);
    expect(screen.getByText("No windows to restore.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Restore selected tabs" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("BrowserSitePermissions", () => {
  const permissions: BrowserSitePermission[] = [
    { id: "camera", label: "Camera", effective: "ask" },
    { id: "location", label: "Location", effective: "allow", value: "allow", available: ["allow", "block"] },
    { id: "popups", label: "Pop-ups", effective: "block", unavailableReason: "Set by your organization" },
  ];

  it("shows the effective setting in text and reports a change by permission id", () => {
    const onChange = vi.fn();
    render(<BrowserSitePermissions origin="https://hardware.example.com" permissions={permissions} onChange={onChange} />);
    expect(screen.getByText("https://hardware.example.com")).toBeTruthy();
    expect(screen.getByText("Effective: Ask")).toBeTruthy();
    const camera = screen.getByRole("combobox", { name: "Set Camera" }) as HTMLSelectElement;
    expect(camera.value).toBe("ask");
    fireEvent.change(camera, { target: { value: "block" } });
    expect(onChange).toHaveBeenCalledWith("camera", "block");
    const location = screen.getByRole("combobox", { name: "Set Location" });
    expect(within(location).getAllByRole("option").map((option) => option.textContent)).toEqual(["Allow", "Block"]);
  });

  it("locks permissions that are managed or saving and says why", () => {
    const onChange = vi.fn();
    render(<BrowserSitePermissions origin="https://hardware.example.com" permissions={permissions} onChange={onChange} pendingIds={["camera"]} />);
    expect(screen.getByText("Effective: Block · Set by your organization")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Set Pop-ups" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText("Effective: Ask · Saving…")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Set Camera" }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "Set Location" }) as HTMLSelectElement).disabled).toBe(false);
  });

  it("keeps a current value that is no longer offered visible but not selectable", () => {
    const onChange = vi.fn();
    render(<BrowserSitePermissions origin="https://hardware.example.com" onChange={onChange}
      permissions={[{ id: "mic", label: "Microphone", effective: "ask", value: "ask", available: ["block"] }]} />);
    const select = screen.getByRole("combobox", { name: "Set Microphone" }) as HTMLSelectElement;
    expect(select.value).toBe("ask");
    expect((within(select).getByRole("option", { name: "Ask" }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: "block" } });
    expect(onChange).toHaveBeenCalledWith("mic", "block");
  });

  it("is read-only without a handler and shows an empty message", () => {
    const { rerender } = render(<BrowserSitePermissions origin="https://hardware.example.com" permissions={permissions} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    rerender(<BrowserSitePermissions origin="https://hardware.example.com" permissions={[]} />);
    expect(screen.getByText("No permissions available.")).toBeTruthy();
  });
});

describe("OpenTabPicker", () => {
  const tabs: OpenBrowserTab[] = [
    { id: "a", title: "Paint color matcher", address: "hardware.example.com/paint/match", window: "Main window" },
    { id: "b", title: "Supplier portal", address: "supplier.example.com/orders", window: "Main window" },
    { id: "c", title: "Weekly flyer draft", address: "docs.example.com/flyer", window: "Marketing" },
  ];

  it("opens and attaches tabs by id and marks attached tabs in text", () => {
    const onOpen = vi.fn();
    const onAttach = vi.fn();
    render(<OpenTabPicker tabs={tabs} onOpen={onOpen} onAttach={onAttach} attachedIds={["b"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Weekly flyer draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Attach Paint color matcher" }));
    expect(onOpen).toHaveBeenCalledWith("c");
    expect(onAttach).toHaveBeenCalledWith("a");
    const attached = screen.getByRole("button", { name: "Attached Supplier portal" }) as HTMLButtonElement;
    expect(attached.disabled).toBe(true);
    fireEvent.click(attached);
    expect(onAttach).toHaveBeenCalledTimes(1);
  });

  it("filters by window and text and shows an empty message", () => {
    render(<OpenTabPicker tabs={tabs} />);
    const panel = screen.getByRole("region", { name: "Open tabs" });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Marketing · docs.example.com/flyer")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Window" }), { target: { value: "Marketing" } });
    expect(listTexts(panel)).toEqual(["Weekly flyer draft"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Window" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search open tabs" }), { target: { value: "supplier.example" } });
    expect(listTexts(panel)).toEqual(["Supplier portal"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search open tabs" }), { target: { value: "invoice" } });
    expect(screen.getByText("No matching tabs.")).toBeTruthy();
  });
});

describe("PageCaptureReview", () => {
  it("shows the preview in a focusable region and attaches the capture with a trimmed label", async () => {
    const onAttach = vi.fn().mockResolvedValue(undefined);
    render(<PageCaptureReview captureId="cap-1" preview={<img src="data:image/png;base64," alt="Checkout page" />} initialLabel="Checkout" onAttach={onAttach} />);
    const preview = screen.getByRole("region", { name: "Capture preview" });
    expect(preview.tabIndex).toBe(0);
    expect(within(preview).getByRole("img", { name: "Checkout page" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Discard capture" })).toBeNull();
    const label = screen.getByRole("textbox", { name: "Capture label" });
    expect((label as HTMLInputElement).value).toBe("Checkout");
    fireEvent.change(label, { target: { value: "  Checkout error  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Attach capture" })); });
    expect(onAttach).toHaveBeenCalledWith("cap-1", "Checkout error");
  });

  it("discards by id, blocks discarding while attaching and shows a failed attach as an alert", async () => {
    let fail: (error: Error) => void = () => undefined;
    const onAttach = vi.fn(() => new Promise<void>((_, reject) => { fail = reject; }));
    const onDiscard = vi.fn();
    render(<PageCaptureReview captureId="cap-2" preview={<p>Cart page</p>} onAttach={onAttach} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard capture" }));
    expect(onDiscard).toHaveBeenCalledWith("cap-2");

    fireEvent.click(screen.getByRole("button", { name: "Attach capture" }));
    expect(screen.getByRole("button", { name: "Discard capture" }).matches(":disabled")).toBe(true);
    await act(async () => fail(new Error("Attachment limit reached.")));
    expect(screen.getByRole("alert").textContent).toBe("Attachment limit reached.");
    expect(screen.getByRole("button", { name: "Discard capture" }).matches(":disabled")).toBe(false);
  });

  it("resets the label draft and errors when a new capture arrives", async () => {
    const onAttach = vi.fn().mockRejectedValue(new Error("Upload failed."));
    const { rerender } = render(<PageCaptureReview captureId="cap-1" preview={<p>One</p>} initialLabel="Cart" onAttach={onAttach} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Capture label" }), { target: { value: "Edited" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Attach capture" })); });
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<PageCaptureReview captureId="cap-2" preview={<p>Two</p>} initialLabel="Receipt" onAttach={onAttach} />);
    expect((screen.getByRole("textbox", { name: "Capture label" }) as HTMLInputElement).value).toBe("Receipt");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("PageFindBar", () => {
  const base = { onQueryChange: vi.fn(), onMove: vi.fn() };

  it("announces the current match and moves with the buttons, Enter and Shift+Enter", () => {
    const onMove = vi.fn();
    const onQueryChange = vi.fn();
    render(<PageFindBar query="torque" onQueryChange={onQueryChange} currentMatch={2} matchCount={5} onMove={onMove} />);
    expect(screen.getByRole("status").textContent).toBe("2 of 5");
    const input = screen.getByRole("searchbox", { name: "Find text" });
    fireEvent.change(input, { target: { value: "torque wrench" } });
    expect(onQueryChange).toHaveBeenCalledWith("torque wrench");
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onMove.mock.calls).toEqual([["next"], ["previous"], ["next"], ["previous"]]);
  });

  it("counts matches with correct wording and says when there are none", () => {
    const { rerender } = render(<PageFindBar {...base} query="drill" currentMatch={null} matchCount={1} />);
    expect(screen.getByRole("status").textContent).toBe("1 match");
    rerender(<PageFindBar {...base} query="drill" currentMatch={null} matchCount={4} />);
    expect(screen.getByRole("status").textContent).toBe("4 matches");
    rerender(<PageFindBar {...base} query="lathe" currentMatch={null} matchCount={0} />);
    expect(screen.getByRole("status").textContent).toBe("No matches");
    rerender(<PageFindBar {...base} query="  " currentMatch={null} matchCount={0} />);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("blocks moving while searching, with no query or with no matches", () => {
    const onMove = vi.fn();
    const { rerender } = render(<PageFindBar query="drill" onQueryChange={vi.fn()} currentMatch={1} matchCount={3} onMove={onMove} pending />);
    expect(screen.getByRole("status").textContent).toBe("Searching…");
    const next = screen.getByRole("button", { name: "Next match" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Find text" }), { key: "Enter" });
    rerender(<PageFindBar query="" onQueryChange={vi.fn()} currentMatch={null} matchCount={3} onMove={onMove} />);
    expect((screen.getByRole("button", { name: "Previous match" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<PageFindBar query="lathe" onQueryChange={vi.fn()} currentMatch={null} matchCount={0} onMove={onMove} />);
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("closes with the close button or Escape and hides the close button without a handler", () => {
    const onClose = vi.fn();
    const { rerender } = render(<PageFindBar {...base} query="drill" currentMatch={1} matchCount={3} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close find bar" }));
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Find text" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<PageFindBar {...base} query="drill" currentMatch={1} matchCount={3} />);
    expect(screen.queryByRole("button", { name: "Close find bar" })).toBeNull();
  });
});

describe("PageLinkInspector", () => {
  const links = [
    { id: "l1", label: "Deck stain", address: "https://hardware.example.com/paint/deck-stain", domain: "hardware.example.com" },
    { id: "l2", label: "Store hours", address: "https://hardware.example.com/hours", domain: "hardware.example.com" },
    { id: "l3", label: "", address: "https://social.example.com/hardware", domain: "social.example.com" },
  ];

  it("groups links by domain with a count, inspects a link by id and names unlabelled links by address", () => {
    const onInspect = vi.fn();
    render(<PageLinkInspector links={links} onInspect={onInspect} />);
    expect(screen.getByText("hardware.example.com · 2 links")).toBeTruthy();
    expect(screen.getByText("social.example.com · 1 link")).toBeTruthy();
    expect(screen.getAllByRole("list")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Store hours" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect https://social.example.com/hardware" }));
    expect(onInspect.mock.calls).toEqual([["l2"], ["l3"]]);
  });

  it("filters links and distinguishes a page without links from no matches", () => {
    const { rerender } = render(<PageLinkInspector links={links} onInspect={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search links" }), { target: { value: "deck" } });
    expect(screen.getByText("hardware.example.com · 1 link")).toBeTruthy();
    expect(screen.queryByText(/social\.example\.com ·/)).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search links" }), { target: { value: "checkout" } });
    expect(screen.getByText("No matching links.")).toBeTruthy();
    rerender(<PageLinkInspector links={[]} onInspect={vi.fn()} />);
    expect(screen.getByText("No links on this page.")).toBeTruthy();
  });
});

describe("PageSelectionToolbar", () => {
  it("quotes, attaches and copies the selected text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const onQuote = vi.fn();
    const onAttach = vi.fn();
    const selection = "Use two coats on new wood and let each dry for four hours.";
    render(<PageSelectionToolbar selection={selection} onQuote={onQuote} onAttach={onAttach} />);
    expect(screen.getByText(selection).tagName).toBe("BLOCKQUOTE");
    fireEvent.click(screen.getByRole("button", { name: "Quote selection" }));
    fireEvent.click(screen.getByRole("button", { name: "Add selection to context" }));
    expect(onQuote).toHaveBeenCalledWith(selection);
    expect(onAttach).toHaveBeenCalledWith(selection);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy selection" })); });
    expect(writeText).toHaveBeenCalledWith(selection);
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("asks for a selection when it is empty or whitespace and hides actions without handlers", () => {
    const { rerender } = render(<PageSelectionToolbar selection={"  \n "} onQuote={vi.fn()} />);
    expect(screen.getByText("Select text on a page to use it here.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<PageSelectionToolbar selection="Aisle 7" />);
    expect(screen.getByRole("button", { name: "Copy selection" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quote selection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add selection to context" })).toBeNull();
  });
});
