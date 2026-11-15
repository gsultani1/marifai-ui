// packages/ai-ui/test/preview.test.tsx
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  advanceDeployment,
  applyHunkSelection,
  ArtifactCard,
  ArtifactViewer,
  ChangeReview,
  createProjectPreview,
  createPythonPreview,
  createSvgPreview,
  DeploymentStatus,
  type DeploymentStep,
  describeInspectedElement,
  diffHunks,
  DiffReview,
  estimateRemaining,
  ExportProgress,
  formatAnchor,
  ImageCompare,
  InlineEdit,
  type InspectedElement,
  inspectedElementToContext,
  InteractivePreview,
  maskSecretHint,
  parseUnifiedDiff,
  PREVIEW_INSPECTOR_SCRIPT,
  PreviewErrorBanner,
  readinessDelay,
  readInspectorMessage,
  RegionCapture,
  regionFromPoints,
  regionToFrameRect,
  resolvePreviewAddress,
  resolveTrackedChanges,
  ReviewComments,
  type ReviewThread,
  scriptDataUrl,
  SecretField,
  SelectedElementChip,
  ShareButton,
  shareOrCopy,
  sortThreads,
  TrackedChanges,
  trackedSegments,
  useAutoFix,
  useUrlReadiness,
  VersionHistory,
  WebPreview,
} from "../src/index.js";

const PATCH = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a };
diff --git a/old.txt b/new.txt
rename from old.txt
rename to new.txt
diff --git a/README.md b/README.md
new file mode 100644
--- /dev/null
+++ b/README.md
@@ -0,0 +1,2 @@
+# Title
+Body
diff --git a/gone.js b/gone.js
deleted file mode 100644
--- a/gone.js
+++ /dev/null
@@ -1 +0,0 @@
-console.log("bye");
`;

const OLD_TEXT = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"].join("\n") + "\n";
const NEW_TEXT = ["ONE", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "TWELVE", "thirteen"].join("\n") + "\n";

const ELEMENT: InspectedElement = {
  tagName: "button",
  id: "save",
  classes: ["primary", "large"],
  text: "Save changes to this document now",
  selector: "main > form > button#save",
  html: '<button id="save" class="primary large">Save changes to this document now</button>',
  rect: { x: 10, y: 20, width: 120, height: 36 },
  attributes: { type: "submit" },
  path: "/settings",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("patches", () => {
  it("parses a unified diff into files with status, renames and counts", () => {
    const files = parseUnifiedDiff(PATCH);
    expect(files.map((file) => [file.path, file.status, file.additions, file.deletions])).toEqual([
      ["src/app.ts", "modified", 2, 1],
      ["new.txt", "renamed", 0, 0],
      ["README.md", "added", 2, 0],
      ["gone.js", "deleted", 0, 1],
    ]);
    expect(files[1]!.oldPath).toBe("old.txt");
  });

  it("applies any selection of hunks, keeping the final newline", () => {
    const hunks = diffHunks(OLD_TEXT, NEW_TEXT, 1);
    expect(hunks).toHaveLength(2);
    expect(applyHunkSelection(OLD_TEXT, hunks, [true, true])).toBe(NEW_TEXT);
    expect(applyHunkSelection(OLD_TEXT, hunks, [false, false])).toBe(OLD_TEXT);
    expect(applyHunkSelection(OLD_TEXT, hunks, [true, false])).toBe(OLD_TEXT.replace("one", "ONE"));
    const noNewline = diffHunks("a\nb", "a\nc", 1);
    expect(applyHunkSelection("a\nb", noNewline, [true])).toBe("a\nc");
    expect(applyHunkSelection("", diffHunks("", "x\n"), [true])).toBe("x\n");
  });

  it("reviews files: summary, collapse, open and revert with confirmation", async () => {
    const onOpen = vi.fn();
    const onRevert = vi.fn();
    render(<DiffReview patch={PATCH} onOpen={onOpen} onRevert={onRevert} collapseAbove={2} />);
    expect(screen.getByText("4 files changed")).toBeTruthy();
    expect(screen.getByText(/\(4 lines added, 2 removed\)/)).toBeTruthy();
    const app = screen.getByRole("region", { name: "src/app.ts" });
    expect(within(app).getByText("Large change collapsed. Expand to review.")).toBeTruthy();
    fireEvent.click(within(app).getByRole("button", { expanded: false }));
    expect(within(app).getAllByText("Added:")).toHaveLength(2);
    expect(within(screen.getByRole("region", { name: "new.txt" })).getByText("Renamed without changes.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "gone.js" })).queryByRole("button", { name: "Open gone.js" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open README.md" }));
    expect(onOpen).toHaveBeenCalledWith("README.md");
    fireEvent.click(screen.getByRole("button", { name: "Revert README.md" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("The new file will be removed.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Revert" }));
    await waitFor(() => expect(onRevert).toHaveBeenCalledWith(expect.objectContaining({ path: "README.md" })));
  });

  it("applies only the accepted changes in ChangeReview", () => {
    const onApply = vi.fn();
    render(<ChangeReview oldValue={OLD_TEXT} newValue={NEW_TEXT} context={1} fileName="list.txt" onApply={onApply} />);
    expect(screen.getByText("2 of 2 accepted")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    expect(screen.getByText("Rejected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 of 2 changes" }));
    expect(onApply).toHaveBeenCalledWith(OLD_TEXT.replace("one", "ONE"), 1, 2);
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply all changes" }));
    expect(onApply).toHaveBeenLastCalledWith(NEW_TEXT, 2, 2);
  });
});

describe("tracked changes", () => {
  it("joins replacements and resolves decisions", () => {
    const segments = trackedSegments("The quick brown fox", "The slow brown fox jumps");
    const changes = segments.filter((segment) => segment.type === "change");
    expect(changes).toEqual([
      { type: "change", id: 0, removed: "quick", added: "slow" },
      { type: "change", id: 1, removed: "", added: " jumps" },
    ]);
    expect(resolveTrackedChanges(segments, { 0: "reject" })).toBe("The quick brown fox jumps");
    expect(resolveTrackedChanges(segments, {}, "reject")).toBe("The quick brown fox");
  });

  it("accepts and rejects suggestions one by one and finishes", () => {
    const onResolve = vi.fn();
    render(<TrackedChanges original="Ship it Friday." revised="Ship it Monday morning." author="Marifai" onResolve={onResolve} />);
    expect(screen.getByRole("heading", { name: "Marifai edits" })).toBeTruthy();
    const reject = screen.getAllByRole("button", { name: /^Reject change/ });
    fireEvent.click(reject[0]!);
    expect(screen.getByRole("status").textContent).toMatch(/of .* to review|All changes reviewed/);
    fireEvent.click(screen.getByRole("button", { name: /^Finish/ }));
    expect(onResolve).toHaveBeenCalledWith(resolveTrackedChanges(trackedSegments("Ship it Friday.", "Ship it Monday morning."), { 0: "reject" }));
  });
});

describe("ImageCompare and DeploymentStatus", () => {
  it("moves the divider from the keyboard and switches modes", () => {
    render(<ImageCompare before={{ src: "a.png", alt: "Old header" }} after={{ src: "b.png", alt: "New header" }} />);
    const slider = screen.getByRole("slider", { name: "Divider between before and after" });
    fireEvent.change(slider, { target: { value: "70" } });
    expect(slider.getAttribute("aria-valuetext")).toBe("70% before");
    fireEvent.click(screen.getByRole("radio", { name: "Overlay" }));
    expect(screen.getByRole("slider", { name: /Fade between before and after/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Side by side" }));
    expect(screen.getByText("Before")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("advances steps and shows the live card with actions", () => {
    const steps: DeploymentStep[] = [
      { id: "build", label: "Build", status: "pending" },
      { id: "upload", label: "Upload", status: "pending" },
    ];
    const started = advanceDeployment(steps, 1000);
    expect(started.map((step) => step.status)).toEqual(["running", "pending"]);
    const next = advanceDeployment(started, 4000);
    expect(next.map((step) => step.status)).toEqual(["complete", "running"]);
    expect(next[0]!.finishedAt).toBe(4000);
    const onRollback = vi.fn();
    const onDeploy = vi.fn();
    render(<DeploymentStatus state="live" environment="Production" url="https://shop.example.com" deployedAt={Date.now()} steps={advanceDeployment(next, 5000)} onRollback={onRollback} onDeploy={onDeploy} />);
    expect(screen.getByRole("heading", { name: "Production deployment" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "shop.example.com" }).getAttribute("href")).toBe("https://shop.example.com/");
    fireEvent.click(screen.getByRole("button", { name: "Roll back" }));
    fireEvent.click(screen.getByRole("button", { name: "Redeploy" }));
    expect(onRollback).toHaveBeenCalled();
    expect(onDeploy).toHaveBeenCalled();
  });
});

describe("SecretField, sharing and exports", () => {
  it("validates, saves and never shows a saved key", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Key rejected by provider")).mockResolvedValue(undefined);
    const { rerender } = render(<SecretField label="OpenAI key" source="none" validate={(value) => (value.startsWith("sk-") ? null : "Keys start with sk-.")} onSave={onSave} />);
    const input = screen.getByLabelText("OpenAI key");
    expect(input.getAttribute("type")).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show key" }));
    expect(input.getAttribute("type")).toBe("text");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toBe("Keys start with sk-.");
    fireEvent.change(input, { target: { value: "sk-test-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Key rejected by provider");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith("sk-test-1234"));
    rerender(<SecretField label="OpenAI key" source="saved" hint={maskSecretHint("sk-test-1234")} onSave={onSave} />);
    expect(screen.getByText("Saved (…1234)")).toBeTruthy();
    expect(screen.queryByDisplayValue("sk-test-1234")).toBeNull();
    expect(maskSecretHint("abc")).toBe("•••");
  });

  it("shares through the system sheet, reports cancel and falls back to copying", async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new DOMException("Canceled", "AbortError"));
    vi.stubGlobal("navigator", { ...navigator, share, canShare: () => true, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    expect(await shareOrCopy({ title: "Report", url: "https://example.com/r/1" })).toBe("shared");
    expect(await shareOrCopy({ url: "https://example.com/r/1" })).toBe("cancelled");
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    expect(await shareOrCopy({ text: "hello", url: "https://example.com/r/2" })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://example.com/r/2");
    render(<ShareButton content={{ url: "https://example.com/r/3" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeTruthy();
  });

  it("shows export progress, an estimate, then download or retry", () => {
    expect(estimateRemaining(0.5, 10_000)).toBe(10_000);
    expect(estimateRemaining(0.01, 10_000)).toBeUndefined();
    const onCancel = vi.fn();
    const { rerender } = render(<ExportProgress format="PDF" fileName="q3-report.pdf" status="exporting" progress={0.42} stage="Rendering page 5 of 12" onCancel={onCancel} />);
    expect(screen.getByRole("heading", { name: "Exporting q3-report.pdf" })).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Exporting q3-report.pdf" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    const onDownload = vi.fn();
    rerender(<ExportProgress format="PDF" fileName="q3-report.pdf" status="ready" size={204_800} onDownload={onDownload} />);
    expect(screen.getByText("PDF · 200 KB")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownload).toHaveBeenCalled();
    const onRetry = vi.fn();
    rerender(<ExportProgress format="PDF" status="failed" error="The renderer ran out of memory." onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toBe("The renderer ran out of memory.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("versions and artifact cards", () => {
  it("restores in two steps with focus on the confirmation", async () => {
    const onRestore = vi.fn().mockRejectedValueOnce(new Error("Version is locked")).mockResolvedValue(undefined);
    render(
      <VersionHistory
        currentId="v3"
        onRestore={onRestore}
        versions={[
          { id: "v3", label: "v3", message: "Add pricing table", author: "Marifai", additions: 40, deletions: 2 },
          { id: "v2", label: "v2", message: "Hero copy" },
          { id: "v1", label: "v1" },
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Restore v3" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore v2" }));
    const confirm = screen.getByRole("group", { name: "Confirm restoring v2" });
    await waitFor(() => expect(document.activeElement).toBe(within(confirm).getByRole("button", { name: "Restore v2" })));
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Restore v2" })));
    expect(onRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restore v1" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm restoring v1" })).getByRole("button", { name: "Restore v1" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Version is locked");
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm restoring v1" })).getByRole("button", { name: "Restore v1" }));
    await waitFor(() => expect(screen.queryByRole("group", { name: "Confirm restoring v1" })).toBeNull());
    expect(onRestore).toHaveBeenCalledTimes(2);
  });

  it("shows building and failed states on the inline card", () => {
    const onClick = vi.fn();
    const { rerender } = render(<ArtifactCard title="Pricing page" kind="html" status="building" onClick={onClick} />);
    expect(screen.getByRole("button", { name: /^Pricing page ?, Building…$/ })).toBeTruthy();
    rerender(<ArtifactCard title="Pricing page" kind="html" version={3} active onClick={onClick} />);
    const card = screen.getByRole("button", { name: /^Pricing page ?, Web page · Version 3$/ });
    expect(card.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });
});

describe("preview errors and auto-fix", () => {
  it("expands error details and hands errors to Fix it", () => {
    const onFix = vi.fn();
    render(<PreviewErrorBanner errors={["TypeError: x is undefined\n    at App (App.tsx:4)"]} onFix={onFix} note="Auto-fix attempt 1 of 3." />);
    expect(screen.getByText("The preview hit an error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByLabelText("Error details").textContent).toContain("at App (App.tsx:4)");
    fireEvent.click(screen.getByRole("button", { name: "Fix it" }));
    expect(onFix).toHaveBeenCalledWith(["TypeError: x is undefined\n    at App (App.tsx:4)"]);
  });

  it("requests one fix per set of errors after they settle, stopping at the limit", () => {
    vi.useFakeTimers();
    const onFix = vi.fn();
    const { result, rerender } = renderHook((props: { errors: string[]; busy?: boolean }) => useAutoFix({ errors: props.errors, onFix, maxAttempts: 2, delayMs: 1000, busy: props.busy ?? false }), { initialProps: { errors: ["A"] } as { errors: string[]; busy?: boolean } });
    expect(result.current.scheduled).toBe(true);
    act(() => vi.advanceTimersByTime(999));
    expect(onFix).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFix).toHaveBeenCalledWith(["A"]);
    act(() => vi.advanceTimersByTime(5000));
    expect(onFix).toHaveBeenCalledTimes(1);
    rerender({ errors: [], busy: true });
    rerender({ errors: ["A"], busy: true });
    act(() => vi.advanceTimersByTime(5000));
    expect(onFix).toHaveBeenCalledTimes(1);
    rerender({ errors: ["A"], busy: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(onFix).toHaveBeenCalledTimes(2);
    rerender({ errors: [] });
    rerender({ errors: ["B"] });
    act(() => vi.advanceTimersByTime(5000));
    expect(onFix).toHaveBeenCalledTimes(2);
    expect(result.current.exhausted).toBe(true);
    act(() => result.current.reset());
    act(() => vi.advanceTimersByTime(1000));
    expect(onFix).toHaveBeenLastCalledWith(["B"]);
  });

  it("auto-fixes from ArtifactViewer when runtime errors arrive", () => {
    vi.useFakeTimers();
    const onFix = vi.fn();
    render(<ArtifactViewer title="Broken page" kind="html" content="<p>hi</p>" onFix={onFix} autoFix />);
    const frame = document.querySelector("iframe")!;
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { source: "ai-ui-preview", type: "error", message: "ReferenceError: foo" }, source: frame.contentWindow }));
    });
    expect(screen.getByText("ReferenceError: foo")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1500));
    expect(onFix).toHaveBeenCalledWith(["ReferenceError: foo"]);
    expect(screen.getByText("Auto-fix attempt 1 of 3.")).toBeTruthy();
  });
});

describe("URL readiness", () => {
  it("backs off between checks and reports ready", async () => {
    expect([1, 2, 3, 4, 9].map((attempt) => readinessDelay(attempt, 500, 4000))).toEqual([0, 500, 1000, 2000, 4000]);
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useUrlReadiness("http://localhost:5173", { initialDelayMs: 10 }));
    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:5173", expect.objectContaining({ method: "HEAD", mode: "no-cors" }));
  });

  it("fails after the last attempt and retries on request", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useUrlReadiness("http://localhost:3000", { maxAttempts: 2, initialDelayMs: 5 }));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    fetchMock.mockResolvedValue(new Response(null));
    act(() => result.current.retry());
    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});

describe("element inspector", () => {
  it("validates messages and turns a selection into context", () => {
    expect(readInspectorMessage({ source: "ai-ui-preview", type: "inspect", element: { ...ELEMENT, tagName: "<script>" } })).toBeNull();
    expect(readInspectorMessage({ source: "elsewhere", type: "inspect", element: ELEMENT })).toBeNull();
    const message = readInspectorMessage({ source: "ai-ui-preview", type: "inspect", element: { ...ELEMENT, text: "x".repeat(500), attributes: { "bad name": "x", href: "/a" } } });
    expect(message?.type).toBe("inspect");
    if (message?.type !== "inspect") return;
    expect(message.element.text).toHaveLength(300);
    expect(message.element.attributes).toEqual({ href: "/a" });
    expect(inspectedElementToContext(ELEMENT)).toEqual({ id: "element:/settings:main > form > button#save", label: "<button#save.primary>", kind: "element", detail: '"Save changes to this doc…"', title: "main > form > button#save on /settings" });
    expect(describeInspectedElement(ELEMENT)).toContain("Selector: main > form > button#save");
    const onRemove = vi.fn();
    render(<SelectedElementChip element={ELEMENT} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: 'Remove <button#save.primary> "Save changes to this doc…"' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("adds the inspector to html previews and reports a picked element once", () => {
    const onInspect = vi.fn();
    render(<InteractivePreview title="App" html="<button>Go</button>" allowScripts onInspect={onInspect} />);
    const frame = screen.getByTitle("App") as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toContain(PREVIEW_INSPECTOR_SCRIPT);
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    const toggle = screen.getByRole("button", { name: "Select an element" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(post).toHaveBeenLastCalledWith({ source: "ai-ui-host", type: "inspect", enabled: true }, "*");
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { source: "ai-ui-preview", type: "inspect", element: ELEMENT }, source: frame.contentWindow }));
    });
    expect(onInspect).toHaveBeenCalledWith(ELEMENT);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data: { source: "ai-ui-preview", type: "inspect", element: ELEMENT }, source: frame.contentWindow }));
    });
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it("leaves the inspector out without onInspect or scripts", () => {
    render(<InteractivePreview title="Static" html="<p>x</p>" allowScripts={false} onInspect={() => undefined} />);
    expect(screen.getByTitle("Static").getAttribute("srcdoc")).not.toContain("inspector-ready");
    expect(screen.queryByRole("button", { name: "Select an element" })).toBeNull();
  });
});

describe("WebPreview", () => {
  const servers = [
    { id: "web", url: "http://localhost:5173", label: "Vite :5173" },
    { id: "docs", url: "http://localhost:3000" },
  ];

  it("resolves typed addresses only to configured servers", () => {
    expect(resolvePreviewAddress("about", servers, "web")).toEqual({ serverId: "web", path: "/about" });
    expect(resolvePreviewAddress("http://localhost:3000/guide?x=1#top", servers, "web")).toEqual({ serverId: "docs", path: "/guide?x=1#top" });
    expect(resolvePreviewAddress("https://evil.example/", servers, "web")).toBeNull();
    expect(resolvePreviewAddress("javascript:alert(1)", servers, "web")).toBeNull();
  });

  it("navigates, switches servers, picks devices and resizes from the keyboard", () => {
    render(<WebPreview title="Shop" servers={servers} />);
    const frame = () => screen.getByTitle("Shop");
    expect(frame().getAttribute("src")).toBe("http://localhost:5173/");
    const address = screen.getByRole("textbox", { name: "Address" });
    fireEvent.change(address, { target: { value: "/cart" } });
    fireEvent.submit(address.closest("form")!);
    expect(frame().getAttribute("src")).toBe("http://localhost:5173/cart");
    fireEvent.change(address, { target: { value: "https://evil.example/" } });
    fireEvent.submit(address.closest("form")!);
    expect(screen.getByRole("alert").textContent).toBe("Only addresses on Vite :5173, localhost:3000 open here.");
    fireEvent.change(screen.getByRole("combobox", { name: "Server" }), { target: { value: "docs" } });
    expect(frame().getAttribute("src")).toBe("http://localhost:3000/cart");
    const width = screen.getByRole("separator", { name: "Preview width" });
    fireEvent.keyDown(width, { key: "Home" });
    expect(width.getAttribute("aria-valuenow")).toBe("200");
    expect(screen.getByText("200 × 200")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fill" }));
    expect(screen.queryByRole("button", { name: "Fill" })).toBeNull();
    expect(screen.getByRole("button", { name: "Landscape" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("combobox", { name: "Device" }), { target: { value: "iphone-15" } });
    expect(screen.getByText("393 × 852")).toBeTruthy();
    expect(document.querySelector("[data-slot=web-preview-device]")?.className).toContain("bg-foreground");
    fireEvent.click(screen.getByRole("button", { name: "Landscape" }));
    expect(screen.getByText("852 × 393")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Device frame" }));
    expect(document.querySelector("[data-slot=web-preview-device]")?.className).not.toContain("bg-foreground");
  });

  it("waits for the server before loading it", async () => {
    let answer: () => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = () => resolve(new Response(null)))));
    vi.stubGlobal("fetch", fetchMock);
    render(<WebPreview title="Dev" servers={[servers[0]!]} waitForServer />);
    expect(screen.getByText("Waiting for Vite :5173 to start…")).toBeTruthy();
    expect(screen.queryByTitle("Dev")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => answer());
    expect(await screen.findByTitle("Dev")).toBeTruthy();
  });
});

describe("RegionCapture", () => {
  it("normalizes drags and maps regions onto captured frames", () => {
    expect(regionFromPoints({ x: 50, y: 40 }, { x: 10, y: 300 }, { width: 100, height: 200 })).toEqual({ x: 10, y: 40, width: 40, height: 160 });
    expect(regionToFrameRect({ x: 10, y: 20, width: 100, height: 50 }, { width: 1000, height: 500 }, { width: 2000, height: 1000 })).toEqual({ x: 20, y: 40, width: 200, height: 100 });
    expect(regionToFrameRect({ x: 10, y: 20, width: 200, height: 140 }, { width: 1000, height: 500 }, { width: 500, height: 250 })).toEqual({ x: 5, y: 10, width: 100, height: 70 });
    expect(regionToFrameRect({ x: 990, y: 0, width: 100, height: 10 }, { width: 1000, height: 500 }, { width: 1000, height: 500 }).width).toBe(10);
  });

  it("captures a dragged area, captures everything from the keyboard and cancels with Escape", async () => {
    const image = new Blob(["png"], { type: "image/png" });
    const capture = vi.fn().mockResolvedValue(image);
    const onCapture = vi.fn();
    function Demo() {
      const [active, setActive] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setActive(true)}>
            Capture
          </button>
          <RegionCapture active={active} onActiveChange={setActive} onCapture={onCapture} capture={capture}>
            <div style={{ width: 300, height: 200 }}>Preview</div>
          </RegionCapture>
        </>
      );
    }
    render(<Demo />);
    const root = document.querySelector("[data-slot=region-capture]")!;
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 200));
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    const overlay = screen.getByRole("dialog", { name: "Select an area to capture" });
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 300, 200));
    overlay.setPointerCapture = () => undefined;
    fireEvent.pointerDown(overlay, { clientX: 20, clientY: 30, button: 0 });
    fireEvent.pointerMove(overlay, { clientX: 120, clientY: 90 });
    expect(screen.getByText("100 × 60")).toBeTruthy();
    fireEvent.pointerUp(overlay, { clientX: 120, clientY: 90 });
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith(image, { x: 20, y: 30, width: 100, height: 60 }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    await waitFor(() => expect(onCapture).toHaveBeenLastCalledWith(image, { x: 0, y: 0, width: 300, height: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Capture" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(capture).toHaveBeenCalledTimes(2);
  });
});

describe("InlineEdit", () => {
  it("streams a suggestion, then replaces, retries and shows changes", async () => {
    const onReplace = vi.fn();
    const onGenerate = vi.fn(async function* () {
      yield "Ship it ";
      yield "on Monday.";
    });
    render(<InlineEdit selection="Ship it Friday." onGenerate={onGenerate} onReplace={onReplace} onInsert={vi.fn()} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Instruction" }));
    fireEvent.click(screen.getByRole("button", { name: "Shorten" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Suggested text" }).textContent).toBe("Ship it on Monday."));
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({ actionId: "shorten", selection: "Ship it Friday." }));
    fireEvent.click(screen.getByRole("button", { name: "Show changes" }));
    expect(screen.getByText("deleted:", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole("button", { name: "Replace" }));
    expect(onReplace).toHaveBeenCalledWith("Ship it on Monday.");
  });

  it("takes typed instructions, reports errors and discards with Escape", async () => {
    const onClose = vi.fn();
    const onGenerate = vi.fn().mockRejectedValueOnce(new Error("Rate limited")).mockResolvedValue("Formal text.");
    render(<InlineEdit selection="hey there" onGenerate={onGenerate} onReplace={vi.fn()} onClose={onClose} />);
    const input = screen.getByRole("textbox", { name: "Instruction" });
    fireEvent.change(input, { target: { value: "Make it formal" } });
    fireEvent.submit(input.closest("form")!);
    expect((await screen.findByRole("alert")).textContent).toContain("Rate limited");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Suggested text" }).textContent).toBe("Formal text."));
    expect(onGenerate).toHaveBeenLastCalledWith(expect.objectContaining({ instruction: "Make it formal" }));
    fireEvent.keyDown(screen.getByRole("region", { name: "Suggested text" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ReviewComments", () => {
  const threads: ReviewThread[] = [
    { id: "t2", anchor: { line: 40, file: "src/App.tsx", quote: "const total = 0" }, comments: [{ id: "c3", author: "Dana Reyes", body: "Should this include tax?" }] },
    { id: "t1", anchor: { line: 3, endLine: 5, file: "src/App.tsx" }, comments: [{ id: "c1", author: "Marifai", body: "Unused import." }, { id: "c2", author: "Dana Reyes", body: "Removed." }], resolved: true },
    { id: "t0", anchor: { line: 1, file: "README.md" }, comments: [{ id: "c0", author: "Lee", body: "Typo in title." }] },
  ];

  it("orders threads by anchor and formats ranges", () => {
    expect(sortThreads(threads).map((thread) => thread.id)).toEqual(["t0", "t1", "t2"]);
    expect(formatAnchor({ line: 3, endLine: 5 })).toBe("Lines 3–5");
    expect(formatAnchor({ line: 7, file: "a.ts" })).toBe("a.ts, line 7");
  });

  it("filters, replies, resolves, jumps and starts new threads", async () => {
    const onReply = vi.fn();
    const onResolve = vi.fn();
    const onJump = vi.fn();
    const onCreate = vi.fn();
    render(<ReviewComments threads={threads} onReply={onReply} onResolve={onResolve} onJump={onJump} draftAnchor={{ line: 12, quote: "return null;" }} onCreate={onCreate} />);
    expect(screen.getByText("2 open · 1 resolved")).toBeTruthy();
    expect(screen.queryByText("Unused import.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "README.md, line 1" }));
    expect(onJump).toHaveBeenCalledWith({ line: 1, file: "README.md" });
    const reply = screen.getByRole("textbox", { name: "Reply on src/App.tsx, line 40" });
    fireEvent.change(reply, { target: { value: "Yes, add tax." } });
    fireEvent.keyDown(reply, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(onReply).toHaveBeenCalledWith("t2", "Yes, add tax."));
    fireEvent.click(screen.getAllByRole("button", { name: "Resolve" })[0]!);
    expect(onResolve).toHaveBeenCalledWith("t0", true);
    fireEvent.click(screen.getByRole("radio", { name: "Resolved" }));
    fireEvent.click(screen.getByRole("button", { name: /Show 2 comments/ }));
    expect(screen.getByText("Unused import.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(onResolve).toHaveBeenLastCalledWith("t1", false);
    const draft = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(draft, { target: { value: "Handle the empty case." } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ line: 12, quote: "return null;" }, "Handle the empty case."));
  });
});

describe("preview documents", () => {
  it("renders SVG through an image so its scripts never run", () => {
    const { html, allowedOrigins } = createSvgPreview('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(html).not.toContain("<script");
    expect(html).toContain("data:image/svg+xml");
    expect(allowedOrigins).toEqual([]);
  });

  it("runs Python with Pyodide and asks for eval", () => {
    const preview = createPythonPreview('print("</script>")', { packages: ["numpy"] });
    expect(preview.allowEval).toBe(true);
    expect(preview.allowedOrigins).toEqual(["https://cdn.jsdelivr.net"]);
    expect(preview.html).toContain('"print(\\"\\u003c/script>\\")"');
    expect(preview.html).toContain('["numpy"]');
    render(<InteractivePreview title="Py" {...preview} />);
    expect(screen.getByTitle("Py").getAttribute("srcdoc")).toContain("'unsafe-eval' 'wasm-unsafe-eval'");
  });

  it("bundles a multi-file project", () => {
    const { html, allowedOrigins } = createProjectPreview({
      "index.html": '<!doctype html><html><head><title>Shop</title><link rel="stylesheet" href="./styles/site.css"></head><body><header>Top</header><img src="logo.svg" alt=""><script src="legacy.js"></script><script type="module" src="/src/main.js"></script></body></html>',
      "styles/site.css": "body { background: url(../icon.svg); }",
      "icon.svg": "<svg/>",
      "logo.svg": "<svg/>",
      "legacy.js": "window.legacy = '</script>';",
      "src/main.js": 'import { total } from "./cart";\nimport data from "./data.json";\nimport "./main.css";\ndocument.body.dataset.total = total(data);',
      "src/cart.js": "export const total = (items) => items.length;",
      "src/data.json": "[1,2]",
      "src/main.css": "header { color: red }",
    });
    expect(html).toContain('<style data-file="styles/site.css">body { background: url("data:image/svg+xml');
    expect(html).toContain(`<script src="${scriptDataUrl("window.legacy = '</script>';")}"></script>`);
    expect(html).toContain('<img src="data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E"');
    expect(html.indexOf('<script type="importmap">')).toBeLessThan(html.indexOf("<title>"));
    expect(html).toContain("<header>Top</header>");
    expect(html).toContain('id="ai-ui-entries">["src/main.js"]');
    expect(html).not.toContain("babel");
    expect(allowedOrigins).toEqual(["https://esm.sh"]);
    const generated = createProjectPreview({ "src/main.tsx": "export {}" });
    expect(generated.html).toContain('<div id="root"></div>');
    expect(generated.html).toContain("@babel/standalone");
    expect(generated.allowedOrigins).toContain("https://cdn.jsdelivr.net");
  });
});
