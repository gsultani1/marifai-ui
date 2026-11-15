// packages/ai-ui/example/gallery/controls.tsx
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArchiveIcon,
  BoldIcon,
  CopyIcon,
  DrillIcon,
  HammerIcon,
  ItalicIcon,
  PackageIcon,
  PaintBucketIcon,
  SearchIcon,
  ShovelIcon,
  StoreIcon,
  TruckIcon,
  UnderlineIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../src/components/accordion.js";
import { Checkbox, CheckboxGroup } from "../../src/components/checkbox.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../src/components/collapsible.js";
import { Combobox, type ComboboxOption, MultiSelect } from "../../src/components/combobox.js";
import { Fieldset } from "../../src/components/fieldset.js";
import { FormField, TextInput } from "../../src/components/form-field.js";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../src/components/input-group.js";
import { Label } from "../../src/components/label.js";
import { Meter } from "../../src/components/meter.js";
import { Progress } from "../../src/components/progress.js";
import { RadioGroup } from "../../src/components/radio-group.js";
import { Select, type SelectOptionGroup } from "../../src/components/select.js";
import { Slider } from "../../src/components/slider.js";
import { Switch } from "../../src/components/switch.js";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow, type TableSortDirection, cycleSortDirection } from "../../src/components/table.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/tabs.js";
import { Textarea } from "../../src/components/textarea.js";
import { formatTime, TimePicker } from "../../src/components/time-picker.js";
import { Toggle, ToggleGroup } from "../../src/components/toggle.js";
import { Demo, GallerySection } from "./section.js";

const CATEGORIES: SelectOptionGroup[] = [
  {
    label: "Tools",
    options: [
      { value: "hand-tools", label: "Hand tools", icon: <HammerIcon aria-hidden="true" />, description: "Hammers, saws, wrenches" },
      { value: "power-tools", label: "Power tools", icon: <DrillIcon aria-hidden="true" />, description: "Drills, drivers, sanders" },
    ],
  },
  {
    label: "Home and garden",
    options: [
      { value: "paint", label: "Paint and sundries", icon: <PaintBucketIcon aria-hidden="true" /> },
      { value: "garden", label: "Lawn and garden", icon: <ShovelIcon aria-hidden="true" /> },
      { value: "seasonal", label: "Seasonal", description: "Opens in March", disabled: true },
    ],
  },
];

const INITIAL_SUPPLIERS: ComboboxOption[] = [
  { value: "northline", label: "Northline Hardware Supply", description: "orders@northline.example.com" },
  { value: "prairie", label: "Prairie Fastener Co.", description: "sales@prairie-fastener.example.com" },
  { value: "lakeside", label: "Lakeside Lumber", description: "yard@lakeside-lumber.example.com" },
  { value: "summit", label: "Summit Paint Distributors", description: "Account on hold", disabled: true },
  { value: "keystone", label: "Keystone Plumbing Wholesale" },
  { value: "ridge", label: "Ridge Electric Supply" },
];

const DEPARTMENTS: ComboboxOption[] = [
  { value: "tools", label: "Tools" },
  { value: "paint", label: "Paint" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "garden", label: "Lawn and garden" },
  { value: "fasteners", label: "Fasteners" },
];

const INVENTORY = [
  { sku: "HM-1601", name: "Claw hammer, 16 oz", qty: 24, price: 1999 },
  { sku: "DS-0250", name: "Deck screws, 5 lb box", qty: 4, price: 3249 },
  { sku: "TM-2501", name: "Tape measure, 25 ft", qty: 40, price: 899 },
  { sku: "PR-0900", name: "Paint roller kit", qty: 2, price: 1450 },
  { sku: "GH-5000", name: "Garden hose, 50 ft", qty: 15, price: 3499 },
];

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const dollars = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

type SortKey = "qty" | "price";

export function ControlsGallery() {
  const [notifications, setNotifications] = useState({ lowStock: true, dailySummary: false, onlineOrders: true });
  const [delivery, setDelivery] = useState<"pickup" | "local" | "freight">("pickup");
  const [receipt, setReceipt] = useState<"print" | "email" | "both">("both");
  const [category, setCategory] = useState<string | null>("power-tools");
  const [suppliers, setSuppliers] = useState(INITIAL_SUPPLIERS);
  const [supplier, setSupplier] = useState<string | null>("northline");
  const [departments, setDepartments] = useState(["tools", "paint"]);
  const [syncDepartments, setSyncDepartments] = useState(["tools", "plumbing"]);
  const [priceRange, setPriceRange] = useState<readonly number[]>([25, 250]);
  const [reorderPoint, setReorderPoint] = useState(10);
  const [formatting, setFormatting] = useState(["bold"]);
  const [alignment, setAlignment] = useState(["left"]);
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: TableSortDirection }>({ key: "qty", direction: "none" });
  const [opens, setOpens] = useState<string | null>("07:00");
  const [closes, setCloses] = useState<string | null>("18:00");
  const [cutoff, setCutoff] = useState<string | null>("14:30");
  const [footer, setFooter] = useState("Thanks for shopping local. Returns accepted within 30 days with a receipt.");
  const [upload, setUpload] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const startUpload = () => {
    if (timer.current) clearInterval(timer.current);
    setUpload(0);
    timer.current = setInterval(() => {
      setUpload((current) => {
        const next = Math.min(100, current + 10);
        if (next === 100 && timer.current) clearInterval(timer.current);
        return next;
      });
    }, 300);
  };

  const sortBy = (key: SortKey) => setSort((current) => ({ key, direction: cycleSortDirection(current.key === key ? current.direction : "none") }));
  const directionFor = (key: SortKey): TableSortDirection => (sort.key === key ? sort.direction : "none");
  const rows = sort.direction === "none" ? INVENTORY : [...INVENTORY].sort((a, b) => (a[sort.key] - b[sort.key]) * (sort.direction === "ascending" ? 1 : -1));
  const stockValue = INVENTORY.reduce((total, row) => total + row.qty * row.price, 0);

  return (
    <GallerySection id="gallery-controls" title="Form controls and layout">
      <Demo title="Fieldset and label" className="w-full max-w-2xl">
        <Fieldset legend="Store profile" description="Shown on receipts and the online storefront." className="w-full rounded-lg border border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="controls-store-name" required>
                Store name
              </Label>
              <TextInput id="controls-store-name" defaultValue="Whitten Hardware" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="controls-store-email" optional>
                Contact email
              </Label>
              <TextInput id="controls-store-email" type="email" placeholder="orders@example.com" />
            </div>
          </div>
        </Fieldset>
      </Demo>

      <Demo title="Input group" className="grid w-full gap-4 md:grid-cols-2">
        <FormField label="Retail price" description="Before sales tax.">
          <InputGroup>
            <InputGroupAddon>$</InputGroupAddon>
            <InputGroupInput inputMode="decimal" defaultValue="19.99" />
            <InputGroupAddon align="end">USD</InputGroupAddon>
          </InputGroup>
        </FormField>
        <FormField label="Cut length">
          <InputGroup>
            <InputGroupInput inputMode="numeric" defaultValue="8" />
            <InputGroupAddon align="end">ft</InputGroupAddon>
          </InputGroup>
        </FormField>
        <FormField label="Find a product">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput type="search" placeholder="Name or SKU" defaultValue="hammer" />
            <InputGroupButton size="icon" aria-label="Clear search">
              <XIcon aria-hidden="true" />
            </InputGroupButton>
          </InputGroup>
        </FormField>
        <FormField label="Storefront address">
          <InputGroup>
            <InputGroupAddon>https://</InputGroupAddon>
            <InputGroupInput defaultValue="whitten.example.com" />
            <InputGroupButton variant="outline" size="sm" className="mr-1.5">
              <CopyIcon aria-hidden="true" />
              Copy
            </InputGroupButton>
          </InputGroup>
        </FormField>
      </Demo>

      <Demo title="Textarea" className="grid w-full gap-4 md:grid-cols-2">
        <FormField label="Receipt footer" description="Grows as you type, up to six lines.">
          <Textarea value={footer} onValueChange={setFooter} autosize minRows={2} maxRows={6} maxLength={160} showCount />
        </FormField>
        <FormField label="Pickup text message" description="Messages over 160 characters are sent as two texts.">
          <Textarea defaultValue="Your order is ready at the contractor desk. Bring your order number." minRows={3} maxLength={160} showCount softLimit />
        </FormField>
      </Demo>

      <Demo title="Switch" className="w-full max-w-xl">
        <Fieldset legend="Notifications" className="w-full rounded-lg border border-border p-4">
          <Switch
            label="Low stock alerts"
            description="Email the manager when an item drops below its reorder point."
            switchPosition="end"
            checked={notifications.lowStock}
            onCheckedChange={(checked) => setNotifications((current) => ({ ...current, lowStock: checked }))}
          />
          <Switch
            label="Daily sales summary"
            description="Sent at closing time."
            switchPosition="end"
            checked={notifications.dailySummary}
            onCheckedChange={(checked) => setNotifications((current) => ({ ...current, dailySummary: checked }))}
          />
          <Switch
            label="Online order emails"
            switchPosition="end"
            size="sm"
            checked={notifications.onlineOrders}
            onCheckedChange={(checked) => setNotifications((current) => ({ ...current, onlineOrders: checked }))}
          />
        </Fieldset>
      </Demo>

      <Demo title="Checkbox" className="flex w-full flex-wrap items-start gap-10">
        <CheckboxGroup
          label="Departments to sync"
          description="Price updates from suppliers apply to these departments."
          selectAll
          value={syncDepartments}
          onValueChange={setSyncDepartments}
          options={DEPARTMENTS.slice(0, 4).map((department) => ({ value: department.value, label: department.label }))}
        />
        <div className="flex flex-col gap-3">
          <Checkbox label="Print a copy for the register" defaultChecked />
          <Checkbox label="Ask for a signature over $100" description="Card payments only." />
        </div>
      </Demo>

      <Demo title="Radio group" className="grid w-full gap-6 md:grid-cols-[2fr_1fr]">
        <RadioGroup
          label="Delivery method"
          variant="card"
          value={delivery}
          onValueChange={setDelivery}
          options={[
            { value: "pickup", label: "In-store pickup", description: "Ready in about two hours.", icon: <StoreIcon aria-hidden="true" />, aside: "Free" },
            { value: "local", label: "Local delivery", description: "Within 15 miles, next business day.", icon: <TruckIcon aria-hidden="true" />, aside: "$7.99" },
            { value: "freight", label: "Freight", description: "Lumber and bulk orders on a pallet.", icon: <PackageIcon aria-hidden="true" />, aside: "Quote" },
          ]}
        />
        <RadioGroup
          label="Receipt format"
          value={receipt}
          onValueChange={setReceipt}
          options={[
            { value: "print", label: "Printed" },
            { value: "email", label: "Email", description: "Sent to the address on file." },
            { value: "both", label: "Both" },
          ]}
        />
      </Demo>

      <Demo title="Select" className="grid w-full gap-4 md:grid-cols-2">
        <FormField label="Category" description={category ? `Saved as ${category}` : "Pick where this item is shelved."}>
          <Select options={CATEGORIES} value={category} onValueChange={setCategory} placeholder="Choose a category" />
        </FormField>
        <FormField label="Sold by">
          <Select
            size="sm"
            defaultValue="each"
            options={[
              { value: "each", label: "Each" },
              { value: "box", label: "Box" },
              { value: "foot", label: "Linear foot" },
              { value: "pound", label: "Pound" },
            ]}
          />
        </FormField>
      </Demo>

      <Demo title="Combobox and multi-select" className="grid w-full gap-4 md:grid-cols-2">
        <FormField label="Primary supplier" description="Type a new name to add a supplier.">
          <Combobox
            options={suppliers}
            value={supplier}
            onValueChange={setSupplier}
            placeholder="Search suppliers"
            emptyMessage="No suppliers match"
            onCreate={(label) => {
              const created = { value: `custom-${suppliers.length}`, label };
              setSuppliers((current) => [...current, created]);
              return created;
            }}
          />
        </FormField>
        <FormField label="Departments" description="Choose up to four.">
          <MultiSelect options={DEPARTMENTS} value={departments} onValueChange={setDepartments} max={4} placeholder="Add departments" />
        </FormField>
      </Demo>

      <Demo title="Slider" className="flex w-full flex-wrap items-start gap-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Slider<readonly number[]>
            label="Price range"
            value={priceRange}
            onValueChange={setPriceRange}
            min={0}
            max={500}
            step={5}
            minStepsBetweenValues={5}
            formatValue={dollars}
            marks={[
              { value: 0, label: "$0" },
              { value: 125, label: "$125" },
              { value: 250, label: "$250" },
              { value: 375, label: "$375" },
              { value: 500, label: "$500" },
            ]}
          />
          <Slider label="Reorder point" value={reorderPoint} onValueChange={setReorderPoint} min={0} max={50} formatValue={(value) => `${value} units`} />
        </div>
        <Slider aria-label="Shelf height" orientation="vertical" defaultValue={48} min={12} max={84} step={6} formatValue={(value) => `${value} in`} className="h-40" />
      </Demo>

      <Demo title="Progress" className="flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Progress label="Uploading spring-catalog.csv" value={upload} tone={upload === 100 ? "success" : "default"} valueText={upload === 100 ? "Done" : undefined} />
          <button type="button" onClick={startUpload} className="self-start rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            {upload === 0 ? "Start upload" : "Upload again"}
          </button>
        </div>
        <Progress label="Syncing inventory with Northline" value={null} size="sm" />
        <Progress label="Shelf labels printed" value={36} max={48} valueText="36 of 48" tone="warning" size="lg" />
      </Demo>

      <Demo title="Meter" className="flex w-full max-w-md flex-col gap-4">
        <Meter label="Deck screws, 5 lb box" value={12} max={200} low={25} high={150} optimum={200} formatValue={(value) => `${value} of 200`} statusText={{ danger: "Low stock", warning: "Reorder soon", success: "In stock" }} />
        <Meter label="Paint rollers" value={60} max={120} low={20} high={90} optimum={120} formatValue={(value) => `${value} of 120`} statusText={{ danger: "Low stock", warning: "Reorder soon", success: "In stock" }} />
        <Meter label="Garden hoses" value={140} max={150} low={20} high={100} optimum={150} formatValue={(value) => `${value} of 150`} statusText={{ danger: "Low stock", warning: "Reorder soon", success: "In stock" }} />
      </Demo>

      <Demo title="Toggle and toggle group" className="flex w-full flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <ToggleGroup
            label="Text formatting"
            multiple
            variant="ghost"
            size="sm"
            value={formatting}
            onValueChange={setFormatting}
            items={[
              { value: "bold", label: "Bold", icon: <BoldIcon aria-hidden="true" />, iconOnly: true },
              { value: "italic", label: "Italic", icon: <ItalicIcon aria-hidden="true" />, iconOnly: true },
              { value: "underline", label: "Underline", icon: <UnderlineIcon aria-hidden="true" />, iconOnly: true },
            ]}
          />
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
          <ToggleGroup
            label="Alignment"
            variant="ghost"
            size="sm"
            value={alignment}
            onValueChange={(next) => next.length > 0 && setAlignment(next)}
            items={[
              { value: "left", label: "Align left", icon: <AlignLeftIcon aria-hidden="true" />, iconOnly: true },
              { value: "center", label: "Align center", icon: <AlignCenterIcon aria-hidden="true" />, iconOnly: true },
              { value: "right", label: "Align right", icon: <AlignRightIcon aria-hidden="true" />, iconOnly: true },
            ]}
          />
        </div>
        <ToggleGroup
          label="Stock filter"
          defaultValue={["in-stock"]}
          items={[
            { value: "in-stock", label: "In stock" },
            { value: "low", label: "Low" },
            { value: "out", label: "Out" },
          ]}
        />
        <Toggle pressed={showDiscontinued} onPressedChange={setShowDiscontinued}>
          <ArchiveIcon aria-hidden="true" />
          Show discontinued
        </Toggle>
      </Demo>

      <Demo title="Tabs" className="grid w-full gap-6 md:grid-cols-2">
        <Tabs defaultValue="overview">
          <TabsList aria-label="Store dashboard">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="text-sm">
            142 sales today, $6,218 in revenue.
          </TabsContent>
          <TabsContent value="inventory" keepMounted="visited" className="text-sm">
            7 items are below their reorder point.
          </TabsContent>
          <TabsContent value="orders" className="text-sm">
            3 online orders are waiting for pickup.
          </TabsContent>
        </Tabs>
        <Tabs defaultValue="general" variant="underline" orientation="vertical">
          <TabsList aria-label="Register settings">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="taxes">Taxes</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="text-sm">
            Register 2 opens with a $150 cash drawer.
          </TabsContent>
          <TabsContent value="taxes" className="text-sm">
            State sales tax is 6.5 percent; contractor accounts are exempt.
          </TabsContent>
          <TabsContent value="receipts" className="text-sm">
            Receipts print the store phone number and return policy.
          </TabsContent>
        </Tabs>
      </Demo>

      <Demo title="Accordion" className="w-full max-w-2xl">
        <Accordion defaultValue={["returns"]}>
          <AccordionItem value="returns">
            <AccordionTrigger headingLevel={4}>What is the return policy?</AccordionTrigger>
            <AccordionContent>Unused items can be returned within 30 days with a receipt. Cut lumber, mixed paint and rentals are final sale.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="rentals">
            <AccordionTrigger headingLevel={4}>Do you rent equipment?</AccordionTrigger>
            <AccordionContent>Yes. Tile saws, carpet cleaners and post-hole diggers rent by the half day, day or week. A deposit is required.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="keys">
            <AccordionTrigger headingLevel={4}>Can you cut and copy keys?</AccordionTrigger>
            <AccordionContent>Standard house and padlock keys are cut while you wait at the service counter.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="delivery">
            <AccordionTrigger headingLevel={4}>How far do you deliver?</AccordionTrigger>
            <AccordionContent>Local delivery covers 15 miles from the store. Freight orders ship anywhere in the county.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Demo>

      <Demo title="Collapsible" className="w-full max-w-xl">
        <Collapsible className="w-full rounded-lg border border-border p-3">
          <CollapsibleTrigger>Advanced register settings</CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-3">
            <Switch label="Round cash totals to the nearest nickel" />
            <Switch label="Require a manager PIN for voids" defaultChecked />
          </CollapsibleContent>
        </Collapsible>
      </Demo>

      <Demo title="Table" className="w-full">
        <Table label="Inventory" containerClassName="border border-border">
          <TableCaption>Rows under 5 on hand are highlighted. Sort by quantity or price.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Item</TableHead>
              <TableHead align="end" sortDirection={directionFor("qty")} onSort={() => sortBy("qty")}>
                On hand
              </TableHead>
              <TableHead align="end" sortDirection={directionFor("price")} onSort={() => sortBy("price")}>
                Price
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sku} selected={row.qty < 5}>
                <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell align="end">{row.qty}</TableCell>
                <TableCell align="end">{money(row.price)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Stock value</TableCell>
              <TableCell align="end">{money(stockValue)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Demo>

      <Demo title="Time picker" className="flex w-full flex-wrap items-start gap-6">
        <FormField label="Opens at" description="Weekdays, 15-minute steps.">
          <TimePicker value={opens} onValueChange={setOpens} minuteStep={15} min="05:00" max={closes ?? "23:45"} name="opens" />
        </FormField>
        <FormField label="Closes at" description={closes ? `Saved as ${closes}` : "Not set"}>
          <TimePicker value={closes} onValueChange={setCloses} minuteStep={15} min={opens ?? "05:00"} max="23:45" name="closes" />
        </FormField>
        <TimePicker label="Delivery cutoff" hourCycle={24} value={cutoff} onValueChange={setCutoff} />
        <p className="basis-full text-sm text-muted-foreground">
          Open {formatTime(opens, { hourCycle: 12 }) || "--"} to {formatTime(closes, { hourCycle: 12 }) || "--"}; same-day delivery for orders before {cutoff ?? "--"}.
        </p>
      </Demo>
    </GallerySection>
  );
}
