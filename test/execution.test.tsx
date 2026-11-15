// packages/ai-ui/test/execution.test.tsx
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  appendExecutionOutput,
  applyCarriageReturns,
  createNotebookCell,
  describeSession,
  detectLogLevel,
  EventLog,
  type ExecutionOutput,
  ExecutionOutputView,
  LogBuffer,
  type LogLine,
  LogViewer,
  Notebook,
  type NotebookCell,
  notebookFromIpynb,
  type NotebookKernel,
  notebookToIpynb,
  parseAnsi,
  RunPanel,
  RuntimeSelector,
  stripAnsi,
  Terminal,
  TerminalBuffer,
  type TerminalHandle,
  TerminalTabs,
  useLogBuffer,
} from "../src/index.js";

vi.mock("../src/components/terminal-view.js", () => ({
  TerminalView: ({ label }: { label: string }) => <div role="region" aria-label={label} data-testid="xterm-view" />,
}));

describe("ANSI", () => {
  it("parses colors and styles and drops control sequences", () => {
    const segments = parseAnsi("\u001b[1;31mError\u001b[0m: \u001b[38;5;46mok\u001b[39m \u001b[38;2;10;20;30mrgb\u001b[0m\u001b[2K\u001b]0;title\u0007 done");
    expect(segments).toEqual([
      { text: "Error", bold: true, fg: "var(--ansi-red)" },
      { text: ": " },
      { text: "ok", fg: "rgb(0, 255, 0)" },
      { text: " " },
      { text: "rgb", fg: "rgb(10, 20, 30)" },
      { text: " done" },
    ]);
    expect(stripAnsi("\u001b[32m✓\u001b[39m passed")).toBe("✓ passed");
  });

  it("redraws carriage-return lines like a terminal", () => {
    expect(applyCarriageReturns("10%\r20%\r100%")).toBe("100%");
    expect(applyCarriageReturns("abcdef\rXY")).toBe("XYcdef");
    expect(stripAnsi(applyCarriageReturns("transforming (148) src/routes/orders.tsx\r\u001b[2Ksrc/a.ts"))).toBe("src/a.ts");
  });
});

describe("LogBuffer", () => {
  it("joins chunks into lines per stream and caps the history", () => {
    const buffer = new LogBuffer({ maxLines: 3 });
    buffer.append("hel", { timestamp: 1 });
    buffer.append("lo\r\nwor", { timestamp: 2 });
    buffer.append("oops", { stream: "stderr" });
    buffer.append("ld\n");
    const { lines } = buffer.getSnapshot();
    expect(lines.map((line) => [line.text, line.stream, Boolean(line.partial)])).toEqual([
      ["hello", "stdout", false],
      ["world", "stdout", false],
      ["oops", "stderr", true],
    ]);
    buffer.appendLine("$ npm test", { stream: "command" });
    expect(buffer.getSnapshot().dropped).toBe(1);
    expect(buffer.getSnapshot().lines.find((line) => line.stream === "stderr")?.partial).toBe(true);
    expect(buffer.getSnapshot().lines.at(-1)).toMatchObject({ text: "$ npm test", stream: "command" });
  });

  it("detects levels and collapses progress redraws", () => {
    expect(detectLogLevel("npm ERR! missing script")).toBe("error");
    expect(detectLogLevel("\u001b[33mwarning\u001b[0m: deprecated")).toBe("warn");
    expect(detectLogLevel("Compiled successfully")).toBeUndefined();
    const buffer = new LogBuffer();
    for (let percent = 0; percent <= 100; percent += 10) buffer.append(`\rDownloading ${percent}%`);
    const [line] = buffer.getSnapshot().lines;
    expect(applyCarriageReturns(line!.text)).toBe("Downloading 100%");
    expect(line!.text.length).toBeLessThan(40);
  });

  it("exposes a buffer through useLogBuffer", () => {
    const { result } = renderHook(() => useLogBuffer({ maxLines: 10 }));
    act(() => result.current.append("ready\n"));
    expect(result.current.lines.map((line) => line.text)).toEqual(["ready"]);
    act(() => result.current.clear());
    expect(result.current.lines).toEqual([]);
  });
});

describe("Terminal", () => {
  it("queues output, caps it and mirrors plain text", () => {
    const buffer = new TerminalBuffer(20, 50);
    buffer.write("\u001b[32mhello\u001b[0m\r\n");
    expect(buffer.getText()).toBe("hello\n");
    buffer.write("x".repeat(30));
    expect(buffer.take()).toContain("[earlier output truncated]");
    expect(buffer.take()).toBe("");
    const clear = vi.fn();
    const detach = buffer.attach({ focus: () => undefined, fit: () => undefined, clear, terminal: null });
    buffer.clear();
    expect(clear).toHaveBeenCalled();
    detach();
    expect(buffer.view).toBeNull();
  });

  it("shows queued output before xterm.js loads and then hands over to the view", async () => {
    const ref = createRef<TerminalHandle>();
    const { container } = render(<Terminal ref={ref} initialContent={"$ npm run build\r\n"} aria-label="Build terminal" />);
    expect(container.querySelector("pre")?.textContent).toBe("$ npm run build\n");
    expect(await screen.findByTestId("xterm-view")).toBeTruthy();
    expect(ref.current?.getTerminal()).toBeNull();
  });

  it("labels terminal tabs with their run state", () => {
    const onNew = vi.fn();
    render(
      <TerminalTabs
        sessions={[
          { id: "a", title: "npm run dev", status: "running" },
          { id: "b", title: "pytest", status: "exited", exitCode: 1 },
        ]}
        activeId="a"
        onActiveChange={() => undefined}
        onNew={onNew}
      >
        <p>terminal</p>
      </TerminalTabs>,
    );
    expect(screen.getByRole("tab", { name: "npm run dev, running" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "pytest, exited with code 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New terminal" }));
    expect(onNew).toHaveBeenCalled();
    expect(describeSession({ id: "c", title: "x", status: "error" })).toBe("failed");
  });
});

const LINES: LogLine[] = [
  { id: 1, text: "$ npm install", stream: "command", timestamp: Date.UTC(2026, 9, 24, 12, 0, 0) },
  { id: 2, text: "\u001b[33mwarn\u001b[0m deprecated inflight", stream: "stderr", level: "warn" },
  { id: 3, text: "added 120 packages", stream: "stdout" },
  { id: 4, text: "\u001b[31mnpm ERR!\u001b[0m code ELIFECYCLE", stream: "stderr", level: "error" },
];

describe("LogViewer", () => {
  it("renders colored output with filters, search and timestamps", () => {
    render(<LogViewer lines={LINES} dropped={5} />);
    const log = screen.getByRole("log", { name: "Output lines" });
    expect(within(log).getByText("warn").getAttribute("style")).toContain("var(--ansi-yellow)");
    expect(within(log).getByText("5 earlier lines were dropped.", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Errors/ }));
    expect(log.querySelectorAll("[data-stream]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Errors/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search output" }), { target: { value: "packages" } });
    expect(log.querySelector("mark")?.textContent).toBe("packages");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search output" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Show timestamps" }));
    expect(log.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-24T12:00:00.000Z");
  });

  it("runs commands with history and shows the connection state", () => {
    const onCommand = vi.fn();
    const onReconnect = vi.fn();
    const { rerender } = render(<LogViewer lines={[]} onCommand={onCommand} />);
    expect(screen.getByText("No output yet.")).toBeTruthy();
    const input = screen.getByRole("textbox", { name: "Command" });
    fireEvent.change(input, { target: { value: "ls -la" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "pwd" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommand.mock.calls).toEqual([["ls -la"], ["pwd"]]);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect((input as HTMLInputElement).value).toBe("pwd");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect((input as HTMLInputElement).value).toBe("ls -la");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect((input as HTMLInputElement).value).toBe("");
    rerender(<LogViewer lines={[]} onCommand={onCommand} connection="disconnected" onReconnect={onReconnect} />);
    expect(screen.getByText("Disconnected. Output may be incomplete.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(onReconnect).toHaveBeenCalled();
    expect((screen.getByRole("textbox", { name: "Command" }) as HTMLInputElement).disabled).toBe(true);
  });
});

describe("execution outputs and run panel", () => {
  it("merges streams and renders rich outputs safely", () => {
    const outputs: ExecutionOutput[] = [
      { type: "stdout", text: "a\n" },
      { type: "stderr", text: "b\n" },
      { type: "image", src: "data:image/png;base64,AAAA", alt: "Sales chart" },
      { type: "html", html: "<b>hi</b><script>alert(1)</script>", title: "Report" },
      { type: "json", value: { total: 3 } },
      { type: "error", name: "ValueError", message: "bad", traceback: "line 1" },
    ];
    render(<ExecutionOutputView outputs={outputs} />);
    expect(screen.getAllByLabelText("Output")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Sales chart" })).toBeTruthy();
    expect(screen.getByTitle("Report").getAttribute("sandbox")).toBe("");
    expect(screen.getByRole("alert").textContent).toContain("ValueError: bad");
    expect(appendExecutionOutput([{ type: "stdout", text: "a" }], { type: "stdout", text: "b" })).toEqual([{ type: "stdout", text: "ab" }]);
  });

  it("runs with the button or Ctrl+Enter and shows status", () => {
    const onRun = vi.fn();
    const onStop = vi.fn();
    const onRunnerChange = vi.fn();
    const runners = [
      { id: "py", label: "Python", command: "python main.py" },
      { id: "node", label: "Node", command: "node index.js" },
    ];
    const { rerender } = render(<RunPanel runners={runners} runner="py" onRunnerChange={onRunnerChange} onRun={onRun} status="idle" outputs={[]} />);
    expect(screen.getByText("python main.py")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Runner" }), { target: { value: "node" } });
    expect(onRunnerChange).toHaveBeenCalledWith("node");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Runner" }), { key: "Enter", ctrlKey: true });
    expect(onRun).toHaveBeenCalledTimes(2);
    rerender(<RunPanel runners={runners} runner="py" onRunnerChange={onRunnerChange} onRun={onRun} onStop={onStop} status="running" outputs={[]} startedAt={Date.now()} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
    rerender(<RunPanel runners={runners} runner="py" onRunnerChange={onRunnerChange} onRun={onRun} status="failed" exitCode={2} outputs={[{ type: "stderr", text: "boom" }]} />);
    expect(screen.getByRole("status").textContent).toBe("Failed (exit 2)");
  });
});

describe("ipynb", () => {
  it("round-trips cells and outputs", () => {
    const cells: NotebookCell[] = [
      { id: "m", type: "markdown", source: "# Title\nText" },
      { id: "c", type: "code", source: "print(1)\nx = 2", executionCount: 3, outputs: [{ type: "stdout", text: "1\n" }, { type: "image", src: "data:image/png;base64,AAAA", alt: "plot" }, { type: "error", name: "NameError", message: "y", traceback: "Traceback\nline" }] },
    ];
    const json = notebookToIpynb(cells, { kernelName: "Python 3", language: "python" });
    const parsed = JSON.parse(json) as { nbformat: number; cells: Array<{ source: string[] }> };
    expect(parsed.nbformat).toBe(4);
    expect(parsed.cells[1]!.source).toEqual(["print(1)\n", "x = 2"]);
    const result = notebookFromIpynb(json);
    expect(result.ok && result.cells).toEqual(cells);
    expect(result.ok && result.metadata).toEqual({ kernelName: "Python 3", language: "python" });
  });

  it("rejects unsupported files", () => {
    expect(notebookFromIpynb("nope")).toMatchObject({ ok: false });
    expect(notebookFromIpynb(JSON.stringify({ nbformat: 3, cells: [] }))).toMatchObject({ ok: false, error: expect.stringMatching(/nbformat 4/) });
    expect(notebookFromIpynb(JSON.stringify({ cells: [{ source: "x" }] }))).toMatchObject({ ok: false, error: "Cell 1 is not in a supported format." });
    const svg = notebookFromIpynb(JSON.stringify({ nbformat: 4, cells: [{ cell_type: "code", source: "", outputs: [{ output_type: "display_data", data: { "image/svg+xml": "<svg/>" } }] }] }));
    expect(svg.ok && svg.cells[0]!.outputs![0]).toMatchObject({ type: "image", src: expect.stringMatching(/^data:image\/svg\+xml;base64,/) });
  });
});

function fakeKernel(): NotebookKernel & { calls: string[]; release?: () => void } {
  const kernel: NotebookKernel & { calls: string[]; release?: () => void } = {
    name: "Fake",
    calls: [],
    execute: (code, { signal, onOutput }) => {
      kernel.calls.push(code);
      if (code === "wait") {
        return new Promise((resolve, reject) => {
          kernel.release = () => resolve({ status: "ok" });
          signal.addEventListener("abort", () => reject(new DOMException("Interrupted", "AbortError")));
        });
      }
      if (code.startsWith("fail")) {
        onOutput({ type: "error", name: "Error", message: "boom" });
        return Promise.resolve({ status: "error" });
      }
      onOutput({ type: "stdout", text: `ran ${code}\n` });
      return Promise.resolve({ status: "ok" });
    },
    restart: () => Promise.resolve(),
  };
  return kernel;
}

describe("Notebook", () => {
  it("runs cells, counts executions and adds a cell after Shift+Enter on the last one", async () => {
    const kernel = fakeKernel();
    const onCellsChange = vi.fn();
    render(<Notebook kernel={kernel} defaultCells={[{ id: "a", type: "code", source: "one" }, { id: "b", type: "markdown", source: "**Notes**" }]} onCellsChange={onCellsChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Run cell 1" }));
    const first = screen.getByRole("group", { name: "Cell 1, code" });
    await within(first).findByText("ran one");
    expect(within(first).getByText("Cell 1 ran as execution 1")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Text cell 2, press Enter to edit" }).textContent).toContain("Notes");

    fireEvent.keyDown(first.querySelector("pre") ?? first, { key: "Enter", shiftKey: true });
    await waitFor(() => expect(within(first).getByText("Cell 1 ran as execution 2")).toBeTruthy());
    expect(kernel.calls).toEqual(["one", "one"]);
    fireEvent.keyDown(screen.getByRole("group", { name: "Text cell 2, press Enter to edit" }), { key: "Enter" });
    expect(screen.getByRole("group", { name: "Cell 2, text" }).querySelector('[aria-busy="true"], [data-slot="code-editor"]')).toBeTruthy();
  });

  it("stops run all at the first failure and interrupts long runs", async () => {
    const kernel = fakeKernel();
    render(<Notebook kernel={kernel} defaultCells={[{ id: "a", type: "code", source: "one" }, { id: "b", type: "code", source: "fail here" }, { id: "c", type: "code", source: "three" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run all" }));
    expect(await screen.findByText("Stopped at cell 2 because it failed.")).toBeTruthy();
    expect(kernel.calls).toEqual(["one", "fail here"]);
    expect(screen.getByRole("group", { name: "Cell 3, code" }).getAttribute("data-status")).toBe("idle");
    expect(screen.getByRole("group", { name: "Cell 2, code" }).getAttribute("data-status")).toBe("error");
  });

  it("interrupts, restarts, deletes with undo and converts cells", async () => {
    const kernel = fakeKernel();
    render(<Notebook kernel={kernel} defaultCells={[{ id: "a", type: "code", source: "wait" }, { id: "b", type: "code", source: "two" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Run cell 1" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Interrupt" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Interrupt" }));
    expect(await screen.findByText(/Execution was stopped/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(await screen.findByText("Kernel restarted. Variables were cleared.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "More actions for cell 2" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete cell" }));
    expect(screen.queryByRole("group", { name: "Cell 2, code" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("group", { name: "Cell 2, code" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More actions for cell 2" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Change to text" }));
    expect(screen.getByRole("group", { name: "Cell 2, text" })).toBeTruthy();
  });

  it("exports and imports .ipynb", async () => {
    const kernel = fakeKernel();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const created: Blob[] = [];
    const original = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return "blob:test";
    };
    const { container } = render(<Notebook kernel={kernel} defaultCells={[createNotebookCell("code", "x = 1")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Export .ipynb" }));
    URL.createObjectURL = original;
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    expect(JSON.parse(await created[0]!.text()).cells[0].source).toEqual(["x = 1"]);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([notebookToIpynb([{ id: "i", type: "markdown", source: "Imported" }, { id: "j", type: "code", source: "y", executionCount: 7, outputs: [] }])], "demo.ipynb");
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("Imported demo.ipynb (2 cells).")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Text cell 1, press Enter to edit" }).textContent).toContain("Imported");
  });
});

describe("EventLog and RuntimeSelector", () => {
  it("filters, searches and expands events", () => {
    render(
      <EventLog
        events={[
          { id: "1", time: 1, level: "info", source: "api", message: "Request started" },
          { id: "2", time: 2, level: "error", source: "billing", message: "Charge failed", details: { code: "card_declined" } },
          { id: "3", time: 3, level: "warn", message: "Slow query" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]!.textContent).toContain("Slow query");
    fireEvent.click(screen.getByRole("button", { name: /^Error/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    const row = screen.getByRole("button", { name: /Charge failed/ });
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/card_declined/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Error/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search events" }), { target: { value: "card_declined" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("picks a runtime and keeps unavailable ones disabled", async () => {
    const onValueChange = vi.fn();
    render(
      <RuntimeSelector
        runtimes={[
          { id: "py", name: "Python", version: "3.13", status: "ready", recommended: true },
          { id: "node", name: "Node.js", version: "22", status: "starting" },
          { id: "go", name: "Go", version: "1.25", status: "unavailable" },
        ]}
        defaultValue="py"
        onValueChange={onValueChange}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Runtime" }));
    const go = await screen.findByRole("option", { name: /Go 1.25/ });
    expect(go.getAttribute("aria-disabled")).toBe("true");
    const node = screen.getByRole("option", { name: /Node.js 22/ });
    fireEvent.pointerDown(node, { pointerType: "mouse" });
    fireEvent.pointerUp(node, { pointerType: "mouse" });
    fireEvent.mouseUp(node);
    fireEvent.click(node);
    expect(onValueChange).toHaveBeenCalledWith("node");
  });
});
