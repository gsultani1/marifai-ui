// packages/ai-ui/example/gallery/display.tsx
import { DrillIcon, DropletIcon, HammerIcon, PackageIcon, PaintBucketIcon, PaintRollerIcon, PlugIcon, RulerIcon, ShovelIcon, TreesIcon, WrenchIcon, ZapIcon } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { CalendarHeatmap, type HeatmapValue } from "../../src/components/calendar-heatmap.js";
import { Carousel, type CarouselItem } from "../../src/components/carousel.js";
import { CircularProgress } from "../../src/components/circular-progress.js";
import { Countdown, Timer } from "../../src/components/countdown.js";
import { DescriptionList } from "../../src/components/description-list.js";
import { InfiniteScroll } from "../../src/components/infinite-scroll.js";
import { Marquee } from "../../src/components/marquee.js";
import { Masonry } from "../../src/components/masonry.js";
import { QRCode } from "../../src/components/qr-code.js";
import { SortableList } from "../../src/components/sortable-list.js";
import { TransferList, type TransferItem } from "../../src/components/transfer-list.js";
import { type TreeNode, TreeView } from "../../src/components/tree-view.js";
import { VirtualList, type VirtualListHandle } from "../../src/components/virtual-list.js";
import { button, buttonVariants, card, focusRing } from "../../src/lib/classes.js";
import { cn } from "../../src/lib/cn.js";
import { addDays, startOfDay, toIsoDate } from "../../src/lib/dates.js";
import { Demo, GallerySection } from "./section.js";

const TODAY = startOfDay(new Date());
const SALE_ENDS = new Date(TODAY.getTime() + 2 * 86_400_000 + 17 * 3_600_000 + 25 * 60_000);
const outlineButton = cn(button, buttonVariants.outline, focusRing);

function PhotoTile({ icon, title, detail, chart }: { icon: ReactNode; title: string; detail: string; chart: number }) {
  return (
    <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-lg border border-border text-foreground [&_svg]:size-14" style={{ background: `color-mix(in oklab, var(--chart-${chart}) 16%, var(--card))` }}>
      {icon}
      <span className="text-base font-semibold">{title}</span>
      <span className="text-sm">{detail}</span>
    </div>
  );
}

const PHOTOS: Array<{ id: string; label: string; icon: ReactNode; detail: string; chart: number }> = [
  { id: "front", label: "Front view", icon: <DrillIcon aria-hidden="true" />, detail: "20V cordless drill, 1/2 in chuck", chart: 1 },
  { id: "side", label: "Side view", icon: <DrillIcon aria-hidden="true" className="-scale-x-100" />, detail: "Two-speed gearbox and LED work light", chart: 2 },
  { id: "battery", label: "Battery", icon: <ZapIcon aria-hidden="true" />, detail: "4.0 Ah battery with fuel gauge", chart: 3 },
  { id: "case", label: "Carry case", icon: <PackageIcon aria-hidden="true" />, detail: "Hard case with bit organizer", chart: 4 },
  { id: "in-use", label: "In use", icon: <HammerIcon aria-hidden="true" />, detail: "Driving 3 in deck screws", chart: 5 },
];

const CAROUSEL_ITEMS: CarouselItem[] = PHOTOS.map((photo) => ({
  id: photo.id,
  label: photo.label,
  content: <PhotoTile icon={photo.icon} title={photo.label} detail={photo.detail} chart={photo.chart} />,
  thumbnail: (
    <span className="flex size-full items-center justify-center text-foreground [&_svg]:size-6" style={{ background: `color-mix(in oklab, var(--chart-${photo.chart}) 16%, var(--card))` }}>
      {photo.icon}
    </span>
  ),
}));

const DEALS = ["Paint 20% off", "Mulch 5 for $10", "Free key cutting", "Grill tune-up kits", "Rental deposit waived"].map((deal, index) => ({
  id: `deal-${index}`,
  label: deal,
  content: (
    <div className={cn(card, "flex h-28 flex-col justify-between p-4")}>
      <span className="text-sm font-semibold">{deal}</span>
      <span className="text-xs text-muted-foreground">Through Sunday at all locations</span>
    </div>
  ),
}));

function CarouselDemo() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <Carousel label="Cordless drill photos" items={CAROUSEL_ITEMS} picker="thumbnails" loop />
      <Carousel label="Weekly deals" items={DEALS} slidesPerView={{ 0: 1, 360: 2 }} autoplay={6000} />
    </div>
  );
}

const CATEGORY_TREE: TreeNode[] = [
  {
    id: "hand-tools",
    label: "Hand tools",
    icon: <HammerIcon />,
    children: [
      { id: "hammers", label: "Hammers" },
      { id: "screwdrivers", label: "Screwdrivers" },
      { id: "measuring", label: "Measuring and layout", icon: <RulerIcon /> },
      { id: "wrenches", label: "Wrenches", icon: <WrenchIcon /> },
    ],
  },
  { id: "power-tools", label: "Power tools", icon: <DrillIcon />, hasChildren: true },
  {
    id: "plumbing",
    label: "Plumbing",
    icon: <DropletIcon />,
    children: [
      { id: "pipe", label: "Pipe and fittings" },
      { id: "valves", label: "Valves" },
      { id: "water-heaters", label: "Water heaters", disabled: true },
    ],
  },
  {
    id: "electrical",
    label: "Electrical",
    icon: <PlugIcon />,
    children: [
      { id: "wire", label: "Wire and cable" },
      { id: "breakers", label: "Breakers" },
    ],
  },
  { id: "paint", label: "Paint and supplies", icon: <PaintBucketIcon />, children: [{ id: "interior", label: "Interior paint" }, { id: "rollers", label: "Rollers and brushes", icon: <PaintRollerIcon /> }] },
  { id: "garden", label: "Lawn and garden", icon: <TreesIcon />, children: [{ id: "shovels", label: "Shovels", icon: <ShovelIcon /> }, { id: "mulch", label: "Mulch and soil" }] },
];

function loadPowerTools(): Promise<TreeNode[]> {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          { id: "drills", label: "Drills and drivers" },
          { id: "saws-power", label: "Circular saws" },
          { id: "sanders", label: "Sanders" },
        ]),
      700,
    ),
  );
}

function TreeDemo() {
  const [selected, setSelected] = useState<string[]>(["hammers"]);
  const [checked, setChecked] = useState<string[]>(["pipe", "valves"]);
  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <div className={cn(card, "flex flex-col gap-2 p-2")}>
        <TreeView nodes={CATEGORY_TREE} label="Store categories" defaultExpanded={["hand-tools"]} selected={selected} onSelectedChange={setSelected} loadChildren={loadPowerTools} />
        <p className="px-2 text-xs text-muted-foreground">Selected: {selected.join(", ") || "none"}</p>
      </div>
      <div className={cn(card, "flex flex-col gap-2 p-2")}>
        <TreeView nodes={CATEGORY_TREE.filter((node) => node.children)} label="Categories in the spring sale" selectionMode="none" checkboxes defaultExpanded={["plumbing"]} checked={checked} onCheckedChange={setChecked} />
        <p className="px-2 text-xs text-muted-foreground">{checked.length} categories checked</p>
      </div>
    </div>
  );
}

function DescriptionDemo() {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <DescriptionList
        className={cn(card, "px-4")}
        items={[
          { term: "Store", details: "Main Street Hardware #12" },
          { term: "Address", details: "1200 Main Street, Springfield", copyValue: "1200 Main Street, Springfield" },
          { term: "Phone", details: "(555) 010-4477", copyValue: "(555) 010-4477" },
          { term: "Email", details: "service@example.com", copyValue: "service@example.com" },
          { term: "Hours", details: "Mon to Sat 7 am to 8 pm, Sun 9 am to 5 pm" },
        ]}
      />
      <DescriptionList
        layout="grid"
        columns={3}
        className={cn(card, "p-4")}
        items={[
          { term: "Manager on duty", details: "Dana Whitfield" },
          { term: "Open registers", details: "3 of 4" },
          { term: "Deliveries today", details: "2 trucks" },
          { term: "Key machine", details: "Available" },
          { term: "Rental desk", details: "Opens at 8 am" },
          { term: "Loyalty sign-ups", details: "14" },
        ]}
      />
    </div>
  );
}

function CountdownDemo() {
  return (
    <div className="flex w-full flex-wrap items-start gap-8">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Spring sale ends in</span>
        <Countdown target={SALE_ENDS} label="Spring sale ends in" />
        <Countdown target={SALE_ENDS} label="Spring sale time left in hours" variant="compact" largestUnit="hours" />
      </div>
      <Timer label="Paint shaker timer" mode="countdown" duration={90_000} />
      <Timer label="Key cutting stopwatch" />
    </div>
  );
}

const DEPARTMENTS_LIST = ["Hardware", "Fasteners", "Lumber", "Paint", "Plumbing", "Electrical", "Lawn and garden", "Seasonal", "Tool rental", "Key cutting"];
const PRODUCTS = ["Wood screws #8 x 2 in", "Hex bolt 3/8 in", "PVC elbow 1 in", "Copper tee 1/2 in", "Interior latex gallon", "Painter's tape 2 in", "LED bulb A19", "Outlet cover", "Garden hose 50 ft", "Work gloves L"];
const SKU_ROWS = Array.from({ length: 10_000 }, (_, index) => ({
  sku: `MSH-${String(100_000 + index * 7).padStart(6, "0")}`,
  name: PRODUCTS[index % PRODUCTS.length]!,
  department: DEPARTMENTS_LIST[index % DEPARTMENTS_LIST.length]!,
  price: 1.29 + ((index * 37) % 400) / 10,
}));
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function VirtualListDemo() {
  const list = useRef<VirtualListHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={outlineButton} onClick={() => list.current?.scrollToIndex(5000, "start")}>
          Jump to row 5,001
        </button>
        <button type="button" className={outlineButton} onClick={() => list.current?.scrollToIndex(SKU_ROWS.length - 1)}>
          Jump to the last SKU
        </button>
        <span className="text-sm" role="status">
          {selected ? `Selected ${selected}` : "No SKU selected"}
        </span>
      </div>
      <VirtualList
        ref={list}
        items={SKU_ROWS}
        label="SKU catalog, 10,000 items"
        mode="listbox"
        height={264}
        itemHeight={44}
        getKey={(row) => row.sku}
        isSelected={(row) => row.sku === selected}
        onSelect={(row) => setSelected(row.sku)}
        className="border border-border bg-card"
        renderItem={(row, { selected: isSelected }) => (
          <div className={cn("flex h-full items-center gap-3 border-b border-border px-3 text-sm", isSelected && "font-semibold")}>
            <span className="w-24 shrink-0 font-mono text-xs">{row.sku}</span>
            <span className="min-w-0 flex-1 truncate">{row.name}</span>
            <span className="hidden w-28 shrink-0 truncate sm:inline">{row.department}</span>
            <span className="w-16 shrink-0 text-right tabular-nums">{currency.format(row.price)}</span>
          </div>
        )}
      />
    </div>
  );
}

interface Order {
  id: number;
  customer: string;
  total: number;
  items: number;
}

const CUSTOMERS = ["Riverside Builders", "J. Alvarez", "Oak Street Deli", "M. Chen", "Hillcrest HOA", "P. Okafor", "Lakeview Rentals", "S. Novak"];

function makeOrders(page: number): Order[] {
  return Array.from({ length: 8 }, (_, index) => {
    const id = 5000 - page * 8 - index;
    return { id, customer: CUSTOMERS[(id * 3) % CUSTOMERS.length]!, total: 12 + ((id * 53) % 900) / 4, items: 1 + (id % 9) };
  });
}

function InfiniteScrollDemo() {
  const scroller = useRef<HTMLDivElement>(null);
  const [orders, setOrders] = useState<Order[]>(() => makeOrders(0));
  const [failNext, setFailNext] = useState(false);
  const pages = orders.length / 8;
  const loadMore = () =>
    new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (failNext) {
          setFailNext(false);
          reject(new Error("The order service did not respond."));
          return;
        }
        setOrders((previous) => [...previous, ...makeOrders(previous.length / 8)]);
        resolve();
      }, 700);
    });
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <button type="button" aria-pressed={failNext} className={cn(outlineButton, "self-start")} onClick={() => setFailNext(!failNext)}>
        Fail the next load
      </button>
      <div ref={scroller} className={cn(card, "h-72 overflow-y-auto")}>
        <InfiniteScroll onLoadMore={loadMore} hasMore={pages < 5} scrollRoot={scroller} loadMoreLabel="Load more orders" endMessage="That is every order from this week." className="px-3">
          <ul aria-label="Recent orders" className="divide-y divide-border">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex flex-col">
                  <span className="font-medium">Order #{order.id}</span>
                  <span className="text-xs text-muted-foreground">
                    {order.customer}, {order.items} {order.items === 1 ? "item" : "items"}
                  </span>
                </span>
                <span className="tabular-nums">{currency.format(order.total)}</span>
              </li>
            ))}
          </ul>
        </InfiniteScroll>
      </div>
    </div>
  );
}

const IDEAS = [
  { title: "Floating shelves", body: "Two 1x10 boards, hidden brackets and a stud finder. A weekend project for any room.", tag: "Beginner" },
  { title: "Raised garden bed", body: "Cedar boards, galvanized corner brackets and 12 bags of soil mix.", tag: "Garden" },
  { title: "Pegboard tool wall", body: "Hang every hand tool where you can see it. Includes hooks, bins and a French cleat rail for heavy items like circular saws.", tag: "Garage" },
  { title: "Porch light swap", body: "Turn off the breaker, test the wire, and install a dusk-to-dawn fixture.", tag: "Electrical" },
  { title: "Refresh kitchen cabinets", body: "Degloss, prime with a bonding primer, then two coats of cabinet enamel. Swap the hinges and pulls while the doors are off.", tag: "Paint" },
  { title: "Fix a running toilet", body: "A new flapper and fill valve kit solves most leaks in under an hour.", tag: "Plumbing" },
  { title: "Fire pit patio", body: "Pavers, paver base, sand and a steel ring insert.", tag: "Outdoor" },
  { title: "Mudroom bench", body: "Plywood box, cushion top and coat hooks above. Paint to match the trim.", tag: "Intermediate" },
];

function MasonryDemo() {
  return (
    <Masonry
      className="w-full"
      items={IDEAS}
      getKey={(idea) => idea.title}
      minColumnWidth={200}
      gap={12}
      renderItem={(idea) => (
        <article className={cn(card, "flex flex-col gap-1.5 p-3")}>
          <h4 className="text-sm font-semibold">{idea.title}</h4>
          <p className="text-sm">{idea.body}</p>
          <span className="self-start rounded-full border border-border px-2 py-0.5 text-xs">{idea.tag}</span>
        </article>
      )}
    />
  );
}

const SUPPLIERS = ["Acme Fasteners", "Northwind Lumber", "Summit Paint Co.", "Bluewater Plumbing Supply", "Ironclad Tools", "Greenleaf Garden", "Brightline Electric", "Keystone Hardware"];

function MarqueeDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <Marquee label="Supplier logos" className="w-full">
        {SUPPLIERS.map((supplier) => (
          <span key={supplier} className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold whitespace-nowrap">
            {supplier}
          </span>
        ))}
      </Marquee>
      <Marquee label="Store announcements" direction="up" speed={20} className="h-28 w-full max-w-sm" gap={12}>
        {["Curbside pickup is free on orders over $35.", "Propane exchange is behind the garden center.", "Ask about our tool rental weekend rates.", "Paint matching takes about 10 minutes."].map((note) => (
          <span key={note} className="text-sm">
            {note}
          </span>
        ))}
      </Marquee>
    </div>
  );
}

function QRCodeDemo() {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <QRCode value="https://example.com/store" label="QR code for the store website" downloadable fileName="main-street-hardware" />
      <QRCode value="MSH-104207" label="QR code for SKU MSH-104207" size={112} ecLevel="H" />
    </div>
  );
}

const STAFF_DEPARTMENTS: TransferItem[] = DEPARTMENTS_LIST.map((name) => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  label: name,
  ...(name === "Tool rental" ? { description: "Requires rental training", disabled: true } : name === "Key cutting" ? { description: "Key machine certified" } : {}),
}));

function TransferDemo() {
  const [assigned, setAssigned] = useState<string[]>(["paint", "hardware"]);
  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <TransferList items={STAFF_DEPARTMENTS} value={assigned} onValueChange={setAssigned} sourceLabel="Departments" targetLabel="Dana's departments" />
      <p className="text-xs text-muted-foreground">Dana covers {assigned.length} departments.</p>
    </div>
  );
}

interface Pick {
  id: string;
  name: string;
  location: string;
  quantity: number;
}

const PICKS: Pick[] = [
  { id: "p1", name: "Tape measure 25 ft", location: "Aisle 3, bin 12", quantity: 1 },
  { id: "p2", name: "Claw hammer 16 oz", location: "Aisle 3, bin 4", quantity: 2 },
  { id: "p3", name: "Wood screws #8 x 2 in", location: "Aisle 7, bin 22", quantity: 4 },
  { id: "p4", name: "Drill bit set", location: "Aisle 5, bin 9", quantity: 1 },
  { id: "p5", name: "Safety glasses", location: "Front counter", quantity: 3 },
  { id: "p6", name: "Work gloves L", location: "Aisle 1, bin 2", quantity: 3 },
];

function SortableDemo() {
  const [picks, setPicks] = useState(PICKS);
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <SortableList
        label="Pick list for order 4471"
        items={picks}
        onReorder={setPicks}
        getKey={(pick) => pick.id}
        getLabel={(pick) => pick.name}
        renderItem={(pick, { index }) => (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex flex-col">
              <span className="font-medium">
                {index + 1}. {pick.name}
              </span>
              <span className="text-xs text-muted-foreground">{pick.location}</span>
            </span>
            <span className="tabular-nums">x{pick.quantity}</span>
          </div>
        )}
      />
    </div>
  );
}

function ProgressDemo() {
  return (
    <div className="flex flex-wrap items-end gap-6">
      <CircularProgress value={72} label="Cycle count progress" tone="success" size="xl" />
      <CircularProgress value={91} label="Shrink budget used" tone="warning" size="lg" />
      <CircularProgress value={40} label="Truck unloading" tone="info" size="lg" formatValue={(value) => `${Math.round((value / 100) * 30)}/30`} />
      <CircularProgress value={18} label="Returns processed" tone="danger" />
      <CircularProgress label="Syncing the price file" />
      <CircularProgress label="Saving" size="sm" />
    </div>
  );
}

const SALES_START = addDays(TODAY, -181);
const SALES: HeatmapValue[] = Array.from({ length: 182 }, (_, offset) => {
  const date = addDays(SALES_START, offset);
  const weekday = date.getDay();
  const base = weekday === 6 ? 46 : weekday === 0 ? 22 : 30;
  const swing = Math.round(12 * Math.sin(offset / 9) + 8 * Math.cos(offset / 4));
  const closed = toIsoDate(date).endsWith("-12-25") || toIsoDate(date).endsWith("-01-01");
  return { date: toIsoDate(date), value: closed ? 0 : Math.max(0, base + swing) };
});

function HeatmapDemo() {
  return <CalendarHeatmap values={SALES} start={SALES_START} end={TODAY} label="Daily sales, last 26 weeks" unit={["sale", "sales"]} className="w-full" />;
}

/** Data display and collection components with hardware store content. */
export function DisplayGallery() {
  return (
    <GallerySection id="gallery-display" title="Data display and collections">
      <Demo title="Carousel" className="flex w-full">
        <CarouselDemo />
      </Demo>
      <Demo title="Tree view" className="flex w-full">
        <TreeDemo />
      </Demo>
      <Demo title="Description list" className="flex w-full">
        <DescriptionDemo />
      </Demo>
      <Demo title="Countdown and timer">
        <CountdownDemo />
      </Demo>
      <Demo title="Virtual list" className="flex w-full">
        <VirtualListDemo />
      </Demo>
      <Demo title="Infinite scroll" className="flex w-full">
        <InfiniteScrollDemo />
      </Demo>
      <Demo title="Masonry" className="flex w-full">
        <MasonryDemo />
      </Demo>
      <Demo title="Marquee" className="flex w-full">
        <MarqueeDemo />
      </Demo>
      <Demo title="QR code">
        <QRCodeDemo />
      </Demo>
      <Demo title="Transfer list" className="flex w-full">
        <TransferDemo />
      </Demo>
      <Demo title="Sortable list" className="flex w-full">
        <SortableDemo />
      </Demo>
      <Demo title="Circular progress">
        <ProgressDemo />
      </Demo>
      <Demo title="Calendar heatmap" className="flex w-full">
        <HeatmapDemo />
      </Demo>
    </GallerySection>
  );
}
