// packages/ai-ui/example/gallery/forms.tsx
import { LayoutGridIcon, ListIcon } from "lucide-react";
import { useState } from "react";

import {
  Banner,
  ColorPicker,
  type ColumnField,
  CsvColumnMapper,
  CurrencyInput,
  FilterChips,
  FormField,
  FormWizard,
  NumberInput,
  OTPInput,
  parseDelimited,
  PasswordField,
  Rating,
  SearchInput,
  SegmentedControl,
  SignaturePad,
  type SignatureValue,
  TagInput,
  TextInput,
  type UploadContext,
  UploadQueue,
  useFormDraft,
  useUploadQueue,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const PRODUCTS = [
  { name: "Claw hammer, 16 oz", status: "in-stock" },
  { name: "Hand saw, 15 in", status: "low" },
  { name: "Tape measure, 25 ft", status: "in-stock" },
  { name: "Utility knife", status: "out" },
  { name: "Level, 24 in", status: "in-stock" },
  { name: "Hammer drill", status: "low" },
];

const CSV = `Item Description,Qty On Hand,SKU #,Cost Each,Notes
Claw hammer 16 oz,24,HM-1601,9.99,Aisle 3
Hand saw 15 in,6,SW-1502,14.50,
Tape measure 25 ft,40,TM-2501,7.25,Endcap
Utility knife,0,UK-0007,4.99,Reorder
Level 24 in,11,LV-2401,18.00,`;

const CSV_ROWS = parseDelimited(CSV);

const IMPORT_FIELDS: ColumnField[] = [
  { id: "sku", label: "SKU", required: true },
  { id: "name", label: "Name", aliases: ["description", "item"] },
  { id: "quantity", label: "Quantity", required: true, aliases: ["qty", "on hand"] },
  { id: "cost", label: "Unit cost", aliases: ["cost each", "price"] },
];

/** Simulated upload: progress over about two seconds; files named with "fail" are rejected by the "server". */
function simulateUpload(file: File, { signal, onProgress }: UploadContext): Promise<void> {
  return new Promise((resolve, reject) => {
    let progress = 0;
    const timer = setInterval(() => {
      progress = Math.min(1, progress + 0.1);
      onProgress(progress);
      if (progress >= 0.6 && file.name.includes("fail")) {
        clearInterval(timer);
        reject(new Error("The server rejected this file."));
      } else if (progress >= 1) {
        clearInterval(timer);
        resolve();
      }
    }, 200);
    signal.addEventListener("abort", () => {
      clearInterval(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

interface StoreDraft extends Record<string, unknown> {
  storeName: string;
  phone: string;
  opens: number | null;
}

const EMPTY_STORE: StoreDraft = { storeName: "", phone: "", opens: null };

export function FormsGallery() {
  const [tags, setTags] = useState(["fasteners", "outdoor"]);
  const [price, setPrice] = useState<number | null>(1999);
  const [code, setCode] = useState("");
  const [rating, setRating] = useState<number | null>(4);
  const [view, setView] = useState<"list" | "board">("list");
  const [plan, setPlan] = useState("team");
  const [filters, setFilters] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [store, setStore] = useState<StoreDraft>(EMPTY_STORE);
  const [submitted, setSubmitted] = useState(false);
  const draft = useFormDraft({ key: "ai-ui-gallery:store-draft", value: store });
  const uploads = useUploadQueue({ upload: simulateUpload, concurrency: 2, maxSize: 5 * 1024 * 1024 });

  const visible = PRODUCTS.filter((product) => (!filters.length || filters.includes(product.status)) && product.name.toLowerCase().includes(query.trim().toLowerCase()));
  const statusCount = (status: string) => PRODUCTS.filter((product) => product.status === status).length;

  return (
    <GallerySection id="gallery-forms" title="Inputs and forms">
      <Demo title="Fields" className="grid w-full gap-4 md:grid-cols-2">
        <FormField label="Store name" description="Shown on receipts." validationMode="onBlur" validate={(value) => (String(value ?? "").trim().length < 3 ? "Use at least 3 characters." : null)} required>
          <TextInput name="storeName" placeholder="Whitten Hardware" required />
        </FormField>
        <FormField label="Labels" description="Enter, comma or Tab adds a label.">
          <TagInput value={tags} onValueChange={setTags} suggestions={["fasteners", "outdoor", "paint", "plumbing", "electrical", "seasonal", "tools"]} maxTags={6} />
        </FormField>
        <FormField label="Quantity">
          <NumberInput defaultValue={12} min={0} max={999} endContent="ea" />
        </FormField>
        <FormField label="Unit price" description={price === null ? "No price" : `Stored as ${price} cents`}>
          <CurrencyInput value={price} onValueChange={setPrice} min={0} />
        </FormField>
        <FormField label="Verification code" description={code.length === 6 ? `Code ${code} entered` : "Enter the 6-digit code we texted you."}>
          <OTPInput length={6} groups={[3, 3]} value={code} onValueChange={setCode} />
        </FormField>
        <FormField label="New password">
          <PasswordField showStrength generate />
        </FormField>
      </Demo>
      <Demo title="Choices" className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <Rating label="Service" value={rating} onValueChange={setRating} />
          <Rating label="Average rating" value={4.3} readOnly size="sm" />
          <SegmentedControl
            label="View"
            value={view}
            onValueChange={setView}
            options={[
              { value: "list", label: "List", icon: <ListIcon aria-hidden="true" /> },
              { value: "board", label: "Board", icon: <LayoutGridIcon aria-hidden="true" /> },
            ]}
          />
          <ColorPicker label="Brand color" value={color} onValueChange={setColor} alpha swatches={["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#111827"]} recentStorageKey="ai-ui-gallery:recent-colors" />
        </div>
        <SegmentedControl
          label="Plan"
          value={plan}
          onValueChange={setPlan}
          options={[
            { value: "solo", label: "Solo", description: "One register, one user." },
            { value: "team", label: "Team", description: "Up to 7 staff with roles." },
            { value: "multi", label: "Multi-store", description: "Shared inventory across stores." },
          ]}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput label="Search products" placeholder="Search products" value={query} onValueChange={setQuery} shortcut="/" resultCount={visible.length} className="w-64" />
            <FilterChips
              label="Stock status"
              value={filters}
              onValueChange={setFilters}
              options={[
                { value: "in-stock", label: "In stock", count: statusCount("in-stock") },
                { value: "low", label: "Low", count: statusCount("low") },
                { value: "out", label: "Out", count: statusCount("out") },
              ]}
            />
          </div>
          <ul aria-label="Products" className="flex flex-col divide-y divide-border rounded-md border border-border text-sm">
            {visible.length ? visible.map((product) => <li key={product.name} className="px-3 py-1.5">{product.name}</li>) : <li className="px-3 py-1.5 text-muted-foreground">No products match.</li>}
          </ul>
        </div>
      </Demo>
      <Demo title="Form wizard with a saved draft" className="flex w-full max-w-2xl flex-col gap-3">
        {draft.draft && (
          <Banner
            tone="info"
            title="You have an unsent draft"
            actions={
              <>
                <button type="button" onClick={() => setStore({ ...EMPTY_STORE, ...draft.draft })} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent">
                  Restore
                </button>
                <button type="button" onClick={draft.clear} className="rounded-md px-2.5 py-1 text-xs font-medium hover:bg-accent">
                  Discard
                </button>
              </>
            }
          >
            Saved {draft.savedAt ? new Date(draft.savedAt).toLocaleString() : ""}.
          </Banner>
        )}
        {submitted ? (
          <Banner tone="success" title="Store created" actions={<button type="button" onClick={() => setSubmitted(false)} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent">Start over</button>}>
            {store.storeName} opens at {store.opens}:00.
          </Banner>
        ) : (
          <FormWizard
            onSubmit={async () => {
              await new Promise((resolve) => setTimeout(resolve, 400));
              draft.clear();
              setSubmitted(true);
            }}
            submitLabel="Create store"
            steps={[
              {
                id: "store",
                title: "Store details",
                description: "Name and contact number.",
                validate: () => [...(store.storeName.trim() ? [] : ["Enter the store name."]), ...(/^\+?[\d\s().-]{7,}$/.test(store.phone) ? [] : ["Enter a phone number."])],
                content: (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Store name">
                      <TextInput value={store.storeName} onValueChange={(value: string) => setStore({ ...store, storeName: value })} />
                    </FormField>
                    <FormField label="Phone">
                      <TextInput type="tel" value={store.phone} onValueChange={(value: string) => setStore({ ...store, phone: value })} />
                    </FormField>
                  </div>
                ),
              },
              {
                id: "hours",
                title: "Opening hour",
                validate: () => (store.opens === null ? ["Choose when the store opens."] : []),
                content: (
                  <FormField label="Opens at (24-hour clock)">
                    <NumberInput value={store.opens} onValueChange={(value) => setStore({ ...store, opens: value })} min={0} max={23} endContent=":00" />
                  </FormField>
                ),
              },
              {
                id: "review",
                title: "Review",
                content: (
                  <dl className="grid grid-cols-[8rem_1fr] gap-1 text-sm">
                    <dt className="text-muted-foreground">Store</dt>
                    <dd>{store.storeName || "Not set"}</dd>
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{store.phone || "Not set"}</dd>
                    <dt className="text-muted-foreground">Opens</dt>
                    <dd>{store.opens === null ? "Not set" : `${store.opens}:00`}</dd>
                  </dl>
                ),
              },
            ]}
          />
        )}
      </Demo>
      <Demo title="Signature" className="grid w-full gap-4 md:grid-cols-2">
        <SignaturePad onChange={setSignature} />
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Exported SVG</span>
          {signature ? <img alt="Signature preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(signature.svg)}`} className="aspect-[3/1] w-full rounded-md border border-border bg-white" /> : <p className="text-muted-foreground">Nothing signed yet.</p>}
        </div>
      </Demo>
      <Demo title="Import column mapping" className="w-full">
        <div className="flex w-full flex-col gap-2">
          <CsvColumnMapper headers={CSV_ROWS[0]!} rows={CSV_ROWS.slice(1)} fields={IMPORT_FIELDS} onConfirm={(_mapping, records) => setImported(records.length)} />
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {imported === null ? "" : `Imported ${imported} rows.`}
          </p>
        </div>
      </Demo>
      <Demo title="Upload queue" className="w-full max-w-2xl">
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => uploads.add([new File(["a".repeat(120_000)], "price-list.csv", { type: "text/csv" }), new File(["b".repeat(800_000)], "store-photo.jpg", { type: "image/jpeg" }), new File(["c".repeat(40_000)], "fail-invoice.pdf", { type: "application/pdf" }), new File([], "empty.txt")])}
            className="self-start rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
          >
            Add sample files
          </button>
          <UploadQueue
            items={uploads.items}
            rejected={uploads.rejected}
            onAddFiles={uploads.add}
            onPause={uploads.pause}
            onResume={uploads.resume}
            onRetry={uploads.retry}
            onRemove={uploads.remove}
            onReattach={uploads.reattach}
            onClearCompleted={uploads.clearCompleted}
            allowFolders
          />
        </div>
      </Demo>
    </GallerySection>
  );
}
