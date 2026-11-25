// packages/ai-ui/test/feedback.test.tsx
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Banner,
  ConfirmDialog,
  ConnectionStatus,
  ConversationMarker,
  createToastManager,
  DeferredSurface,
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
  InputCounter,
  PresenceAvatars,
  SaveStatus,
  StatusPill,
  SurfaceState,
  SyncStatus,
  ThinkingIndicator,
  Toaster,
  useOnlineStatus,
  useStreamBuffer,
  useToast,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe("format helpers", () => {
  it("formats relative times, durations and compact numbers", () => {
    const now = new Date("2026-01-01T12:00:00Z").getTime();
    expect(formatRelativeTime(now - 10_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(formatRelativeTime(now + 2 * 3600_000, now)).toBe("in 2 hours");
    expect(formatDuration(8_400)).toBe("8s");
    expect(formatDuration(65_000)).toBe("1m 05s");
    expect(formatDuration(2 * 3600_000 + 3 * 60_000)).toBe("2h 03m");
    expect(formatCompactNumber(1200, "en")).toBe("1.2K");
  });
});

describe("ConfirmDialog", () => {
  it("focuses Cancel first and closes after a synchronous confirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog trigger={<button type="button">Delete chat</button>} title="Delete this chat?" tone="destructive" confirmLabel="Delete" onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete chat" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this chat?" });
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(dialog.isConnected).toBe(false));
  });

  it("stays open with an error when an async confirm rejects", async () => {
    render(<ConfirmDialog defaultOpen title="Roll back?" onConfirm={() => Promise.reject(new Error("conflict"))} />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe("conflict");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("prefers an explicit errorMessage and falls back to a generic message for errors without one", async () => {
    const { unmount } = render(<ConfirmDialog defaultOpen title="Roll back?" errorMessage="The rollback could not start." onConfirm={() => Promise.reject(new Error("conflict"))} />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The rollback could not start.");
    unmount();
    render(<ConfirmDialog defaultOpen title="Roll back?" onConfirm={() => { throw "offline"; }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe("That did not work. Try again.");
  });
});

describe("Banner", () => {
  it("announces danger, shows actions and remembers a keyed dismissal", () => {
    const { unmount } = render(
      <Banner tone="danger" title="Preview failed" dismissKey="compat" actions={<button type="button">Open in new tab</button>}>
        The sandbox could not start.
      </Banner>,
    );
    expect(screen.getByRole("alert").textContent).toContain("The sandbox could not start.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();
    render(<Banner tone="danger" dismissKey="compat">Again</Banner>);
    expect(screen.queryByText("Again")).toBeNull();
  });
});

describe("Toaster", () => {
  function Harness({ onCommit }: { onCommit: () => void }) {
    const { toast, undoable } = useToast();
    return (
      <>
        <button type="button" onClick={() => toast({ title: "Saved", description: "Draft stored", tone: "success" })}>
          Notify
        </button>
        <button type="button" onClick={() => undoable({ title: "Chat deleted", onCommit })}>
          Delete
        </button>
      </>
    );
  }

  it("shows toasts and commits an undoable action only when it closes without Undo", async () => {
    const onCommit = vi.fn();
    render(
      <Toaster>
        <Harness onCommit={onCommit} />
      </Toaster>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(await screen.findByText("Draft stored")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await vi.waitFor(() => expect(screen.queryByText("Chat deleted")).toBeNull());
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const toastElement = (await screen.findByText("Chat deleted")).closest<HTMLElement>("[data-tone]")!;
    fireEvent.click(within(toastElement).getByRole("button", { name: "Dismiss notification" }));
    await vi.waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
  });
});

describe("Toaster keyboard and timers", () => {
  it("dismisses the focused toast with Escape, jumps in with F6 and pauses while hovered", async () => {
    vi.useFakeTimers();
    const manager = createToastManager();
    render(<Toaster manager={manager} />);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    act(() => {
      manager.toast({ title: "Saved", timeout: 1000 });
      manager.toast({ title: "Rate limited", tone: "danger", timeout: 0 });
    });
    expect(screen.getByRole("alert").textContent).toContain("Rate limited");
    const region = screen.getByRole("region", { name: "Notifications" });
    fireEvent.pointerEnter(region);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    fireEvent.pointerLeave(region);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Saved")).toBeNull();
    fireEvent.keyDown(window, { key: "F6" });
    expect(document.activeElement).toBe(screen.getByRole("alert"));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByText("Rate limited")).toBeNull();
  });
});

describe("SurfaceState", () => {
  it("renders each kind and keeps stale content under a refresh error", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<SurfaceState kind="no-results" />);
    expect(screen.getByRole("status").textContent).toContain("No matches");
    rerender(<SurfaceState kind="error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    rerender(
      <SurfaceState kind="error" onRetry={onRetry}>
        <p>Old rows</p>
      </SurfaceState>,
    );
    expect(screen.getByText("Old rows")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Could not refresh");
    rerender(
      <SurfaceState kind="loading">
        <p>Old rows</p>
      </SurfaceState>,
    );
    expect(screen.getByText("Old rows").parentElement?.getAttribute("aria-busy")).toBe("true");
  });

  it("recovers a failed lazy panel with Try again", () => {
    let fail = true;
    function Flaky() {
      if (fail) throw new Error("chunk");
      return <p>Loaded panel</p>;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <DeferredSurface>
        <Flaky />
      </DeferredSurface>,
    );
    expect(screen.getByRole("alert").textContent).toContain("This panel could not load");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Loaded panel")).toBeTruthy();
    spy.mockRestore();
  });
});

describe("status indicators", () => {
  it("labels pills, sync, save and connection states", () => {
    vi.useFakeTimers();
    const now = Date.now();
    render(
      <>
        <StatusPill tone="success" live>
          Generating
        </StatusPill>
        <SyncStatus state="offline" pending={3} stuck={1} onSync={() => undefined} />
        <SaveStatus state="local" />
        <ConnectionStatus state="reconnecting" retryAt={now + 4000} attempt={2} onRetry={() => undefined} />
        <ConnectionStatus state="connected" />
      </>,
    );
    const statuses = screen.getAllByRole("status").map((element) => element.textContent);
    expect(statuses).toContain("Generating");
    expect(statuses.some((text) => text?.includes("Offline · 3 queued (1 stuck)"))).toBe(true);
    expect(statuses).toContain("Changes kept on this device");
    expect(statuses.some((text) => text?.includes("retrying in 4s (attempt 2)"))).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/retrying in 2s/)).toBeTruthy();
    expect(screen.queryByText("Connected")).toBeNull();
  });

  it("rotates thinking phrases while announcing only the first", () => {
    vi.useFakeTimers();
    render(<ThinkingIndicator phrases={["Thinking", "Searching"]} intervalMs={1000} />);
    expect(screen.getByRole("status").textContent).toBe("Thinking");
    expect(screen.getByText("Thinking…")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Searching…")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Thinking");
  });

  it("collapses extra people and marks thread events", () => {
    render(
      <>
        <PresenceAvatars
          users={[
            { id: "1", name: "Ada Lovelace", activity: "editing" },
            { id: "2", name: "Grace Hopper" },
            { id: "3", name: "Alan Turing" },
          ]}
          max={2}
        />
        <ConversationMarker>Switched to Marifai Deep</ConversationMarker>
      </>,
    );
    expect(screen.getByRole("img", { name: "Ada Lovelace, editing" }).textContent).toBe("AL");
    expect(screen.getByRole("img", { name: "1 more: Alan Turing" }).textContent).toBe("+1");
    expect(screen.getByRole("note").textContent).toBe("Switched to Marifai Deep");
  });

  it("counts characters or words and flags the limit", () => {
    const { rerender } = render(<InputCounter value="hello" max={10} />);
    expect(screen.getByText(/5 \/ 10/).getAttribute("data-state")).toBe("ok");
    rerender(<InputCounter value="one two three" max={2} unit="words" />);
    const counter = screen.getByText(/3 \/ 2/);
    expect(counter.getAttribute("data-state")).toBe("over");
    expect(counter.textContent).toContain("1 over the limit");
  });
});

describe("streaming hooks", () => {
  it("coalesces chunks per frame and drops replays", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const onFlush = vi.fn();
    const { result } = renderHook(() => useStreamBuffer<string>({ onFlush }));
    act(() => {
      result.current.push("a", 1);
      result.current.push("b", 2);
      result.current.push("b", 2);
      result.current.push("x", 1);
    });
    expect(frames).toHaveLength(1);
    act(() => frames[0]!(0));
    expect(onFlush).toHaveBeenCalledWith(["a", "b"]);
    act(() => {
      result.current.push("c", 3);
      result.current.flush();
    });
    expect(onFlush).toHaveBeenLastCalledWith(["c"]);
    vi.restoreAllMocks();
  });

  it("tracks online status", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);
    spy.mockRestore();
  });
});

describe("ConfirmDialog controlled", () => {
  it("works as a controlled dialog", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <span>{open ? "open" : "closed"}</span>
          <ConfirmDialog open={open} onOpenChange={setOpen} title="Reset workspace?" onConfirm={() => undefined} />
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(screen.getByText("closed")).toBeTruthy());
  });
});
