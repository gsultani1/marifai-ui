// packages/ai-ui/test/extended.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  Artifact,
  ArtifactContent,
  ArtifactHeader,
  ArtifactModeToggle,
  ArtifactPreview,
  ArtifactTitle,
  Attachment,
  Attachments,
  BranchNavigator,
  Canvas,
  CanvasMain,
  CanvasPanel,
  CanvasResizeHandle,
  Chart,
  CodeBlock,
  CodeEditor,
  createReactPreview,
  DataTable,
  detectFileKind,
  DiffView,
  FileViewer,
  formatBytes,
  InteractivePreview,
  Message,
  MessageActions,
  ModelSelector,
  MessageFeedbackActions,
  type MessageFeedbackValue,
  parseDelimited,
  ToolCall,
  ToolCallApproval,
  ToolCallContent,
  ToolCallInput,
  ToolCallTrigger,
  Whiteboard,
  type WhiteboardElement,
} from "../src/index.js";
import { EditorFallback } from "../src/components/editor-fallback.js";
import { createLazyLoader, useLazyModule } from "../src/hooks/use-lazy-module.js";

describe("utilities", () => {
  it("parses quoted CSV fields, escaped quotes and CRLF", () => {
    expect(parseDelimited('a,b\r\n"x, y","say ""hi"""\n1,')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["1", ""],
    ]);
    expect(parseDelimited("a\tb\n1\t2", "\t")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops a byte order mark and stops at maxRows", () => {
    expect(parseDelimited("\ufeffsku,qty\n1,2\n3,4\n5,6", ",", 2)).toEqual([
      ["sku", "qty"],
      ["1", "2"],
    ]);
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(48213)).toBe("47 KB");
  });

  it("detects file kinds from type and extension", () => {
    expect(detectFileKind("report.pdf", undefined)).toBe("pdf");
    expect(detectFileKind("data.csv", "")).toBe("csv");
    expect(detectFileKind("photo", "image/png")).toBe("image");
    expect(detectFileKind("main.py", undefined)).toBe("text");
    expect(detectFileKind("archive.zip", "application/zip")).toBe("unknown");
  });
});

describe("Attachment", () => {
  it("shows the size and removes on request", () => {
    const onRemove = vi.fn();
    render(
      <Attachments>
        <Attachment name="q3.csv" size={2048} onRemove={onRemove} />
        <Attachment name="photo.png" mimeType="image/png" uploading />
      </Attachments>,
    );
    expect(screen.getByRole("list", { name: "Attachments" })).toBeTruthy();
    expect(screen.getByText("2.0 KB")).toBeTruthy();
    expect(screen.getByText("Uploading")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove q3.csv" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("links only safe URLs and prefers onPreview", () => {
    const onPreview = vi.fn();
    render(
      <Attachments>
        <Attachment name="report.pdf" href="https://files.example.com/report.pdf" />
        <Attachment name="evil.html" href="javascript:alert(1)" />
        <Attachment name="notes.md" href="https://files.example.com/notes.md" onPreview={onPreview} />
      </Attachments>,
    );
    expect(screen.getByRole("link", { name: "report.pdf (opens in new tab)" }).getAttribute("href")).toBe(
      "https://files.example.com/report.pdf",
    );
    expect(screen.queryByRole("link", { name: /evil/ })).toBeNull();
    expect(screen.getByText("evil.html").tagName).toBe("SPAN");
    fireEvent.click(screen.getByRole("button", { name: "notes.md" }));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });
});

describe("Message actions and branches", () => {
  it("toggles feedback and clears it on a second press", () => {
    function Harness() {
      const [value, setValue] = useState<MessageFeedbackValue>(null);
      return (
        <Message from="assistant">
          <MessageActions>
            <MessageFeedbackActions value={value} onValueChange={setValue} />
          </MessageActions>
        </Message>
      );
    }
    render(<Harness />);
    const up = screen.getByRole("button", { name: "Good response" });
    fireEvent.click(up);
    expect(up.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(up);
    expect(up.getAttribute("aria-pressed")).toBe("false");
  });

  it("navigates branches with buttons and arrow keys", () => {
    const onIndexChange = vi.fn();
    const { rerender } = render(<BranchNavigator index={0} count={3} onIndexChange={onIndexChange} />);
    const group = screen.getByRole("group", { name: "Message versions" });
    expect(within(group).getByRole("button", { name: "Previous version" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Previous version" }));
    fireEvent.click(screen.getByRole("button", { name: "Next version" }));
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(onIndexChange.mock.calls).toEqual([[1], [1]]);
    rerender(<BranchNavigator index={0} count={1} onIndexChange={onIndexChange} />);
    expect(screen.queryByRole("group", { name: "Message versions" })).toBeNull();
  });
});

describe("ToolCallApproval", () => {
  it("renders approve and deny only while awaiting approval", () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    const tree = (status: "awaiting-approval" | "running") => (
      <ToolCall name="delete_rows" status={status}>
        <ToolCallTrigger />
        <ToolCallContent>
          <ToolCallApproval onApprove={onApprove} onDeny={onDeny}>
            Deletes 3 rows.
          </ToolCallApproval>
        </ToolCallContent>
      </ToolCall>
    );
    const { rerender } = render(tree("awaiting-approval"));
    expect(screen.getByRole("button", { name: /delete_rows/ }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onDeny).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledTimes(1);
    rerender(tree("running"));
    expect(screen.queryByRole("group", { name: "Approval required" })).toBeNull();
  });

  it("waits for an async decision, ignores repeats and offers a retry after a failure", async () => {
    let settle: { resolve: () => void; reject: (error: unknown) => void } = { resolve: () => undefined, reject: () => undefined };
    const onApprove = vi.fn(() => new Promise<void>((resolve, reject) => (settle = { resolve, reject })));
    const onError = vi.fn();
    render(
      <ToolCall name="charge_card" status="awaiting-approval">
        <ToolCallTrigger />
        <ToolCallContent>
          <ToolCallApproval onApprove={onApprove} onDeny={() => undefined} onError={onError} />
        </ToolCallContent>
      </ToolCall>,
    );
    const approve = screen.getByRole("button", { name: "Approve" });
    fireEvent.click(approve);
    fireEvent.click(approve);
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("group", { name: "Approval required" }).getAttribute("aria-busy")).toBe("true");
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    const failure = new Error("network");
    await act(async () => settle.reject(failure));
    expect(screen.getByRole("alert").textContent).toBe("Your decision could not be sent. Try again.");
    expect(onError).toHaveBeenCalledWith(failure);
    expect(approve.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Artifact", () => {
  it("switches between panel and full screen without remounting content", () => {
    let mounts = 0;
    function Counter() {
      const [id] = useState(() => ++mounts);
      return <span>mount {id}</span>;
    }
    render(
      <Artifact onOpenChange={() => undefined}>
        <ArtifactHeader>
          <ArtifactTitle>Report</ArtifactTitle>
          <ArtifactModeToggle />
        </ArtifactHeader>
        <ArtifactContent>
          <Counter />
        </ArtifactContent>
      </Artifact>,
    );
    const dialog = document.querySelector<HTMLDialogElement>('[data-slot="artifact"]')!;
    expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Report" }).id);
    expect(dialog.hasAttribute("open")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(dialog.dataset.mode).toBe("fullscreen");
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(dialog.dataset.mode).toBe("panel");
    expect(screen.getByText("mount 1")).toBeTruthy();
    expect(mounts).toBe(1);
  });

  it("renders nothing when closed", () => {
    render(<Artifact open={false}>content</Artifact>);
    expect(screen.queryByText("content")).toBeNull();
  });
});

describe("ArtifactPreview", () => {
  it("renders markdown, code and html kinds", () => {
    const { rerender, container } = render(<ArtifactPreview kind="markdown" content="# Title" />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    rerender(<ArtifactPreview kind="code" content="const a = 1;" language="js" />);
    expect(container.querySelector('[data-slot="code-block"]')?.getAttribute("data-language")).toBe("js");
    rerender(<ArtifactPreview kind="html" content="<p>hi</p>" title="Preview" />);
    expect(screen.getByTitle("Preview").tagName).toBe("IFRAME");
  });
});

describe("Canvas", () => {
  it("resizes the panel from the keyboard within its bounds", () => {
    render(
      <Canvas defaultSize={50} minSize={30} maxSize={70}>
        <CanvasMain>chat</CanvasMain>
        <CanvasResizeHandle />
        <CanvasPanel>workspace</CanvasPanel>
      </Canvas>,
    );
    const separator = screen.getByRole("separator", { name: "Resize workspace" });
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator.getAttribute("aria-valuenow")).toBe("45");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator.getAttribute("aria-valuenow")).toBe("30");
    expect(separator.getAttribute("aria-valuetext")).toBe("Chat 30%, workspace 70%");
    expect(separator.getAttribute("aria-controls")).toBe(document.querySelector('[data-slot="canvas-panel"]')?.id);
  });

  it("hides the panel and handle when closed", () => {
    render(
      <Canvas open={false}>
        <CanvasMain>chat</CanvasMain>
        <CanvasResizeHandle />
        <CanvasPanel>workspace</CanvasPanel>
      </Canvas>,
    );
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.queryByText("workspace")).toBeNull();
  });
});

describe("DiffView", () => {
  const before = "a\nb\nc\nd\ne\nf\ng\nh\n";
  const after = "a\nB\nc\nd\ne\nf\ng\nh\ni\n";

  it("counts changes and marks lines for assistive technology", () => {
    const { container } = render(<DiffView oldValue={before} newValue={after} contextLines={1} />);
    expect(container.textContent).toContain("+2");
    expect(container.textContent).toContain("-1");
    expect(container.querySelectorAll('tr[data-kind="added"]')).toHaveLength(2);
    expect(container.querySelectorAll('tr[data-kind="removed"]')).toHaveLength(1);
    expect(screen.getAllByText("Added:", { exact: false }).length).toBeGreaterThan(0);
  });

  it("collapses long unchanged runs behind a toggle", () => {
    const { container } = render(<DiffView oldValue={before} newValue={after} contextLines={1} />);
    const toggle = screen.getByRole("button", { name: /Show 4 unchanged lines/ });
    fireEvent.click(toggle);
    expect(screen.queryByRole("button", { name: /unchanged/ })).toBeNull();
    expect(container.querySelectorAll('tr[data-kind="context"]')).toHaveLength(7);
  });

  it("pairs removed and added lines side by side in split mode", () => {
    const { container } = render(<DiffView oldValue={"x\ny\n"} newValue={"x\nz\n"} mode="split" />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.querySelectorAll("td")).toHaveLength(4);
  });
});

describe("DataTable", () => {
  const columns = [
    { key: "name" as const, header: "Name", editable: true },
    { key: "qty" as const, header: "Qty", type: "number" as const, editable: true },
  ];

  it("sorts by column and exposes aria-sort", () => {
    render(
      <DataTable
        columns={columns}
        rows={[
          { name: "Nails", qty: 120 },
          { name: "Hammer", qty: 14 },
        ]}
      />,
    );
    const header = screen.getByRole("columnheader", { name: /Qty/ });
    fireEvent.click(within(header).getByRole("button"));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    const cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual(["Hammer", "14", "Nails", "120"]);
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("edits cells as a keyboard grid and reports rows in original order", () => {
    const onRowsChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={[
          { name: "Nails", qty: 120 },
          { name: "Hammer", qty: 14 },
        ]}
        onRowsChange={onRowsChange}
      />,
    );
    expect(screen.getByRole("grid")).toBeTruthy();
    const first = screen.getAllByRole("gridcell")[0]!;
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement?.textContent).toBe("120");
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    const input = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Edit Qty" });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRowsChange).toHaveBeenCalledWith([
      { name: "Nails", qty: 99 },
      { name: "Hammer", qty: 14 },
    ]);
  });

  it("keeps the editor open for an invalid number", () => {
    const onRowsChange = vi.fn();
    render(<DataTable columns={columns} rows={[{ name: "Nails", qty: 120 }]} onRowsChange={onRowsChange} />);
    const cell = screen.getAllByRole("gridcell")[1]!;
    cell.focus();
    fireEvent.keyDown(cell, { key: "Enter" });
    const input = screen.getByRole<HTMLInputElement>("spinbutton", { name: "Edit Qty" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRowsChange).not.toHaveBeenCalled();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a number.");
    fireEvent.change(input, { target: { value: "7" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRowsChange).toHaveBeenCalledWith([{ name: "Nails", qty: 7 }]);
  });

  it("blocks new edits while saving and reports a failed save", async () => {
    let reject: (error: unknown) => void = () => undefined;
    const onSaveError = vi.fn();
    const onRowsChange = vi.fn(() => new Promise<void>((_, fail) => (reject = fail)));
    render(
      <DataTable columns={columns} rows={[{ name: "Nails", qty: 120 }]} onRowsChange={onRowsChange} onSaveError={onSaveError} />,
    );
    const cell = screen.getAllByRole("gridcell")[0]!;
    cell.focus();
    fireEvent.keyDown(cell, { key: "Enter" });
    const input = screen.getByRole("textbox", { name: "Edit Name" });
    fireEvent.change(input, { target: { value: "Screws" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("grid").getAttribute("aria-busy")).toBe("true");
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(screen.queryByRole("textbox", { name: "Edit Name" })).toBeNull();
    await act(async () => reject(new Error("conflict")));
    expect(screen.getByRole("alert").textContent).toBe("Changes could not be saved.");
    expect(onSaveError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("grid").getAttribute("aria-busy")).toBeNull();
  });

  it("filters, pages and scrolls from the keyboard when read-only", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ name: `Item ${index + 1}`, qty: index }));
    render(<DataTable columns={columns} rows={rows} caption="Inventory" searchable pageSize={10} />);
    expect(screen.getByRole("region", { name: "Inventory" }).tabIndex).toBe(0);
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Item 11")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Inventory" }), { target: { value: "item 2" } });
    const names = screen.getAllByRole("row").slice(1).map((row) => row.querySelector("td")?.textContent);
    expect(names).toEqual(["Item 2", "Item 20", "Item 21", "Item 22", "Item 23", "Item 24", "Item 25"]);
    expect(screen.queryByText("Page 1 of 3")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Inventory" }), { target: { value: "zzz" } });
    expect(screen.getByText("No matching rows")).toBeTruthy();
  });
});

describe("Chart", () => {
  const data = [
    { month: "Jan", tools: 10, garden: 5 },
    { month: "Feb", tools: 20, garden: 15 },
  ];

  it("labels series in a legend and reads values from the keyboard", () => {
    const { container } = render(
      <Chart
        type="bar"
        title="Sales"
        data={data}
        categoryKey="month"
        series={[
          { key: "tools", label: "Tools" },
          { key: "garden", label: "Garden" },
        ]}
      />,
    );
    expect(screen.getByRole("figure", { name: "Sales" })).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Legend" })).getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelectorAll('[role="group"] svg path')).toHaveLength(4);
    const plot = screen.getByRole("group", { name: "Sales" });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("Feb: Tools 20, Garden 15");
  });

  it("switches to a table view", () => {
    render(<Chart type="line" title="Sales" data={data} categoryKey="month" series={[{ key: "tools", label: "Tools" }]} />);
    expect(screen.queryByRole("list", { name: "Legend" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show as table" }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "20" })).toBeTruthy();
  });

  it("draws one slice per category for pie charts", () => {
    const { container } = render(
      <Chart type="pie" data={data} categoryKey="month" series={[{ key: "tools", label: "Tools" }]} />,
    );
    expect(container.querySelectorAll('[role="group"] svg path')).toHaveLength(2);
    expect(screen.getByText("67%")).toBeTruthy();
  });
});

describe("FileViewer", () => {
  it("renders CSV files as a table", async () => {
    const file = new File(['sku,name\n1,"Hammer, 16oz"\n2,Nails\n'], "inventory.csv", { type: "text/csv" });
    render(<FileViewer file={file} />);
    expect(await screen.findByText("Hammer, 16oz")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /name/ })).toBeTruthy();
    expect(screen.getByText("inventory.csv")).toBeTruthy();
  });

  it("pretty-prints JSON and offers a download for unknown types", async () => {
    const json = new File(['{"a":1}'], "data.json", { type: "application/json" });
    const { container, rerender } = render(<FileViewer file={json} />);
    await screen.findByText("json");
    expect(container.querySelector("pre")?.textContent).toBe('{\n  "a": 1\n}');
    rerender(<FileViewer src="/files/archive.zip" />);
    const links = screen.getAllByRole("link", { name: "Download archive.zip" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/files/archive.zip", "/files/archive.zip"]);
  });
});

describe("InteractivePreview", () => {
  it("sandboxes the frame and forwards runtime errors from it only", () => {
    const onRuntimeError = vi.fn();
    render(<InteractivePreview title="App" html="<head></head><p>hi</p>" allowScripts onRuntimeError={onRuntimeError} />);
    const frame = screen.getByTitle<HTMLIFrameElement>("App");
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-modals allow-popups");
    const srcdoc = frame.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toMatch(/^<meta http-equiv="Content-Security-Policy" content="default-src 'none'; [^"]*connect-src 'none'[^"]*"><script>/);
    expect(srcdoc).toContain("</script><head></head><p>hi</p>");
    const data = { source: "ai-ui-preview", type: "error", message: "boom" };
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, source: window }));
      window.dispatchEvent(new MessageEvent("message", { data, source: frame.contentWindow }));
    });
    expect(onRuntimeError).toHaveBeenCalledTimes(1);
    expect(onRuntimeError).toHaveBeenCalledWith("boom");
  });

  it("drops scripts and unsafe sandbox tokens on request", () => {
    const unsafe = ["allow-same-origin", "allow-top-navigation", "allow-downloads"];
    render(
      <InteractivePreview
        title="Static"
        html="<!doctype html><p>static</p>"
        allowScripts={false}
        // @ts-expect-error allow-same-origin and allow-top-navigation are not accepted tokens
        sandbox={unsafe}
        src="javascript:alert(1)"
      />,
    );
    const frame = screen.getByTitle("Static");
    expect(frame.getAttribute("sandbox")).toBe("allow-downloads");
    const srcdoc = frame.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toMatch(/^<!doctype html><meta http-equiv="Content-Security-Policy"/);
    expect(srcdoc).toContain("script-src 'none'");
    expect(srcdoc).not.toContain("<script>");
    expect(screen.queryByRole("link", { name: "Open in new tab" })).toBeNull();
  });

  it("keeps the content security policy in the head whatever precedes the doctype", () => {
    const cases: Array<[string, boolean]> = [
      ["<!doctype html><p>x</p>", true],
      ["<!-- license --><!---->\n<!--->\t<!--> <!doctype html><p>x</p>", true],
      ["<!-- end with bang --!><!doctype html><p>x</p>", true],
      [" <!doctype html><p>x</p>", false],
      ["<!--><textarea>--><!doctype html><p>x</p>", false],
      ["<!-- never closed <!doctype html><p>x</p>", false],
      ["<p>no doctype</p>", false],
    ];
    cases.forEach(([html, standards], index) => {
      const { unmount } = render(<InteractivePreview title={`Doc ${index}`} html={html} allowScripts={false} />);
      const parsed = new DOMParser().parseFromString(screen.getByTitle(`Doc ${index}`).getAttribute("srcdoc") ?? "", "text/html");
      const policies = parsed.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
      expect(policies, html).toHaveLength(1);
      expect(policies[0]!.parentElement?.tagName, html).toBe("HEAD");
      if (standards) expect(parsed.compatMode, html).toBe("CSS1Compat");
      unmount();
    });
  });

  it("keeps generated scripts inert by default and loads the script prop byte for byte on opt-in", () => {
    const source = 'document.body.dataset.marker = "</script><b>raw</b>";';
    const { rerender } = render(<InteractivePreview title="Probe" html="<!doctype html><p>x</p><script>boom()</script>" script={source} />);
    const frame = screen.getByTitle("Probe");
    expect(frame.getAttribute("sandbox")).toBe("allow-forms allow-modals allow-popups");
    expect(frame.getAttribute("srcdoc")).toContain("script-src 'none'");
    expect(frame.getAttribute("srcdoc")).not.toContain("data:text/javascript");
    rerender(<InteractivePreview title="Probe" html="<!doctype html><p>x</p><script>boom()</script>" script={source} allowScripts />);
    const running = screen.getByTitle("Probe");
    expect(running).not.toBe(frame);
    const srcdoc = running.getAttribute("srcdoc") ?? "";
    expect(running.getAttribute("sandbox")).toBe("allow-scripts allow-forms allow-modals allow-popups");
    const encoded = /<script type="module" src="data:text\/javascript;base64,([^"]+)"><\/script>$/.exec(srcdoc)?.[1] ?? "";
    expect(new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)))).toBe(source);
  });

  it("limits network access to normalized allowed origins", () => {
    render(
      <InteractivePreview
        title="Remote"
        html="<p>x</p>"
        allowScripts
        allowedOrigins={["https://cdn.example.com/lib.js", "javascript:alert(1)", "not a url", "https://cdn.example.com"]}
      />,
    );
    const srcdoc = screen.getByTitle("Remote").getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("script-src 'unsafe-inline' blob: data: https://cdn.example.com;");
    expect(srcdoc).toContain("connect-src https://cdn.example.com;");
    expect(srcdoc).not.toContain("javascript");
  });

  it("builds a React preview with an import map, escaped source and its CDN origins", () => {
    const preview = createReactPreview('export default () => "</script>";', {
      tailwind: true,
      allowedOrigins: ["https://fonts.example.com/css"],
    });
    expect(preview.html).toContain('<script type="importmap">');
    expect(preview.html).toContain("https://esm.sh/react@19.3.1");
    expect(preview.html).toContain("@tailwindcss/browser");
    expect(preview.html).not.toContain('"</script>"');
    expect(preview.allowedOrigins).toEqual(["https://esm.sh", "https://cdn.jsdelivr.net", "https://fonts.example.com"]);
  });
});

describe("Whiteboard", () => {
  const elements: WhiteboardElement[] = [
    { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50, text: "Start" },
    { id: "b", type: "ellipse", x: 200, y: 0, width: 100, height: 50 },
    { id: "ab", type: "connector", from: "a", to: "b" },
  ];

  it("selects, nudges, renames and deletes shapes from the keyboard", () => {
    const onElementsChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState(elements);
      return (
        <Whiteboard
          elements={value}
          onElementsChange={(next) => {
            onElementsChange(next);
            setValue(next);
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    expect(screen.getByRole("application", { name: "Whiteboard with 2 shapes" })).toBeTruthy();
    expect(container.querySelectorAll("[data-connector-id]")).toHaveLength(1);

    const shape = screen.getByRole("button", { name: "Rectangle: Start" });
    fireEvent.focus(shape);
    expect(shape.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(shape, { key: "ArrowRight" });
    expect(onElementsChange.mock.lastCall?.[0][0]).toMatchObject({ id: "a", x: 10 });

    fireEvent.keyDown(shape, { key: "Enter" });
    const editor = screen.getByRole("textbox", { name: "Edit Rectangle: Start" });
    fireEvent.change(editor, { target: { value: "Begin" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Rectangle: Begin" })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("button", { name: "Rectangle: Begin" }), { key: "Delete" });
    expect(screen.getByRole("application", { name: "Whiteboard with 1 shape" })).toBeTruthy();
    expect(container.querySelectorAll("[data-connector-id]")).toHaveLength(0);
  });

  it("connects shapes and resizes them from the keyboard", () => {
    const onElementsChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<WhiteboardElement[]>(elements.filter((element) => element.type !== "connector"));
      return (
        <Whiteboard
          elements={value}
          onElementsChange={(next) => {
            onElementsChange(next);
            setValue(next);
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    const start = screen.getByRole("button", { name: "Rectangle: Start" });
    fireEvent.focus(start);
    fireEvent.keyDown(start, { key: "ArrowRight", altKey: true });
    expect(onElementsChange.mock.lastCall?.[0][0]).toMatchObject({ id: "a", width: 110, height: 50 });

    fireEvent.keyDown(start, { key: "c" });
    fireEvent.keyDown(start, { key: "Enter" });
    expect(screen.getByRole("status").textContent).toContain("Connecting from Rectangle: Start");
    const end = screen.getByRole("button", { name: "Ellipse" });
    fireEvent.focus(end);
    fireEvent.keyDown(end, { key: "Enter" });
    expect(container.querySelectorAll("[data-connector-id]")).toHaveLength(1);
    expect(onElementsChange.mock.lastCall?.[0].at(-1)).toMatchObject({ type: "connector", from: "a", to: "b" });
    expect(screen.getByRole("status").textContent).toBe("");

    fireEvent.keyDown(end, { key: "Enter" });
    fireEvent.keyDown(end, { key: "Escape" });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("switches tools with shortcuts", () => {
    render(<Whiteboard defaultElements={elements} />);
    fireEvent.keyDown(screen.getByRole("application"), { key: "r" });
    expect(screen.getByRole("button", { name: "Rectangle (R)" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(screen.getByRole("application"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Select (V)" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("CodeEditor", () => {
  it("shows the text immediately and loads CodeMirror lazily", async () => {
    const { container } = render(<CodeEditor defaultValue="const a = 1;" language="javascript" aria-label="Source" />);
    expect(container.querySelector('[aria-busy="true"] pre')?.textContent).toBe("const a = 1;");
    const content = await screen.findByRole("textbox", { name: "Source" }, { timeout: 10_000 });
    expect(content.textContent).toBe("const a = 1;");
  });
});

describe("regressions", () => {
  it("opens a tool call when its status later becomes awaiting-approval", () => {
    const tree = (status: "running" | "awaiting-approval") => (
      <ToolCall name="send_email" status={status}>
        <ToolCallTrigger />
        <ToolCallContent>
          <ToolCallApproval onApprove={() => undefined} onDeny={() => undefined} />
        </ToolCallContent>
      </ToolCall>
    );
    const { rerender } = render(tree("running"));
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    rerender(tree("awaiting-approval"));
    expect(screen.getByRole("button", { name: /send_email/ }).getAttribute("aria-expanded")).toBe("true");
    const approve = screen.getByRole("button", { name: "Approve" });
    approve.focus();
    fireEvent.click(approve);
    rerender(tree("running"));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /send_email/ }));
  });

  it("discards a DataTable edit on Escape and does not steal focus after a blur save", async () => {
    const onRowsChange = vi.fn();
    render(
      <>
        <DataTable columns={[{ key: "name", header: "Name", editable: true }]} rows={[{ name: "Nails" }]} onRowsChange={onRowsChange} />
        <button type="button">Elsewhere</button>
      </>,
    );
    const cell = screen.getByRole("gridcell");
    fireEvent.keyDown(cell, { key: "Enter" });
    let input = screen.getByRole("textbox", { name: "Edit Name" });
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onRowsChange).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("gridcell"), { key: "Enter" });
    input = screen.getByRole("textbox", { name: "Edit Name" });
    fireEvent.change(input, { target: { value: "Screws" } });
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    fireEvent.blur(input);
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));
    expect(onRowsChange).toHaveBeenCalledWith([{ name: "Screws" }]);
    expect(document.activeElement).toBe(elsewhere);
  });

  it("discards a whiteboard text edit on Escape and ignores keys from its toolbar", () => {
    const onElementsChange = vi.fn();
    render(
      <Whiteboard
        defaultElements={[{ id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50, text: "Keep" }]}
        onElementsChange={onElementsChange}
      />,
    );
    const shape = screen.getByRole("button", { name: "Rectangle: Keep" });
    fireEvent.focus(shape);
    fireEvent.keyDown(screen.getByRole("button", { name: "Zoom in" }), { key: "Enter" });
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.keyDown(shape, { key: "Enter" });
    const editor = screen.getByRole("textbox", { name: "Edit Rectangle: Keep" });
    fireEvent.change(editor, { target: { value: "Discard me" } });
    fireEvent.keyDown(editor, { key: "Escape" });
    fireEvent.blur(editor);
    expect(onElementsChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Rectangle: Keep" })).toBeTruthy();
  });

  it("portals popups into a full-screen artifact so they stay interactive", async () => {
    render(
      <Artifact defaultMode="fullscreen">
        <ArtifactContent>
          <ModelSelector models={[{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }]} defaultValue="a" />
        </ArtifactContent>
      </Artifact>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Model" }));
    const listbox = await screen.findByRole("listbox");
    expect(document.querySelector('[data-slot="artifact"]')?.contains(listbox)).toBe(true);
  });

  it("names files from signed URLs without the query string", () => {
    render(<FileViewer src="https://cdn.example.com/files/My%20Report.pdf?X-Amz-Signature=abc" />);
    expect(screen.getByText("My Report.pdf")).toBeTruthy();
    expect(screen.getByTitle("My Report.pdf").tagName).toBe("OBJECT");
  });

  it("injects the preview policy before content when the document only has a <header>", () => {
    render(<InteractivePreview title="Fragment" html="<header>Top</header><script>boom()</script>" allowScripts />);
    expect(screen.getByTitle("Fragment").getAttribute("srcdoc")).toMatch(/^<meta http-equiv="Content-Security-Policy"[^>]*><script>/);
  });

  it("renders no attachment list for conditional children that are false", () => {
    const files: string[] = [];
    render(<Attachments>{files.length > 0 && <Attachment name="x" />}</Attachments>);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("resets expanded diff context when the layout changes", () => {
    const before = "a\nb\nc\nd\ne\nf\ng\nh\n";
    const after = "a\nB\nc\nd\ne\nf\ng\nh\ni\n";
    const { rerender } = render(<DiffView oldValue={before} newValue={after} contextLines={1} />);
    fireEvent.click(screen.getByRole("button", { name: /unchanged/ }));
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Diff lines" }));
    rerender(<DiffView oldValue={before} newValue={after} contextLines={1} mode="split" />);
    expect(screen.getByRole("button", { name: /unchanged/ })).toBeTruthy();
  });
});

describe("bounds", () => {
  it("serializes BigInt and circular tool values", () => {
    const value: Record<string, unknown> = { id: 12n, nested: { ok: true } };
    value.self = value;
    const { container } = render(
      <ToolCall name="t" status="completed" defaultOpen>
        <ToolCallContent>
          <ToolCallInput input={value} />
        </ToolCallContent>
      </ToolCall>,
    );
    const text = container.querySelector("pre")?.textContent ?? "";
    expect(text).toContain('"id": "12n"');
    expect(text).toContain('"self": "[Circular]"');
    expect(text).toContain('"ok": true');
  });

  it("renders very long code without highlighting", () => {
    const code = "const x = 1;\n".repeat(5000);
    const { container } = render(<CodeBlock code={code} language="ts" />);
    expect(container.querySelector(".text-code-keyword")).toBeNull();
    expect(container.querySelector("pre")?.textContent?.length).toBe(code.length);
  });

  it("refuses oversized diffs and marks a missing final newline", () => {
    const { rerender } = render(<DiffView oldValue={"a".repeat(30)} newValue={"b".repeat(30)} maxLength={50} />);
    expect(screen.getByRole("status").textContent).toBe("These versions are too large to compare here.");
    rerender(<DiffView oldValue={"a\nb"} newValue={"a\nb\n"} />);
    expect(screen.getByText("No newline at end of file").closest("tr")?.getAttribute("data-kind")).toBe("removed");
  });

  it("charts values whose span defeats tick rounding and tables huge datasets", () => {
    const { container, rerender } = render(
      <Chart
        type="line"
        categoryKey="x"
        series={[{ key: "y", label: "Y" }]}
        data={[
          { x: "a", y: 1e16 },
          { x: "b", y: 1e16 + 2 },
        ]}
      />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    const many = Array.from({ length: 2500 }, (_, index) => ({ x: `p${index}`, y: index }));
    rerender(<Chart key="large" type="bar" title="Readings" categoryKey="x" series={[{ key: "y", label: "Y" }]} data={many} />);
    expect(screen.getByRole("region", { name: "Readings" })).toBeTruthy();
    expect(screen.getByText("Page 1 of 50")).toBeTruthy();
  });
});

describe("FileViewer safety", () => {
  it("shows a blob as a PDF only when it carries the PDF signature", async () => {
    const fake = new File(["<script>alert(1)</script>"], "invoice.pdf", { type: "text/html" });
    const { container, rerender } = render(<FileViewer file={fake} />);
    expect(await screen.findByText("This file is not a valid PDF.")).toBeTruthy();
    expect(container.querySelector("object, iframe")).toBeNull();
    const real = new File(["%PDF-1.7\n%%EOF"], "real.pdf", { type: "application/pdf" });
    rerender(<FileViewer file={real} />);
    expect(await screen.findByTitle("real.pdf")).toBeTruthy();
    expect(container.querySelector("object")?.getAttribute("type")).toBe("application/pdf");
  });

  it("refuses text previews above maxBytes", async () => {
    const file = new File(["x".repeat(2048)], "big.txt", { type: "text/plain" });
    render(<FileViewer file={file} maxBytes={1024} />);
    expect(await screen.findByText("Could not preview big.txt because it is larger than 1.0 KB.")).toBeTruthy();
  });

  it("offers a download when an image cannot be displayed", () => {
    const { container } = render(<FileViewer src="/files/broken.png" />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("This image could not be displayed.")).toBeTruthy();
  });
});

describe("lazy editor loading", () => {
  it("keeps the fallback on a failed import and recovers on retry", async () => {
    let attempts = 0;
    const loader = createLazyLoader(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("chunk failed");
      return { label: "loaded" };
    });
    const onError = vi.fn();
    function Harness() {
      const { module, failed, recovered, retry } = useLazyModule(loader, onError);
      if (module) return <p>{`${module.label}${recovered ? " after retry" : ""}`}</p>;
      return (
        <EditorFallback slot="code-editor" failed={failed} onRetry={retry}>
          <pre>draft text</pre>
        </EditorFallback>
      );
    }
    render(<Harness />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("draft text")).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry editor" }));
    expect(await screen.findByText("loaded after retry")).toBeTruthy();
    expect(attempts).toBe(2);
  });
});
