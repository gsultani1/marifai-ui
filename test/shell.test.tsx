// packages/ai-ui/test/shell.test.tsx
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppShell,
  BarcodeScanner,
  Breadcrumbs,
  cameraErrorMessage,
  CashCount,
  cashCountTotal,
  computeTrend,
  countGrantChanges,
  formatShortcut,
  Gauge,
  initialPanelSizes,
  InstallPrompt,
  isIosDevice,
  isNavItemCurrent,
  OfflineQueuePanel,
  OfflineQueueStore,
  type OfflineQueueStorage,
  OnboardingChecklist,
  Pagination,
  paginationRange,
  parseShortcut,
  PermissionMatrix,
  type PermissionGrants,
  PullToRefresh,
  type QueuedAction,
  ResizablePanels,
  resizePanels,
  SessionTimeoutWarning,
  ShortcutHelp,
  Sparkline,
  StatTile,
  ThemeToggle,
  Tour,
  TrendIndicator,
  UpdatePrompt,
  useBarcodeScanner,
  useShortcuts,
  useTheme,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("Pagination", () => {
  it("builds ranges with ellipses", () => {
    expect(paginationRange(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 10]);
    expect(paginationRange(5, 10)).toEqual([1, "ellipsis-start", 4, 5, 6, "ellipsis-end", 10]);
    expect(paginationRange(10, 10)).toEqual([1, "ellipsis-start", 6, 7, 8, 9, 10]);
    expect(paginationRange(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("changes pages and page size and shows the item range", () => {
    function Demo() {
      const [page, setPage] = useState(2);
      const [size, setSize] = useState(20);
      return <Pagination page={page} pageCount={Math.ceil(312 / size)} onPageChange={setPage} totalItems={312} pageSize={size} onPageSizeChange={setSize} />;
    }
    render(<Demo />);
    expect(screen.getByText("21–40 of 312")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("41–60 of 312")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Page 16" }));
    expect(screen.getByText("301–312 of 312")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
    expect(screen.getByRole("button", { name: "Page 7" })).toBeTruthy();
  });
});

describe("navigation", () => {
  it("collapses long breadcrumb trails and marks the current page", () => {
    render(<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Inventory", href: "/inventory" }, { label: "Hardware", href: "/inventory/hardware" }, { label: "Fasteners", href: "/inventory/hardware/fasteners" }, { label: "Wood screws" }]} maxItems={3} />);
    expect(screen.queryByRole("link", { name: "Inventory" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show full path" }));
    expect(screen.getByRole("link", { name: "Inventory" }).getAttribute("href")).toBe("/inventory");
    expect(screen.getByText("Wood screws").getAttribute("aria-current")).toBe("page");
  });

  it("marks the most specific nav item current, collapses to a rail and opens the drawer", () => {
    expect(isNavItemCurrent({ id: "inv", label: "Inventory", href: "/inventory" }, "/inventory/orders?x=1")).toBe(true);
    expect(isNavItemCurrent({ id: "home", label: "Home", href: "/" }, "/inventory")).toBe(false);
    expect(isNavItemCurrent({ id: "hub", label: "Team", href: "/team", match: ["/schedule"] }, "/schedule/week")).toBe(true);
    const onCollapsedChange = vi.fn();
    render(
      <AppShell
        currentPath="/inventory/orders/42"
        brand="Whitten"
        onCollapsedChange={onCollapsedChange}
        nav={[
          { id: "main", items: [{ id: "home", label: "Home", href: "/" }, { id: "inventory", label: "Inventory", href: "/inventory" }, { id: "orders", label: "Orders", href: "/inventory/orders", badge: 120 }] },
        ]}
      >
        <p>Order 42</p>
      </AppShell>,
    );
    const sidebar = screen.getAllByRole("navigation", { name: "Main" })[0]!;
    expect(within(sidebar).getByRole("link", { name: /Orders/ }).getAttribute("aria-current")).toBe("page");
    expect(within(sidebar).getByRole("link", { name: "Inventory" }).getAttribute("aria-current")).toBeNull();
    expect(within(sidebar).getByText("99+")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = screen.getByRole("dialog");
    fireEvent.click(within(drawer).getByRole("link", { name: "Home" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toMatch(/^#.+-main$/);
  });
});

describe("ResizablePanels", () => {
  it("resizes within limits by keyboard, collapses and restores", () => {
    expect(initialPanelSizes([{ defaultSize: 30 }, {}, {}])).toEqual([30, 35, 35]);
    expect(resizePanels([30, 70], [{ minSize: 20 }, { minSize: 50 }], 0, 40)).toEqual([50, 50]);
    expect(resizePanels([30, 70], [{ minSize: 20 }, {}], 0, -40)).toEqual([20, 80]);
    const onSizesChange = vi.fn();
    render(<ResizablePanels onSizesChange={onSizesChange} panels={[{ id: "files", label: "files", defaultSize: 30, minSize: 15, collapsible: true, children: "Files" }, { id: "editor", children: "Editor" }]} />);
    const separator = screen.getByRole("separator", { name: "Resize files" });
    expect(separator.getAttribute("aria-valuenow")).toBe("30");
    fireEvent.keyDown(separator, { key: "ArrowRight", shiftKey: true });
    expect(separator.getAttribute("aria-valuenow")).toBe("40");
    fireEvent.keyDown(separator, { key: "Enter" });
    expect(separator.getAttribute("aria-valuenow")).toBe("0");
    fireEvent.keyDown(separator, { key: "Enter" });
    expect(separator.getAttribute("aria-valuenow")).toBe("40");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(onSizesChange).toHaveBeenLastCalledWith([0, 100]);
  });
});

describe("shortcuts", () => {
  it("parses and formats shortcuts", () => {
    expect(parseShortcut("mod+shift+k")).toEqual([{ key: "k", mod: true, shift: true, alt: false }]);
    expect(parseShortcut("g i")).toHaveLength(2);
    expect(formatShortcut("mod+k")).toBe("Ctrl+K");
    expect(formatShortcut("mod+k", true)).toBe("⌘K");
    expect(formatShortcut("g i")).toBe("G then I");
    expect(formatShortcut("esc")).toBe("Esc");
  });

  it("fires shortcuts and sequences, skips fields unless allowed, and lists them in help", () => {
    const save = vi.fn();
    const inbox = vi.fn();
    const search = vi.fn();
    function Demo() {
      useShortcuts([
        { id: "save", keys: "mod+s", description: "Save", group: "Editing", handler: save, allowInInputs: true },
        { id: "inbox", keys: "g i", description: "Go to inbox", group: "Navigation", handler: inbox },
        { id: "search", keys: "/", description: "Search", handler: search },
      ]);
      return (
        <>
          <input aria-label="Notes" />
          <ShortcutHelp />
        </>
      );
    }
    render(<Demo />);
    fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
    expect(save).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), { key: "/" });
    expect(search).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), { key: "s", ctrlKey: true });
    expect(save).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document.body, { key: "g" });
    fireEvent.keyDown(document.body, { key: "i" });
    expect(inbox).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("Go to inbox")).toBeTruthy();
    expect(within(dialog).getByText("Show keyboard shortcuts")).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Navigation" })).toBeTruthy();
  });
});

describe("theme", () => {
  it("stores the preference and applies data-theme", () => {
    const { result } = renderHook(() => useTheme({ storageKey: "test-theme" }));
    expect(result.current.preference).toBe("system");
    act(() => result.current.setPreference("dark"));
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("test-theme")).toBe("dark");
    render(<ThemeToggle storageKey="test-theme" />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(result.current.preference).toBe("light");
  });
});

describe("onboarding", () => {
  it("shows progress, actions and a timed dismissal", () => {
    const onAction = vi.fn();
    const tasks = [
      { id: "store", title: "Add your store", done: true },
      { id: "staff", title: "Invite staff", done: false, actionLabel: "Invite", onAction },
    ];
    const { unmount } = render(<OnboardingChecklist tasks={tasks} dismissKey="onboarding" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe("1 of 2 done");
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    expect(onAction).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Hide checklist for now" }));
    expect(screen.queryByRole("progressbar")).toBeNull();
    unmount();
    render(<OnboardingChecklist tasks={tasks} dismissKey="onboarding" />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    window.localStorage.setItem("onboarding", String(Date.now() - 25 * 3600 * 1000));
    render(<OnboardingChecklist tasks={tasks.map((task) => ({ ...task, done: true }))} dismissKey="onboarding" />);
    expect(screen.getByText("You're all set.")).toBeTruthy();
  });

  it("walks through tour steps and finishes", () => {
    const onOpenChange = vi.fn();
    const onFinish = vi.fn();
    render(
      <>
        <button type="button" id="new-order">
          New order
        </button>
        <Tour
          open
          onOpenChange={onOpenChange}
          onFinish={onFinish}
          steps={[
            { id: "a", target: "#new-order", title: "Create orders", content: "Start here." },
            { id: "b", title: "All done", content: "That's the tour." },
          ]}
        />
      </>,
    );
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe("PWA", () => {
  it("detects iOS and offers the browser install prompt", async () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    const onInstalled = vi.fn();
    const { container } = render(<InstallPrompt appName="Whitten" onInstalled={onInstalled} />);
    expect(container.textContent).toBe("");
    const prompt = vi.fn(async () => undefined);
    act(() => {
      window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await vi.waitFor(() => expect(onInstalled).toHaveBeenCalled());
    expect(prompt).toHaveBeenCalled();
  });

  it("blocks updates while there is unsaved work", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<UpdatePrompt needRefresh onRefresh={onRefresh} blocked="Save the price changes first." />);
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Save the price changes first.")).toBeTruthy();
    rerender(<UpdatePrompt needRefresh onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalled();
    rerender(<UpdatePrompt needRefresh={false} offlineReady onRefresh={onRefresh} />);
    expect(screen.getByText("Ready to work offline.")).toBeTruthy();
  });

  it("warns before the session ends and expires once", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 9, 24, 12, 0, 0));
    const onExtend = vi.fn();
    const onExpire = vi.fn();
    render(<SessionTimeoutWarning expiresAt={Date.now() + 6 * 60_000} onExtend={onExtend} onSignOut={vi.fn()} onExpire={onExpire} />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    const dialog = screen.getByRole("alertdialog", { name: "Are you still there?" });
    expect(within(dialog).getByText("4:59")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Stay signed in" }));
    expect(onExtend).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("refreshes after a long enough pull from the top", async () => {
    const onRefresh = vi.fn(async () => undefined);
    render(
      <PullToRefresh onRefresh={onRefresh}>
        <p>Orders</p>
      </PullToRefresh>,
    );
    const area = screen.getByText("Orders").closest('[data-slot="pull-to-refresh"]')!;
    fireEvent.touchStart(area, { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 12, clientY: 100 }] });
    fireEvent.touchEnd(area);
    expect(onRefresh).not.toHaveBeenCalled();
    fireEvent.touchStart(area, { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 12, clientY: 220 }] });
    await act(async () => {
      fireEvent.touchEnd(area);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

function memoryStorage(initial: QueuedAction[] = []): OfflineQueueStorage & { saved: QueuedAction[] } {
  const storage = {
    saved: initial,
    load: async () => storage.saved,
    save: async (actions: QueuedAction[]) => {
      storage.saved = actions;
    },
  };
  return storage;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("OfflineQueueStore", () => {
  it("sends in order when online, parks after repeated failures and never drops", async () => {
    const sent: string[] = [];
    let failing = true;
    const storage = memoryStorage();
    const store = new OfflineQueueStore<{ sku: string }>({
      storage,
      maxAttempts: 2,
      backoffMs: () => 0,
      send: async (action) => {
        if (action.payload.sku === "bad" && failing) throw new Error("Server said no");
        sent.push(action.payload.sku);
      },
    });
    const disconnect = store.connect();
    await store.enqueue("price", { sku: "a" });
    await store.enqueue("price", { sku: "bad" });
    await store.enqueue("price", { sku: "c" });
    for (let index = 0; index < 10; index++) await tick();
    expect(sent).toEqual(["a", "c"]);
    const parked = store.getSnapshot().actions;
    expect(parked).toHaveLength(1);
    expect(parked[0]).toMatchObject({ status: "parked", attempts: 2, lastError: "Server said no" });
    expect(storage.saved).toHaveLength(1);
    failing = false;
    store.retry(parked[0]!.id);
    for (let index = 0; index < 5; index++) await tick();
    expect(sent).toEqual(["a", "c", "bad"]);
    expect(store.getSnapshot().actions).toHaveLength(0);
    disconnect();
  });

  it("waits while offline and restores interrupted sends", async () => {
    const storage = memoryStorage([{ id: "1", type: "count", payload: { n: 1 }, createdAt: 1, attempts: 0, status: "sending" }]);
    const send = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const store = new OfflineQueueStore({ storage, send });
    const disconnect = store.connect();
    await tick();
    expect(store.getSnapshot().actions[0]!.status).toBe("pending");
    expect(send).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    for (let index = 0; index < 5; index++) await tick();
    expect(send).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it("lists parked actions with retry and discard", () => {
    const onDiscard = vi.fn();
    render(<OfflineQueuePanel online={false} onDiscard={onDiscard} onRetry={vi.fn()} describe={(action) => `Update ${String((action.payload as { sku: string }).sku)}`} actions={[{ id: "1", type: "price", payload: { sku: "HM-1601" }, createdAt: Date.now(), attempts: 5, status: "parked", lastError: "Price is locked" }, { id: "2", type: "price", payload: { sku: "SW-1502" }, createdAt: Date.now(), attempts: 0, status: "pending" }]} />);
    expect(screen.getByRole("status").textContent).toBe("1 change needs attention");
    expect(screen.getByText("Stopped after 5 tries: Price is locked")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard Update HM-1601" }));
    expect(onDiscard).toHaveBeenCalledWith("1");
  });
});

describe("dashboards", () => {
  it("computes trends and labels direction for screen readers", () => {
    expect(computeTrend(0, 0)).toEqual({ direction: "flat", percent: 0 });
    expect(computeTrend(50, 0)).toEqual({ direction: "up", percent: 100 });
    expect(computeTrend(80, 100)).toEqual({ direction: "down", percent: -20 });
    render(<TrendIndicator current={120} previous={100} reverseColors comparisonLabel="vs last week" />);
    expect(screen.getByText("Up 20% vs last week")).toBeTruthy();
    render(<TrendIndicator current={5} previous={5} />);
    expect(screen.getByText("No change from the previous period")).toBeTruthy();
    render(<TrendIndicator current={1250} previous={1000} format="currency" locale="en-US" />);
    expect(screen.getByText("+$250.00")).toBeTruthy();
  });

  it("renders sparklines, linked stat tiles and gauges", () => {
    render(<Sparkline values={[12, 9, 20, 18]} />);
    expect(screen.getByRole("img", { name: "Trend from 12 to 18, high 20, low 9" })).toBeTruthy();
    render(<StatTile label="Sales today" value="$4,210" current={4210} previous={3900} href="/reports/sales" />);
    expect(screen.getByRole("link", { name: /Sales today/ }).getAttribute("href")).toBe("/reports/sales");
    render(<Gauge label="Disk used" value={92} warning={75} danger={90} formatValue={(value) => `${value}%`} />);
    const meter = screen.getByRole("meter", { name: "Disk used" });
    expect(meter.getAttribute("aria-valuetext")).toBe("92%, danger");
    expect(meter.dataset.level).toBe("danger");
  });
});

describe("PermissionMatrix", () => {
  const roles = [
    { id: "owner", name: "Owner", locked: true },
    { id: "manager", name: "Manager" },
    { id: "clerk", name: "Clerk" },
  ];
  const permissions = [
    { key: "inventory.view", label: "View inventory", category: "Inventory" },
    { key: "inventory.adjust", label: "Adjust stock", category: "Inventory" },
    { key: "cash.count", label: "Count drawers", category: "Cash" },
  ];

  it("grants categories, filters, counts changes and keeps locked roles fixed", () => {
    function Demo() {
      const [grants, setGrants] = useState<PermissionGrants>({ manager: ["inventory.view"], clerk: [] });
      return <PermissionMatrix roles={roles} permissions={permissions} grants={grants} onGrantsChange={setGrants} baseline={{ manager: ["inventory.view"], clerk: [] }} />;
    }
    render(<Demo />);
    expect(screen.getByRole("checkbox", { name: "View inventory for Owner" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("checkbox", { name: "View inventory for Owner" })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("checkbox", { name: "All Inventory permissions for Clerk, 0 of 2" }));
    expect(screen.getByRole("checkbox", { name: "Adjust stock for Clerk (changed)" })).toHaveProperty("checked", true);
    expect(screen.getByText("2 unsaved changes")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search permissions" }), { target: { value: "drawer" } });
    expect(screen.queryByRole("checkbox", { name: /View inventory for Manager/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Count drawers for Manager" })).toBeTruthy();
    expect(countGrantChanges({ a: ["x", "y"] }, { a: ["y", "z"] })).toBe(2);
  });
});

describe("barcode scanning", () => {
  it("turns fast keystrokes ending in Enter into one scan and strips leaked characters", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(1_000_000);
    const onScan = vi.fn();
    function Demo() {
      const [value, setValue] = useState("");
      useBarcodeScanner({ onScan });
      return <input aria-label="Search" value={value} onChange={(event) => setValue(event.target.value)} />;
    }
    render(<Demo />);
    const field = screen.getByRole("textbox", { name: "Search" }) as HTMLInputElement;
    const type = (text: string, gap: number) => {
      for (const key of text) {
        vi.setSystemTime(Date.now() + gap);
        fireEvent.keyDown(field, { key });
        fireEvent.change(field, { target: { value: field.value + key } });
      }
    };
    type("012345678905", 10);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onScan).toHaveBeenCalledWith("012345678905");
    expect(field.value).toBe("");
    fireEvent.keyDown(field, { key: "Enter" });
    type("012345678905", 10);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onScan).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 1000);
    fireEvent.change(field, { target: { value: "" } });
    type("hammer", 200);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(field.value).toBe("hammer");
  });

  it("never treats typing in a textarea or editor as a scan", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
    const onScan = vi.fn();
    function Demo() {
      useBarcodeScanner({ onScan });
      return <textarea aria-label="Notes" />;
    }
    render(<Demo />);
    const notes = screen.getByRole("textbox", { name: "Notes" });
    for (const key of "012345678905") {
      vi.setSystemTime(Date.now() + 5);
      fireEvent.keyDown(notes, { key });
    }
    const enter = fireEvent.keyDown(notes, { key: "Enter" });
    expect(enter).toBe(true);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("explains camera errors and falls back to typed entry", () => {
    expect(cameraErrorMessage(new DOMException("denied", "NotAllowedError"))).toMatch(/blocked/);
    expect(cameraErrorMessage(new DOMException("busy", "NotReadableError"))).toMatch(/in use/);
    const onDetect = vi.fn();
    render(<BarcodeScanner onDetect={onDetect} />);
    expect(screen.getByText(/can't scan with the camera/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Barcode or SKU"), { target: { value: " 041234567890 " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onDetect).toHaveBeenCalledWith("041234567890", "manual");
    expect(screen.getByRole("status").textContent).toBe("Scanned 041234567890");
  });
});

describe("CashCount", () => {
  it("totals in cents, flags invalid entries and variances", () => {
    expect(cashCountTotal({ "20": "3", "roll-quarters": "1", "coin-penny": "7", "5": "" })).toEqual({ totalCents: 7007, invalid: [] });
    expect(cashCountTotal({ "1": "2.5" }).invalid).toEqual(["1"]);
    const onSubmit = vi.fn();
    render(<CashCount expectedCents={20_000} onSubmit={onSubmit} locale="en-US" />);
    fireEvent.change(screen.getByLabelText("$100"), { target: { value: "2" } });
    expect(screen.getByText("Drawer balances.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Quarter"), { target: { value: "-3" } });
    expect(screen.getByText("Enter a whole number.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit count" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Quarter"), { target: { value: "30" } });
    expect(screen.getByText("Over $7.50")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Over by more than $5.00");
    fireEvent.click(screen.getByRole("button", { name: "Submit count" }));
    expect(onSubmit).toHaveBeenCalledWith({ totalCents: 20_750, varianceCents: 750, counts: { "100": "2", "coin-quarter": "30" } });
  });
});
