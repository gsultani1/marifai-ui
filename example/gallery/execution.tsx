// packages/ai-ui/example/gallery/execution.tsx
import { useEffect, useRef, useState } from "react";

import {
  createJavaScriptKernel,
  EventLog,
  type ExecutionOutput,
  type LogConnection,
  type LogEvent,
  LogViewer,
  Notebook,
  type NotebookCell,
  RunPanel,
  type RunStatus,
  RuntimeSelector,
  Terminal,
  type TerminalHandle,
  type TerminalSession,
  TerminalTabs,
  useLogBuffer,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const GREEN = "\u001b[32m";
const YELLOW = "\u001b[33m";
const BLUE = "\u001b[34m";
const BOLD = "\u001b[1m";
const RESET = "\u001b[0m";
const PROMPT = `${GREEN}george@whitten${RESET}:${BLUE}~/pos${RESET}$ `;

function ShellTerminal({ onExit }: { onExit: () => void }) {
  const terminal = useRef<TerminalHandle>(null);
  const line = useRef("");

  const run = (command: string) => {
    const handle = terminal.current;
    if (!handle) return;
    const [name, ...args] = command.trim().split(/\s+/);
    if (!name) return;
    if (name === "help") handle.writeln(`Commands: ${BOLD}ls${RESET}, ${BOLD}date${RESET}, ${BOLD}echo${RESET} text, ${BOLD}clear${RESET}, ${BOLD}exit${RESET}`);
    else if (name === "ls") handle.writeln(`${BLUE}src${RESET}  ${BLUE}public${RESET}  package.json  README.md  .env`);
    else if (name === "date") handle.writeln(new Date().toString());
    else if (name === "echo") handle.writeln(args.join(" "));
    else if (name === "clear") handle.clear();
    else if (name === "exit") {
      handle.writeln("logout");
      onExit();
    } else handle.writeln(`${YELLOW}${name}: command not found${RESET} (try help)`);
  };

  return (
    <Terminal
      ref={terminal}
      aria-label="bash terminal"
      initialContent={`Welcome to the demo shell. Type ${BOLD}help${RESET}.\r\n${PROMPT}`}
      className="h-56"
      onData={(data) => {
        const handle = terminal.current;
        if (!handle) return;
        for (const char of data) {
          if (char === "\r") {
            handle.write("\r\n");
            run(line.current);
            line.current = "";
            handle.write(PROMPT);
          } else if (char === "\u007f") {
            if (line.current) {
              line.current = line.current.slice(0, -1);
              handle.write("\b \b");
            }
          } else if (char >= " ") {
            line.current += char;
            handle.write(char);
          }
        }
      }}
    />
  );
}

function InstallTerminal({ onDone }: { onDone: (code: number) => void }) {
  const terminal = useRef<TerminalHandle>(null);
  useEffect(() => {
    let step = 0;
    const timer = setInterval(() => {
      const handle = terminal.current;
      if (!handle) return;
      step += 1;
      if (step === 1) handle.writeln(`${PROMPT}npm install`);
      else if (step <= 21) handle.write(`\r${YELLOW}⠋${RESET} Installing packages [${"#".repeat(step - 1).padEnd(20, ".")}] ${(step - 1) * 5}%`);
      else {
        handle.writeln(`\r\n${GREEN}added 214 packages${RESET} in 2.1s`);
        handle.write(PROMPT);
        clearInterval(timer);
        onDone(0);
      }
    }, 120);
    return () => clearInterval(timer);
  }, [onDone]);
  return <Terminal ref={terminal} aria-label="npm install terminal" className="h-56" />;
}

function TerminalDemo() {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    { id: "shell", title: "bash", status: "running" },
    { id: "install", title: "npm install", status: "running" },
  ]);
  const [active, setActive] = useState("shell");
  const [onDone] = useState(() => (code: number) => setSessions((list) => list.map((session) => (session.id === "install" ? { ...session, status: "exited", exitCode: code } : session))));
  const activeSession = sessions.find((session) => session.id === active);

  return (
    <TerminalTabs
      sessions={sessions}
      activeId={active}
      onActiveChange={setActive}
      onNew={() => {
        const id = `shell-${sessions.length + 1}`;
        setSessions((list) => [...list, { id, title: `bash ${list.length + 1}`, status: "running" }]);
        setActive(id);
      }}
      onClose={(id) => {
        setSessions((list) => list.filter((session) => session.id !== id));
        if (id === active) setActive(sessions.find((session) => session.id !== id)?.id ?? "");
      }}
      className="w-full overflow-hidden rounded-lg border border-border"
    >
      <div className="p-2">
        {activeSession?.id === "install" ? (
          <InstallTerminal onDone={onDone} />
        ) : activeSession ? (
          <ShellTerminal key={activeSession.id} onExit={() => setSessions((list) => list.map((session) => (session.id === activeSession.id ? { ...session, status: "exited", exitCode: 0 } : session)))} />
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">No terminals open.</p>
        )}
      </div>
    </TerminalTabs>
  );
}

const BUILD = [
  ["stdout", `${BOLD}> whitten-pos@1.4.0 build${RESET}\n`],
  ["stdout", "> vite build\n\n"],
  ["stdout", `${BLUE}vite v7.3.7${RESET} building for production...\n`],
  ["stdout", "transforming (148) src/routes/orders.tsx"],
  ["stdout", "\r\u001b[2Ktransforming (312) src/lib/pricing.ts\n"],
  ["stderr", `${YELLOW}warning${RESET}: "useMemo" is imported but never used in src/app.tsx\n`],
  ["stdout", `${GREEN}✓${RESET} 412 modules transformed.\n`],
  ["stdout", "dist/index.html                0.46 kB\n"],
  ["stdout", "dist/assets/index-4f2a.css    18.20 kB\n"],
  ["stdout", "dist/assets/index-9c1e.js    142.88 kB\n"],
  ["stderr", "\u001b[31merror\u001b[0m: Type 'string' is not assignable to type 'number' (src/lib/tax.ts:4:3)\n"],
  ["stdout", `${GREEN}✓ built in 1.84s${RESET}\n`],
] as const;

function LogDemo() {
  const log = useLogBuffer({ maxLines: 2000 });
  const [connection, setConnection] = useState<LogConnection>("connected");
  const [running, setRunning] = useState(false);

  const build = () => {
    setRunning(true);
    log.appendLine("npm run build", { stream: "command" });
    BUILD.forEach(([stream, text], index) =>
      setTimeout(() => {
        log.append(text, { stream });
        if (index === BUILD.length - 1) setRunning(false);
      }, 120 * (index + 1)),
    );
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={build} disabled={running} className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50">
          Run build
        </button>
        <button type="button" onClick={() => setConnection(connection === "connected" ? "disconnected" : "connected")} className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {connection === "connected" ? "Simulate disconnect" : "Restore connection"}
        </button>
      </div>
      <LogViewer
        lines={log.lines}
        dropped={log.dropped}
        connection={connection}
        onReconnect={() => {
          setConnection("connecting");
          setTimeout(() => setConnection("connected"), 800);
        }}
        onClear={log.clear}
        onCommand={(command) => {
          log.appendLine(command, { stream: "command" });
          log.append(command === "pwd" ? "/home/george/pos\n" : `${YELLOW}${command.split(" ")[0]}${RESET}: not available in the demo\n`, { stream: command === "pwd" ? "stdout" : "stderr" });
        }}
        historyKey="ai-ui-gallery:log-history"
        label="Build output"
        fileName="build.log"
        className="h-72"
      />
    </div>
  );
}

const RUNNERS = [
  { id: "script", label: "JavaScript (worker)", command: "node totals.js" },
  { id: "report", label: "HTML report", command: "python report.py --html" },
  { id: "chart", label: "Chart", command: "python chart.py" },
];

const SCRIPT = `const sales = [1820, 2140, 1990, 2410, 2675];\nconsole.log("Days:", sales.length);\nconsole.warn("Saturday is missing");\nsales.reduce((sum, day) => sum + day, 0);`;

function RunDemo() {
  const [runner, setRunner] = useState("script");
  const [status, setStatus] = useState<RunStatus>("idle");
  const [outputs, setOutputs] = useState<ExecutionOutput[]>([]);
  const [times, setTimes] = useState<{ startedAt?: number; finishedAt?: number }>({});
  const [kernel] = useState(() => createJavaScriptKernel());
  const abort = useRef<AbortController | null>(null);
  useEffect(() => kernel.dispose, [kernel]);

  const run = () => {
    setOutputs([]);
    setStatus("running");
    const startedAt = Date.now();
    setTimes({ startedAt });
    const finish = (next: RunStatus) => {
      setStatus(next);
      setTimes({ startedAt, finishedAt: Date.now() });
    };
    if (runner === "script") {
      const controller = new AbortController();
      abort.current = controller;
      kernel
        .execute(SCRIPT, { signal: controller.signal, onOutput: (output) => setOutputs((list) => [...list, output]) })
        .then((result) => finish(result.status === "ok" ? "succeeded" : "failed"))
        .catch(() => finish("stopped"));
    } else if (runner === "report") {
      setTimeout(() => {
        setOutputs([{ type: "stdout", text: "Rendering report...\n" }, { type: "html", title: "Weekly sales report", html: "<style>body{font:14px system-ui;margin:12px}td,th{padding:4px 8px;border-bottom:1px solid #ddd;text-align:left}</style><h3>Weekly sales</h3><table><tr><th>Day</th><th>Sales</th></tr><tr><td>Mon</td><td>$1,820</td></tr><tr><td>Tue</td><td>$2,140</td></tr><tr><td>Wed</td><td>$1,990</td></tr></table>" }]);
        finish("succeeded");
      }, 400);
    } else {
      setTimeout(() => {
        const bars = [1820, 2140, 1990, 2410, 2675].map((value, index) => `<rect x="${10 + index * 38}" y="${120 - value / 25}" width="28" height="${value / 25}" fill="#3987e5"/>`).join("");
        setOutputs([{ type: "image", alt: "Bar chart of daily sales rising from $1,820 to $2,675", src: `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130">${bars}</svg>`)}` }]);
        finish("succeeded");
      }, 400);
    }
  };

  return <RunPanel runners={RUNNERS} runner={runner} onRunnerChange={setRunner} onRun={run} onStop={() => abort.current?.abort()} status={status} outputs={outputs} {...times} className="h-80 w-full max-w-2xl" />;
}

const NOTEBOOK: NotebookCell[] = [
  { id: "intro", type: "markdown", source: "## Margin check\n\nCells run in a **Web Worker**. Use `display(value)` or `html(markup)` for rich output." },
  { id: "data", type: "code", source: "var items = [\n  { sku: 'MULCH-BLK', cost: 3.1, price: 4.99 },\n  { sku: 'SCR-3-DECK', cost: 21.5, price: 34.99 },\n  { sku: 'SAND-50', cost: 4.2, price: 6.49 },\n];\nconsole.log(`${items.length} items loaded`);", outputs: [], executionCount: null },
  { id: "margins", type: "code", source: "display(items.map(({ sku, cost, price }) => ({ sku, margin: Math.round((1 - cost / price) * 100) + '%' })));", outputs: [], executionCount: null },
  { id: "html", type: "code", source: "html(`<p style=\"font: 14px system-ui\">Best margin: <b>${items.sort((a, b) => b.price / b.cost - a.price / a.cost)[0].sku}</b></p>`);", outputs: [], executionCount: null },
];

function NotebookDemo() {
  const [kernel] = useState(() => createJavaScriptKernel({ name: "JavaScript (Web Worker)" }));
  useEffect(() => kernel.dispose, [kernel]);
  return <Notebook kernel={kernel} defaultCells={NOTEBOOK} language="javascript" title="margins.ipynb" fileName="margins.ipynb" className="h-[34rem] w-full" />;
}

const EVENTS: LogEvent[] = [
  { id: "1", time: Date.now() - 60_000, level: "info", source: "deploy", message: "Build 1.4.0 started" },
  { id: "2", time: Date.now() - 45_000, level: "debug", source: "cache", message: "Cache hit for node_modules" },
  { id: "3", time: Date.now() - 30_000, level: "warn", source: "db", message: "Query over 500 ms", details: { query: "SELECT * FROM orders WHERE status = $1", duration: 734 } },
  { id: "4", time: Date.now() - 10_000, level: "error", source: "billing", message: "Card declined for order 1042", details: { code: "card_declined", order: 1042, retry: true } },
];

function EventDemo() {
  const [events, setEvents] = useState(EVENTS);
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <EventLog events={events} onClear={() => setEvents([])} className="h-72" />
      <button type="button" onClick={() => setEvents((list) => [...list, { id: String(list.length + 10), time: Date.now(), level: "info", source: "pos", message: `Register ${list.length % 3 + 1} opened` }])} className="self-start rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        Add event
      </button>
    </div>
  );
}

export function ExecutionGallery() {
  return (
    <GallerySection id="gallery-execution" title="Terminals, logs, runs and notebooks">
      <Demo title="Terminal tabs (type help in bash)" className="w-full">
        <TerminalDemo />
      </Demo>
      <Demo title="Build log with filters, follow and a command line" className="w-full">
        <LogDemo />
      </Demo>
      <Demo title="Run panel and runtime" className="flex w-full flex-wrap items-start gap-4">
        <RunDemo />
        <RuntimeSelector
          runtimes={[
            { id: "node", name: "Node.js", version: "22", description: "Runs in a sandboxed worker", status: "ready", recommended: true },
            { id: "python", name: "Python", version: "3.13", description: "Pyodide, loads on first run", status: "starting" },
            { id: "go", name: "Go", version: "1.25", description: "Needs a server runner", status: "unavailable" },
          ]}
          defaultValue="node"
        />
      </Demo>
      <Demo title="Notebook on a JavaScript kernel" className="w-full">
        <NotebookDemo />
      </Demo>
      <Demo title="Event log" className="w-full">
        <EventDemo />
      </Demo>
    </GallerySection>
  );
}
