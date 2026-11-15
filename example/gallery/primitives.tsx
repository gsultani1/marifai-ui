// packages/ai-ui/example/gallery/primitives.tsx
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BarcodeIcon,
  BoxIcon,
  CopyIcon,
  MinusIcon,
  PackageIcon,
  PlusIcon,
  PrinterIcon,
  RefreshCwIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../src/components/alert-dialog.js";
import { AspectRatio } from "../../src/components/aspect-ratio.js";
import { Avatar, AvatarGroup } from "../../src/components/avatar.js";
import { Badge } from "../../src/components/badge.js";
import type { RenderLink } from "../../src/components/breadcrumbs.js";
import { Button, ButtonGroup } from "../../src/components/button.js";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../src/components/card.js";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../../src/components/context-menu.js";
import { CopyButton } from "../../src/components/copy-button.js";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../src/components/dialog.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../src/components/dropdown-menu.js";
import { FormField, TextInput } from "../../src/components/form-field.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../src/components/hover-card.js";
import { Kbd, KbdGroup } from "../../src/components/kbd.js";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "../../src/components/menubar.js";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerClass } from "../../src/components/navigation-menu.js";
import { CurrencyInput, NumberInput } from "../../src/components/number-input.js";
import { Popover, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "../../src/components/popover.js";
import { ScrollArea } from "../../src/components/scroll-area.js";
import { SegmentedControl } from "../../src/components/segmented-control.js";
import { Separator } from "../../src/components/separator.js";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../../src/components/sheet.js";
import { Spinner } from "../../src/components/spinner.js";
import { Tooltip, TooltipProvider } from "../../src/components/tooltip.js";
import { Demo, GallerySection } from "./section.js";

const STAFF = [
  { name: "Dana Whitten", status: "online" as const },
  { name: "Marco Ruiz", status: "busy" as const },
  { name: "Lee Park", status: "away" as const },
  { name: "Ana Lopez", status: "offline" as const },
  { name: "Sam Okafor", status: "online" as const },
];

const BINS = [
  { id: "A3-14", item: "Claw hammer, 16 oz", onHand: 24 },
  { id: "B1-02", item: "Tape measure, 25 ft", onHand: 40 },
  { id: "C7-09", item: "Utility knife", onHand: 0 },
];

const ORDERS = Array.from({ length: 18 }, (_, index) => {
  const number = 1042 - index;
  const customers = ["Riverside Builders", "J. Alvarez", "Oak Street Cafe", "M. Chen", "Hillcrest HOA", "T. Nguyen"];
  return { number, customer: customers[index % customers.length]!, total: 38 + ((index * 47) % 410) };
});

const CATEGORIES = ["Fasteners", "Hand tools", "Power tools", "Plumbing", "Electrical", "Paint", "Garden", "Lumber", "Hardware", "Safety", "Cleaning", "Seasonal"];

const DEPARTMENTS = [
  { href: "/departments/plumbing", title: "Plumbing", description: "Pipe, fittings, faucets and water heaters" },
  { href: "/departments/electrical", title: "Electrical", description: "Wire, boxes, breakers and lighting" },
  { href: "/departments/paint", title: "Paint", description: "Interior, exterior, stains and supplies" },
  { href: "/departments/garden", title: "Lawn and garden", description: "Soil, seed, hoses and tools" },
];

const SERVICES = [
  { href: "/services/keys", title: "Key cutting", description: "House, padlock and mailbox keys while you wait" },
  { href: "/services/paint-match", title: "Paint matching", description: "Bring a chip and we match it" },
  { href: "/services/rental", title: "Tool rental", description: "Tile saws, augers and carpet cleaners by the day" },
];

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** A flag that turns itself off after two seconds, for simulated work. */
function useBriefFlag(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setOn(false), 2000);
    return () => clearTimeout(timer);
  }, [on]);
  return [on, () => setOn(true)];
}

export function PrimitivesGallery() {
  const [syncing, startSync] = useBriefFlag();
  const [refreshing, startRefresh] = useBriefFlag();
  const [range, setRange] = useState("week");
  const [filters, setFilters] = useState(["Plumbing", "Electrical", "Garden"]);
  const [productOpen, setProductOpen] = useState(false);
  const [saved, setSaved] = useState("");
  const [voided, setVoided] = useState(false);
  const [sort, setSort] = useState<string>("relevance");
  const [cart, setCart] = useState(0);
  const [reorderPoint, setReorderPoint] = useState<number | null>(12);
  const [menuAction, setMenuAction] = useState("");
  const [showTax, setShowTax] = useState(true);
  const [showCost, setShowCost] = useState(false);
  const [orderSort, setOrderSort] = useState("date");
  const [bin, setBin] = useState(BINS[0]!.id);
  const [binAction, setBinAction] = useState("");
  const [gridlines, setGridlines] = useState(true);
  const [formulas, setFormulas] = useState(false);
  const [zoom, setZoom] = useState("100");
  const [editorAction, setEditorAction] = useState("");
  const [path, setPath] = useState("/deals");

  const saveProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("productName") ?? "").trim();
    setSaved(name ? `Saved ${name} to the catalog.` : "Saved the product to the catalog.");
    setProductOpen(false);
  };

  const renderLink: RenderLink = ({ href, children, onClick, ...props }) => (
    <a
      {...props}
      href={`#gallery-primitives${href}`}
      onClick={(event) => {
        event.preventDefault();
        setPath(href);
        onClick?.();
      }}
    >
      {children}
    </a>
  );

  return (
    <GallerySection id="gallery-primitives" title="Buttons, overlays and menus">
      <Demo title="Buttons, groups and copy" className="flex w-full flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Save order</Button>
          <Button variant="secondary">Print label</Button>
          <Button variant="outline">Export CSV</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="destructive">Void sale</Button>
          <Button variant="link">View receipt</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline">
            <PlusIcon aria-hidden="true" />
            Small
          </Button>
          <Button variant="outline">Medium</Button>
          <Button size="lg" variant="outline">
            Large
          </Button>
          <Button size="icon" variant="outline" aria-label="Add to cart">
            <ShoppingCartIcon aria-hidden="true" />
          </Button>
          <Button loading={syncing} onClick={startSync}>
            {!syncing && <RefreshCwIcon aria-hidden="true" />}
            {syncing ? "Syncing inventory" : "Sync inventory"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonGroup aria-label="Report range">
            {["day", "week", "month"].map((value) => (
              <Button key={value} variant={range === value ? "secondary" : "outline"} aria-pressed={range === value} onClick={() => setRange(value)}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </Button>
            ))}
          </ButtonGroup>
          <ButtonGroup aria-label="Label text alignment">
            <Button size="icon" variant="outline" aria-label="Align left">
              <AlignLeftIcon aria-hidden="true" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Align center">
              <AlignCenterIcon aria-hidden="true" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Align right">
              <AlignRightIcon aria-hidden="true" />
            </Button>
          </ButtonGroup>
          <ButtonGroup orientation="vertical" aria-label="Quantity">
            <Button size="icon" variant="outline" aria-label="Increase quantity">
              <PlusIcon aria-hidden="true" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Decrease quantity">
              <MinusIcon aria-hidden="true" />
            </Button>
          </ButtonGroup>
          <div className="flex items-center gap-1 rounded-md border border-border py-0.5 pr-0.5 pl-2 text-sm">
            <span className="font-mono">HM-1601</span>
            <CopyButton value="HM-1601" label="Copy SKU HM-1601" />
          </div>
          <CopyButton value="https://example.com/orders/1042" label="Copy order link" showLabel variant="outline" />
        </div>
      </Demo>

      <Demo title="Badges">
        <Badge>New</Badge>
        <Badge variant="secondary">Seasonal</Badge>
        <Badge variant="outline">Special order</Badge>
        <Badge variant="destructive">Recalled</Badge>
        <Badge variant="neutral">Draft</Badge>
        <Badge variant="info">Backordered</Badge>
        <Badge variant="success" dot>
          In stock
        </Badge>
        <Badge variant="warning" dot>
          Low stock
        </Badge>
        <Badge variant="danger" dot>
          Out of stock
        </Badge>
        {filters.map((filter) => (
          <Badge key={filter} variant="outline" onRemove={() => setFilters((current) => current.filter((value) => value !== filter))} removeLabel={`Remove ${filter} filter`}>
            {filter}
          </Badge>
        ))}
        {filters.length === 0 && (
          <Button size="sm" variant="ghost" onClick={() => setFilters(["Plumbing", "Electrical", "Garden"])}>
            Restore filters
          </Button>
        )}
      </Demo>

      <Demo title="Cards, avatars, keys and layout helpers" className="grid w-full gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h4">Weekly sales</CardTitle>
            <CardDescription>Monday to Sunday, all registers</CardDescription>
            <CardAction>
              <Badge variant="success">+8.4%</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-2xl font-semibold tabular-nums">$12,480</p>
            <Separator label="Assigned to" />
            <AvatarGroup max={3} size="sm" label="Assigned to">
              {STAFF.map((person) => (
                <Avatar key={person.name} name={person.name} />
              ))}
            </AvatarGroup>
          </CardContent>
          <CardFooter className="justify-between text-xs text-muted-foreground">
            {refreshing ? <Spinner size="sm" label="Refreshing sales" showLabel className="text-xs" /> : <span>Updated 5 minutes ago</span>}
            <Button size="sm" variant="ghost" onClick={startRefresh}>
              <RefreshCwIcon aria-hidden="true" />
              Refresh
            </Button>
          </CardFooter>
        </Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {STAFF.slice(0, 4).map((person, index) => (
              <Avatar key={person.name} name={person.name} status={person.status} size={(["xs", "sm", "md", "lg"] as const)[index]} />
            ))}
            <Avatar name="Receiving dock" shape="square" fallback={<PackageIcon aria-hidden="true" />} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-2">
              Search <KbdGroup keys="Mod+K" />
            </span>
            <Separator orientation="vertical" className="h-5" />
            <span className="flex items-center gap-2">
              Shortcuts <KbdGroup keys="Shift+?" />
            </span>
            <Separator orientation="vertical" className="h-5" />
            <span className="flex items-center gap-2">
              Go to inventory <KbdGroup keys="g i" />
            </span>
            <span className="flex items-center gap-2">
              Close <Kbd>Esc</Kbd>
            </span>
          </div>
          <AspectRatio ratio={16 / 9} className="max-w-sm rounded-lg border border-border">
            <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
              <BoxIcon aria-hidden="true" className="size-8" />
              Product photo, 16:9
            </div>
          </AspectRatio>
        </div>
      </Demo>

      <Demo title="Dialog with a form and an alert dialog" className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={productOpen} onOpenChange={setProductOpen}>
            <DialogTrigger render={<Button />}>
              <PlusIcon aria-hidden="true" />
              Add product
            </DialogTrigger>
            <DialogContent size="lg">
              <form onSubmit={saveProduct} className="flex min-h-0 flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>Add product</DialogTitle>
                  <DialogDescription>New products show up at the registers right away.</DialogDescription>
                </DialogHeader>
                <DialogBody label="Product details" contentClassName="grid gap-3 sm:grid-cols-2">
                  <FormField label="Product name" className="sm:col-span-2">
                    <TextInput name="productName" defaultValue="Claw hammer, 16 oz" required />
                  </FormField>
                  <FormField label="SKU">
                    <TextInput name="sku" defaultValue="HM-1601" required />
                  </FormField>
                  <FormField label="Price">
                    <CurrencyInput defaultValue={1999} currency="USD" />
                  </FormField>
                  <FormField label="Aisle and bin" description="Where staff will find it.">
                    <TextInput name="bin" defaultValue="A3-14" />
                  </FormField>
                  <FormField label="Reorder point">
                    <NumberInput defaultValue={12} min={0} />
                  </FormField>
                </DialogBody>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button type="submit">Save product</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <TrashIcon aria-hidden="true" />
              Void sale 1042
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Void sale 1042?</AlertDialogTitle>
                <AlertDialogDescription>The $86.40 card payment is refunded and the items return to stock. This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep sale</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => setVoided(true)}>
                  Void sale
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {[saved, voided ? "Sale 1042 was voided." : ""].filter(Boolean).join(" ")}
        </p>
      </Demo>

      <Demo title="Sheet and bottom drawer">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" />}>
            <SlidersHorizontalIcon aria-hidden="true" />
            Filter products
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Filter products</SheetTitle>
              <SheetDescription>Narrow the catalog by department and price.</SheetDescription>
            </SheetHeader>
            <SheetBody label="Filters" contentClassName="flex flex-col gap-4">
              <FormField label="Search within results">
                <TextInput placeholder="Brand or SKU" />
              </FormField>
              <div className="flex flex-col gap-1.5">
                <span aria-hidden="true" className="text-sm font-medium">
                  Sort by
                </span>
                <SegmentedControl
                  label="Sort by"
                  value={sort}
                  onValueChange={setSort}
                  options={[
                    { value: "relevance", label: "Relevance" },
                    { value: "price", label: "Price" },
                    { value: "stock", label: "Stock" },
                  ]}
                />
              </div>
              <FormField label="Maximum price">
                <CurrencyInput defaultValue={5000} currency="USD" />
              </FormField>
            </SheetBody>
            <SheetFooter>
              <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
              <SheetClose render={<Button />}>Show 128 products</SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <Drawer>
          <DrawerTrigger render={<Button variant="outline" />}>
            <BarcodeIcon aria-hidden="true" />
            Scan an item
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Claw hammer, 16 oz</DrawerTitle>
              <DrawerDescription>SKU HM-1601, aisle 3, bin 14. Swipe down to dismiss.</DrawerDescription>
            </DrawerHeader>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span>24 on hand</span>
              <span className="font-semibold tabular-nums">{currency.format(19.99)}</span>
            </div>
            <DrawerFooter>
              <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
              <DrawerClose render={<Button />} onClick={() => setCart((count) => count + 1)}>
                Add to cart
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        <p role="status" className="self-center text-sm text-muted-foreground">
          {cart > 0 ? `${cart} in cart` : ""}
        </p>
      </Demo>

      <Demo title="Popovers, tooltips and hover cards">
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Stock details</PopoverTrigger>
          <PopoverContent arrow>
            <PopoverTitle>Claw hammer, 16 oz</PopoverTitle>
            <PopoverDescription>24 on hand across two bins; 6 more arrive Friday.</PopoverDescription>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-muted-foreground">Aisle 3, bin 14</dt>
              <dd className="text-right tabular-nums">18</dd>
              <dt className="text-muted-foreground">Back room</dt>
              <dd className="text-right tabular-nums">6</dd>
            </dl>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>Reorder point: {reorderPoint ?? "none"}</PopoverTrigger>
          <PopoverContent side="bottom" align="start">
            <PopoverTitle>Set reorder point</PopoverTitle>
            <PopoverDescription>A purchase order is drafted when stock falls to this level.</PopoverDescription>
            <NumberInput aria-label="Reorder point" value={reorderPoint} onValueChange={setReorderPoint} min={0} />
            <PopoverClose render={<Button size="sm" className="self-end" />}>Done</PopoverClose>
          </PopoverContent>
        </Popover>
        <TooltipProvider>
          <div className="flex items-center gap-1">
            <Tooltip content="Print receipt">
              <Button size="icon" variant="ghost" aria-label="Print receipt">
                <PrinterIcon aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip content="Scan a barcode" side="bottom">
              <Button size="icon" variant="ghost" aria-label="Scan a barcode">
                <BarcodeIcon aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip content="Copy order number">
              <Button size="icon" variant="ghost" aria-label="Copy order number">
                <CopyIcon aria-hidden="true" />
              </Button>
            </Tooltip>
          </div>
        </TooltipProvider>
        <p className="self-center text-sm">
          Next delivery from{" "}
          <HoverCard>
            <HoverCardTrigger href="https://example.com/suppliers/orgill">Orgill</HoverCardTrigger>
            <HoverCardContent arrow>
              <div className="flex items-center gap-3">
                <Avatar name="Orgill" shape="square" />
                <div className="flex flex-col">
                  <span className="font-medium">Orgill</span>
                  <span className="text-xs text-muted-foreground">orders@example.com</span>
                </div>
              </div>
              <p className="text-muted-foreground">Ships Tuesdays and Fridays. 214 items on the next truck.</p>
            </HoverCardContent>
          </HoverCard>{" "}
          arrives Friday.
        </p>
      </Demo>

      <Demo title="Dropdown menu with nested submenus" className="flex w-full flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>Order 1042 actions</DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Order 1042</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setMenuAction("Opened order 1042.")}>
                Open
                <DropdownMenuShortcut keys="Mod+O" />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMenuAction("Duplicated order 1042.")}>
                Duplicate
                <DropdownMenuShortcut keys="Mod+D" />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showTax} onCheckedChange={setShowTax}>
              Show tax
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showCost} onCheckedChange={setShowCost}>
              Show cost
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={orderSort} onValueChange={(value) => setOrderSort(String(value))}>
              <DropdownMenuLabel inset>Sort lines by</DropdownMenuLabel>
              <DropdownMenuRadioItem value="date">Date added</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="sku">SKU</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="total">Line total</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setMenuAction("Exported order 1042 as CSV.")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMenuAction("Exported order 1042 as PDF.")}>PDF</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Send to</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setMenuAction("Sent order 1042 to accounting.")}>Accounting</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMenuAction("Emailed order 1042 to the customer.")}>Customer email</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setMenuAction("Deleted order 1042.")}>
              <TrashIcon aria-hidden="true" />
              Delete order
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p role="status" className="text-sm text-muted-foreground">
          {menuAction || `Sorted by ${orderSort === "sku" ? "SKU" : orderSort === "total" ? "line total" : "date added"}${showTax ? ", tax shown" : ""}${showCost ? ", cost shown" : ""}.`}
        </p>
      </Demo>

      <Demo title="Context menu region" className="flex w-full flex-col gap-2">
        <ContextMenu>
          <ContextMenuTrigger className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <span className="text-sm text-muted-foreground">Right-click, long-press, or focus a bin and press Shift+F10.</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {BINS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onContextMenu={() => setBin(entry.id)}
                  onFocus={() => setBin(entry.id)}
                  className="flex flex-col items-start gap-1 rounded-md border border-border bg-card p-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-medium">Bin {entry.id}</span>
                  <span className="text-muted-foreground">{entry.item}</span>
                  <Badge variant={entry.onHand === 0 ? "danger" : "success"} dot>
                    {entry.onHand === 0 ? "Empty" : `${entry.onHand} on hand`}
                  </Badge>
                </button>
              ))}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Bin {bin}</ContextMenuLabel>
            <ContextMenuItem onClick={() => setBinAction(`Started a count for bin ${bin}.`)}>
              Count stock
              <ContextMenuShortcut keys="Mod+Shift+C" />
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setBinAction(`Printed a shelf label for bin ${bin}.`)}>
              Print shelf label
              <ContextMenuShortcut keys="Mod+P" />
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Move contents to</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {BINS.filter((entry) => entry.id !== bin).map((entry) => (
                  <ContextMenuItem key={entry.id} onClick={() => setBinAction(`Moved bin ${bin} to bin ${entry.id}.`)}>
                    Bin {entry.id}
                  </ContextMenuItem>
                ))}
                <ContextMenuItem onClick={() => setBinAction(`Moved bin ${bin} to the back room.`)}>Back room</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => setBinAction(`Marked bin ${bin} as damaged.`)}>
              Mark as damaged
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <p role="status" className="text-sm text-muted-foreground">
          {binAction}
        </p>
      </Demo>

      <Demo title="Menubar" className="flex w-full flex-col gap-2">
        <Menubar aria-label="Price sheet editor">
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setEditorAction("Created a new price sheet.")}>
                New price sheet <MenubarShortcut keys="Mod+N" />
              </MenubarItem>
              <MenubarItem onClick={() => setEditorAction("Opened the spring price sheet.")}>
                Open <MenubarShortcut keys="Mod+O" />
              </MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>Export</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem onClick={() => setEditorAction("Exported the price sheet as CSV.")}>CSV</MenubarItem>
                  <MenubarItem onClick={() => setEditorAction("Exported the price sheet as PDF.")}>PDF</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem onClick={() => setEditorAction("Sent the price sheet to the printer.")}>
                Print <MenubarShortcut keys="Mod+P" />
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Edit</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setEditorAction("Undid the last price change.")}>
                Undo <MenubarShortcut keys="Mod+Z" />
              </MenubarItem>
              <MenubarItem onClick={() => setEditorAction("Redid the price change.")}>
                Redo <MenubarShortcut keys="Mod+Shift+Z" />
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => setEditorAction("Cut the selected rows.")}>
                Cut <MenubarShortcut keys="Mod+X" />
              </MenubarItem>
              <MenubarItem onClick={() => setEditorAction("Copied the selected rows.")}>
                Copy <MenubarShortcut keys="Mod+C" />
              </MenubarItem>
              <MenubarItem onClick={() => setEditorAction("Pasted the rows.")}>
                Paste <MenubarShortcut keys="Mod+V" />
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarCheckboxItem checked={gridlines} onCheckedChange={setGridlines}>
                Show gridlines
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={formulas} onCheckedChange={setFormulas}>
                Show formulas
              </MenubarCheckboxItem>
              <MenubarSeparator />
              <MenubarRadioGroup value={zoom} onValueChange={(value) => setZoom(String(value))}>
                <MenubarRadioItem value="100">Zoom 100%</MenubarRadioItem>
                <MenubarRadioItem value="125">Zoom 125%</MenubarRadioItem>
                <MenubarRadioItem value="150">Zoom 150%</MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
        <p role="status" className="text-sm text-muted-foreground">
          {editorAction || `Zoom ${zoom}%${gridlines ? ", gridlines on" : ""}${formulas ? ", formulas shown" : ""}.`}
        </p>
      </Demo>

      <Demo title="Navigation menu" className="flex w-full flex-col gap-2">
        <NavigationMenu aria-label="Store sections" renderLink={renderLink} indicator>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Departments</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-1 sm:w-[30rem] sm:grid-cols-2">
                  {DEPARTMENTS.map((entry) => (
                    <li key={entry.href}>
                      <NavigationMenuLink href={entry.href} active={path === entry.href} closeOnClick>
                        <span className="font-medium">{entry.title}</span>
                        <p className="text-xs">{entry.description}</p>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Services</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="flex flex-col gap-1 sm:w-80">
                  {SERVICES.map((entry) => (
                    <li key={entry.href}>
                      <NavigationMenuLink href={entry.href} active={path === entry.href} closeOnClick>
                        <span className="font-medium">{entry.title}</span>
                        <p className="text-xs">{entry.description}</p>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="/deals" active={path === "/deals"} className={navigationMenuTriggerClass}>
                Weekly deals
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
        <p role="status" className="text-sm text-muted-foreground">
          Current page: {path}
        </p>
      </Demo>

      <Demo title="Scroll areas" className="grid w-full gap-4 md:grid-cols-2">
        <ScrollArea label="Recent orders" className="h-56 rounded-lg border border-border">
          <ul className="divide-y divide-border text-sm">
            {ORDERS.map((order) => (
              <li key={order.number} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  <span className="font-medium">Order {order.number}</span>
                  <span className="block text-xs text-muted-foreground">{order.customer}</span>
                </span>
                <span className="tabular-nums">{currency.format(order.total)}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium">Browse by category</span>
          <ScrollArea label="Categories" orientation="horizontal" className="rounded-lg border border-border">
            <div className="flex w-max gap-2 p-3 pb-4">
              {CATEGORIES.map((category) => (
                <Badge key={category} variant="secondary" className="h-7 px-3 text-sm">
                  {category}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Demo>
    </GallerySection>
  );
}
