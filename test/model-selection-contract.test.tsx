// packages/ai-ui/test/model-selection-contract.test.tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelSelector } from "../src/components/model-selector.js";

const models = [
  { id: "provider-a/selected", name: "Selected model", provider: "Provider A" },
  { id: "provider-b/alternative", name: "Alternative model", provider: "Provider B" },
];

function choose(option: HTMLElement) {
  fireEvent.pointerDown(option, { pointerType: "mouse", button: 0 });
  fireEvent.pointerUp(option, { pointerType: "mouse", button: 0 });
  fireEvent.click(option, { detail: 1 });
}

describe("ModelSelector explicit selection contract", () => {
  it("does not substitute another provider when a controlled selection leaves the catalog", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ModelSelector models={models} value="provider-a/selected" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Model" }).textContent).toContain("Selected model");
    rerender(
      <ModelSelector models={[models[1]!]} value="provider-a/selected" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Model" }).textContent).not.toContain("Alternative model");
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(
      <ModelSelector
        models={[{ ...models[0]!, name: "Selected model restored" }, models[1]!]}
        value="provider-a/selected"
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Model" }).textContent).toContain("Selected model restored");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("retains an uncontrolled user selection through a catalog refresh", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <ModelSelector models={models} defaultValue="provider-a/selected" onValueChange={onValueChange} />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Model" }));
    choose(within(await screen.findByRole("listbox")).getByRole("option", { name: "Alternative model" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("provider-b/alternative");
    rerender(
      <ModelSelector models={[models[0]!]} defaultValue="provider-a/selected" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Model" }).textContent).not.toContain("Selected model");
    expect(onValueChange).toHaveBeenCalledTimes(1);
    rerender(
      <ModelSelector models={models} defaultValue="provider-a/selected" onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Model" }).textContent).toContain("Alternative model");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("keeps a disabled current selection until the user chooses an enabled replacement", async () => {
    const onValueChange = vi.fn();
    render(
      <ModelSelector
        models={[{ ...models[0]!, disabled: true }, models[1]!]}
        value="provider-a/selected"
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Model" }).textContent).toContain("Selected model");
    fireEvent.click(screen.getByRole("combobox", { name: "Model" }));
    const list = within(await screen.findByRole("listbox"));
    const disabled = list.getByRole("option", { name: "Selected model" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    choose(disabled);
    expect(onValueChange).not.toHaveBeenCalled();
    choose(list.getByRole("option", { name: "Alternative model" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("provider-b/alternative");
  });
});
