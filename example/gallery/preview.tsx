// packages/ai-ui/example/gallery/preview.tsx
import { useEffect, useMemo, useState } from "react";

import {
  advanceDeployment,
  ArtifactCard,
  type ArtifactCardStatus,
  ArtifactViewer,
  ChangeReview,
  createProjectPreview,
  createPythonPreview,
  createSvgPreview,
  DeploymentStatus,
  type DeploymentState,
  type DeploymentStep,
  DiffReview,
  ExportProgress,
  type ExportStatus,
  ImageCompare,
  InlineEdit,
  type InspectedElement,
  InteractivePreview,
  maskSecretHint,
  RegionCapture,
  ReviewComments,
  type ReviewThread,
  SecretField,
  type SecretSource,
  SelectedElementChip,
  ShareButton,
  TrackedChanges,
  useObjectUrl,
  type VersionEntry,
  VersionHistory,
  WebPreview,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const STORE_PAGE = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{font-family:system-ui,sans-serif;margin:0;color:#1c1917;background:#fafaf9}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#1c1917;color:#fafaf9}
main{padding:24px;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.card{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:16px}
.price{font-weight:700;font-size:20px}button{background:#c2410c;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600}
</style></head><body>
<header><strong>Whitten Hardware</strong><nav>Tools · Paint · Garden</nav></header>
<main>
<div class="card"><h2>Cordless drill</h2><p class="price">$129</p><button id="add-drill">Add to cart</button></div>
<div class="card"><h2>Paint roller kit</h2><p class="price">$24</p><button id="add-roller">Add to cart</button></div>
<div class="card"><h2>Garden hose, 50 ft</h2><p class="price">$39</p><button id="add-hose">Add to cart</button></div>
</main></body></html>`;

const BROKEN_PAGE = `<!doctype html><html><body style="font-family:system-ui;padding:24px">
<h1>Order total</h1><p id="total"></p>
<script>document.getElementById("total").textContent = "$" + order.items.reduce((sum, item) => sum + item.price, 0);</script>
</body></html>`;

const FIXED_PAGE = `<!doctype html><html><body style="font-family:system-ui;padding:24px">
<h1>Order total</h1><p id="total"></p>
<script>const order = { items: [{ price: 129 }, { price: 24 }] };
document.getElementById("total").textContent = "$" + order.items.reduce((sum, item) => sum + item.price, 0);</script>
</body></html>`;

const PATCH = `diff --git a/src/cart.ts b/src/cart.ts
--- a/src/cart.ts
+++ b/src/cart.ts
@@ -1,6 +1,8 @@
 export function total(items: Item[]): number {
-  return items.reduce((sum, item) => sum + item.price, 0);
+  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
+  const tax = Math.round(subtotal * 0.0975 * 100) / 100;
+  return subtotal + tax;
 }

 export function isEmpty(items: Item[]): boolean {
   return items.length === 0;
diff --git a/src/tax.ts b/src/tax.ts
new file mode 100644
--- /dev/null
+++ b/src/tax.ts
@@ -0,0 +1,2 @@
+/** Memphis combined sales tax rate. */
+export const TAX_RATE = 0.0975;
diff --git a/src/legacy-cart.js b/src/legacy-cart.js
deleted file mode 100644
--- a/src/legacy-cart.js
+++ /dev/null
@@ -1,2 +0,0 @@
-var cart = [];
-module.exports = cart;
`;

const CONFIG_OLD = `{
  "name": "pos",
  "port": 3000,
  "currency": "USD",
  "receiptFooter": "Thanks for shopping",
  "taxRate": 0.07,
  "printer": "epson-tm-t88",
  "drawer": true,
  "scanner": "zebra",
  "locale": "en-US",
  "theme": "light"
}
`;

const CONFIG_NEW = `{
  "name": "pos",
  "port": 8080,
  "currency": "USD",
  "receiptFooter": "Thanks for shopping",
  "taxRate": 0.07,
  "printer": "epson-tm-t88",
  "drawer": true,
  "scanner": "zebra",
  "locale": "en-US",
  "theme": "system"
}
`;

function swatch(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="${color}"/><circle cx="320" cy="200" r="110" fill="#fff" fill-opacity="0.85"/><text x="320" y="214" font-family="system-ui" font-size="40" font-weight="700" text-anchor="middle" fill="#1c1917">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DEPLOY_STEPS: DeploymentStep[] = [
  { id: "install", label: "Install dependencies", status: "pending" },
  { id: "build", label: "Build", status: "pending" },
  { id: "upload", label: "Upload assets", status: "pending" },
  { id: "activate", label: "Activate", status: "pending" },
];

function InspectDemo() {
  const [element, setElement] = useState<InspectedElement | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const shotUrl = useObjectUrl(shot);
  return (
    <div className="flex w-full flex-col gap-2">
      <RegionCapture
        active={capturing}
        onActiveChange={setCapturing}
        onCapture={(image) => {
          setShot(image);
          setError("");
        }}
        onError={(reason) => setError(reason.name === "NotAllowedError" ? "" : reason.message)}
      >
        <WebPreview
          title="Store preview"
          html={STORE_PAGE}
          defaultDevice="iphone-15"
          onInspect={setElement}
          actions={
            <button type="button" onClick={() => setCapturing(true)} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Capture
            </button>
          }
          className="h-[34rem] w-full"
        />
      </RegionCapture>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {element ? <SelectedElementChip element={element} onRemove={() => setElement(null)} /> : <p className="text-muted-foreground">Turn on element selection in the toolbar and click something in the page.</p>}
        {error && <p className="text-destructive">{error}</p>}
        {shotUrl && <img src={shotUrl} alt="Captured area of the preview" className="max-h-24 rounded-md border border-border" />}
      </div>
    </div>
  );
}

function AutoFixDemo() {
  const [content, setContent] = useState(BROKEN_PAGE);
  const [fixing, setFixing] = useState(false);
  useEffect(() => {
    if (!fixing) return;
    const timer = setTimeout(() => {
      setContent(FIXED_PAGE);
      setFixing(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [fixing]);
  return (
    <div className="flex w-full flex-col gap-2">
      <ArtifactViewer className="h-72 w-full" title="Order total" kind="html" content={content} streaming={fixing} autoFix onFix={() => setFixing(true)} />
      <button type="button" onClick={() => setContent(BROKEN_PAGE)} className="self-start rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        Break it again
      </button>
    </div>
  );
}

function ArtifactCardsDemo() {
  const [status, setStatus] = useState<ArtifactCardStatus>("building");
  const [active, setActive] = useState("pricing");
  useEffect(() => {
    if (status !== "building") return;
    const timer = setTimeout(() => setStatus("ready"), 2500);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <ArtifactCard title="Pricing page" kind="html" status={status} version={3} active={active === "pricing"} onClick={() => setActive("pricing")} />
      <ArtifactCard title="Checkout flow" kind="mermaid" active={active === "flow"} onClick={() => setActive("flow")} />
      <ArtifactCard title="Inventory import" kind="code" status="failed" active={active === "import"} onClick={() => setActive("import")} />
      <button type="button" onClick={() => setStatus("building")} className="self-start rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        Rebuild
      </button>
    </div>
  );
}

function VersionsDemo() {
  const [versions, setVersions] = useState<VersionEntry[]>(() => [
    { id: "v3", label: "v3", message: "Add pricing table", author: "Marifai", createdAt: Date.now() - 5 * 60_000, additions: 48, deletions: 6 },
    { id: "v2", label: "v2", message: "Rewrite hero copy", author: "Marifai", createdAt: Date.now() - 2 * 3_600_000, additions: 12, deletions: 9 },
    { id: "v1", label: "v1", message: "First draft", author: "owner@example.com", createdAt: Date.now() - 26 * 3_600_000, additions: 120, deletions: 0 },
  ]);
  const [selected, setSelected] = useState("v3");
  return (
    <VersionHistory
      className="w-full max-w-md"
      versions={versions}
      currentId={versions[0]!.id}
      selectedId={selected}
      onSelect={setSelected}
      onRestore={(id) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            const source = versions.find((version) => version.id === id);
            const next = { id: `v${versions.length + 1}`, label: `v${versions.length + 1}`, message: `Restored ${source?.label ?? id}`, author: "owner@example.com", createdAt: Date.now() };
            setVersions([next, ...versions]);
            setSelected(next.id);
            resolve();
          }, 500),
        )
      }
    />
  );
}

function InlineEditDemo() {
  const [text, setText] = useState("our store has alot of tools and we can help you find what you need for you're project.");
  const [editing, setEditing] = useState(true);
  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <p className="rounded-md border border-border bg-card p-3 text-sm">{text}</p>
      {editing ? (
        <InlineEdit
          selection={text}
          onGenerate={async function* ({ actionId, signal }) {
            const result =
              actionId === "shorten"
                ? "We stock the tools your project needs."
                : actionId === "expand"
                  ? "Our store carries a wide range of hand and power tools, and our staff will help you find exactly what you need for your project, from the first measurement to the final coat."
                  : "Our store has a lot of tools, and we can help you find what you need for your project.";
            for (const word of result.split(/(?<= )/)) {
              if (signal.aborted) return;
              await new Promise((resolve) => setTimeout(resolve, 40));
              yield word;
            }
          }}
          onReplace={(next) => {
            setText(next);
            setEditing(false);
          }}
          onInsert={(next) => {
            setText(`${text}\n\n${next}`);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="self-start rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Edit with AI
        </button>
      )}
    </div>
  );
}

function ReviewDemo() {
  const [threads, setThreads] = useState<ReviewThread[]>(() => [
    { id: "t1", anchor: { line: 2, file: "src/cart.ts", quote: "const subtotal = items.reduce(…)" }, comments: [{ id: "c1", author: "Marifai", body: "Quantity can be missing on legacy items; default it to 1.", createdAt: Date.now() - 30 * 60_000 }] },
    { id: "t2", anchor: { line: 3, endLine: 4, file: "src/cart.ts" }, comments: [{ id: "c2", author: "Dana Reyes", body: "Use TAX_RATE from tax.ts instead of the literal.", createdAt: Date.now() - 20 * 60_000 }, { id: "c3", author: "Marifai", body: "Done in the next commit.", createdAt: Date.now() - 10 * 60_000 }], resolved: true },
  ]);
  const [draft, setDraft] = useState<{ line: number; file: string; quote: string } | null>(null);
  const [jumped, setJumped] = useState("");
  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <ReviewComments
        threads={threads}
        onJump={(anchor) => setJumped(`Showing ${anchor.file ?? "the document"} at line ${anchor.line}.`)}
        onReply={(id, body) => setThreads(threads.map((thread) => (thread.id === id ? { ...thread, comments: [...thread.comments, { id: `${id}-${thread.comments.length}`, author: "owner@example.com", body, createdAt: Date.now() }] } : thread)))}
        onResolve={(id, resolved) => setThreads(threads.map((thread) => (thread.id === id ? { ...thread, resolved } : thread)))}
        draftAnchor={draft}
        onCancelDraft={() => setDraft(null)}
        onCreate={(anchor, body) => {
          setThreads([...threads, { id: `t${threads.length + 1}`, anchor, comments: [{ id: `n${threads.length}`, author: "owner@example.com", body, createdAt: Date.now() }] }]);
          setDraft(null);
        }}
      />
      {jumped && <p className="text-xs text-muted-foreground">{jumped}</p>}
      {!draft && (
        <button type="button" onClick={() => setDraft({ line: 8, file: "src/cart.ts", quote: "return items.length === 0;" })} className="self-start rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Comment on line 8
        </button>
      )}
    </div>
  );
}

function DeploymentDemo() {
  const [requested, setState] = useState<DeploymentState>("idle");
  const [steps, setSteps] = useState<DeploymentStep[]>(DEPLOY_STEPS);
  const state: DeploymentState = requested === "deploying" && steps.every((step) => step.status === "complete") ? "live" : requested;
  const deployedAt = state === "live" ? steps.at(-1)?.finishedAt : undefined;
  useEffect(() => {
    if (state !== "deploying") return;
    const timer = setInterval(() => setSteps((current) => advanceDeployment(current, Date.now())), 700);
    return () => clearInterval(timer);
  }, [state]);
  const deploy = () => {
    setSteps(advanceDeployment(DEPLOY_STEPS, Date.now()));
    setState("deploying");
  };
  return (
    <DeploymentStatus
      className="w-full max-w-md"
      state={state}
      steps={state === "idle" ? [] : steps}
      environment="Production"
      version="1.4.0 (d470d5e)"
      url="https://pos.example.com"
      {...(deployedAt !== undefined ? { deployedAt } : {})}
      onDeploy={deploy}
      onCancel={() => setState("canceled")}
      onRetry={deploy}
      onRollback={() => setState("idle")}
    />
  );
}

function ExportDemo() {
  const [requested, setStatus] = useState<ExportStatus>("exporting");
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const status: ExportStatus = requested === "exporting" && progress >= 1 ? "ready" : requested;
  useEffect(() => {
    if (status !== "exporting") return;
    const timer = setInterval(() => setProgress((value) => Math.min(1, value + 0.08)), 400);
    return () => clearInterval(timer);
  }, [status]);
  const restart = () => {
    setProgress(0);
    setStartedAt(Date.now());
    setStatus("exporting");
  };
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <ExportProgress
        format="PDF"
        fileName="q3-sales-report.pdf"
        status={status}
        progress={progress}
        stage={`Rendering page ${Math.max(1, Math.ceil(progress * 12))} of 12`}
        startedAt={startedAt}
        size={1_482_000}
        onCancel={() => setStatus("canceled")}
        onRetry={restart}
        onDownload={restart}
      />
      <ShareButton content={{ title: "Q3 sales report", url: "https://example.com/reports/q3" }} className="self-start" />
    </div>
  );
}

function SecretsDemo() {
  const [source, setSource] = useState<SecretSource>("saved");
  const [hint, setHint] = useState(maskSecretHint("sk-demo-7f3a"));
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <SecretField
        label="Anthropic API key"
        source={source}
        hint={hint}
        description="Stored encrypted on your server. It is never shown again after saving."
        validate={(value) => (value.length < 12 ? "That key looks too short." : null)}
        onSave={(value) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setHint(maskSecretHint(value));
              setSource("saved");
              resolve();
            }, 400),
          )
        }
        onRemove={() => setSource("none")}
      />
      <SecretField label="Stripe secret key" source="environment" envName="STRIPE_SECRET_KEY" onSave={() => undefined} />
    </div>
  );
}

function BuildersDemo() {
  const project = useMemo(
    () =>
      createProjectPreview({
        "index.html": '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Cart</h1><ul id="items"></ul><p id="total"></p><script type="module" src="main.js"></script></body></html>',
        "styles.css": "body{font-family:system-ui;padding:16px;background:#f5f5f4}h1{margin:0 0 8px}#total{font-weight:700}",
        "main.js": 'import { items } from "./data.js";\nimport { total } from "./lib/money.js";\nconst list = document.getElementById("items");\nfor (const item of items) { const li = document.createElement("li"); li.textContent = item.name + " — $" + item.price; list.append(li); }\ndocument.getElementById("total").textContent = "Total $" + total(items);',
        "data.js": 'export const items = [{ name: "Hammer", price: 18 }, { name: "Nails (1 lb)", price: 6 }, { name: "Level", price: 22 }];',
        "lib/money.js": "export const total = (items) => items.reduce((sum, item) => sum + item.price, 0);",
      }),
    [],
  );
  const svg = useMemo(() => createSvgPreview('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#c2410c"/><path d="M35 62l17 17 34-38" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/></svg>'), []);
  const [python, setPython] = useState(false);
  const pythonPreview = useMemo(() => createPythonPreview("import statistics\nsales = [1820, 2140, 1975, 2675]\nprint('Average daily sales:', statistics.mean(sales))\nprint('Best day:', max(sales))"), []);
  return (
    <div className="grid w-full gap-3 md:grid-cols-3">
      <InteractivePreview title="Multi-file project" {...project} toolbar={false} className="h-56 overflow-hidden rounded-lg border border-border" />
      <InteractivePreview title="SVG preview" {...svg} allowScripts={false} toolbar={false} className="h-56 overflow-hidden rounded-lg border border-border" />
      {python ? (
        <InteractivePreview title="Python preview" {...pythonPreview} toolbar={false} className="h-56 overflow-hidden rounded-lg border border-border" />
      ) : (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-border p-4 text-center text-sm">
          <p className="text-muted-foreground">Runs Python in the browser with Pyodide (about 10 MB on first load).</p>
          <button type="button" onClick={() => setPython(true)} className="rounded-md border border-border px-2.5 py-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Run Python
          </button>
        </div>
      )}
    </div>
  );
}

export function PreviewGallery() {
  const [config, setConfig] = useState(CONFIG_OLD);
  const [prose, setProse] = useState<string | null>(null);
  return (
    <GallerySection id="gallery-preview" title="Previews, review and artifacts">
      <Demo title="Web preview: devices, inspector and region capture" className="flex w-full">
        <InspectDemo />
      </Demo>
      <Demo title="Preview errors with auto-fix" className="flex w-full">
        <AutoFixDemo />
      </Demo>
      <Demo title="Artifact cards and version history" className="grid w-full gap-4 md:grid-cols-2">
        <ArtifactCardsDemo />
        <VersionsDemo />
      </Demo>
      <Demo title="Diff review" className="flex w-full flex-col">
        <DiffReview patch={PATCH} onOpen={() => undefined} onRevert={() => undefined} />
      </Demo>
      <Demo title="Selective accept and tracked changes" className="grid w-full gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <ChangeReview oldValue={config} newValue={CONFIG_NEW} fileName="pos.config.json" context={1} onApply={(result) => setConfig(result)} onDiscard={() => setConfig(CONFIG_OLD)} />
          {config !== CONFIG_OLD && <p className="text-xs text-muted-foreground">Applied. Discard resets the demo.</p>}
        </div>
        <div className="flex flex-col gap-2">
          <TrackedChanges author="Marifai" original="We open at 8 on weekdays and close early on Sundays. Returns need a receipt." revised="We open at 7 a.m. on weekdays and close at 4 p.m. on Sundays. Returns within 30 days need a receipt." onResolve={setProse} />
          {prose !== null && <p className="rounded-md border border-border bg-card p-2 text-sm">{prose}</p>}
        </div>
      </Demo>
      <Demo title="Inline AI edit and review comments" className="grid w-full gap-4 md:grid-cols-2">
        <InlineEditDemo />
        <ReviewDemo />
      </Demo>
      <Demo title="Image compare" className="flex w-full">
        <ImageCompare before={{ src: swatch("#a8a29e", "Before"), alt: "Gray placeholder banner", label: "Before" }} after={{ src: swatch("#c2410c", "After"), alt: "Orange sale banner", label: "After" }} className="w-full max-w-xl" />
      </Demo>
      <Demo title="Deployments, exports, sharing and secrets" className="grid w-full gap-4 md:grid-cols-3">
        <DeploymentDemo />
        <ExportDemo />
        <SecretsDemo />
      </Demo>
      <Demo title="Preview builders: project, SVG and Python" className="flex w-full">
        <BuildersDemo />
      </Demo>
    </GallerySection>
  );
}
