// packages/ai-ui/example/gallery/shell.tsx
import { BarChart3Icon, BoxIcon, CalendarIcon, DollarSignIcon, HomeIcon, PackageIcon, ShoppingCartIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import {
  AppShell,
  BarcodeScanner,
  Breadcrumbs,
  CashCount,
  Gauge,
  InstallPrompt,
  localStorageQueueStorage,
  type NavSection,
  OfflineQueuePanel,
  OnboardingChecklist,
  Pagination,
  PermissionMatrix,
  type PermissionGrants,
  PullToRefresh,
  type RenderLink,
  ResizablePanels,
  SessionTimeoutWarning,
  ShortcutHelp,
  StatTile,
  ThemeToggle,
  Tour,
  UpdatePrompt,
  useBarcodeScanner,
  useOfflineQueue,
  useShortcuts,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const NAV: NavSection[] = [
  {
    id: "store",
    items: [
      { id: "home", label: "Home", href: "/", icon: <HomeIcon aria-hidden="true" /> },
      { id: "inventory", label: "Inventory", href: "/inventory", icon: <BoxIcon aria-hidden="true" /> },
      { id: "orders", label: "Orders", href: "/inventory/orders", icon: <ShoppingCartIcon aria-hidden="true" />, badge: 3 },
      { id: "cash", label: "Cash", href: "/cash", icon: <DollarSignIcon aria-hidden="true" /> },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { id: "schedule", label: "Schedule", href: "/schedule", icon: <CalendarIcon aria-hidden="true" /> },
      { id: "people", label: "People", href: "/people", icon: <UsersIcon aria-hidden="true" /> },
      { id: "reports", label: "Reports", href: "/reports", icon: <BarChart3Icon aria-hidden="true" /> },
    ],
  },
];

const ROLES = [
  { id: "owner", name: "Owner", locked: true },
  { id: "manager", name: "Manager" },
  { id: "cashier", name: "Cashier" },
  { id: "stocker", name: "Stocker" },
];

const PERMISSIONS = [
  { key: "inventory.view", label: "View inventory", category: "Inventory" },
  { key: "inventory.adjust", label: "Adjust stock", description: "Counts, damages and transfers", category: "Inventory" },
  { key: "inventory.price", label: "Change prices", category: "Inventory" },
  { key: "cash.open", label: "Open the register", category: "Cash" },
  { key: "cash.count", label: "Count drawers", category: "Cash" },
  { key: "cash.refund", label: "Issue refunds", category: "Cash" },
  { key: "team.schedule", label: "Edit the schedule", category: "Team" },
  { key: "team.invite", label: "Invite staff", category: "Team" },
];

const INITIAL_GRANTS: PermissionGrants = {
  manager: ["inventory.view", "inventory.adjust", "inventory.price", "cash.open", "cash.count", "cash.refund", "team.schedule"],
  cashier: ["inventory.view", "cash.open"],
  stocker: ["inventory.view", "inventory.adjust"],
};

const ORDERS = Array.from({ length: 312 }, (_, index) => `Order #${10_000 + index}`);

export function ShellGallery() {
  const [path, setPath] = useState("/inventory/orders");
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tasks, setTasks] = useState({ store: true, staff: false, cash: false });
  const [needRefresh, setNeedRefresh] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => Number.MAX_SAFE_INTEGER);
  const [sessionNote, setSessionNote] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [serverDown, setServerDown] = useState(false);
  const [grants, setGrants] = useState(INITIAL_GRANTS);
  const [baseline, setBaseline] = useState(INITIAL_GRANTS);
  const [scans, setScans] = useState<string[]>([]);
  const [countResult, setCountResult] = useState<string | null>(null);
  const [wedge, setWedge] = useState(false);

  const outbox = useOfflineQueue<{ sku: string; cents: number }>({
    storage: localStorageQueueStorage("ai-ui-gallery:outbox"),
    maxAttempts: 3,
    backoffMs: () => 300,
    send: async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (serverDown) throw new Error("Server unavailable");
    },
  });

  const addScan = (code: string) => setScans((current) => [code, ...current].slice(0, 5));
  useBarcodeScanner({ onScan: addScan, enabled: wedge });
  useShortcuts([
    { id: "go-orders", keys: "g o", description: "Go to orders", group: "Navigation", handler: () => setPath("/inventory/orders") },
    { id: "go-home", keys: "g h", description: "Go home", group: "Navigation", handler: () => setPath("/") },
    { id: "collapse", keys: "[", description: "Toggle the sidebar", group: "Layout", handler: () => document.querySelector<HTMLButtonElement>('[data-slot="app-shell"] button[aria-pressed]')?.click() },
  ]);

  const renderLink: RenderLink = ({ href, children, onClick, ...props }) => (
    <a
      {...props}
      href={`#gallery-shell${href === "/" ? "" : href}`}
      onClick={(event) => {
        event.preventDefault();
        setPath(href);
        onClick?.();
      }}
    >
      {children}
    </a>
  );

  const current = NAV.flatMap((section) => section.items).find((item) => item.href === path);

  return (
    <GallerySection id="gallery-shell" title="App shell, navigation, PWA and operations">
      <Demo title="App shell with dashboard tiles" className="w-full">
        <div ref={setFrame} className="h-[460px] w-full overflow-hidden rounded-lg border border-border bg-background text-foreground">
          <AppShell
            nav={NAV}
            currentPath={path}
            renderLink={renderLink}
            brand={<span data-tour="brand">Whitten Hardware</span>}
            header={
              <>
                <button type="button" onClick={() => setHelpOpen(true)} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                  Shortcuts <kbd className="ml-1 rounded border border-border px-1 font-mono">?</kbd>
                </button>
                <span data-tour="theme">
                  <ThemeToggle element={frame} storageKey="ai-ui-gallery:shell-theme" />
                </span>
              </>
            }
            sidebarFooter={<p className="px-2 text-xs text-muted-foreground">Memphis store</p>}
          >
            <div className="flex flex-col gap-4 p-4">
              <Breadcrumbs renderLink={renderLink} items={[{ label: "Home", href: "/" }, ...(path === "/" ? [] : path.startsWith("/inventory/") ? [{ label: "Inventory", href: "/inventory" }] : []), ...(path === "/" ? [] : [{ label: current?.label ?? "Page" }])]} />
              <h3 className="text-lg font-semibold">{current?.label ?? "Home"}</h3>
              <div data-tour="tiles" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Sales today" value="$4,210" current={4210} previous={3900} comparisonLabel="vs last Saturday" sparkline={[3100, 3600, 3300, 4000, 3900, 4210]} href="/reports" renderLink={renderLink} />
                <StatTile label="Transactions" value="186" current={186} previous={201} comparisonLabel="vs last Saturday" sparkline={[170, 190, 210, 195, 201, 186]} />
                <StatTile label="Refunds" value="$96" current={96} previous={140} reverseColors comparisonLabel="vs last Saturday" icon={<PackageIcon aria-hidden="true" />} />
                <StatTile label="Open orders" value="3" subtitle="1 arriving today" loading={false} />
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <Gauge label="Storage used" value={68} warning={75} danger={90} formatValue={(value) => `${value}%`} />
                <Gauge label="Labor vs budget" value={104} max={120} warning={100} danger={110} formatValue={(value) => `${value}%`} />
              </div>
            </div>
          </AppShell>
        </div>
        <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      </Demo>
      <Demo title="Onboarding checklist and tour" className="grid w-full gap-3 md:grid-cols-2">
        <OnboardingChecklist
          tasks={[
            { id: "store", title: "Add your store details", done: tasks.store },
            { id: "staff", title: "Invite your staff", description: "Managers can edit the schedule.", done: tasks.staff, actionLabel: "Invite", onAction: () => setTasks({ ...tasks, staff: true }) },
            { id: "cash", title: "Count your first drawer", done: tasks.cash, actionLabel: "Mark done", onAction: () => setTasks({ ...tasks, cash: true }) },
          ]}
        />
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted-foreground">The tour points at parts of the app shell above.</p>
          <button type="button" onClick={() => setTourOpen(true)} className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-accent">
            Start tour
          </button>
        </div>
        <Tour
          open={tourOpen}
          onOpenChange={setTourOpen}
          steps={[
            { id: "brand", target: '[data-tour="brand"]', title: "Your store", content: "Switch stores and find settings here." },
            { id: "tiles", target: '[data-tour="tiles"]', title: "Today at a glance", content: "Tiles compare today with the same day last week. Select one to open the report." },
            { id: "theme", target: '[data-tour="theme"]', title: "Light or dark", content: "Follow the system setting or pick one.", side: "left" },
          ]}
        />
      </Demo>
      <Demo title="Pagination and resizable panels" className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <ul aria-label="Orders" className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-5">
            {ORDERS.slice((page - 1) * pageSize, page * pageSize).map((order) => (
              <li key={order} className="rounded border border-border px-2 py-1">
                {order}
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageCount={Math.ceil(ORDERS.length / pageSize)}
            onPageChange={setPage}
            totalItems={ORDERS.length}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            label="Orders pagination"
          />
        </div>
        <ResizablePanels
          className="h-48 rounded-lg border border-border"
          storageKey="ai-ui-gallery:panels"
          panels={[
            { id: "files", label: "files", defaultSize: 25, minSize: 15, collapsible: true, className: "p-3 text-sm", children: <p className="text-muted-foreground">Files</p> },
            { id: "editor", label: "editor", minSize: 30, className: "p-3 text-sm", children: <p>Editor</p> },
            { id: "preview", defaultSize: 30, minSize: 20, className: "p-3 text-sm", children: <p className="text-muted-foreground">Preview</p> },
          ]}
        />
      </Demo>
      <Demo title="Install, update, session and offline" className="grid w-full gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <InstallPrompt appName="Whitten Hardware" description="Open it from your home screen and keep working offline." />
          <button
            type="button"
            onClick={() => window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: "dismissed" as const }) }))}
            className="self-start rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Simulate install offer
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <UpdatePrompt needRefresh={needRefresh} onRefresh={() => setNeedRefresh(false)} onDismiss={() => setNeedRefresh(false)} blocked={unsaved && "Save the price changes before updating."} />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button type="button" onClick={() => setNeedRefresh(true)} className="rounded-md border border-border px-2.5 py-1 font-medium hover:bg-accent">
              Simulate update
            </button>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={unsaved} onChange={(event) => setUnsaved(event.target.checked)} className="accent-primary" />
              Unsaved changes
            </label>
            <button
              type="button"
              onClick={() => {
                setSessionNote("");
                setExpiresAt(Date.now() + 4.5 * 60_000);
              }}
              className="rounded-md border border-border px-2.5 py-1 font-medium hover:bg-accent"
            >
              Simulate session ending
            </button>
            <span aria-live="polite">{sessionNote}</span>
          </div>
          <SessionTimeoutWarning
            expiresAt={expiresAt}
            onExtend={() => {
              setExpiresAt(Number.MAX_SAFE_INTEGER);
              setSessionNote("Session extended.");
            }}
            onSignOut={() => {
              setExpiresAt(Number.MAX_SAFE_INTEGER);
              setSessionNote("Signed out.");
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <PullToRefresh
            onRefresh={async () => {
              await new Promise((resolve) => setTimeout(resolve, 600));
              setRefreshedAt(new Date().toLocaleTimeString());
            }}
            label="Recent orders"
            className="h-40 rounded-lg border border-border"
          >
            <ul className="divide-y divide-border text-sm">
              {ORDERS.slice(0, 8).map((order) => (
                <li key={order} className="px-3 py-2">
                  {order}
                </li>
              ))}
            </ul>
          </PullToRefresh>
          <p className="text-xs text-muted-foreground">{refreshedAt ? `Refreshed at ${refreshedAt}` : "Pull down on a touch screen to refresh."}</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button type="button" onClick={() => void outbox.enqueue("price", { sku: `HM-${1600 + outbox.actions.length}`, cents: 1099 })} className="rounded-md border border-border px-2.5 py-1 font-medium hover:bg-accent">
              Queue a price change
            </button>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={serverDown} onChange={(event) => setServerDown(event.target.checked)} className="accent-primary" />
              Server rejects changes
            </label>
          </div>
          <OfflineQueuePanel actions={outbox.actions} online={outbox.online} onRetry={outbox.retry} onDiscard={outbox.discard} onSyncNow={() => void outbox.flush()} describe={(action) => `Set ${(action.payload as { sku: string }).sku} to $10.99`} />
        </div>
      </Demo>
      <Demo title="Roles and permissions" className="w-full">
        <PermissionMatrix
          roles={ROLES}
          permissions={PERMISSIONS}
          grants={grants}
          onGrantsChange={setGrants}
          baseline={baseline}
          toolbar={
            <button type="button" onClick={() => setBaseline(grants)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              Save
            </button>
          }
        />
      </Demo>
      <Demo title="Barcode scanning and cash count" className="grid w-full gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <BarcodeScanner onDetect={(code) => addScan(code)} />
          <div className="text-sm">
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={wedge} onChange={(event) => setWedge(event.target.checked)} className="accent-primary" />
              Listen for a handheld scanner (keyboard mode) anywhere on this page
            </label>
            <ul aria-label="Scanned items" className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
              {scans.map((code, index) => (
                <li key={`${code}-${index}`}>{code}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <CashCount expectedCents={35_000} onSubmit={({ totalCents, varianceCents }) => setCountResult(`Submitted $${(totalCents / 100).toFixed(2)}${varianceCents ? `, ${varianceCents > 0 ? "over" : "short"} $${(Math.abs(varianceCents) / 100).toFixed(2)}` : ", balanced"}.`)} />
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {countResult ?? ""}
          </p>
        </div>
      </Demo>
    </GallerySection>
  );
}
