// packages/ai-ui/example/gallery/browser-panels.tsx
import { type ReactNode, useState } from "react";

import {
  BookmarkManager,
  BrowserConsolePanel,
  BrowserDownloadList,
  BrowserHistoryList,
  BrowserNavigationBar,
  BrowserPageDiff,
  BrowserProfilePicker,
  BrowserReaderView,
  BrowserRequestTable,
  BrowserSessionRestore,
  BrowserSitePermissions,
  Button,
  OpenTabPicker,
  PageCaptureReview,
  PageFindBar,
  PageLinkInspector,
  PageSelectionToolbar,
  type BrowserBookmark,
  type BrowserConsoleEntry,
  type BrowserDownload,
  type BrowserDownloadAction,
  type BrowserPermissionValue,
  type BrowserRestoreWindow,
  type BrowserSitePermission,
  type InspectedBrowserRequest,
  type InspectedPageLink,
  type OpenBrowserTab,
  type SelectableBrowserProfile,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

const STORE = "hardware.example.com";

const PRODUCT_TEXT = "Cedar deck stain protects new and weathered wood. Apply the stain with a brush, let it dry for four hours, then add a second coat of stain on boards that face the sun.";

const WARRANTY = "Exterior stains carry a five-year warranty when the deck is cleaned and dried before the first coat.";

const TABS: OpenBrowserTab[] = [
  { id: "tab-stain", title: "Cedar deck stain", address: STORE + "/paint/cedar-stain", window: "Agent window" },
  { id: "tab-supplier", title: "Supplier order portal", address: "supplier.example.com/orders/7731", window: "Agent window" },
  { id: "tab-flyer", title: "Weekend flyer draft", address: "docs.example.com/flyer", window: "Marketing" },
];

const VISITS = [
  { id: "visit-1", title: "Cordless drill comparison", address: STORE + "/tools/drills/compare", visitedAt: "Today, 9:41 AM" },
  { id: "visit-2", title: "Order 4821 status", address: STORE + "/orders/4821", visitedAt: "Today, 8:12 AM" },
  { id: "visit-3", title: "Store hours and holidays", address: STORE + "/hours", visitedAt: "Yesterday, 5:30 PM" },
];

const FOLDERS = [{ id: "suppliers", label: "Suppliers" }, { id: "policies", label: "Store policies" }];

const MB = 1024 * 1024;

const CONSOLE: BrowserConsoleEntry[] = [
  { id: "c1", level: "info", text: "Cart restored with 3 items" },
  { id: "c2", level: "warning", text: "Product image is missing alt text", source: { address: STORE + "/assets/gallery.js", line: 88 } },
  { id: "c3", level: "error", text: "TypeError: price is undefined", source: { address: STORE + "/assets/cart.js", line: 42, column: 17 } },
  { id: "c4", level: "debug", text: "Stock check took 140 ms" },
];

const REQUESTS: InspectedBrowserRequest[] = [
  { id: "req-cart", address: "api." + STORE + "/cart", method: "GET", status: "200", type: "fetch", durationMs: 84 },
  { id: "req-checkout", address: "api." + STORE + "/checkout", method: "POST", status: "500", type: "fetch", durationMs: 1210 },
  { id: "req-stock", address: "api." + STORE + "/stock?sku=CS-1", method: "GET", status: "200", type: "fetch", durationMs: 140 },
  { id: "req-logo", address: "cdn." + STORE + "/logo.svg", method: "GET", status: "304", type: "image" },
  { id: "req-font", address: "cdn." + STORE + "/fonts/inter.woff2", method: "GET", status: "200", type: "font", durationMs: 32 },
];

const LINKS: InspectedPageLink[] = [
  { id: "link-stain", label: "Cedar deck stain", address: "https://" + STORE + "/paint/cedar-stain", domain: STORE },
  { id: "link-brushes", label: "Stain brushes", address: "https://" + STORE + "/paint/brushes", domain: STORE },
  { id: "link-guide", label: "Deck care guide", address: "https://guides.example.com/deck-care", domain: "guides.example.com" },
  { id: "link-social", label: "", address: "https://social.example.com/hardware", domain: "social.example.com" },
];

const PROFILES: SelectableBrowserProfile[] = [
  { id: "ops", name: "Store operations", session: "Signed in as ops@" + STORE, storage: "Cookies kept between runs" },
  { id: "guest", name: "Guest", session: "Signed out", storage: "Cleared when the run ends" },
  { id: "buyer", name: "Purchasing", session: "Signed in as buying@" + STORE, storage: "Shared with the buying team", unavailableReason: "In use by another run" },
];

function countMatches(text: string, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  return text.toLocaleLowerCase().split(needle).length - 1;
}

function HighlightedText({ text, query, current }: { text: string; query: string; current: number | null }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const parts: ReactNode[] = [];
  const lower = text.toLocaleLowerCase();
  let index = 0;
  let match = 0;
  while (index < text.length) {
    const found = lower.indexOf(needle.toLocaleLowerCase(), index);
    if (found < 0) break;
    parts.push(text.slice(index, found));
    match++;
    parts.push(<mark key={found} className={match === current ? "rounded-sm bg-primary text-primary-foreground" : "rounded-sm bg-accent text-accent-foreground"}>
      {text.slice(found, found + needle.length)}
    </mark>);
    index = found + needle.length;
  }
  parts.push(text.slice(index));
  return <>{parts}</>;
}

function NavigationDemo() {
  const [address, setAddress] = useState(STORE + "/paint/cedar-stain");
  const [history, setHistory] = useState({ entries: [STORE + "/paint", STORE + "/paint/cedar-stain"], index: 1 });
  const [loading, setLoading] = useState(false);
  const [findOpen, setFindOpen] = useState(true);
  const [query, setQuery] = useState("stain");
  const [current, setCurrent] = useState<number | null>(1);
  const matches = countMatches(PRODUCT_TEXT, query);

  function visit(index: number, entries = history.entries) {
    setHistory({ entries, index });
    setAddress(entries[index]!);
    setLoading(true);
    void wait(900).then(() => setLoading(false));
  }

  return (
    <div className="min-w-0 space-y-3 md:col-span-2">
      <BrowserNavigationBar address={address} onAddressChange={setAddress} loading={loading}
        onNavigate={(destination) => visit(history.index + 1, [...history.entries.slice(0, history.index + 1), destination])}
        onBack={history.index > 0 ? () => visit(history.index - 1) : undefined}
        onForward={history.index < history.entries.length - 1 ? () => visit(history.index + 1) : undefined}
        onReload={() => visit(history.index)} onStop={() => setLoading(false)} />
      <p className="rounded-md border border-border bg-muted/30 p-3 text-sm">
        <HighlightedText text={PRODUCT_TEXT} query={findOpen ? query : ""} current={current} />
      </p>
      {findOpen ? (
        <PageFindBar query={query} matchCount={matches} currentMatch={matches ? Math.min(current ?? 1, matches) : null}
          onQueryChange={(next) => { setQuery(next); setCurrent(countMatches(PRODUCT_TEXT, next) ? 1 : null); }}
          onMove={(direction) => setCurrent((value) => {
            const at = value ?? 0;
            return direction === "next" ? (at % matches) + 1 : ((at - 2 + matches) % matches) + 1;
          })}
          onClose={() => setFindOpen(false)} />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setFindOpen(true)}>Show find bar</Button>
      )}
    </div>
  );
}

function SelectionCaptureDemo() {
  const [selection, setSelection] = useState(WARRANTY);
  const [draft, setDraft] = useState("");
  const [context, setContext] = useState<string[]>([]);
  const [capture, setCapture] = useState<number | null>(1);
  const [captureNote, setCaptureNote] = useState("");

  return (
    <>
      <div className="min-w-0 space-y-2">
        <PageSelectionToolbar selection={selection}
          onQuote={(text) => setDraft("> " + text + "\n\nDoes this cover pressure-treated pine?")}
          onAttach={(text) => setContext((items) => (items.includes(text) ? items : [...items, text]))} />
        <Button variant="outline" size="sm" onClick={() => setSelection(selection ? "" : WARRANTY)}>
          {selection ? "Clear page selection" : "Select the warranty text"}
        </Button>
        <p role="status" className="text-xs break-words whitespace-pre-wrap text-muted-foreground">
          {draft ? "Chat draft: " + draft : context.length ? "Added to the assistant's context." : ""}
        </p>
      </div>
      <div className="min-w-0 space-y-2">
        {capture !== null ? (
          <PageCaptureReview captureId={"capture-" + capture} initialLabel="Checkout error"
            preview={
              <div className="min-w-64 space-y-1 border border-border bg-background p-3 text-xs">
                <p className="font-semibold">Checkout · 3 items</p>
                <p>Cedar deck stain, 1 gal · $34.99</p>
                <p>Stain brush, 3 in · $8.49</p>
                <p className="font-medium text-destructive">Payment failed: price is undefined</p>
              </div>
            }
            onAttach={async (id, label) => {
              await wait(600);
              setCaptureNote("Attached " + (label || id) + " to the bug report.");
              setCapture(null);
            }}
            onDiscard={() => { setCaptureNote("Capture discarded."); setCapture(null); }} />
        ) : (
          <Button variant="outline" size="sm" onClick={() => { setCaptureNote(""); setCapture((value) => (value ?? 0) + 1); }}>Take another capture</Button>
        )}
        <p role="status" className="text-xs break-words text-muted-foreground">{captureNote}</p>
      </div>
    </>
  );
}

function TabsHistoryBookmarksDemo() {
  const [attached, setAttached] = useState<string[]>(["tab-supplier"]);
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>([
    { id: "bm-supplier", title: "Lumber supplier catalog", address: "supplier.example.com/catalog", folderId: "suppliers" },
    { id: "bm-returns", title: "Returns policy", address: STORE + "/help/returns", folderId: "policies" },
    { id: "bm-flyer", title: "Weekend flyer", address: "docs.example.com/flyer", folderId: null },
  ]);
  const [opened, setOpened] = useState("");

  return (
    <>
      <OpenTabPicker tabs={TABS} attachedIds={attached}
        onOpen={(id) => setOpened("Switched to " + TABS.find((tab) => tab.id === id)?.title + ".")}
        onAttach={(id) => setAttached((ids) => [...ids, id])} />
      <BrowserHistoryList visits={VISITS} onOpen={(id) => setOpened("Reopened " + VISITS.find((item) => item.id === id)?.title + ".")} />
      <div className="min-w-0 space-y-2 md:col-span-2">
        <BookmarkManager bookmarks={bookmarks} folders={FOLDERS}
          onOpen={(id) => setOpened("Opened " + bookmarks.find((item) => item.id === id)?.title + ".")}
          onSave={async (id, changes) => {
            await wait(400);
            setBookmarks((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
          }}
          onRemove={(id) => setBookmarks((items) => items.filter((item) => item.id !== id))} />
        <p role="status" className="text-xs break-words text-muted-foreground">{opened}</p>
      </div>
    </>
  );
}

const NEXT_STATUS: Record<BrowserDownloadAction, BrowserDownload["status"]> = { pause: "paused", resume: "downloading", cancel: "canceled", retry: "downloading" };

function DownloadsRestoreDemo() {
  const [downloads, setDownloads] = useState<BrowserDownload[]>([
    { id: "dl-manual", name: "drill-manual.pdf", status: "downloading", receivedBytes: 6.2 * MB, totalBytes: 9.8 * MB },
    { id: "dl-catalog", name: "spring-catalog.zip", status: "paused", receivedBytes: 31 * MB, totalBytes: 84 * MB },
    { id: "dl-price", name: "price-list.xlsx", status: "queued", receivedBytes: 0 },
    { id: "dl-receipt", name: "receipt-4821.pdf", status: "completed", receivedBytes: 220 * 1024, totalBytes: 220 * 1024 },
    { id: "dl-brochure", name: "paint-brochure.pdf", status: "failed", receivedBytes: 0, detail: "Network error" },
  ]);
  const [pending, setPending] = useState<string[]>([]);
  const [windows, setWindows] = useState<BrowserRestoreWindow[]>([
    { id: "win-research", title: "Supplier research", tabs: [{ id: "t-lumber", title: "Lumber prices" }, { id: "t-freight", title: "Freight quote" }] },
    { id: "win-admin", title: "Store admin", tabs: [{ id: "t-inventory", title: "Inventory dashboard" }, { id: "t-schedule", title: "Staff schedule" }] },
  ]);
  const [restored, setRestored] = useState("");

  async function runAction(id: string, action: BrowserDownloadAction) {
    setPending((ids) => [...ids, id]);
    await wait(500);
    setDownloads((items) => items.map((item) => item.id !== id ? item : {
      ...item, status: NEXT_STATUS[action], receivedBytes: action === "retry" ? 0 : item.receivedBytes, detail: undefined,
    }));
    setPending((ids) => ids.filter((value) => value !== id));
  }

  return (
    <>
      <BrowserDownloadList downloads={downloads} pendingIds={pending} onAction={(id, action) => void runAction(id, action)} />
      <div className="min-w-0 space-y-2">
        <BrowserSessionRestore windows={windows} onRestore={async (selection) => {
          await wait(700);
          const count = selection.reduce((total, item) => total + item.tabIds.length, 0);
          setWindows((items) => items.map((item) => {
            const picked = selection.find((entry) => entry.windowId === item.id)?.tabIds ?? [];
            return { ...item, tabs: item.tabs.filter((tab) => !picked.includes(tab.id)) };
          }).filter((item) => item.tabs.length));
          setRestored("Restored " + count + (count === 1 ? " tab." : " tabs."));
        }} />
        <p role="status" className="text-xs break-words text-muted-foreground">{restored}</p>
      </div>
    </>
  );
}

function DeveloperToolsDemo() {
  const [inspected, setInspected] = useState("");
  return (
    <>
      <BrowserConsolePanel entries={CONSOLE} onOpenSource={(source) => setInspected("Opened " + source.address + " at line " + source.line + ".")} />
      <BrowserRequestTable requests={REQUESTS} onInspect={(id) => {
        const request = REQUESTS.find((item) => item.id === id);
        if (request) setInspected(request.method + " " + request.address + " returned " + request.status + ".");
      }} />
      <BrowserPageDiff
        before={{ label: "Monday 9:00 AM", text: "Cedar deck stain\n1 gallon\n$34.99\nIn stock: 12\nShips in 2 days\n" }}
        after={{ label: "Tuesday 9:00 AM", text: "Cedar deck stain\n1 gallon\n$29.99 (weekend sale)\nIn stock: 4\nShips in 2 days\n" }} />
      <PageLinkInspector links={LINKS} onInspect={(id) => {
        const link = LINKS.find((item) => item.id === id);
        if (link) setInspected("Link points to " + link.address + ".");
      }} />
      <p role="status" className="text-xs break-words text-muted-foreground md:col-span-2">{inspected}</p>
    </>
  );
}

function ProfileSettingsDemo() {
  const [profile, setProfile] = useState<string | null>("ops");
  const [permissions, setPermissions] = useState<BrowserSitePermission[]>([
    { id: "camera", label: "Camera", effective: "ask" },
    { id: "location", label: "Location", effective: "allow", value: "allow", available: ["allow", "block"] },
    { id: "notifications", label: "Notifications", effective: "block", value: "block" },
    { id: "popups", label: "Pop-ups", effective: "block", unavailableReason: "Set by your organization" },
  ]);
  const [saving, setSaving] = useState<string[]>([]);

  async function change(id: string, value: BrowserPermissionValue) {
    setSaving((ids) => [...ids, id]);
    await wait(500);
    setPermissions((items) => items.map((item) => (item.id === id ? { ...item, value, effective: value } : item)));
    setSaving((ids) => ids.filter((item) => item !== id));
  }

  return (
    <>
      <div className="min-w-0 space-y-3">
        <BrowserProfilePicker profiles={PROFILES} value={profile} onChange={setProfile} />
        <BrowserSitePermissions origin={"https://" + STORE} permissions={permissions} pendingIds={saving} onChange={(id, value) => void change(id, value)} />
      </div>
      <BrowserReaderView title="How to stain a deck in one weekend" byline="Garden Center Team · 6 min read">
        <p>Start on a dry morning. Sweep the boards, wash them with deck cleaner and let the wood dry for a full day before you open the stain.</p>
        <p>Work in the shade when you can, three boards at a time, and keep a wet edge so the color stays even. Two thin coats last longer than one heavy coat.</p>
      </BrowserReaderView>
    </>
  );
}

export function BrowserPanelsGallery() {
  return (
    <GallerySection id="gallery-browser-panels" title="Browser panels">
      <Demo title="Navigation and find on page" className="grid w-full items-start gap-3 md:grid-cols-2">
        <NavigationDemo />
      </Demo>
      <Demo title="Page selection and captures" className="grid w-full items-start gap-3 md:grid-cols-2">
        <SelectionCaptureDemo />
      </Demo>
      <Demo title="Tabs, history and bookmarks" className="grid w-full items-start gap-3 md:grid-cols-2">
        <TabsHistoryBookmarksDemo />
      </Demo>
      <Demo title="Downloads and session restore" className="grid w-full items-start gap-3 md:grid-cols-2">
        <DownloadsRestoreDemo />
      </Demo>
      <Demo title="Console, requests, page changes and links" className="grid w-full items-start gap-3 md:grid-cols-2">
        <DeveloperToolsDemo />
      </Demo>
      <Demo title="Profiles, site permissions and reader view" className="grid w-full items-start gap-3 md:grid-cols-2">
        <ProfileSettingsDemo />
      </Demo>
    </GallerySection>
  );
}
