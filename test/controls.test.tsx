// packages/ai-ui/test/controls.test.tsx
import { Field } from "@base-ui/react/field";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../src/components/accordion.js";
import { Checkbox, CheckboxGroup } from "../src/components/checkbox.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../src/components/collapsible.js";
import { Combobox, type ComboboxOption, MultiSelect } from "../src/components/combobox.js";
import { Fieldset } from "../src/components/fieldset.js";
import { FormField } from "../src/components/form-field.js";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../src/components/input-group.js";
import { Label } from "../src/components/label.js";
import { getMeterTone, Meter } from "../src/components/meter.js";
import { Progress } from "../src/components/progress.js";
import { RadioCard, RadioGroup, RadioGroupItem } from "../src/components/radio-group.js";
import { Select } from "../src/components/select.js";
import { Slider } from "../src/components/slider.js";
import { Switch } from "../src/components/switch.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, type TableSortDirection, cycleSortDirection } from "../src/components/table.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/tabs.js";
import { Textarea } from "../src/components/textarea.js";
import { formatTime, parseTime, TimePicker } from "../src/components/time-picker.js";
import { Toggle, ToggleGroup } from "../src/components/toggle.js";

const SUPPLIERS: ComboboxOption[] = [
  { value: "northline", label: "Northline Hardware Supply" },
  { value: "prairie", label: "Prairie Fastener Co." },
  { value: "lakeside", label: "Lakeside Lumber" },
  { value: "summit", label: "Summit Paint Distributors", disabled: true },
];

const DEPARTMENTS: ComboboxOption[] = [
  { value: "tools", label: "Tools" },
  { value: "paint", label: "Paint" },
  { value: "plumbing", label: "Plumbing" },
  { value: "garden", label: "Garden" },
];

/** Types like a user: jsdom change events carry no inputType, so the combobox would treat them as autofill. */
function typeInto(input: HTMLElement, value: string) {
  act(() => input.focus());
  fireEvent.input(input, { target: { value }, inputType: "insertText" });
}

/** Mouse selection of a listbox option: Base UI commits a click that starts with a pointer press on the item. */
function pick(option: HTMLElement) {
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}

describe("parseTime", () => {
  it("parses 24-hour times, with or without seconds", () => {
    expect(parseTime("14:30")).toEqual({ hours: 14, minutes: 30 });
    expect(parseTime("7:05")).toEqual({ hours: 7, minutes: 5 });
    expect(parseTime("00:00")).toEqual({ hours: 0, minutes: 0 });
    expect(parseTime("23:59:59")).toEqual({ hours: 23, minutes: 59 });
    expect(parseTime("08:15:30.250")).toEqual({ hours: 8, minutes: 15 });
    expect(parseTime("  09:45  ")).toEqual({ hours: 9, minutes: 45 });
  });

  it("parses 12-hour times in common spellings", () => {
    expect(parseTime("2:30 PM")).toEqual({ hours: 14, minutes: 30 });
    expect(parseTime("2:30pm")).toEqual({ hours: 14, minutes: 30 });
    expect(parseTime("2 p.m.")).toEqual({ hours: 14, minutes: 0 });
    expect(parseTime("9am")).toEqual({ hours: 9, minutes: 0 });
    expect(parseTime("12 AM")).toEqual({ hours: 0, minutes: 0 });
    expect(parseTime("12:15 am")).toEqual({ hours: 0, minutes: 15 });
    expect(parseTime("12:00 PM")).toEqual({ hours: 12, minutes: 0 });
    expect(parseTime("11:59 P")).toEqual({ hours: 23, minutes: 59 });
  });

  it("rejects malformed and out-of-range input", () => {
    for (const text of ["", "abc", "24:00", "12:60", "23:59:60", "13 PM", "0:30 AM", "14", "1430", "7:5", "9:00 xm", "am", "-1:00", "1:00:00:00"]) {
      expect(parseTime(text), text).toBeNull();
    }
  });
});

describe("formatTime", () => {
  it("formats the HH:mm value by default and 12-hour text on request", () => {
    expect(formatTime({ hours: 9, minutes: 5 })).toBe("09:05");
    expect(formatTime({ hours: 0, minutes: 0 }, { hourCycle: 12 })).toBe("12:00 AM");
    expect(formatTime({ hours: 12, minutes: 30 }, { hourCycle: 12 })).toBe("12:30 PM");
    expect(formatTime({ hours: 18, minutes: 45 }, { hourCycle: 12 })).toBe("6:45 PM");
    expect(formatTime("6:45 pm")).toBe("18:45");
    expect(formatTime("18:45", { hourCycle: 12, meridiem: ["a. m.", "p. m."] })).toBe("6:45 p. m.");
  });

  it("returns an empty string for empty, unparseable or invalid parts", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime(undefined)).toBe("");
    expect(formatTime("noon")).toBe("");
    expect(formatTime({ hours: 24, minutes: 0 })).toBe("");
    expect(formatTime({ hours: 10, minutes: 60 })).toBe("");
    expect(formatTime({ hours: 1.5, minutes: 0 })).toBe("");
  });

  it("round-trips every minute of the day through both hour cycles", () => {
    for (let total = 0; total < 24 * 60; total += 7) {
      const parts = { hours: Math.floor(total / 60), minutes: total % 60 };
      expect(parseTime(formatTime(parts))).toEqual(parts);
      expect(parseTime(formatTime(parts, { hourCycle: 12 }))).toEqual(parts);
    }
  });
});

describe("getMeterTone", () => {
  it("treats the region holding optimum as success and steps away as warning then danger", () => {
    const stock = { min: 0, max: 200, low: 25, high: 150, optimum: 200 };
    expect(getMeterTone({ ...stock, value: 180 })).toBe("success");
    expect(getMeterTone({ ...stock, value: 150 })).toBe("success");
    expect(getMeterTone({ ...stock, value: 80 })).toBe("warning");
    expect(getMeterTone({ ...stock, value: 25 })).toBe("warning");
    expect(getMeterTone({ ...stock, value: 12 })).toBe("danger");
  });

  it("mirrors the regions when lower is better", () => {
    const disk = { min: 0, max: 100, low: 60, high: 85, optimum: 0 };
    expect(getMeterTone({ ...disk, value: 40 })).toBe("success");
    expect(getMeterTone({ ...disk, value: 70 })).toBe("warning");
    expect(getMeterTone({ ...disk, value: 95 })).toBe("danger");
  });

  it("only warns outside the band when optimum sits between low and high", () => {
    const temperature = { min: 0, max: 100, low: 30, high: 70, optimum: 50 };
    expect(getMeterTone({ ...temperature, value: 50 })).toBe("success");
    expect(getMeterTone({ ...temperature, value: 10 })).toBe("warning");
    expect(getMeterTone({ ...temperature, value: 90 })).toBe("warning");
  });

  it("defaults to success and clamps values and thresholds", () => {
    expect(getMeterTone({ value: 10 })).toBe("success");
    expect(getMeterTone({ value: -50, low: 20, high: 80, optimum: 100 })).toBe("danger");
    expect(getMeterTone({ value: 500, low: 20, high: 80, optimum: 100 })).toBe("success");
    expect(getMeterTone({ value: 50, low: 90, high: 10, optimum: 100 })).toBe("danger");
    expect(getMeterTone({ value: 95, low: 90, high: 10, optimum: 100 })).toBe("success");
  });
});

describe("cycleSortDirection", () => {
  it("cycles none, ascending, descending and back", () => {
    expect(cycleSortDirection("none")).toBe("ascending");
    expect(cycleSortDirection("ascending")).toBe("descending");
    expect(cycleSortDirection("descending")).toBe("none");
  });
});

describe("Label", () => {
  it("labels a control with htmlFor and shows required and optional markers", () => {
    render(
      <>
        <Label htmlFor="sku" required>
          SKU
        </Label>
        <input id="sku" />
        <Label htmlFor="notes" optional>
          Notes
        </Label>
        <input id="notes" />
      </>,
    );
    expect(screen.getByRole("textbox", { name: "SKU" })).toBeTruthy();
    expect(screen.getByText("*").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Notes (optional)" })).toBeTruthy();
  });

  it("composes with Base UI Field.Label so the field wires the control", () => {
    render(
      <Field.Root>
        <Field.Label render={<Label required />}>Store name</Field.Label>
        <Field.Control />
      </Field.Root>,
    );
    const input = screen.getByRole("textbox", { name: "Store name" });
    expect(input).toBeTruthy();
    expect(document.querySelector("[data-slot=label]")?.getAttribute("for")).toBe(input.id);
  });
});

describe("Textarea", () => {
  it("joins a FormField and counts characters", () => {
    const onValueChange = vi.fn();
    render(
      <FormField label="Receipt footer" description="Printed under every receipt.">
        <Textarea defaultValue="Thanks" maxLength={20} showCount onValueChange={onValueChange} />
      </FormField>,
    );
    const textarea = screen.getByRole("textbox", { name: "Receipt footer" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Printed under every receipt.").id).toBe(textarea.getAttribute("aria-describedby"));
    expect(textarea.getAttribute("maxlength")).toBe("20");
    fireEvent.change(textarea, { target: { value: "Thanks for shopping" } });
    expect(onValueChange).toHaveBeenLastCalledWith("Thanks for shopping");
    expect(document.querySelector("[data-slot=input-counter]")?.textContent).toContain("19 / 20");
  });

  it("lets a soft limit overflow and marks the field invalid", () => {
    function Controlled() {
      const [value, setValue] = useState("Short");
      return <Textarea aria-label="Message" value={value} onValueChange={setValue} maxLength={5} showCount softLimit />;
    }
    render(<Controlled />);
    const textarea = screen.getByRole("textbox", { name: "Message" });
    expect(textarea.getAttribute("maxlength")).toBeNull();
    expect(textarea.getAttribute("aria-invalid")).toBeNull();
    fireEvent.change(textarea, { target: { value: "Shorter" } });
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector("[data-slot=input-counter]")?.getAttribute("data-state")).toBe("over");
  });

  it("sets rows from minRows and passes the ref", () => {
    let element: HTMLTextAreaElement | null = null;
    render(<Textarea aria-label="Notes" minRows={4} ref={(node) => {
          element = node;
        }} />);
    expect(screen.getByRole("textbox", { name: "Notes" }).getAttribute("rows")).toBe("4");
    expect(element).toBe(screen.getByRole("textbox", { name: "Notes" }));
  });
});

describe("InputGroup", () => {
  it("describes the input with addon text, focuses it from an addon and runs inline buttons", () => {
    const onClick = vi.fn();
    render(
      <InputGroup>
        <InputGroupAddon>$</InputGroupAddon>
        <InputGroupInput aria-label="Price" />
        <InputGroupAddon align="end">USD</InputGroupAddon>
        <InputGroupButton size="icon" aria-label="Clear price" onClick={onClick}>
          x
        </InputGroupButton>
      </InputGroup>,
    );
    const input = screen.getByRole("textbox", { name: "Price" });
    const described = (input.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["$", "USD"]);
    fireEvent.mouseDown(screen.getByText("$"));
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByRole("button", { name: "Clear price" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("group")).toBeTruthy();
  });

  it("skips icon-only addons and joins a FormField", () => {
    render(
      <FormField label="Search inventory">
        <InputGroup>
          <InputGroupAddon>
            <svg aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput aria-describedby="hint" />
        </InputGroup>
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: "Search inventory" });
    expect(input.getAttribute("aria-describedby")).toBe("hint");
  });
});

describe("Switch", () => {
  it("toggles from the control and the label and links the description", () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Low stock alerts" description="Email when an item drops below its reorder point." onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch", { name: "Low stock alerts" });
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(document.getElementById(control.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Email when an item drops below its reorder point.");
    fireEvent.click(control);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(control.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByText("Low stock alerts"));
    expect(control.getAttribute("aria-checked")).toBe("false");
  });

  it("stays controlled and renders bare with an aria-label", () => {
    render(<Switch aria-label="Daily summary" checked onCheckedChange={() => undefined} />);
    const control = screen.getByRole("switch", { name: "Daily summary" });
    fireEvent.click(control);
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.getAttribute("data-slot")).toBe("switch");
  });
});

describe("Checkbox", () => {
  it("toggles with its label and reports mixed when indeterminate", () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Checkbox label="Email receipts" description="Send a copy to the customer." onCheckedChange={onCheckedChange} />
        <Checkbox aria-label="Some rows" indeterminate />
      </>,
    );
    const box = screen.getByRole("checkbox", { name: "Email receipts" });
    fireEvent.click(screen.getByText("Email receipts"));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(document.getElementById(box.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Send a copy to the customer.");
    expect(screen.getByRole("checkbox", { name: "Some rows" }).getAttribute("aria-checked")).toBe("mixed");
  });

  it("drives a Select all parent that goes indeterminate and skips disabled children", () => {
    const onValueChange = vi.fn();
    render(
      <CheckboxGroup
        label="Departments to sync"
        selectAll
        defaultValue={["paint"]}
        onValueChange={onValueChange}
        options={[
          { value: "tools", label: "Tools" },
          { value: "paint", label: "Paint" },
          { value: "garden", label: "Garden", disabled: true },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Departments to sync" });
    const parent = within(group).getByRole("checkbox", { name: "Select all" });
    expect(parent.getAttribute("aria-checked")).toBe("mixed");
    fireEvent.click(parent);
    expect(onValueChange).toHaveBeenLastCalledWith(["tools", "paint"]);
    fireEvent.click(within(group).getByRole("checkbox", { name: "Tools" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Paint" }));
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    expect(parent.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(within(group).getByRole("checkbox", { name: "Tools" }));
    expect(parent.getAttribute("aria-checked")).toBe("mixed");
  });
});

describe("RadioGroup", () => {
  it("selects with clicks and arrow keys", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup label="Receipt format" defaultValue="print" onValueChange={onValueChange}>
        <RadioGroupItem value="print" label="Print" />
        <RadioGroupItem value="email" label="Email" description="Sent to the address on file." />
        <RadioGroupItem value="both" label="Both" />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup", { name: "Receipt format" });
    const print = within(group).getByRole("radio", { name: "Print" });
    expect(print.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(group).getByRole("radio", { name: "Both" }));
    expect(onValueChange).toHaveBeenLastCalledWith("both");
    const email = within(group).getByRole("radio", { name: "Email" });
    fireEvent.click(email);
    act(() => email.focus());
    fireEvent.keyDown(email, { key: "ArrowDown" });
    await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith("both"));
    expect(document.activeElement).toBe(within(group).getByRole("radio", { name: "Both" }));
    expect(document.getElementById(email.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Sent to the address on file.");
  });

  it("renders option cards named by their label and described by the rest", () => {
    function Shipping() {
      const [value, setValue] = useState<"pickup" | "delivery">("pickup");
      return (
        <RadioGroup
          label="Delivery method"
          variant="card"
          value={value}
          onValueChange={setValue}
          options={[
            { value: "pickup", label: "In-store pickup", description: "Ready in 2 hours.", aside: "Free" },
            { value: "delivery", label: "Local delivery", description: "Within 15 miles.", aside: "$7.99" },
          ]}
        />
      );
    }
    render(<Shipping />);
    const delivery = screen.getByRole("radio", { name: "Local delivery" });
    const description = (delivery.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(description).toEqual(["Within 15 miles.", "$7.99"]);
    fireEvent.click(delivery);
    expect(delivery.getAttribute("aria-checked")).toBe("true");
    expect(delivery.getAttribute("data-slot")).toBe("radio-card");
  });
});

describe("RadioCard", () => {
  it("composes as children and skips disabled cards", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" variant="card" onValueChange={onValueChange}>
        <RadioCard value="solo" label="Solo" description="One register." />
        <RadioCard value="multi" label="Multi-store" disabled aside="Contact us" />
      </RadioGroup>,
    );
    const multi = screen.getByRole("radio", { name: "Multi-store" });
    expect(multi.matches(":disabled") || multi.getAttribute("aria-disabled") === "true").toBe(true);
    fireEvent.click(multi);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Solo" }));
    expect(onValueChange).toHaveBeenLastCalledWith("solo");
  });
});

describe("Select", () => {
  const CATEGORIES = [
    {
      label: "Tools",
      options: [
        { value: "hand-tools", label: "Hand tools", description: "Hammers, saws and wrenches" },
        { value: "power-tools", label: "Power tools" },
      ],
    },
    {
      label: "Building",
      options: [
        { value: "lumber", label: "Lumber" },
        { value: "fasteners", label: "Fasteners", disabled: true },
      ],
    },
  ];

  it("shows a placeholder, picks an option and is named by its FormField", async () => {
    const onValueChange = vi.fn();
    render(
      <FormField label="Category">
        <Select options={CATEGORIES} placeholder="Choose a category" onValueChange={onValueChange} />
      </FormField>,
    );
    const trigger = screen.getByRole("combobox", { name: "Category" });
    expect(trigger.textContent).toContain("Choose a category");
    fireEvent.click(trigger);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("group", { name: "Tools" })).toBeTruthy();
    expect(within(listbox).getByRole("option", { name: /Fasteners/ }).getAttribute("aria-disabled")).toBe("true");
    expect(within(listbox).getByText("Hammers, saws and wrenches")).toBeTruthy();
    pick(within(listbox).getByRole("option", { name: /Lumber/ }));
    expect(onValueChange).toHaveBeenLastCalledWith("lumber");
    await waitFor(() => expect(trigger.textContent).toContain("Lumber"));
  });

  it("renders a controlled value and an aria-label without a field", () => {
    render(<Select aria-label="Unit" value="ft" options={[{ value: "ft", label: "Feet" }, { value: "m", label: "Meters" }]} />);
    expect(screen.getByRole("combobox", { name: "Unit" }).textContent).toContain("Feet");
  });
});

describe("Combobox", () => {
  it("filters as you type, shows the empty message and selects", async () => {
    const onValueChange = vi.fn();
    render(<Combobox aria-label="Supplier" options={SUPPLIERS} onValueChange={onValueChange} emptyMessage="No suppliers match" />);
    const input = screen.getByRole("combobox", { name: "Supplier" });
    typeInto(input, "lum");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual(["Lakeside Lumber"]);
    pick(within(listbox).getByRole("option", { name: "Lakeside Lumber" }));
    expect(onValueChange).toHaveBeenLastCalledWith("lakeside");
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("Lakeside Lumber"));
    typeInto(input, "zzz");
    expect(await screen.findByText("No suppliers match")).toBeTruthy();
  });

  it("uses a custom filter and offers a Create entry that selects the new option", async () => {
    const onCreate = vi.fn((label: string) => ({ value: "new", label }));
    const onValueChange = vi.fn();
    render(<Combobox aria-label="Supplier" options={SUPPLIERS} filter={(option, query) => option.label.toLowerCase().startsWith(query.toLowerCase())} onCreate={onCreate} onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox", { name: "Supplier" });
    typeInto(input, "Supply");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).queryByRole("option", { name: "Northline Hardware Supply" })).toBeNull();
    pick(within(listbox).getByRole("option", { name: 'Create "Supply"' }));
    expect(onCreate).toHaveBeenCalledWith("Supply");
    expect(onValueChange).toHaveBeenLastCalledWith("new");
  });

  it("reports typing for async search and shows a busy status while loading", async () => {
    const onInputValueChange = vi.fn();
    render(<Combobox aria-label="Supplier" options={[]} filter={null} loading loadingMessage="Searching suppliers" onInputValueChange={onInputValueChange} />);
    typeInto(screen.getByRole("combobox", { name: "Supplier" }), "pr");
    expect(onInputValueChange).toHaveBeenLastCalledWith("pr");
    expect(await screen.findByText("Searching suppliers")).toBeTruthy();
    expect(screen.getByRole("listbox").closest("[aria-busy=true]")).toBeTruthy();
  });
});

describe("MultiSelect", () => {
  it("adds chips, removes them by button and Backspace, and caps the selection", async () => {
    const onValueChange = vi.fn();
    render(<MultiSelect aria-label="Departments" options={DEPARTMENTS} defaultValue={["tools"]} max={2} onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox", { name: "Departments" });
    expect(screen.getByRole("button", { name: "Remove Tools" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show options" }));
    const listbox = await screen.findByRole("listbox");
    pick(within(listbox).getByRole("option", { name: "Paint" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["tools", "paint"]);
    expect(await screen.findByText("You can choose up to 2.")).toBeTruthy();
    expect(within(screen.getByRole("listbox")).getByRole("option", { name: "Garden" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onValueChange).toHaveBeenLastCalledWith(["tools", "paint"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Tools" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["paint"]);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("button", { name: "Remove Paint" })).toBeNull();
  });
});

describe("Slider", () => {
  it("formats aria-valuetext, steps with the keyboard and draws marks", () => {
    const onValueChange = vi.fn();
    render(<Slider label="Reorder point" defaultValue={20} min={0} max={100} step={5} formatValue={(value) => `${value} units`} onValueChange={onValueChange} marks={[{ value: 0, label: "0" }, { value: 50, label: "50" }, { value: 100, label: "100" }]} />);
    const thumb = screen.getByRole("slider", { name: "Reorder point" });
    expect(thumb.getAttribute("aria-valuetext")).toBe("20 units");
    expect(screen.getByText("20 units")).toBeTruthy();
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenLastCalledWith(25, expect.anything());
    expect(screen.getByText("50").closest("[aria-hidden=true]")).toBeTruthy();
  });

  it("names both thumbs of a range and shows the range value", () => {
    render(<Slider label="Price" defaultValue={[20, 80]} max={200} formatValue={(value) => `$${value}`} />);
    const low = screen.getByRole("slider", { name: "Price, minimum" });
    const high = screen.getByRole("slider", { name: "Price, maximum" });
    expect(low.getAttribute("aria-valuetext")).toBe("$20");
    expect(high.getAttribute("aria-valuetext")).toBe("$80");
    expect(screen.getByText("$20 – $80")).toBeTruthy();
  });

  it("supports vertical orientation", () => {
    render(<Slider aria-label="Volume" orientation="vertical" defaultValue={30} />);
    expect(screen.getByRole("slider", { name: "Volume" }).getAttribute("aria-orientation")).toBe("vertical");
  });

  it("names the thumbs from aria-label when there is no visible label", () => {
    render(<Slider aria-label="Shelf height" defaultValue={[24, 60]} max={84} />);
    expect(screen.getByRole("slider", { name: "Shelf height, minimum" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Shelf height, maximum" })).toBeTruthy();
  });
});

describe("Progress and Meter", () => {
  it("reports determinate progress with a label and custom value text", () => {
    render(<Progress label="Uploading catalog.csv" value={40} valueText="4 of 10 files" tone="success" />);
    const bar = screen.getByRole("progressbar", { name: "Uploading catalog.csv" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuetext")).toBe("4 of 10 files");
    expect(bar.getAttribute("data-tone")).toBe("success");
    expect(screen.getByText("4 of 10 files")).toBeTruthy();
  });

  it("drops aria-valuenow when indeterminate", () => {
    render(<Progress aria-label="Syncing inventory" value={null} />);
    const bar = screen.getByRole("progressbar", { name: "Syncing inventory" });
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
  });

  it("picks the meter tone from thresholds and announces the status word", () => {
    render(<Meter label="Deck screws" value={12} max={200} low={25} high={150} optimum={200} formatValue={(value) => `${value} boxes`} statusText={{ danger: "Low stock" }} />);
    const meter = screen.getByRole("meter", { name: "Deck screws" });
    expect(meter.getAttribute("data-tone")).toBe("danger");
    expect(meter.getAttribute("aria-valuetext")).toBe("12 boxes, Low stock");
    expect(screen.getByText("Low stock")).toBeTruthy();
    expect(screen.getByText("12 boxes")).toBeTruthy();
  });
});

describe("Toggle and ToggleGroup", () => {
  it("toggles aria-pressed", () => {
    const onPressedChange = vi.fn();
    render(<Toggle onPressedChange={onPressedChange}>Show discontinued</Toggle>);
    const toggle = screen.getByRole("button", { name: "Show discontinued" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.anything());
  });

  it("keeps one pressed in single mode and many in multiple mode, with labels on icon-only items", () => {
    const onAlign = vi.fn();
    const onFormat = vi.fn();
    render(
      <>
        <ToggleGroup label="Alignment" defaultValue={["left"]} onValueChange={onAlign} items={[{ value: "left", label: "Align left" }, { value: "center", label: "Align center" }]} />
        <ToggleGroup
          label="Text formatting"
          multiple
          variant="ghost"
          onValueChange={onFormat}
          items={[
            { value: "bold", label: "Bold", icon: <svg aria-hidden="true" />, iconOnly: true },
            { value: "italic", label: "Italic", icon: <svg aria-hidden="true" />, iconOnly: true },
          ]}
        />
      </>,
    );
    const alignment = screen.getByRole("group", { name: "Alignment" });
    fireEvent.click(within(alignment).getByRole("button", { name: "Align center" }));
    expect(onAlign).toHaveBeenLastCalledWith(["center"]);
    expect(within(alignment).getByRole("button", { name: "Align left" }).getAttribute("aria-pressed")).toBe("false");
    const formatting = screen.getByRole("group", { name: "Text formatting" });
    fireEvent.click(within(formatting).getByRole("button", { name: "Bold" }));
    fireEvent.click(within(formatting).getByRole("button", { name: "Italic" }));
    expect(onFormat).toHaveBeenLastCalledWith(["bold", "italic"]);
    expect(within(formatting).getByRole("button", { name: "Bold" }).getAttribute("title")).toBe("Bold");
  });
});

describe("Tabs", () => {
  it("switches panels by click and arrow key and keeps visited panels mounted", async () => {
    render(
      <Tabs defaultValue="overview" variant="underline">
        <TabsList aria-label="Store">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Sales today</TabsContent>
        <TabsContent value="inventory" keepMounted="visited">
          <input aria-label="Count" />
        </TabsContent>
        <TabsContent value="orders">Open orders</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Sales today")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Count" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    expect(screen.getByRole("tab", { name: "Inventory" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    const inventory = screen.getByRole("tab", { name: "Inventory" });
    act(() => inventory.focus());
    fireEvent.keyDown(inventory, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Orders" })));
    fireEvent.click(screen.getByRole("tab", { name: "Orders" }));
    expect(screen.getByText("Open orders")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Count", hidden: true })).toBeTruthy();
    expect(document.querySelector("[data-slot=tabs]")?.getAttribute("data-variant")).toBe("underline");
  });
});

describe("Accordion and Collapsible", () => {
  it("opens one item at a time unless multiple", () => {
    const { unmount } = render(
      <Accordion>
        <AccordionItem value="returns">
          <AccordionTrigger>What is the return policy?</AccordionTrigger>
          <AccordionContent>Returns within 30 days with a receipt.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="keys">
          <AccordionTrigger>Do you cut keys?</AccordionTrigger>
          <AccordionContent>Yes, at the service counter.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const returns = screen.getByRole("button", { name: "What is the return policy?" });
    const keys = screen.getByRole("button", { name: "Do you cut keys?" });
    expect(returns.closest("h3")).toBeTruthy();
    fireEvent.click(returns);
    expect(returns.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Returns within 30 days with a receipt.")).toBeTruthy();
    fireEvent.click(keys);
    expect(keys.getAttribute("aria-expanded")).toBe("true");
    expect(returns.getAttribute("aria-expanded")).toBe("false");
    unmount();

    render(
      <Accordion multiple defaultValue={["a"]}>
        <AccordionItem value="a">
          <AccordionTrigger headingLevel={4}>Rentals</AccordionTrigger>
          <AccordionContent>Daily and weekly rates.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger headingLevel={4}>Delivery</AccordionTrigger>
          <AccordionContent>Within 15 miles.</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
    expect(screen.getByRole("button", { name: "Rentals" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Delivery" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Rentals" }).closest("h4")).toBeTruthy();
  });

  it("toggles a collapsible and reports open changes", () => {
    const onOpenChange = vi.fn();
    render(
      <Collapsible onOpenChange={onOpenChange}>
        <CollapsibleTrigger>Advanced settings</CollapsibleTrigger>
        <CollapsibleContent>Tax rounding</CollapsibleContent>
      </Collapsible>,
    );
    const trigger = screen.getByRole("button", { name: "Advanced settings" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(screen.getByText("Tax rounding")).toBeTruthy();
  });
});

describe("Table", () => {
  it("names the scroll region and sorts with aria-sort", () => {
    function Inventory() {
      const [sort, setSort] = useState<TableSortDirection>("none");
      const rows = [
        { sku: "HM-1601", name: "Claw hammer", qty: 24 },
        { sku: "UK-0007", name: "Utility knife", qty: 3 },
      ];
      const sorted = sort === "none" ? rows : [...rows].sort((a, b) => (sort === "ascending" ? a.qty - b.qty : b.qty - a.qty));
      return (
        <Table label="Inventory">
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead align="end" sortDirection={sort} onSort={() => setSort(cycleSortDirection(sort))}>
                On hand
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.sku} selected={row.qty < 5}>
                <TableCell>{row.name}</TableCell>
                <TableCell align="end">{row.qty}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
    render(<Inventory />);
    const region = screen.getByRole("region", { name: "Inventory" });
    expect(region.getAttribute("tabindex")).toBe("0");
    const table = within(region).getByRole("table", { name: "Inventory" });
    const header = within(table).getByRole("columnheader", { name: /On hand/ });
    expect(header.getAttribute("aria-sort")).toBe("none");
    expect(within(table).getByRole("columnheader", { name: "Item" }).getAttribute("aria-sort")).toBeNull();
    fireEvent.click(within(header).getByRole("button", { name: "On hand" }));
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(within(table).getAllByRole("row")[1]?.textContent).toContain("Utility knife");
    expect(within(table).getAllByRole("row")[1]?.getAttribute("data-state")).toBe("selected");
    fireEvent.click(within(header).getByRole("button", { name: "On hand" }));
    expect(header.getAttribute("aria-sort")).toBe("descending");
  });

  it("renders a plain wrapper without a label", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Empty aisle</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.querySelector("[data-slot=table-container]")?.getAttribute("tabindex")).toBeNull();
  });
});

describe("TimePicker", () => {
  function segments(name: string) {
    const group = screen.getByRole("group", { name });
    return {
      group,
      hour: within(group).getByRole("spinbutton", { name: `${name} Hours` }),
      minute: within(group).getByRole("spinbutton", { name: `${name} Minutes` }),
      period: within(group).queryByRole("spinbutton", { name: `${name} AM/PM` }),
    };
  }

  it("types digits across segments like a native time input", () => {
    const onValueChange = vi.fn();
    render(<TimePicker label="Opens at" onValueChange={onValueChange} />);
    const { hour, minute, period } = segments("Opens at");
    expect(hour.getAttribute("aria-valuetext")).toBe("Empty");
    act(() => hour.focus());
    fireEvent.keyDown(hour, { key: "7" });
    expect(document.activeElement).toBe(minute);
    fireEvent.keyDown(minute, { key: "3" });
    fireEvent.keyDown(minute, { key: "0" });
    expect(document.activeElement).toBe(period);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(period!, { key: "p" });
    expect(onValueChange).toHaveBeenLastCalledWith("19:30");
    expect((hour as HTMLInputElement).value).toBe("07");
    expect((period as HTMLInputElement).value).toBe("PM");
    act(() => hour.focus());
    fireEvent.keyDown(hour, { key: "1" });
    fireEvent.keyDown(hour, { key: "1" });
    expect(onValueChange).toHaveBeenLastCalledWith("23:30");
    fireEvent.keyDown(hour, { key: "Backspace" });
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("steps segments with arrows, Home and End and respects minuteStep", () => {
    const onValueChange = vi.fn();
    render(<TimePicker aria-label="Delivery cutoff" hourCycle={24} defaultValue="14:50" minuteStep={15} onValueChange={onValueChange} />);
    const { hour, minute, period } = segments("Delivery cutoff");
    expect(period).toBeNull();
    fireEvent.keyDown(minute, { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith("14:00");
    fireEvent.keyDown(minute, { key: "ArrowDown" });
    expect(onValueChange).toHaveBeenLastCalledWith("14:45");
    fireEvent.keyDown(hour, { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith("15:45");
    fireEvent.keyDown(hour, { key: "End" });
    expect(onValueChange).toHaveBeenLastCalledWith("23:45");
    fireEvent.keyDown(hour, { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith("00:45");
    expect(hour.getAttribute("aria-valuemax")).toBe("23");
  });

  it("clamps arrows to min and max and snaps typed values when focus leaves", () => {
    const onValueChange = vi.fn();
    render(
      <>
        <TimePicker label="Closes at" defaultValue="20:30" min="07:00" max="21:00" minuteStep={15} onValueChange={onValueChange} />
        <button type="button">Elsewhere</button>
      </>,
    );
    const { hour, minute, group } = segments("Closes at");
    fireEvent.keyDown(hour, { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith("21:00");
    act(() => minute.focus());
    fireEvent.keyDown(minute, { key: "0" });
    fireEvent.keyDown(minute, { key: "8" });
    expect(onValueChange).toHaveBeenLastCalledWith("21:08");
    expect(minute.getAttribute("aria-invalid")).toBe("true");
    expect(group.getAttribute("data-invalid")).toBe("true");
    fireEvent.blur(minute, { relatedTarget: screen.getByRole("button", { name: "Elsewhere" }) });
    expect(onValueChange).toHaveBeenLastCalledWith("21:00");
    expect(minute.getAttribute("aria-invalid")).toBeNull();
  });

  it("follows a controlled value and joins a FormField with validation", () => {
    function Hours() {
      const [opens, setOpens] = useState<string | null>("09:00");
      return (
        <>
          <FormField label="Opens at" description="Local time.">
            <TimePicker value={opens} onValueChange={setOpens} name="opens" required />
          </FormField>
          <button type="button" onClick={() => setOpens("06:15")}>
            Early open
          </button>
        </>
      );
    }
    render(<Hours />);
    const group = screen.getByRole("group", { name: "Opens at" });
    expect(document.getElementById(group.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Local time.");
    const hidden = document.querySelector<HTMLInputElement>("input[name=opens]");
    expect(hidden?.value).toBe("09:00");
    expect(hidden?.required).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Early open" }));
    expect(within(group).getByRole("spinbutton", { name: "Opens at Hours" }).getAttribute("aria-valuenow")).toBe("6");
    expect(hidden?.value).toBe("06:15");
    act(() => hidden?.focus());
    expect(document.activeElement).toBe(within(group).getByRole("spinbutton", { name: "Opens at Hours" }));
  });
});

describe("Fieldset", () => {
  it("names the group with its legend, describes it and disables controls inside", () => {
    render(
      <Fieldset legend="Notifications" description="Where alerts are sent." disabled>
        <Switch label="Low stock alerts" />
        <Checkbox label="Weekly report" />
      </Fieldset>,
    );
    const group = screen.getByRole("group", { name: "Notifications" });
    expect(document.getElementById(group.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Where alerts are sent.");
    expect(within(group).getByRole("switch", { name: "Low stock alerts" }).matches(":disabled")).toBe(true);
    expect(within(group).getByRole("checkbox", { name: "Weekly report" }).matches(":disabled")).toBe(true);
  });
});
