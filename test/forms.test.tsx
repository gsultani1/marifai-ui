// packages/ai-ui/test/forms.test.tsx
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyColumnMapping,
  autoMapColumns,
  ColorPickerPanel,
  contrastRatio,
  CsvColumnMapper,
  currencyFractionDigits,
  CurrencyInput,
  FilterChips,
  FormField,
  FormWizard,
  generatePassword,
  hsvToRgb,
  OTPInput,
  parseColor,
  PasswordField,
  Rating,
  rgbToHsv,
  sanitizeDraft,
  scorePassword,
  SearchInput,
  SegmentedControl,
  SignaturePad,
  strokeToPath,
  TagInput,
  TextInput,
  toHex,
  type UploadContext,
  UploadQueue,
  UploadQueueStore,
  useFormDraft,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("password helpers", () => {
  it("scores rules and caps common passwords, repeats and sequences", () => {
    expect(scorePassword("").score).toBe(0);
    const common = scorePassword("Password1!");
    expect(common.score).toBe(1);
    expect(common.warnings).toContain("This is a commonly used password.");
    expect(scorePassword("P@ssw0rd2024!").score).toBe(1);
    expect(scorePassword("Tr0ub4dor&Horse").score).toBe(5);
    expect(scorePassword("Tr0ub4dor&Horse").label).toBe("Strong");
    const sequence = scorePassword("Zebra!1234Quilt");
    expect(sequence.score).toBe(3);
    expect(sequence.warnings).toContain("Avoid sequences like 1234 or qwer.");
    expect(scorePassword("Gooooose!7Lantern").warnings).toContain("Avoid repeating the same character.");
  });

  it("generates passwords with every enabled set and no ambiguous characters", () => {
    for (let run = 0; run < 20; run++) {
      const password = generatePassword({ length: 24 });
      expect(password).toHaveLength(24);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
    expect(generatePassword({ length: 10, uppercase: false, digits: false, symbols: false })).toMatch(/^[a-z]{10}$/);
    expect(() => generatePassword({ lowercase: false, uppercase: false, digits: false, symbols: false })).toThrow();
  });
});

describe("color helpers", () => {
  it("parses hex, rgb and hsl and round-trips through HSV", () => {
    expect(parseColor("#0f08")).toEqual({ r: 0, g: 255, b: 0, a: 0.533 });
    expect(parseColor("rgb(10 20 30 / 50%)")).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor("rgba(10, 20, 30, 0.25)")).toEqual({ r: 10, g: 20, b: 30, a: 0.25 });
    expect(toHex(parseColor("hsl(120 100% 50%)")!)).toBe("#00ff00");
    expect(parseColor("hsl(0.5turn, 100%, 25%)")).toEqual({ r: 0, g: 128, b: 128, a: 1 });
    expect(parseColor("not a color")).toBeNull();
    expect(parseColor("rgb(1 2)")).toBeNull();
    expect(parseColor('rgb(1,2,3)" onmouseover="x()')).toBeNull();
    expect(parseColor("rgb(1, 2, 3px)")).toBeNull();
    const color = { r: 37, g: 99, b: 235, a: 1 };
    expect(hsvToRgb(rgbToHsv(color))).toEqual(color);
    expect(toHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21);
  });

  it("edits a color with the keyboard, hex entry and swatches", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<ColorPickerPanel value="#808080" onValueChange={onValueChange} swatches={["#2563eb"]} />);
    const area = screen.getByRole("slider", { name: "Saturation and brightness" });
    expect(area.getAttribute("aria-valuetext")).toBe("Saturation 0%, brightness 50%");
    fireEvent.keyDown(area, { key: "ArrowUp", shiftKey: true });
    expect(onValueChange).toHaveBeenLastCalledWith("#9a9a9a");
    fireEvent.change(screen.getByRole("textbox", { name: "Hex color" }), { target: { value: "#ff0000" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
    fireEvent.click(screen.getByRole("button", { name: "#2563eb" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#2563eb");
    rerender(<ColorPickerPanel value="#2563eb" onValueChange={onValueChange} swatches={["#2563eb"]} />);
    expect(screen.getByRole("button", { name: "#2563eb" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("spinbutton", { name: "Red" })).toHaveProperty("value", "37");
  });
});

describe("TagInput", () => {
  it("adds on Enter and comma, splits pastes, rejects duplicates and removes chips", () => {
    const onValueChange = vi.fn();
    render(<TagInput aria-label="Labels" defaultValue={["urgent"]} onValueChange={onValueChange} maxTags={5} />);
    const input = screen.getByRole("combobox", { name: "Labels" });
    fireEvent.change(input, { target: { value: "paint" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenLastCalledWith(["urgent", "paint"]);
    fireEvent.change(input, { target: { value: "Paint" } });
    fireEvent.keyDown(input, { key: "," });
    expect(screen.getByRole("status").textContent).toBe('"Paint" is already added.');
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.paste(input, { clipboardData: { getData: () => "lumber, tools\nseasonal\nextra" } });
    expect(onValueChange).toHaveBeenLastCalledWith(["urgent", "paint", "lumber", "tools", "seasonal"]);
    expect(screen.getByRole("status").textContent).toBe("You can add up to 5 tags.");
    expect(screen.getByText("5/5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove urgent" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["paint", "lumber", "tools", "seasonal"]);
  });

  it("runs validate and transform", () => {
    const onValueChange = vi.fn();
    render(<TagInput aria-label="Emails" transform={(tag) => tag.toLowerCase()} validate={(tag) => (tag.includes("@") ? null : `${tag} is not an email`)} onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox", { name: "Emails" });
    fireEvent.change(input, { target: { value: "Ana@Example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenLastCalledWith(["ana@example.com"]);
    fireEvent.change(input, { target: { value: "bob" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("status").textContent).toBe("bob is not an email");
    expect((input as HTMLInputElement).value).toBe("bob");
  });
});

describe("number and code inputs", () => {
  it("stores currency in minor units", () => {
    expect(currencyFractionDigits("USD", "en-US")).toBe(2);
    expect(currencyFractionDigits("JPY", "en-US")).toBe(0);
    const onValueChange = vi.fn();
    render(<CurrencyInput aria-label="Price" defaultValue={1999} onValueChange={onValueChange} locale="en-US" />);
    const input = screen.getByRole("textbox", { name: "Price" });
    expect((input as HTMLInputElement).value).toBe("$19.99");
    fireEvent.change(input, { target: { value: "12.345" } });
    expect(onValueChange).toHaveBeenLastCalledWith(1235);
  });

  it("renders labelled OTP slots in groups", () => {
    render(<OTPInput length={6} groups={[3, 3]} aria-label="Verification code" defaultValue="123" />);
    const slots = screen.getAllByRole("textbox");
    expect(slots).toHaveLength(6);
    expect(screen.getAllByLabelText("Verification code")).toContain(slots[0]);
    expect(slots[5]!.getAttribute("aria-label")).toBe("Character 6 of 6");
    expect(slots.map((slot) => (slot as HTMLInputElement).value).join("")).toBe("123");
    expect(slots[0]!.getAttribute("autocomplete")).toBe("one-time-code");
  });
});

describe("PasswordField", () => {
  it("meters strength, reveals and generates", () => {
    const onValueChange = vi.fn();
    render(
      <FormField label="New password">
        <PasswordField showStrength generate onValueChange={onValueChange} />
      </FormField>,
    );
    const input = screen.getByLabelText("New password");
    expect(input.getAttribute("autocomplete")).toBe("new-password");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByRole("meter", { name: "Password strength" }).getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByText("At least 12 characters").textContent).toContain("(not met)");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.getAttribute("type")).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Generate password" }));
    const generated = onValueChange.mock.lastCall![0] as string;
    expect(generated).toHaveLength(20);
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("5");
    fireEvent.keyDown(input, { key: "A", getModifierState: (key: string) => key === "CapsLock" });
  });
});

describe("choice inputs", () => {
  it("rates with radios, clears on a second click and shows read-only fractions", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Rating label="Service" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onValueChange).toHaveBeenLastCalledWith(4);
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onValueChange).toHaveBeenLastCalledWith(null);
    rerender(<Rating label="Service" value={4.5} readOnly />);
    expect(screen.getByRole("img", { name: "Service: 4.5 out of 5" })).toBeTruthy();
  });

  it("selects segments and toggles filter chips", () => {
    const onMode = vi.fn();
    render(<SegmentedControl label="View" options={[{ value: "list", label: "List" }, { value: "board", label: "Board" }]} onValueChange={onMode} />);
    fireEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(onMode).toHaveBeenLastCalledWith("board");
    const onFilters = vi.fn();
    render(<FilterChips label="Status" options={[{ value: "open", label: "Open", count: 1200 }, { value: "closed", label: "Closed" }]} onValueChange={onFilters} />);
    fireEvent.click(screen.getByRole("button", { name: /Open/ }));
    expect(onFilters).toHaveBeenLastCalledWith(["open"]);
    expect(screen.getByText("1.2K")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onFilters).toHaveBeenLastCalledWith([]);
  });
});

describe("SearchInput", () => {
  it("debounces, searches at once on Enter, clears on Escape and announces counts", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { rerender } = render(<SearchInput onSearch={onSearch} debounceMs={200} />);
    const input = screen.getByRole("searchbox", { name: "Search" });
    fireEvent.change(input, { target: { value: "ham" } });
    fireEvent.change(input, { target: { value: "hammer" } });
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenLastCalledWith("hammer");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledTimes(2);
    rerender(<SearchInput onSearch={onSearch} debounceMs={200} resultCount={3} />);
    expect(screen.getByRole("status").textContent).toBe("3 results");
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
    expect(onSearch).toHaveBeenLastCalledWith("");
  });

  it("focuses from a page shortcut but not while typing elsewhere", () => {
    render(
      <>
        <TextInput aria-label="Other" />
        <SearchInput shortcut="/" />
      </>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Other" }), { key: "/" });
    expect(document.activeElement).not.toBe(screen.getByRole("searchbox"));
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });
});

describe("FormWizard", () => {
  it("blocks Next on errors, returns to the first invalid step on submit and submits when valid", async () => {
    let nameValid = false;
    const onSubmit = vi.fn();
    render(
      <FormWizard
        onSubmit={onSubmit}
        steps={[
          { id: "name", title: "Name", content: <p>Name step</p>, validate: () => (nameValid ? [] : ["Enter a store name"]) },
          { id: "hours", title: "Hours", content: <p>Hours step</p> },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Enter a store name");
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    nameValid = true;
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("button", { name: "Submit" });
    expect(screen.getByRole("heading", { name: "Hours" }).closest("section")!.hidden).toBe(false);
    nameValid = false;
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByRole("button", { name: "Next" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Name" }).closest("section")!.hidden).toBe(false);
    nameValid = true;
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(within(screen.getByRole("list", { name: "Form steps" })).getAllByRole("listitem")[0]!.textContent).toContain("completed");
  });
});

describe("CsvColumnMapper", () => {
  const fields = [
    { id: "sku", label: "SKU", required: true },
    { id: "name", label: "Name", aliases: ["description", "item"] },
    { id: "quantity", label: "Quantity", required: true, aliases: ["qty", "on hand"] },
    { id: "cost", label: "Unit cost" },
  ];

  it("guesses columns from headers and aliases", () => {
    expect(autoMapColumns(["Item Description", "Qty On Hand", "SKU #", "Notes"], fields)).toEqual({ sku: 2, name: 0, quantity: 1, cost: null });
    expect(applyColumnMapping([["a", "b", "c"]], { x: 2, y: null, z: 0 })).toEqual([{ x: "c", z: "a" }]);
  });

  it("blocks import until required fields map and previews records", () => {
    const onConfirm = vi.fn();
    render(<CsvColumnMapper headers={["Item", "Count", "Cost"]} rows={[["Hammer", "12", "9.99"], ["Saw", "3", "24.50"]]} fields={fields} onConfirm={onConfirm} />);
    const importButton = screen.getByRole("button", { name: "Import 2 rows" });
    expect(importButton).toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toBe("Map SKU, Quantity to continue.");
    fireEvent.change(screen.getByLabelText(/^SKU/), { target: { value: "0" } });
    expect(screen.getAllByText("Column used for another field")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: "1" } });
    expect(screen.getByText("12 · 3")).toBeTruthy();
    fireEvent.click(importButton);
    expect(onConfirm.mock.lastCall![1]).toEqual([
      { sku: "Hammer", quantity: "12", cost: "9.99" },
      { sku: "Saw", quantity: "3", cost: "24.50" },
    ]);
  });
});

describe("useFormDraft", () => {
  it("saves after a pause without secrets, offers the draft on return and clears it", () => {
    vi.useFakeTimers();
    expect(sanitizeDraft({ name: "Ana", password: "x", cardNumber: "4242", file: new Blob(["a"]) })).toEqual({ name: "Ana" });
    const first = renderHook(({ value }) => useFormDraft({ key: "draft:test", value }), { initialProps: { value: { name: "", password: "" } } });
    expect(window.localStorage.getItem("draft:test")).toBeNull();
    first.rerender({ value: { name: "Ana", password: "hunter2" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(JSON.parse(window.localStorage.getItem("draft:test")!).value).toEqual({ name: "Ana" });
    first.unmount();
    const second = renderHook(({ value }) => useFormDraft({ key: "draft:test", value }), { initialProps: { value: { name: "", password: "" } } });
    expect(second.result.current.draft).toEqual({ name: "Ana" });
    expect(window.localStorage.getItem("draft:test")).not.toBeNull();
    act(() => second.result.current.clear());
    expect(second.result.current.draft).toBeNull();
    expect(window.localStorage.getItem("draft:test")).toBeNull();
  });

  it("ignores drafts older than the limit", () => {
    window.localStorage.setItem("draft:old", JSON.stringify({ version: 1, savedAt: Date.now() - 8 * 24 * 3600 * 1000, value: { name: "Old" } }));
    const { result } = renderHook(() => useFormDraft({ key: "draft:old", value: { name: "" } }));
    expect(result.current.draft).toBeNull();
  });
});

function deferredUpload() {
  const calls: Array<{ file: File; context: UploadContext; resolve: () => void; reject: (error: Error) => void }> = [];
  const upload = (file: File, context: UploadContext) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ file, context, resolve, reject });
      context.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  return { calls, upload };
}

const file = (name: string, size = 10, lastModified = 1) => new File(["x".repeat(size)], name, { lastModified, type: "text/plain" });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("UploadQueueStore", () => {
  it("limits concurrency, pauses, resumes, retries and rejects bad files", async () => {
    const { calls, upload } = deferredUpload();
    const store = new UploadQueueStore({ upload, concurrency: 1, maxSize: 100, accept: ".txt,.csv" });
    const rejected = store.add([file("a.txt"), file("b.txt"), file("empty.txt", 0), file("big.txt", 200), file("photo.png")]);
    expect(rejected.map((item) => item.reason)).toEqual(["The file is empty.", "The file is too large.", "This file type isn't accepted."]);
    const [a, b] = store.getSnapshot().items;
    expect([a!.status, b!.status]).toEqual(["uploading", "queued"]);
    calls[0]!.context.onProgress(0.5);
    expect(store.getSnapshot().items[0]!.progress).toBe(0.5);
    store.pause(a!.id);
    await flush();
    expect(store.getSnapshot().items.map((item) => item.status)).toEqual(["paused", "uploading"]);
    calls[1]!.reject(new Error("Server said no"));
    await flush();
    expect(store.getSnapshot().items[1]).toMatchObject({ status: "failed", error: "Server said no" });
    store.resume(a!.id);
    await flush();
    expect(store.getSnapshot().items[0]!.status).toBe("uploading");
    calls[2]!.resolve();
    await flush();
    expect(store.getSnapshot().items[0]).toMatchObject({ status: "done", progress: 1 });
    store.retry(b!.id);
    await flush();
    expect(store.getSnapshot().items[1]!.status).toBe("uploading");
    expect(store.getSnapshot().items[1]!.error).toBeUndefined();
  });

  it("restores unfinished items as needing the file and checks re-attached files", async () => {
    const { calls, upload } = deferredUpload();
    const first = new UploadQueueStore({ upload, persistKey: "uploads" });
    first.add([file("report.csv", 20, 5)]);
    first.abortAll();
    const second = new UploadQueueStore({ upload, persistKey: "uploads" });
    const [item] = second.getSnapshot().items;
    expect(item).toMatchObject({ name: "report.csv", status: "needs-file" });
    expect(second.reattach(item!.id, file("report.csv", 21, 5))).toBe(false);
    expect(second.getSnapshot().items[0]!.error).toBe("That file doesn't match report.csv.");
    expect(second.reattach(item!.id, file("report.csv", 20, 5))).toBe(true);
    expect(second.getSnapshot().items[0]!.status).toBe("uploading");
    expect(calls).toHaveLength(2);
  });

  it("renders progress, actions and overflow", () => {
    const onRetry = vi.fn();
    const items = Array.from({ length: 32 }, (_, index) => ({ id: String(index), name: `file-${index}.txt`, size: 2048, type: "text/plain", lastModified: 1, addedAt: 1, status: index === 0 ? ("uploading" as const) : index === 1 ? ("failed" as const) : ("queued" as const), progress: index === 0 ? 0.4 : 0, ...(index === 1 ? { error: "Network error" } : {}) }));
    render(<UploadQueue items={items} onRetry={onRetry} onPause={vi.fn()} rejected={[{ name: "big.mov", reason: "The file is too large." }]} />);
    expect(screen.getByRole("progressbar", { name: "file-0.txt upload" }).getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByRole("alert").textContent).toContain("big.mov: The file is too large.");
    fireEvent.click(screen.getByRole("button", { name: "Retry file-1.txt" }));
    expect(onRetry).toHaveBeenCalledWith("1");
    expect(screen.getAllByRole("listitem").filter((item) => item.textContent?.startsWith("file-"))).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(screen.getByText("file-31.txt")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("1 uploading · 30 waiting · 1 need attention");
  });
});

describe("SignaturePad", () => {
  it("smooths strokes and exports typed signatures as escaped SVG", () => {
    expect(strokeToPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])).toBe("M0 0Q10 10 15 5L20 0");
    expect(strokeToPath([{ x: 5, y: 5 }])).toBe("M5 5l0.1 0");
    const onChange = vi.fn();
    render(<SignaturePad onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Type" }));
    fireEvent.change(screen.getByLabelText("Type your full name"), { target: { value: "Ana <Ruiz>" } });
    const value = onChange.mock.lastCall![0];
    expect(value.kind).toBe("typed");
    expect(value.svg).toContain("Ana &#60;Ruiz&#62;");
    expect(value.svg).not.toContain("<Ruiz>");
  });
});
