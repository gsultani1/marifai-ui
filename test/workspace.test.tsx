// packages/ai-ui/test/workspace.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ancestorPaths,
  buildFileTree,
  CodeEditor,
  type Command,
  CommandPalette,
  createIgnoreMatcher,
  type DatabaseRowsRequest,
  DatabaseViewer,
  DocsViewer,
  extractHeadings,
  FileBreadcrumb,
  FileChanges,
  FileSearch,
  FileTree,
  findSecretRanges,
  fuzzyFilter,
  fuzzyMatch,
  highlightRanges,
  LockManager,
  looksBinary,
  maskSecrets,
  neighbourAfterClose,
  profileColumn,
  searchFileContents,
  slugify,
  topValues,
  validateFileName,
  visibleNodes,
  Workbench,
  type WorkspaceTab,
  WorkspaceTabs,
} from "../src/index.js";

afterEach(() => {
  window.localStorage.clear();
});

const FILES = [
  { path: "src/app.tsx", status: "modified" as const },
  { path: "src/lib/pricing.ts", unsaved: true },
  { path: "src/lib/tax.ts", status: "added" as const },
  { path: "src/routes/orders.tsx" },
  { path: "README.md", locked: true },
  { path: "package.json" },
  { path: "node_modules/react/index.js" },
  { path: "logs/server.log" },
  { path: "src/item10.ts" },
  { path: "src/item2.ts" },
];

describe("file tree utilities", () => {
  it("builds a sorted tree with folders first, natural order and change counts", () => {
    const tree = buildFileTree(FILES, ["node_modules/", "*.log"]);
    expect(tree.map((node) => node.name)).toEqual(["src", "package.json", "README.md"]);
    const src = tree[0]!;
    expect(src.children.map((node) => node.name)).toEqual(["lib", "routes", "app.tsx", "item2.ts", "item10.ts"]);
    expect(src.changes).toBe(2);
    expect(src.children[0]!.changes).toBe(1);
  });

  it("matches gitignore-style patterns", () => {
    const ignored = createIgnoreMatcher(["node_modules/", "*.log", "!keep.log", "/dist", "build/**/cache", "# comment"]);
    expect(ignored("node_modules/react/index.js")).toBe(true);
    expect(ignored("packages/a/node_modules/x.js")).toBe(true);
    expect(ignored("logs/server.log")).toBe(true);
    expect(ignored("logs/keep.log")).toBe(false);
    expect(ignored("dist/app.js")).toBe(true);
    expect(ignored("src/dist/app.js")).toBe(false);
    expect(ignored("build/a/b/cache")).toBe(true);
    expect(ignored("src/app.tsx")).toBe(false);
  });

  it("lists visible nodes with ARIA positions", () => {
    const tree = buildFileTree(FILES, ["node_modules/", "logs/"]);
    const rows = visibleNodes(tree, new Set(["src"]));
    expect(rows.slice(0, 3).map((row) => [row.node.path, row.level, row.position, row.setSize])).toEqual([
      ["src", 1, 1, 3],
      ["src/lib", 2, 1, 5],
      ["src/routes", 2, 2, 5],
    ]);
    expect(ancestorPaths("a/b/c.ts")).toEqual(["a", "a/b"]);
  });

  it("validates new names", () => {
    expect(validateFileName("  ")).toBe("Enter a name.");
    expect(validateFileName("a:b")).toMatch(/can't contain/);
    expect(validateFileName("../x")).toMatch(/can't contain/);
    expect(validateFileName("App.tsx", ["app.tsx"])).toBe('"App.tsx" already exists here.');
    expect(validateFileName("components/Button.tsx")).toBeNull();
  });
});

describe("fuzzy matching", () => {
  it("prefers contiguous and word-start matches and returns highlight indices", () => {
    expect(fuzzyMatch("xyz", "Open file")).toBeNull();
    const direct = fuzzyMatch("file", "Open file")!;
    const scattered = fuzzyMatch("of", "Open file")!;
    expect(direct.score).toBeGreaterThan(scattered.score);
    expect(direct.indices).toEqual([5, 6, 7, 8]);
    expect(highlightRanges("Open file", scattered.indices)).toEqual([
      { text: "O", match: true },
      { text: "pen ", match: false },
      { text: "f", match: true },
      { text: "ile", match: false },
    ]);
    const ranked = fuzzyFilter(["Toggle sidebar", "Save file", "Go to file"], "file", (item) => [item]).map((result) => result.item);
    expect(ranked).toEqual(["Save file", "Go to file"]);
  });
});

describe("searchFileContents", () => {
  const files = [
    { path: "src/a.ts", content: "const price = 1;\nconst Price = 2;\nexport { priceList };" },
    { path: "src/b.ts", content: "no match here" },
  ];

  it("finds matches with case, whole word and regex options", () => {
    expect(searchFileContents(files, "price").total).toBe(3);
    expect(searchFileContents(files, "price", { matchCase: true }).total).toBe(2);
    const whole = searchFileContents(files, "price", { wholeWord: true });
    expect(whole.groups[0]!.matches.map((match) => match.line)).toEqual([1, 2]);
    const regex = searchFileContents(files, "pri\\w+List", { regex: true });
    expect(regex.groups[0]!.matches[0]).toMatchObject({ line: 3, column: 10, ranges: [[9, 18]] });
  });

  it("reports invalid expressions and caps results", () => {
    expect(searchFileContents(files, "(", { regex: true }).error).toMatch(/^Invalid regular expression/);
    expect(searchFileContents(files, "x*", { regex: true }).error).toMatch(/matches empty text/);
    const capped = searchFileContents(files, "e", { maxResults: 2 });
    expect(capped).toMatchObject({ truncated: true, total: 2 });
  });

  it("trims long lines around the match", () => {
    const long = { path: "min.js", content: `${"a".repeat(400)}needle${"b".repeat(400)}` };
    const [match] = searchFileContents([long], "needle").groups[0]!.matches;
    expect(match!.preview.startsWith("…")).toBe(true);
    expect(match!.preview.slice(match!.ranges[0]![0], match!.ranges[0]![1])).toBe("needle");
  });
});

describe("secrets, docs and profiles", () => {
  it("finds and masks likely secrets", () => {
    const env = 'API_KEY=abc123secretvalue\nDEBUG=true\npassword: "hunter22"\ntoken = process.env.TOKEN\nkey: sk-ant-abcdefghijklmnopqrstuvwxyz';
    const masked = maskSecrets(env);
    expect(masked).toContain("API_KEY=••••••••");
    expect(masked).toContain('password: "••••••••"');
    expect(masked).toContain("DEBUG=true");
    expect(masked).toContain("token = process.env.TOKEN");
    expect(masked).not.toContain("sk-ant-");
    expect(findSecretRanges("nothing to see")).toEqual([]);
    expect(maskSecrets("DATABASE_URL=postgres://pos:hunter2secret@db.internal/pos")).toBe("DATABASE_URL=postgres://pos:••••••••@db.internal/pos");
  });

  it("detects binary text", () => {
    expect(looksBinary("PNG\u0000\u0001\u0002")).toBe(true);
    expect(looksBinary("plain text\n")).toBe(false);
  });

  it("extracts headings outside code with unique ids", () => {
    const markdown = "# Intro\n\nText\n\n```md\n# not a heading\n```\n\n## Setup\n### Setup\nTitle\n=====\n#### Deep";
    expect(extractHeadings(markdown)).toEqual([
      { level: 1, text: "Intro", id: "intro" },
      { level: 2, text: "Setup", id: "setup" },
      { level: 3, text: "Setup", id: "setup-1" },
      { level: 1, text: "Title", id: "title" },
    ]);
    expect(slugify("Café & Bar: v2!")).toBe("cafe-bar-v2");
  });

  it("profiles columns of typed values", () => {
    const numbers = profileColumn([3, 1, null, 2, 2]);
    expect(numbers).toMatchObject({ type: "number", nulls: 1, distinct: 3, min: 1, max: 3, mean: 2 });
    expect(numbers.top[0]).toEqual({ value: "2", count: 2 });
    expect(profileColumn(["2026-01-02", "2025-12-31"])).toMatchObject({ type: "date", min: "2025-12-31", max: "2026-01-02" });
    expect(profileColumn([{ a: 1 }, "x"]).type).toBe("mixed");
    expect(topValues(["b", "a", "b"], 1)).toEqual([{ value: "b", count: 2 }]);
  });
});

function TreeHarness(props: Partial<Parameters<typeof FileTree>[0]>) {
  const [selected, setSelected] = useState<string | null>(null);
  return <FileTree files={FILES} ignore={["node_modules/", "logs/"]} selectedPath={selected} onSelect={setSelected} {...props} />;
}

describe("FileTree", () => {
  it("navigates like an ARIA tree and opens files", () => {
    const onSelect = vi.fn();
    render(<FileTree files={FILES} ignore={["node_modules/", "logs/"]} onSelect={onSelect} />);
    const tree = screen.getByRole("tree", { name: "Files" });
    const src = within(tree).getByRole("treeitem", { name: /^src/ });
    expect(src.getAttribute("aria-expanded")).toBe("false");
    expect(src.tabIndex).toBe(0);
    act(() => src.focus());
    fireEvent.keyDown(src, { key: "ArrowRight" });
    expect(src.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(src, { key: "ArrowRight" });
    expect(within(tree).getByRole("treeitem", { name: /^lib/ }).tabIndex).toBe(0);
    fireEvent.keyDown(src, { key: "End" });
    const readme = within(tree).getByRole("treeitem", { name: /^README.md\s?, locked/ });
    expect(readme.tabIndex).toBe(0);
    fireEvent.keyDown(readme, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("README.md");
    fireEvent.keyDown(readme, { key: "a" });
    expect(within(tree).getByRole("treeitem", { name: /^app.tsx\s?, modified/ }).tabIndex).toBe(0);
    fireEvent.keyDown(readme, { key: "ArrowLeft" });
    expect(src.tabIndex).toBe(0);
  });

  it("reveals the selected file and shows badges", () => {
    render(<FileTree files={FILES} selectedPath="src/lib/pricing.ts" />);
    const file = screen.getByRole("treeitem", { name: /^pricing.ts\s?, unsaved$/ });
    expect(file.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("treeitem", { name: /^tax.ts\s?, added$/ })).toBeTruthy();
    expect(screen.getByRole("treeitem", { name: /^src$/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("creates, renames with F2 and deletes after confirmation", async () => {
    const onCreate = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(<TreeHarness onCreate={onCreate} onRename={onRename} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "New file" }));
    const name = screen.getByRole("textbox", { name: "File name" });
    fireEvent.change(name, { target: { value: "package.json" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toBe('"package.json" already exists here.');
    fireEvent.change(name, { target: { value: "notes.md" } });
    fireEvent.keyDown(name, { key: "Enter" });
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("notes.md", "file"));
    expect(onCreate).toHaveBeenCalledTimes(1);

    const readme = screen.getByRole("treeitem", { name: /^README.md/ });
    act(() => readme.focus());
    fireEvent.keyDown(readme, { key: "F2" });
    const rename = screen.getByRole("textbox", { name: "New name" });
    fireEvent.change(rename, { target: { value: "GUIDE.md" } });
    fireEvent.keyDown(rename, { key: "Enter" });
    await waitFor(() => expect(onRename).toHaveBeenCalledWith("README.md", "GUIDE.md"));

    const pkg = screen.getByRole("treeitem", { name: /^package.json/ });
    act(() => pkg.focus());
    fireEvent.keyDown(pkg, { key: "Delete" });
    const dialog = await screen.findByRole("alertdialog", { name: "Delete package.json?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("package.json", "file"));
  });

  it("cancels a rename on Escape without committing", () => {
    const onRename = vi.fn();
    render(<TreeHarness onRename={onRename} />);
    const pkg = screen.getByRole("treeitem", { name: /^package.json/ });
    act(() => pkg.focus());
    fireEvent.keyDown(pkg, { key: "F2" });
    const rename = screen.getByRole("textbox", { name: "New name" });
    fireEvent.change(rename, { target: { value: "other.json" } });
    fireEvent.keyDown(rename, { key: "Escape" });
    fireEvent.blur(rename);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "New name" })).toBeNull();
  });
});

describe("file breadcrumb, search and changes", () => {
  it("lists siblings from a path segment", async () => {
    const onNavigate = vi.fn();
    render(<FileBreadcrumb path="src/lib/pricing.ts" files={FILES} onNavigate={onNavigate} rootLabel="whitten-pos" />);
    const nav = screen.getByRole("navigation", { name: "File path" });
    expect(within(nav).getByText("whitten-pos")).toBeTruthy();
    fireEvent.click(within(nav).getByRole("button", { name: "pricing.ts, show items in src/lib" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "tax.ts" }));
    expect(onNavigate).toHaveBeenCalledWith("src/lib/tax.ts");
  });

  it("searches files and opens a result at its line", async () => {
    const onOpen = vi.fn();
    render(<FileSearch files={[{ path: "src/a.ts", content: "let price = 1;\nprice += 2;" }, { path: "src/b.ts", content: "PRICE" }]} onOpen={onOpen} />);
    const input = screen.getByRole("searchbox", { name: "Search in files" });
    fireEvent.change(input, { target: { value: "price" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("3 results in 2 files")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Match case" }));
    expect(screen.getByText("2 results in 1 file")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Line 2: price += 2;" }));
    expect(onOpen).toHaveBeenCalledWith("src/a.ts", 2, 1);
    fireEvent.click(screen.getByRole("button", { name: "Use regular expression" }));
    fireEvent.change(input, { target: { value: "(" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect((await screen.findByRole("alert")).textContent).toMatch(/Invalid regular expression/);
  });

  it("summarizes changed files and discards after confirmation", async () => {
    const onDiscard = vi.fn();
    render(
      <FileChanges
        changes={[
          { path: "src/app.tsx", status: "modified", additions: 10, deletions: 3 },
          { path: "src/new.ts", status: "added", additions: 2 },
        ]}
        onDiscard={onDiscard}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^2 files changed 12 lines added 3 lines removed/ }));
    const popup = await screen.findByRole("dialog", { name: "2 files changed" });
    expect(within(popup).getByRole("button", { name: /^new.ts src\s?, added/ })).toBeTruthy();
    fireEvent.click(within(popup).getByRole("button", { name: "Discard changes to src/app.tsx" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Discard changes to app.tsx?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(onDiscard).toHaveBeenCalledWith(["src/app.tsx"]));
  });

  it("locks files from a searchable list", () => {
    const onLockChange = vi.fn();
    render(<LockManager files={["src/app.tsx", ".env", "README.md"]} locks={[{ path: ".env", lockedBy: "Dana" }]} onLockChange={onLockChange} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]!.textContent).toContain(".env");
    expect(within(items[0]!).getByText("Locked by Dana")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Lock README.md" }));
    expect(onLockChange).toHaveBeenCalledWith("README.md", true);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a file to lock" }), { target: { value: "app" } });
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });
});

const TABS: WorkspaceTab[] = [
  { id: "a", title: "app.tsx", path: "src/app.tsx" },
  { id: "b", title: "pricing.ts", path: "src/lib/pricing.ts", unsaved: true },
  { id: "c", title: "README.md", pinned: true },
];

function TabsHarness({ onReorder }: { onReorder?: (ids: string[]) => void }) {
  const [tabs, setTabs] = useState(TABS);
  const [active, setActive] = useState("a");
  const [closed, setClosed] = useState<WorkspaceTab[]>([]);
  return (
    <WorkspaceTabs
      tabs={tabs}
      activeId={active}
      onActiveChange={setActive}
      onClose={(ids) => {
        setClosed((list) => [...tabs.filter((tab) => ids.includes(tab.id)), ...list]);
        setTabs((list) => list.filter((tab) => !ids.includes(tab.id)));
      }}
      onReorder={(ids) => {
        onReorder?.(ids);
        setTabs((list) => ids.map((id) => list.find((tab) => tab.id === id)!));
      }}
      recentlyClosed={closed}
      onReopen={(tab) => {
        setTabs((list) => [...list, tab]);
        setActive(tab.id);
      }}
    >
      <p>Editing {active}</p>
    </WorkspaceTabs>
  );
}

describe("WorkspaceTabs", () => {
  it("keeps pinned tabs first and moves with arrows", () => {
    render(<TabsHarness />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual(["README.md, pinned", "app.tsx", "pricing.ts, unsaved"]);
    expect(screen.getByRole("tabpanel", { name: "app.tsx" }).textContent).toBe("Editing a");
    tabs[1]!.focus();
    fireEvent.keyDown(tabs[1]!, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /^pricing.ts\s?, unsaved$/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("closes with Delete, activates the neighbour and reopens from history", async () => {
    render(<TabsHarness />);
    const app = screen.getByRole("tab", { name: "app.tsx" });
    expect(app.getAttribute("aria-keyshortcuts")).toBe("Delete");
    act(() => app.focus());
    fireEvent.keyDown(app, { key: "Delete" });
    expect(screen.queryByRole("tab", { name: "app.tsx" })).toBeNull();
    expect(screen.getByRole("tab", { name: /^pricing.ts\s?, unsaved$/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /^README.md\s?, pinned$/ }).getAttribute("aria-keyshortcuts")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recently closed" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "src/app.tsx" }));
    expect(screen.getByRole("tab", { name: "app.tsx" }).getAttribute("aria-selected")).toBe("true");
  });

  it("reorders with Alt+Shift+arrows within the unpinned group and closes on middle click", () => {
    const onReorder = vi.fn();
    render(<TabsHarness onReorder={onReorder} />);
    const app = screen.getByRole("tab", { name: "app.tsx" });
    fireEvent.keyDown(app, { key: "ArrowRight", altKey: true, shiftKey: true });
    expect(onReorder).toHaveBeenCalledWith(["c", "b", "a"]);
    fireEvent.keyDown(screen.getByRole("tab", { name: "app.tsx" }), { key: "ArrowLeft", altKey: true, shiftKey: true });
    fireEvent.keyDown(screen.getByRole("tab", { name: "app.tsx" }), { key: "ArrowLeft", altKey: true, shiftKey: true });
    expect(onReorder).toHaveBeenCalledTimes(2);
    fireEvent(screen.getByRole("tab", { name: /^pricing.ts\s?, unsaved$/ }).parentElement!, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(screen.queryByRole("tab", { name: /pricing.ts/ })).toBeNull();
  });

  it("picks the tab to activate after a close", () => {
    const tabs = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(neighbourAfterClose(tabs, "b", ["b"])).toBe("c");
    expect(neighbourAfterClose(tabs, "c", ["c"])).toBe("b");
    expect(neighbourAfterClose(tabs, "a", ["b"])).toBe("a");
    expect(neighbourAfterClose(tabs, "b", ["a", "b", "c"])).toBeNull();
  });
});

describe("Workbench", () => {
  it("toggles the sidebar and panel from buttons and shortcuts", () => {
    render(<Workbench sidebar={<p>Tree</p>} editor={<p>Editor</p>} panel={<p>Terminal output</p>} panelLabel="Terminal" />);
    expect(screen.getByRole("complementary", { name: "Explorer" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Terminal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show terminal" }));
    expect(screen.queryByText("Terminal output")).toBeNull();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.queryByText("Tree")).toBeNull();
    expect(screen.getByRole("button", { name: "Show explorer" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Editor")).toBeTruthy();
  });
});

describe("CodeEditor extras", () => {
  it("shows a placeholder for binary content and masks secrets before loading", () => {
    const { rerender, container } = render(<CodeEditor value={"GIF89a\u0000\u0001"} />);
    expect(screen.getByText("Binary file")).toBeTruthy();
    rerender(<CodeEditor value="API_KEY=supersecretvalue" maskSecrets />);
    expect(container.querySelector("pre")?.textContent).toBe("API_KEY=••••••••");
  });
});

describe("DocsViewer", () => {
  it("renders the outline, assigns heading ids and switches pages", () => {
    const pages = [
      { id: "guide", title: "Guide", content: "# Guide\n\nIntro.\n\n## Install\n\nSteps.\n\n## Use\n\nMore." },
      { id: "api", title: "API", content: "# API\n\nEndpoints.", generating: true },
    ];
    render(<DocsViewer pages={pages} />);
    const outline = screen.getByRole("navigation", { name: "On this page" });
    const install = within(outline).getByRole("link", { name: "Install" });
    expect(install.getAttribute("href")).toBe("#doc-install");
    expect(document.getElementById("doc-install")?.textContent).toBe("Install");
    fireEvent.click(install);
    expect(install.getAttribute("aria-current")).toBe("location");
    expect(document.activeElement?.id).toBe("doc-install");
    expect(screen.getByRole("status").textContent).toBe("Generating");
    fireEvent.click(screen.getByRole("button", { name: /^API\s?, generating$/ }));
    expect(screen.getByRole("region", { name: "API" }).textContent).toContain("Endpoints.");
  });
});

describe("DatabaseViewer", () => {
  const tables = [
    { name: "orders", rowCount: 3, columns: [{ name: "id", type: "INTEGER", primaryKey: true }, { name: "customer", type: "TEXT" }, { name: "meta", type: "JSON", nullable: true }] },
    { name: "items", rowCount: 0, columns: [{ name: "sku", type: "TEXT" }] },
  ];
  const rows = [
    { id: 1, customer: "Ana", meta: '{"rush":true}' },
    { id: 2, customer: "Ben", meta: null },
    { id: 3, customer: "Cy", meta: null },
  ];

  it("loads, sorts, navigates cells and opens details", async () => {
    const loadRows = vi.fn((table: string, request: DatabaseRowsRequest) => Promise.resolve({ rows: table === "orders" ? (request.sort?.direction === "descending" ? [...rows].reverse() : rows) : [], total: table === "orders" ? 3 : 0 }));
    render(<DatabaseViewer tables={tables} loadRows={loadRows} />);
    const grid = await screen.findByRole("grid", { name: "Rows of orders" });
    await within(grid).findByText("Ana");
    expect(loadRows).toHaveBeenLastCalledWith("orders", { offset: 0, limit: 50 }, expect.any(AbortSignal));
    expect(within(grid).getAllByText("NULL")).toHaveLength(2);

    fireEvent.click(within(grid).getByRole("button", { name: "customer" }));
    await waitFor(() => expect(loadRows).toHaveBeenLastCalledWith("orders", { offset: 0, limit: 50, sort: { column: "customer", direction: "ascending" } }, expect.any(AbortSignal)));
    fireEvent.click(within(grid).getByRole("button", { name: "customer" }));
    await waitFor(() => expect(within(grid).getAllByRole("row")[1]!.textContent).toContain("Cy"));
    expect(within(grid).getByRole("columnheader", { name: /customer/ }).getAttribute("aria-sort")).toBe("descending");

    const first = within(grid).getAllByRole("gridcell")[0]!;
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(first, { key: "Enter" });
    const detail = screen.getByRole("complementary", { name: "meta · row 3" });
    expect(within(detail).getByText("rush")).toBeTruthy();
    fireEvent.click(within(detail).getByRole("button", { name: "Close cell detail" }));

    fireEvent.click(screen.getByRole("radio", { name: "Schema" }));
    expect(screen.getByRole("table", { name: "Columns of orders" }).textContent).toContain("Primary");
    fireEvent.click(screen.getByRole("button", { name: /^items/ }));
    expect(screen.getByRole("heading", { name: "items" })).toBeTruthy();
  });

  it("shows a retry when rows fail to load", async () => {
    let fail = true;
    const loadRows = vi.fn(() => (fail ? Promise.reject(new Error("Database is locked.")) : Promise.resolve({ rows, total: 3 })));
    render(<DatabaseViewer tables={tables} loadRows={loadRows} />);
    expect(await screen.findByText("Database is locked.")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ana")).toBeTruthy();
  });
});

describe("CommandPalette", () => {
  it("opens with the hotkey, filters, runs commands and remembers recents", async () => {
    const save = vi.fn();
    const toggle = vi.fn();
    const commands: Command[] = [
      { id: "save", label: "Save file", group: "File", shortcut: "mod+s", onSelect: save },
      { id: "sidebar", label: "Toggle sidebar", group: "View", keywords: ["explorer"], onSelect: toggle },
      { id: "close", label: "Close file", group: "File", disabled: true, onSelect: () => undefined },
    ];
    render(<CommandPalette commands={commands} modes={[{ prefix: ":", label: "Go to line", commands: (query) => (/^\d+$/.test(query) ? [{ id: "line", label: `Go to line ${query}`, onSelect: () => undefined }] : []) }]} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox", { name: "Command palette" });
    expect(screen.getByText("Type : go to line")).toBeTruthy();
    fireEvent.change(input, { target: { value: "explorer" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Toggle sidebar"]);
    expect(screen.getByRole("status").textContent).toBe("1 result");
    fireEvent.change(input, { target: { value: "sav" } });
    const option = screen.getByRole("option", { name: /Save file/ });
    expect(option.getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(option.id);
    expect(option.querySelector("mark")?.textContent).toBe("Sav");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(save).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    expect(JSON.parse(window.localStorage.getItem("ai-ui-command-recent")!)).toEqual(["save"]);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const reopened = await screen.findByRole("combobox", { name: "Command palette" });
    expect(screen.getByRole("group", { name: "Recent" })).toBeTruthy();
    fireEvent.change(reopened, { target: { value: ":42" } });
    expect(await screen.findByRole("option", { name: "Go to line 42" })).toBeTruthy();
    fireEvent.change(reopened, { target: { value: "close" } });
    fireEvent.keyDown(reopened, { key: "Enter" });
    expect(screen.getByRole("combobox")).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(reopened, { key: "Escape" });
    });
  });
});
