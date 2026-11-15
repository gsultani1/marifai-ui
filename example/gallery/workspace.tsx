// packages/ai-ui/example/gallery/workspace.tsx
import { CommandIcon, FilePlusIcon, PanelLeftIcon, SaveIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";

import {
  type CodeEditorHandle,
  CodeEditor,
  type Command,
  CommandPalette,
  type DatabaseRow,
  type DatabaseRowsRequest,
  DatabaseViewer,
  type DocPage,
  DocsViewer,
  FileBreadcrumb,
  type FileChange,
  FileChanges,
  type FileLock,
  FileSearch,
  FileTree,
  type FileTreeEntry,
  LockManager,
  SegmentedControl,
  Workbench,
  type WorkspaceTab,
  WorkspaceTabs,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const INITIAL: Record<string, string> = {
  "src/app.tsx": `import { OrdersPage } from "./routes/orders";\n\nexport function App() {\n  return <OrdersPage storeName="Whitten Hardware" />;\n}\n`,
  "src/lib/pricing.ts": `export const CONTRACTOR_DISCOUNT = 0.1;\n\nexport function priceFor(list: number, contractor: boolean): number {\n  const price = contractor ? list * (1 - CONTRACTOR_DISCOUNT) : list;\n  return Math.round(price * 100) / 100;\n}\n`,
  "src/lib/tax.ts": `export const TAX_RATE = 0.0975;\n\nexport function withTax(amount: number): number {\n  return Math.round(amount * (1 + TAX_RATE) * 100) / 100;\n}\n`,
  "src/routes/orders.tsx": `import { priceFor } from "../lib/pricing";\nimport { withTax } from "../lib/tax";\n\nexport function OrdersPage({ storeName }: { storeName: string }) {\n  const total = withTax(priceFor(42.5, true));\n  return <h1>{storeName}: {total}</h1>;\n}\n`,
  "README.md": "# Whitten POS\n\nCounter app for orders, pricing and tax.\n",
  "package.json": `{\n  "name": "whitten-pos",\n  "private": true,\n  "scripts": { "dev": "vite" }\n}\n`,
  ".env": "DATABASE_URL=postgres://pos:hunter2secret@db.internal/pos\nSTRIPE_SECRET_KEY=demo_stripe_secret_7f3a9c21\nPUBLIC_STORE_NAME=Whitten Hardware\n",
  "public/logo.png": "\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\u0000\u0000\u0000\u0010",
  "node_modules/react/index.js": "module.exports = {};\n",
};

const STREAMED = `export function receiptLines(items: Array<{ name: string; price: number }>): string[] {\n  return items.map((item) => \`\${item.name.padEnd(24)} \${item.price.toFixed(2).padStart(8)}\`);\n}\n`;

const ORDERS: DatabaseRow[] = Array.from({ length: 64 }, (_, index) => ({
  id: index + 1,
  customer: ["Ana Ruiz", "Luis Ortega", "Dana Webb", "Cole Builders", "Maple Farms"][index % 5],
  total: Math.round((19 + ((index * 37) % 400) + (index % 3) * 0.49) * 100) / 100,
  status: ["paid", "open", "paid", "refunded"][index % 4],
  meta: index % 6 === 0 ? JSON.stringify({ rush: true, notes: "Deliver to job site", items: index % 7 }) : null,
}));

const ITEMS: DatabaseRow[] = [
  { sku: "SCR-3-DECK", name: "3 in deck screws, 5 lb", on_hand: 14, reorder_at: 20 },
  { sku: "SAND-50", name: "Play sand, 50 lb", on_hand: 0, reorder_at: 30 },
  { sku: "MULCH-BLK", name: "Black mulch, 2 cu ft", on_hand: 212, reorder_at: 80 },
];

const TABLES = [
  { name: "orders", rowCount: ORDERS.length, columns: [{ name: "id", type: "INTEGER", primaryKey: true, nullable: false }, { name: "customer", type: "TEXT" }, { name: "total", type: "REAL" }, { name: "status", type: "TEXT" }, { name: "meta", type: "JSON" }] },
  { name: "items", rowCount: ITEMS.length, columns: [{ name: "sku", type: "TEXT", primaryKey: true, nullable: false }, { name: "name", type: "TEXT" }, { name: "on_hand", type: "INTEGER" }, { name: "reorder_at", type: "INTEGER" }] },
];

const DOCS: DocPage[] = [
  {
    id: "overview",
    title: "Overview",
    content: "# Whitten POS\n\nThe counter app rings up orders, applies contractor pricing and adds sales tax.\n\n## Architecture\n\nRoutes live in `src/routes`, shared math in `src/lib`.\n\n### Pricing\n\nContractor accounts get 10% off list.\n\n### Tax\n\nThe Memphis combined rate is 9.75%.\n\n## Running locally\n\n```sh\nnpm install\nnpm run dev\n```\n\n## Deploying\n\nPush to `main`; the pipeline builds and deploys the store image.\n",
  },
  { id: "pricing", title: "Pricing rules", content: "# Pricing rules\n\n## Contractor discount\n\nApplied before tax.\n\n## Rounding\n\nPrices round to the cent after each step.\n" },
];

const LANGUAGE: Record<string, string> = { tsx: "tsx", ts: "typescript", md: "markdown", json: "json", env: "shell" };
const languageFor = (path: string) => LANGUAGE[path.split(".").pop() ?? ""];
const titleFor = (path: string) => path.split("/").pop() ?? path;

function loadTableRows(table: string, request: DatabaseRowsRequest, signal: AbortSignal): Promise<{ rows: DatabaseRow[]; total: number }> {
  const source = table === "orders" ? ORDERS : ITEMS;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const sorted = request.sort ? [...source].sort((a, b) => String(a[request.sort!.column] ?? "").localeCompare(String(b[request.sort!.column] ?? ""), undefined, { numeric: true }) * (request.sort!.direction === "ascending" ? 1 : -1)) : source;
      resolve({ rows: sorted.slice(request.offset, request.offset + request.limit), total: source.length });
    }, 250);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

function MiniIde() {
  const [contents, setContents] = useState(INITIAL);
  const [saved, setSaved] = useState(INITIAL);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: "src/routes/orders.tsx", title: "orders.tsx", path: "src/routes/orders.tsx" },
    { id: "src/lib/pricing.ts", title: "pricing.ts", path: "src/lib/pricing.ts" },
  ]);
  const [active, setActive] = useState<string | null>("src/routes/orders.tsx");
  const [closed, setClosed] = useState<WorkspaceTab[]>([]);
  const [sideView, setSideView] = useState<"files" | "search" | "locks">("files");
  const [locks, setLocks] = useState<FileLock[]>([{ path: ".env", lockedBy: "George" }]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [status, setStatus] = useState("Ready");
  const [editor, setEditor] = useState<CodeEditorHandle | null>(null);

  const paths = Object.keys(contents);
  const changes: FileChange[] = paths.flatMap((path): FileChange[] => {
    if (!(path in saved)) return [{ path, status: "added", additions: contents[path]!.split("\n").length - 1 }];
    if (saved[path] === contents[path]) return [];
    const before = saved[path]!.split("\n");
    const after = contents[path]!.split("\n");
    return [{ path, status: "modified", additions: after.filter((line) => !before.includes(line)).length, deletions: before.filter((line) => !after.includes(line)).length }];
  });
  const files: FileTreeEntry[] = paths.map((path) => ({
    path,
    ...(changes.find((change) => change.path === path) ? { status: changes.find((change) => change.path === path)!.status } : {}),
    ...(contents[path] !== saved[path] && path in saved ? { unsaved: true } : {}),
    ...(locks.some((lock) => lock.path === path) ? { locked: true } : {}),
  }));

  const showTab = (path: string) => {
    setTabs((list) => (list.some((tab) => tab.id === path) ? list : [...list, { id: path, title: titleFor(path), path }]));
    setActive(path);
  };

  const open = (path: string, line?: number, column?: number) => {
    if (!(path in contents)) return;
    showTab(path);
    if (line) setTimeout(() => editor?.revealLine(line, column), 60);
  };

  const close = (ids: string[]) => {
    setClosed((list) => [...tabs.filter((tab) => ids.includes(tab.id)), ...list.filter((tab) => !ids.includes(tab.id))]);
    setTabs((list) => list.filter((tab) => !ids.includes(tab.id)));
    if (active && ids.includes(active)) setActive(null);
  };

  const save = (path: string, text: string) => {
    setSaved((map) => ({ ...map, [path]: text }));
    setStatus(`Saved ${titleFor(path)}`);
  };

  const streamNewFile = () => {
    const path = "src/lib/receipt.ts";
    setContents((map) => ({ ...map, [path]: "" }));
    showTab(path);
    setStreaming(path);
    let index = 0;
    const timer = setInterval(() => {
      index = Math.min(STREAMED.length, index + 6);
      setContents((map) => ({ ...map, [path]: STREAMED.slice(0, index) }));
      if (index >= STREAMED.length) {
        clearInterval(timer);
        setStreaming(null);
        setStatus("The assistant created receipt.ts");
      }
    }, 40);
  };

  const commands: Command[] = [
    ...paths.filter((path) => !path.startsWith("node_modules/")).map((path) => ({ id: `open:${path}`, label: titleFor(path), description: path, group: "Files", onSelect: () => open(path) })),
    { id: "save", label: "Save file", group: "Commands", shortcut: "mod+s", icon: <SaveIcon aria-hidden="true" />, disabled: !active, onSelect: () => active && save(active, contents[active]!) },
    { id: "sidebar", label: "Toggle sidebar", group: "Commands", shortcut: "mod+b", keywords: ["explorer"], icon: <PanelLeftIcon aria-hidden="true" />, onSelect: () => setSidebarOpen((value) => !value) },
    { id: "new", label: "Have the assistant write receipt.ts", group: "Commands", icon: <SparklesIcon aria-hidden="true" />, onSelect: streamNewFile },
  ];

  const activeTabs = tabs.map((tab) => ({ ...tab, unsaved: contents[tab.id] !== saved[tab.id] && tab.id in saved }));

  return (
    <>
      <Workbench
        className="h-[40rem] w-full"
        storageKey="ai-ui-gallery:workbench"
        sidebarOpen={sidebarOpen}
        onSidebarOpenChange={setSidebarOpen}
        panelLabel="Database"
        defaultPanelOpen={false}
        header={
          <>
            <span className="text-sm font-semibold">whitten-pos</span>
            <FileChanges
              changes={changes}
              onOpen={(path) => open(path)}
              onDiscard={(discard) => {
                setContents((map) => {
                  const next = { ...map };
                  for (const path of discard) {
                    if (path in saved) next[path] = saved[path]!;
                    else delete next[path];
                  }
                  return next;
                });
              }}
            />
            <button type="button" onClick={() => setPaletteOpen(true)} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5">
              <CommandIcon aria-hidden="true" />
              Commands
            </button>
          </>
        }
        sidebar={
          <div className="flex h-full min-h-0 flex-col gap-2 p-2">
            <SegmentedControl
              label="Sidebar view"
              size="sm"
              fullWidth
              value={sideView}
              onValueChange={setSideView}
              options={[
                { value: "files", label: "Files" },
                { value: "search", label: "Search" },
                { value: "locks", label: "Locks" },
              ]}
            />
            {sideView === "files" && (
              <FileTree
                files={files}
                ignore={["node_modules/"]}
                selectedPath={active}
                onSelect={(path) => open(path)}
                defaultExpanded={["src", "src/routes"]}
                onCreate={(path, kind) => {
                  if (kind === "file") {
                    setContents((map) => ({ ...map, [path]: "" }));
                    showTab(path);
                  } else setContents((map) => ({ ...map, [`${path}/.gitkeep`]: "" }));
                }}
                onRename={(from, to) => {
                  setContents((map) => Object.fromEntries(Object.entries(map).map(([path, text]) => [path === from ? to : path.startsWith(`${from}/`) ? to + path.slice(from.length) : path, text])));
                  setTabs((list) => list.map((tab) => (tab.id === from ? { ...tab, id: to, title: titleFor(to), path: to } : tab)));
                  if (active === from) setActive(to);
                }}
                onDelete={(path) => {
                  setContents((map) => Object.fromEntries(Object.entries(map).filter(([key]) => key !== path && !key.startsWith(`${path}/`))));
                  close(tabs.filter((tab) => tab.id === path || tab.id.startsWith(`${path}/`)).map((tab) => tab.id));
                }}
                onDropFiles={(folder, dropped) => {
                  void Promise.all(dropped.map(async (file) => [`${folder ? `${folder}/` : ""}${file.webkitRelativePath || file.name}`, await file.text()] as const)).then((entries) => setContents((map) => ({ ...map, ...Object.fromEntries(entries) })));
                }}
                className="min-h-0 flex-1"
              />
            )}
            {sideView === "search" && <FileSearch files={paths.filter((path) => !path.startsWith("node_modules/") && path !== "public/logo.png").map((path) => ({ path, content: contents[path]! }))} onOpen={open} className="min-h-0 flex-1" />}
            {sideView === "locks" && <LockManager files={paths} ignore={["node_modules/"]} locks={locks} onLockChange={(path, locked) => setLocks((list) => (locked ? [...list, { path, lockedBy: "You" }] : list.filter((lock) => lock.path !== path)))} className="min-h-0 flex-1 border-0 p-0" />}
          </div>
        }
        editor={
          <WorkspaceTabs
            tabs={activeTabs}
            activeId={active}
            onActiveChange={setActive}
            onClose={close}
            onReorder={(ids) => setTabs((list) => ids.map((id) => list.find((tab) => tab.id === id)!))}
            onPinChange={(id, pinned) => setTabs((list) => list.map((tab) => (tab.id === id ? { ...tab, pinned } : tab)))}
            recentlyClosed={closed}
            onReopen={(tab) => open(tab.id)}
            className="h-full"
          >
            {active && active in contents ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center gap-2 border-b border-border px-3 py-1">
                  <FileBreadcrumb path={active} files={files.filter((file) => !file.path.startsWith("node_modules/"))} onNavigate={(path) => open(path)} className="min-w-0 flex-1" />
                  {locks.some((lock) => lock.path === active) && <span className="text-xs text-muted-foreground">Locked</span>}
                </div>
                <CodeEditor
                  ref={setEditor}
                  aria-label={`Editing ${titleFor(active)}`}
                  value={contents[active]!}
                  onValueChange={(text) => setContents((map) => ({ ...map, [active]: text }))}
                  onSave={(text) => save(active, text)}
                  language={languageFor(active)}
                  readOnly={locks.some((lock) => lock.path === active)}
                  streaming={streaming === active}
                  maskSecrets={active.endsWith(".env")}
                  className="min-h-0 flex-1 rounded-none border-0"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <p>Open a file from the tree, search or the command palette.</p>
                <button type="button" onClick={streamNewFile} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4">
                  <FilePlusIcon aria-hidden="true" />
                  Have the assistant write a file
                </button>
              </div>
            )}
          </WorkspaceTabs>
        }
        panel={<DatabaseViewer tables={TABLES} loadRows={loadTableRows} pageSize={20} className="h-full rounded-none border-0" />}
        statusBar={
          <>
            <span>main</span>
            <span role="status">{status}</span>
            <span className="ml-auto">{active ? (languageFor(active) ?? "text") : ""}</span>
          </>
        }
      />
      <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} recentKey="ai-ui-gallery:commands" modes={[{ prefix: ":", label: "Go to line", commands: (query) => (active && /^\d+$/.test(query) ? [{ id: "line", label: `Go to line ${query} in ${titleFor(active)}`, onSelect: () => setTimeout(() => editor?.revealLine(Number(query)), 60) }] : []) }]} />
    </>
  );
}

function DocsDemo() {
  const [pages, setPages] = useState(DOCS);
  return (
    <div className="flex w-full flex-col gap-2">
      <DocsViewer pages={pages} className="h-96 w-full" />
      <button
        type="button"
        onClick={() => {
          const id = `faq-${pages.length}`;
          const full = "# FAQ\n\n## Can I void a sale?\n\nYes, managers can void within the shift.\n\n## Where do refunds go?\n\nBack to the original card.\n";
          setPages((list) => [...list, { id, title: "FAQ", content: "", generating: true }]);
          let index = 0;
          const timer = setInterval(() => {
            index = Math.min(full.length, index + 8);
            setPages((list) => list.map((page) => (page.id === id ? { ...page, content: full.slice(0, index), generating: index < full.length } : page)));
            if (index >= full.length) clearInterval(timer);
          }, 60);
        }}
        className="self-start rounded-md border border-border px-2.5 py-1 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        Generate an FAQ page
      </button>
    </div>
  );
}

export function WorkspaceGallery() {
  return (
    <GallerySection id="gallery-workspace" title="Workspace and IDE">
      <Demo title="Workbench with file tree, search, locks, tabs, editor, changes and database" className="w-full">
        <MiniIde />
      </Demo>
      <Demo title="Generated documentation" className="w-full">
        <DocsDemo />
      </Demo>
    </GallerySection>
  );
}
