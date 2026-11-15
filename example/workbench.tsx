// packages/ai-ui/example/workbench.tsx
import { type ReactNode, useMemo, useState } from "react";

import {
  Artifact,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
  ArtifactModeToggle,
  ArtifactPreview,
  ArtifactTitle,
  Canvas,
  CanvasMain,
  type CanvasMode,
  CanvasPanel,
  CanvasResizeHandle,
  Chart,
  CodeEditor,
  createReactPreview,
  DataTable,
  type DataTableColumn,
  DiffView,
  DocumentEditor,
  FileViewer,
  InteractivePreview,
  ModelSelector,
  Whiteboard,
  type WhiteboardElement,
} from "../src/index.js";
import { focusRing } from "../src/lib/classes.js";
import { cn } from "../src/lib/cn.js";

const ORIGINAL_CODE = `export function total(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}
`;

const DOCUMENT = `# Release notes

The **0.1** release adds streaming markdown, tool approval and a split canvas.

- Faster first paint
- Sandboxed previews
`;

const REPORT = `# Q3 summary

Revenue grew **12%** quarter over quarter, led by the garden category.

| Category | Q2 | Q3 |
| :-- | --: | --: |
| Tools | 41,200 | 44,900 |
| Garden | 28,400 | 35,100 |
`;

interface StockRow {
  sku: string;
  name: string;
  onHand: number;
}

const STOCK_COLUMNS: DataTableColumn<StockRow>[] = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Item", editable: true },
  { key: "onHand", header: "On hand", type: "number", editable: true },
];

const SALES = [
  { month: "Jul", tools: 13800, garden: 10400 },
  { month: "Aug", tools: 15100, garden: 12900 },
  { month: "Sep", tools: 16000, garden: 11800 },
];

const BOARD: WhiteboardElement[] = [
  { id: "plan", type: "rectangle", x: 40, y: 60, width: 140, height: 64, text: "Plan" },
  { id: "build", type: "ellipse", x: 260, y: 60, width: 140, height: 64, text: "Build" },
  { id: "ship", type: "rectangle", x: 480, y: 60, width: 140, height: 64, text: "Ship" },
  { id: "plan-build", type: "connector", from: "plan", to: "build" },
];

const PROBE = `<!doctype html>
<html lang="en">
<body>
<p id="status">Probing</p>
<script>
let parentAccess = "blocked";
try { parent.document.title; parentAccess = "allowed"; } catch (error) {}
document.body.dataset.parentAccess = parentAccess;
fetch("https://example.com/").then(
  () => { document.body.dataset.network = "allowed"; },
  () => { document.body.dataset.network = "blocked"; },
);
document.getElementById("status").textContent = "Parent access " + parentAccess;
</script>
</body>
</html>`;

const SCRIPT_PAGE = `<!doctype html>
<html lang="en">
<body>
<p id="state">Scripts off</p>
<script>document.getElementById("state").textContent = "Inline script ran";</script>
</body>
</html>`;

const SCRIPT_MODULE = 'document.getElementById("state").textContent = "Module kept </script> intact";';

const COUNTER = `import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState<number>(0);
  return (
    <button className="m-4 rounded-lg bg-blue-700 px-4 py-2 text-white" onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}`;

/** Every preview dependency from one CDN, so the frame needs a single allowed origin. */
const JSDELIVR_REACT = {
  react: "https://cdn.jsdelivr.net/npm/react@19.3.1/+esm",
  "react/jsx-runtime": "https://cdn.jsdelivr.net/npm/react@19.3.1/jsx-runtime/+esm",
  "react-dom": "https://cdn.jsdelivr.net/npm/react-dom@19.3.1/+esm",
  "react-dom/client": "https://cdn.jsdelivr.net/npm/react-dom@19.3.1/client/+esm",
  "react/": "https://cdn.jsdelivr.net/npm/react@19.3.1/",
  "react-dom/": "https://cdn.jsdelivr.net/npm/react-dom@19.3.1/",
};

const MODELS = [
  { id: "writer", name: "Writer" },
  { id: "analyst", name: "Analyst" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function WorkbenchDemo() {
  const [code, setCode] = useState(ORIGINAL_CODE);
  const [doc, setDoc] = useState(DOCUMENT);
  const [rows, setRows] = useState<StockRow[]>([
    { sku: "HW-100", name: "Claw hammer", onHand: 24 },
    { sku: "HW-200", name: "Wood screws", onHand: 1300 },
    { sku: "GD-310", name: "Garden hose", onHand: 18 },
  ]);
  const [elements, setElements] = useState(BOARD);
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<CanvasMode>("split");
  const [writer, setWriter] = useState("writer");
  const counter = useMemo(() => createReactPreview(COUNTER, { tailwind: true, imports: JSDELIVR_REACT }), []);
  const csv = useMemo(
    () => new File(["sku,item,on_hand\nHW-100,Claw hammer,24\nHW-200,Wood screws,1300\n"], "stock.csv", { type: "text/csv" }),
    [],
  );

  return (
    <Canvas open={open} mode={mode} onModeChange={setMode} className="h-full">
      <CanvasMain className="overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn("self-start rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent", focusRing)}
            >
              Open artifact
            </button>
          )}
          <Section title="Code editor">
            <CodeEditor value={code} onValueChange={setCode} language="tsx" aria-label="Example code" className="h-40" />
            <output aria-label="Code length" className="text-xs text-muted-foreground">
              {code.length} characters
            </output>
          </Section>
          <Section title="Document editor">
            <DocumentEditor value={doc} onValueChange={setDoc} aria-label="Release notes" className="h-80" />
          </Section>
          <Section title="Diff">
            <DiffView oldValue={ORIGINAL_CODE} newValue={code} oldTitle="Original" newTitle="Edited" />
          </Section>
          <Section title="Data table">
            <DataTable columns={STOCK_COLUMNS} rows={rows} onRowsChange={setRows} getRowKey={(row) => row.sku} caption="Stock levels" />
          </Section>
          <Section title="Chart">
            <Chart
              type="bar"
              title="Monthly sales"
              data={SALES}
              categoryKey="month"
              series={[
                { key: "tools", label: "Tools" },
                { key: "garden", label: "Garden" },
              ]}
            />
          </Section>
          <Section title="File viewer">
            <FileViewer file={csv} className="h-64" />
          </Section>
          <Section title="Sandboxed previews">
            <InteractivePreview title="Isolation probe" html={PROBE} allowScripts toolbar={false} className="h-64" />
            <InteractivePreview title="Inert by default" html={SCRIPT_PAGE} script={SCRIPT_MODULE} toolbar={false} className="h-24" />
            <InteractivePreview title="Scripts opted in" html={SCRIPT_PAGE} script={SCRIPT_MODULE} allowScripts toolbar={false} className="h-24" />
            <InteractivePreview title="Generated component" {...counter} className="h-72" />
          </Section>
          <Section title="Whiteboard">
            <Whiteboard elements={elements} onElementsChange={setElements} className="h-80" />
            <output aria-label="Board summary" className="text-xs text-muted-foreground">
              {elements.filter((element) => element.type !== "connector").length} shapes,{" "}
              {elements.filter((element) => element.type === "connector").length} connectors
            </output>
          </Section>
        </div>
      </CanvasMain>
      <CanvasResizeHandle />
      <CanvasPanel>
        <Artifact onOpenChange={setOpen}>
          <ArtifactHeader>
            <ArtifactTitle>Quarterly report</ArtifactTitle>
            <ArtifactActions>
              <ModelSelector models={MODELS} value={writer} onValueChange={setWriter} aria-label="Report model" />
              <ArtifactModeToggle />
              <ArtifactClose />
            </ArtifactActions>
          </ArtifactHeader>
          <ArtifactContent>
            <ArtifactPreview kind="markdown" content={REPORT} />
          </ArtifactContent>
        </Artifact>
      </CanvasPanel>
    </Canvas>
  );
}
