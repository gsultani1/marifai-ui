// packages/ai-ui/example/gallery/dev-tools.tsx
import { type ReactNode, useRef, useState } from "react";

import {
  BreakpointList,
  Button,
  CodeReferenceList,
  CodeReviewFileNavigator,
  DebugCallStack,
  DebugVariableTree,
  DebugWatchExpressions,
  EditorDiagnosticsSummary,
  EditorFindReplace,
  EditorGoToLine,
  EditorLocationHistory,
  EditorSymbolOutline,
  GitBlamePanel,
  GitBranchPicker,
  GitCommitForm,
  GitCommitHistory,
  MergeConflictResolver,
  TestExplorer,
  type CodeReference,
  type CodeReviewFile,
  type DebugThread,
  type DebugVariable,
  type DebugWatchExpression,
  type DiagnosticCount,
  type EditorLocationEntry,
  type EditorSearchOptions,
  type EditorSourceLocation,
  type EditorSymbol,
  type GitBlameRange,
  type GitBranchOption,
  type GitCommitDraft,
  type GitHistoryCommit,
  type MergeConflict,
  type MergeConflictChoice,
  type SourceBreakpoint,
  type StagedCommitFile,
  type TestExplorerEntry,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const GRID = "grid w-full grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3";
const NOTE = "text-xs text-muted-foreground break-words";
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const at = (location: EditorSourceLocation) => location.file + ":" + location.line + (location.column === undefined ? "" : ":" + location.column);

const THREADS: DebugThread[] = [
  { id: "main", label: "Main thread", frames: [
    { id: "main-1", label: "applyDiscount", source: { file: "src/cart.ts", line: 31, column: 5 } },
    { id: "main-2", label: "calculateTotal", source: { file: "src/cart.ts", line: 62 } },
    { id: "main-3", label: "checkout", source: { file: "src/checkout.ts", line: 12 } },
    { id: "main-4", label: "processTicksAndRejections" },
  ] },
  { id: "pricing", label: "Supplier price sync", frames: [
    { id: "pricing-1", label: "fetchSupplierPrices", source: { file: "src/pricing/sync.ts", line: 44, column: 11 } },
    { id: "pricing-2", label: "drainQueue", source: { file: "src/pricing/queue.ts", line: 9 } },
  ] },
];

const VARIABLES: DebugVariable[] = [
  { id: "local", label: "Local", children: [
    { id: "item", label: "item", type: "CartItem", children: [
      { id: "item-sku", label: "sku", type: "string", value: "\"HAM-16OZ\"" },
      { id: "item-price", label: "price", type: "number", value: "24.99" },
      { id: "item-quantity", label: "quantity", type: "number", value: "2" },
    ] },
    { id: "discount", label: "discount", type: "number", value: "0.1" },
    { id: "contractor", label: "contractor", type: "boolean", value: "true" },
  ] },
  { id: "module", label: "Module", children: [{ id: "tax-rate", label: "TAX_RATE", type: "number", value: "0.0725" }] },
];

const WATCH_VALUES: Record<string, string> = {
  "item.price": "24.99",
  "item.quantity": "2",
  "item.price * item.quantity": "49.98",
  "discount": "0.1",
  "TAX_RATE": "0.0725",
};

function evaluate(expression: string): Pick<DebugWatchExpression, "value" | "error"> {
  const value = WATCH_VALUES[expression.replace(/\s+/g, " ")];
  return value === undefined ? { error: "Not available in the selected frame." } : { value };
}

function DebuggerDemo() {
  const [threadId, setThreadId] = useState<string | null>("main");
  const [frameId, setFrameId] = useState<string | null>("main-1");
  const [opened, setOpened] = useState("");
  const [breakpoints, setBreakpoints] = useState<SourceBreakpoint[]>([
    { id: "bp-1", file: "src/cart.ts", line: 31, column: 5, enabled: true },
    { id: "bp-2", file: "src/cart.ts", line: 62, enabled: true, condition: "items.length > 20" },
    { id: "bp-3", file: "src/receipt.ts", line: 14, enabled: false },
  ]);
  const [savingBreakpoints, setSavingBreakpoints] = useState<string[]>([]);
  const [watches, setWatches] = useState<DebugWatchExpression[]>([
    { id: "w-1", expression: "item.price * item.quantity", value: "49.98" },
    { id: "w-2", expression: "discount", value: "0.1" },
    { id: "w-3", expression: "customer.taxExempt", error: "customer is not defined" },
  ]);
  const [refreshing, setRefreshing] = useState<string[]>([]);
  const nextWatch = useRef(4);

  function toggleBreakpoint(id: string, enabled: boolean) {
    setSavingBreakpoints((ids) => [...ids, id]);
    setTimeout(() => {
      setBreakpoints((list) => list.map((item) => item.id === id ? { ...item, enabled } : item));
      setSavingBreakpoints((ids) => ids.filter((value) => value !== id));
    }, 400);
  }

  function editBreakpoint(id: string) {
    setBreakpoints((list) => list.map((item) => {
      if (item.id !== id) return item;
      const { condition, ...rest } = item;
      return condition ? rest : { ...rest, condition: "item.quantity > 10" };
    }));
  }

  async function saveWatch(expression: string, id?: string) {
    await wait(400);
    const result = evaluate(expression);
    if (id) setWatches((list) => list.map((item) => item.id === id ? { id, expression, ...result } : item));
    else setWatches((list) => [...list, { id: "w-" + nextWatch.current++, expression, ...result }]);
  }

  function refreshWatch(id: string) {
    setRefreshing((ids) => [...ids, id]);
    setTimeout(() => {
      setWatches((list) => list.map((item) => item.id === id ? { id, expression: item.expression, ...evaluate(item.expression) } : item));
      setRefreshing((ids) => ids.filter((value) => value !== id));
    }, 500);
  }

  return (
    <div className={GRID}>
      <div className="min-w-0 space-y-2">
        <DebugCallStack threads={THREADS} threadId={threadId} frameId={frameId}
          onThreadChange={(id) => { setThreadId(id); setFrameId(THREADS.find((thread) => thread.id === id)?.frames[0]?.id ?? null); }}
          onFrameChange={(_thread, id) => setFrameId(id)}
          onOpenSource={(source) => setOpened("Opened " + at(source) + " in the editor.")} />
        {opened && <p className={NOTE}>{opened}</p>}
      </div>
      <DebugVariableTree scopes={VARIABLES} />
      <DebugWatchExpressions expressions={watches} pendingIds={refreshing} onSave={saveWatch} onRefresh={refreshWatch}
        onRemove={(id) => setWatches((list) => list.filter((item) => item.id !== id))} />
      <BreakpointList breakpoints={breakpoints} pendingIds={savingBreakpoints} onEnabledChange={toggleBreakpoint} onEdit={editBreakpoint}
        onRemove={(id) => setBreakpoints((list) => list.filter((item) => item.id !== id))} />
    </div>
  );
}

const SYMBOLS: EditorSymbol[] = [
  { id: "cart-item", label: "CartItem", kind: "interface", start: { file: "src/cart.ts", line: 3 }, end: { file: "src/cart.ts", line: 8 } },
  { id: "cart", label: "Cart", kind: "class", start: { file: "src/cart.ts", line: 10 }, end: { file: "src/cart.ts", line: 58 }, children: [
    { id: "add-item", label: "addItem", kind: "method", start: { file: "src/cart.ts", line: 14, column: 3 }, end: { file: "src/cart.ts", line: 22, column: 3 } },
    { id: "apply-discount", label: "applyDiscount", kind: "method", start: { file: "src/cart.ts", line: 31, column: 3 }, end: { file: "src/cart.ts", line: 44, column: 3 } },
    { id: "subtotal", label: "subtotal", kind: "getter", start: { file: "src/cart.ts", line: 48, column: 3 }, end: { file: "src/cart.ts", line: 51, column: 3 } },
  ] },
  { id: "calculate-total", label: "calculateTotal", kind: "function", start: { file: "src/cart.ts", line: 60 }, end: { file: "src/cart.ts", line: 64 } },
];

function findSymbol(symbols: readonly EditorSymbol[], start: EditorSourceLocation): EditorSymbol | undefined {
  for (const symbol of symbols) {
    if (symbol.start === start) return symbol;
    const child = symbol.children && findSymbol(symbol.children, start);
    if (child) return child;
  }
  return undefined;
}

const REFERENCES: CodeReference[] = [
  { id: "ref-1", start: { file: "src/checkout.ts", line: 12, column: 17 }, excerpt: "const total = calculateTotal(cart.items);" },
  { id: "ref-2", start: { file: "src/checkout.ts", line: 40, column: 9 }, excerpt: "receipt.total = calculateTotal(order.items);" },
  { id: "ref-3", start: { file: "src/quotes/estimate.ts", line: 27, column: 21 }, excerpt: "return { ...quote, total: calculateTotal(lines) };" },
];

const DIAGNOSTICS: DiagnosticCount[] = [
  { file: "src/cart.ts", severity: "error", count: 2 },
  { file: "src/cart.ts", severity: "warning", count: 1 },
  { file: "src/receipt.ts", severity: "warning", count: 3 },
  { file: "src/receipt.ts", severity: "info", count: 1 },
];

const FIND_SOURCE = [
  "export function calculateTotal(items: CartItem[]) {",
  "  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);",
  "  const discounted = applyDiscount(subtotal, items);",
  "  return roundCents(discounted * (1 + TAX_RATE));",
  "}",
].join("\n");

function searchPattern(options: EditorSearchOptions): RegExp | null {
  if (!options.query) return null;
  const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(options.wholeWord ? "\\b" + escaped + "\\b" : escaped, options.matchCase ? "g" : "gi");
}

function FindReplaceDemo() {
  const [text, setText] = useState(FIND_SOURCE);
  const [search, setSearch] = useState<EditorSearchOptions>({ query: "subtotal", replacement: "netSubtotal", matchCase: true, wholeWord: true });
  const [current, setCurrent] = useState(0);
  const pattern = searchPattern(search);
  const found = pattern ? [...text.matchAll(pattern)] : [];
  const active = found.length ? Math.min(current, found.length - 1) : -1;

  function replace(scope: "one" | "all", options: EditorSearchOptions) {
    const expression = searchPattern(options);
    if (!expression) return;
    let index = 0;
    setText((value) => value.replace(expression, (match) => (scope === "all" || index++ === active ? options.replacement : match)));
  }

  const segments: ReactNode[] = [];
  let cursor = 0;
  found.forEach((match, index) => {
    const start = match.index ?? 0;
    segments.push(text.slice(cursor, start));
    segments.push(index === active
      ? <mark key={start} className="rounded-sm bg-primary text-primary-foreground">{match[0]}</mark>
      : <span key={start} className="rounded-sm bg-muted underline underline-offset-2">{match[0]}</span>);
    cursor = start + match[0].length;
  });
  segments.push(text.slice(cursor));

  return (
    <div className="min-w-0 space-y-2">
      <EditorFindReplace value={search} matches={found.length} onChange={(value) => { setSearch(value); setCurrent(0); }}
        onMove={(direction) => setCurrent((index) => found.length ? (index + (direction === "next" ? 1 : found.length - 1)) % found.length : 0)}
        onReplace={replace} />
      <figure className="rounded-md border border-border bg-muted/30 p-2">
        <figcaption className="text-xs text-muted-foreground">src/cart.ts, lines 60–64</figcaption>
        <pre className="mt-1 text-xs break-all whitespace-pre-wrap"><code>{segments}</code></pre>
      </figure>
    </div>
  );
}

function EditorDemo() {
  const [cursor, setCursor] = useState<EditorSourceLocation>({ file: "src/cart.ts", line: 31, column: 5 });
  const [activeSymbol, setActiveSymbol] = useState<string | null>("apply-discount");
  const [history, setHistory] = useState<EditorLocationEntry[]>([
    { id: "h-1", file: "src/checkout.ts", line: 12, title: "checkout" },
    { id: "h-2", file: "src/cart.ts", line: 60, title: "calculateTotal" },
    { id: "h-3", file: "src/cart.ts", line: 31, column: 5, title: "applyDiscount" },
  ]);
  const [activeEntry, setActiveEntry] = useState<string | null>("h-3");
  const [problems, setProblems] = useState("");
  const nextEntry = useRef(4);

  function navigate(location: EditorSourceLocation, title?: string) {
    const id = "h-" + nextEntry.current++;
    setCursor(location);
    setHistory((list) => {
      const kept = list.slice(0, list.findIndex((item) => item.id === activeEntry) + 1);
      return [...kept, { ...location, id, title }].slice(-6);
    });
    setActiveEntry(id);
  }

  return (
    <div className="min-w-0 space-y-2">
      <p className={NOTE}>Cursor at {at(cursor)}</p>
      <div className={GRID}>
        <EditorSymbolOutline symbols={SYMBOLS} activeId={activeSymbol} onOpen={(start) => {
          const symbol = findSymbol(SYMBOLS, start);
          setActiveSymbol(symbol?.id ?? null);
          navigate(start, symbol?.label);
        }} />
        <div className="min-w-0 space-y-3">
          <EditorGoToLine lineCount={64} onGoTo={(line, column) => navigate({ file: "src/cart.ts", line, column })} />
          <EditorLocationHistory entries={history} activeId={activeEntry}
            onOpen={(entry) => { setActiveEntry(entry.id); setCursor(entry); }} />
        </div>
        <FindReplaceDemo />
        <div className="min-w-0 space-y-2">
          <EditorDiagnosticsSummary counts={DIAGNOSTICS} onOpen={(file, severity) => setProblems("Problems filtered to " + severity + (severity === "info" ? " messages" : "s") + " in " + (file ?? "all files") + ".")} />
          {problems && <p className={NOTE}>{problems}</p>}
        </div>
        <CodeReferenceList references={REFERENCES} onOpen={(start) => navigate(start, "calculateTotal reference")} />
      </div>
    </div>
  );
}

const BRANCHES: GitBranchOption[] = [
  { id: "main", name: "main", scope: "local", current: true },
  { id: "contractor-pricing", name: "feature/contractor-pricing", scope: "local" },
  { id: "release", name: "release/2.4", scope: "local", unavailableReason: "Checked out in another worktree" },
  { id: "origin-main", name: "origin/main", scope: "remote" },
  { id: "origin-receipt", name: "origin/feature/receipt-printer", scope: "remote" },
];

const HISTORY: GitHistoryCommit[] = [
  { id: "3f2a1bc", summary: "Apply the contractor discount before tax", author: "Dana Ortiz", timestamp: "Nov 18, 2:02 PM", ref: "HEAD -> main" },
  { id: "9c4e7d0", summary: "Round receipt totals to the cent", author: "Lee Park", timestamp: "Nov 17, 9:40 AM" },
  { id: "51d0e2a", summary: "Add bulk pricing for fasteners", author: "Dana Ortiz", timestamp: "Nov 15, 4:15 PM", ref: "v2.3.0" },
];

const BLAME: GitBlameRange[] = [
  { id: "blame-1", startLine: 1, endLine: 9, author: "Lee Park", commitId: "51d0e2a", summary: "Add bulk pricing for fasteners" },
  { id: "blame-2", startLine: 10, endLine: 10, author: "Dana Ortiz", commitId: "3f2a1bc", summary: "Apply the contractor discount before tax" },
  { id: "blame-3", startLine: 11, endLine: 24, author: "Lee Park", commitId: "9c4e7d0", summary: "Round receipt totals to the cent" },
];

const STAGED: StagedCommitFile[] = [
  { id: "stage-1", path: "src/receipt.ts" },
  { id: "stage-2", path: "src/receipt.test.ts" },
];

const CONFLICTS: MergeConflict[] = [
  { id: "conflict-1", file: "src/tax.ts", current: "export const TAX_RATE = 0.07;\n", incoming: "export const TAX_RATE = 0.0725;\n" },
  { id: "conflict-2", file: "src/receipt.ts", current: "footer: \"Thanks for shopping local!\",\n", incoming: "footer: \"Thanks for shopping at Riverside Hardware!\",\nreturnsWindowDays: 30,\n" },
];

function GitDemo() {
  const [branches, setBranches] = useState(BRANCHES);
  const [checkingOut, setCheckingOut] = useState<string[]>([]);
  const [commits, setCommits] = useState(HISTORY);
  const [staged, setStaged] = useState(STAGED);
  const [viewing, setViewing] = useState("");
  const [conflicts, setConflicts] = useState(CONFLICTS);
  const [resolving, setResolving] = useState<string[]>([]);
  const nextCommit = useRef(1);

  function checkout(id: string) {
    setCheckingOut((ids) => [...ids, id]);
    setTimeout(() => {
      setBranches((list) => list.map((branch) => ({ ...branch, current: branch.id === id })));
      setCheckingOut((ids) => ids.filter((value) => value !== id));
    }, 700);
  }

  async function commit(draft: GitCommitDraft) {
    await wait(600);
    if (/^wip\b/i.test(draft.summary)) throw new Error("The pre-commit hook blocks summaries that start with WIP.");
    const branch = branches.find((item) => item.current)?.name ?? "main";
    const id = (0x7a3f210 + nextCommit.current++ * 0x1f3d).toString(16).slice(0, 7);
    setCommits((list) => [
      { id, summary: draft.summary, author: "Sam Rivera", timestamp: "Just now", ref: "HEAD -> " + branch },
      ...list.map(({ ref, ...rest }) => (ref?.startsWith("HEAD") ? rest : { ...rest, ref })),
    ]);
    setStaged([]);
  }

  function resolve(id: string, choice: MergeConflictChoice) {
    setResolving((ids) => [...ids, id]);
    setTimeout(() => {
      setConflicts((list) => list.map((conflict) => conflict.id === id ? { ...conflict, choice } : conflict));
      setResolving((ids) => ids.filter((value) => value !== id));
    }, 500);
  }

  return (
    <div className="min-w-0 space-y-2">
      {viewing && <p className={NOTE}>{viewing}</p>}
      <div className={GRID}>
        <GitBranchPicker branches={branches} pendingIds={checkingOut} onCheckout={checkout} />
        <div className="min-w-0 space-y-2">
          <GitCommitForm stagedFiles={staged} onCommit={commit} initialValue={{ summary: "Print the returns window on receipts", body: "" }} />
          {!staged.length && (
            <Button type="button" variant="link" size="sm" onClick={() => setStaged(STAGED)}>Stage the receipt changes again</Button>
          )}
        </div>
        <GitCommitHistory commits={commits} onOpen={(id) => setViewing("Viewing commit " + id + ".")}
          onCompare={(id) => setViewing("Comparing " + id + " with the working tree.")} />
        <GitBlamePanel file="src/pricing.ts" ranges={BLAME} onOpenCommit={(id) => setViewing("Viewing commit " + id + ".")} />
        <div className="min-w-0 space-y-2 sm:col-span-2">
          <MergeConflictResolver conflicts={conflicts} pendingIds={resolving} onResolve={resolve} />
          {conflicts.every((conflict) => conflict.choice) && (
            <Button type="button" variant="link" size="sm" onClick={() => setConflicts(CONFLICTS)}>Restore the sample merge conflicts</Button>
          )}
        </div>
      </div>
    </div>
  );
}

const REVIEW_FILES: CodeReviewFile[] = [
  { id: "file-1", path: "src/cart.ts", reviewed: true },
  { id: "file-2", path: "src/pricing/contractor.ts", reviewed: false },
  { id: "file-3", path: "src/receipt.ts", reviewed: false },
  { id: "file-4", path: "test/cart.test.ts", reviewed: false },
];

const TESTS: TestExplorerEntry[] = [
  { id: "suite-cart", name: "cart", kind: "suite", outcome: "failed" },
  { id: "cart-add", name: "adds an item to the cart", kind: "test", parentName: "cart", outcome: "passed" },
  { id: "cart-discount", name: "applies the contractor discount", kind: "test", parentName: "cart", outcome: "passed" },
  { id: "cart-tax", name: "rounds tax to the cent", kind: "test", parentName: "cart", outcome: "failed" },
  { id: "suite-receipt", name: "receipt", kind: "suite", outcome: "idle" },
  { id: "receipt-footer", name: "prints the store footer", kind: "test", parentName: "receipt", outcome: "idle" },
  { id: "receipt-barcode", name: "prints the order barcode", kind: "test", parentName: "receipt", outcome: "skipped" },
];

const FAILING = new Set(["cart-tax"]);

function rollUp(tests: TestExplorerEntry[]): TestExplorerEntry[] {
  return tests.map((suite) => {
    if (suite.kind !== "suite") return suite;
    const children = tests.filter((test) => test.parentName === suite.name && test.outcome !== "skipped");
    const outcome = children.some((test) => test.outcome === "running") ? "running"
      : children.some((test) => test.outcome === "failed") ? "failed"
        : children.length && children.every((test) => test.outcome === "passed") ? "passed" : "idle";
    return { ...suite, outcome };
  });
}

function ReviewDemo() {
  const [files, setFiles] = useState(REVIEW_FILES);
  const [activeFile, setActiveFile] = useState<string | null>("file-1");
  const [tests, setTests] = useState(TESTS);

  function openFile(id: string) {
    setFiles((list) => list.map((file) => file.id === activeFile ? { ...file, reviewed: true } : file));
    setActiveFile(id);
  }

  function run(id: string, kind: TestExplorerEntry["kind"]) {
    const suite = tests.find((test) => test.id === id);
    const ids = kind === "suite"
      ? tests.filter((test) => test.parentName === suite?.name && test.outcome !== "skipped").map((test) => test.id)
      : [id];
    setTests((list) => rollUp(list.map((test) => ids.includes(test.id) ? { ...test, outcome: "running" } : test)));
    setTimeout(() => {
      setTests((list) => rollUp(list.map((test) => ids.includes(test.id) ? { ...test, outcome: FAILING.has(test.id) ? "failed" : "passed" } : test)));
    }, 900);
  }

  return (
    <div className={GRID}>
      <div className="min-w-0 space-y-2">
        <CodeReviewFileNavigator files={files} activeId={activeFile} onOpen={openFile} />
        <p className={NOTE}>Opening another file marks the current one as reviewed.</p>
      </div>
      <TestExplorer tests={tests} onRun={run} className="sm:col-span-1 lg:col-span-2" />
    </div>
  );
}

export function DevToolsGallery() {
  return (
    <GallerySection id="gallery-dev-tools" title="Debugger, git and editor panels">
      <Demo title="Debugger" className="flex w-full">
        <DebuggerDemo />
      </Demo>
      <Demo title="Editor navigation, search and diagnostics" className="flex w-full">
        <EditorDemo />
      </Demo>
      <Demo title="Branches, commits, blame and merge conflicts" className="flex w-full">
        <GitDemo />
      </Demo>
      <Demo title="Code review and tests" className="flex w-full">
        <ReviewDemo />
      </Demo>
    </GallerySection>
  );
}
