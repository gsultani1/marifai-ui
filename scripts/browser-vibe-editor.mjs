// scripts/browser-vibe-editor.mjs
import assert from "node:assert/strict";

/** Verify the shared document through pointer, keyboard, prompts, recovery and host extensions. */
export async function checkVibeEditor(page, pass) {
  const editor = page.getByRole("region", { name: "Vibe coding editor", exact: true });
  await editor.scrollIntoViewIfNeeded();
  await editor.getByRole("button", { name: "Reset demo", exact: true }).click();
  const resetDialog = page.getByRole("alertdialog", { name: "Reset this demo?" });
  await resetDialog.getByRole("button", { name: "Reset demo", exact: true }).click();
  const builder = editor.locator('[data-slot="page-builder"]');
  const canvas = builder.getByRole("region", { name: "Page builder canvas", exact: true });
  const inspector = editor.getByRole("complementary", { name: "Block properties", exact: true });
  const intro = canvas.getByRole("group", { name: "Heading: Architecture shaped by place.", exact: true });
  await intro.waitFor();
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 1920, height: 1080 });
  const resizeAssistant = editor.getByRole("separator", { name: "Resize assistant", exact: true });
  await resizeAssistant.waitFor({ state: "visible" });
  const beforeResize = Number(await resizeAssistant.getAttribute("aria-valuenow"));
  await resizeAssistant.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(Number(await resizeAssistant.getAttribute("aria-valuenow")), beforeResize + 1);
  const propertiesToggle = editor.getByRole("button", { name: "Properties", exact: true });
  await propertiesToggle.click();
  assert.equal(await propertiesToggle.getAttribute("aria-pressed"), "false");
  await propertiesToggle.click();
  await inspector.waitFor();
  if (originalViewport) await page.setViewportSize(originalViewport);
  pass("vibe editor resizes its assistant from the keyboard and collapses or restores the properties panel");

  const firstOrder = await canvas.locator('[data-container-id="root"] > [data-block-id]').evaluateAll(
    blocks => blocks.map(block => block.getAttribute("data-block-id")));
  await builder.getByRole("button", { name: "Add Section", exact: true }).dragTo(intro, { targetPosition: { x: 40, y: 4 } });
  const section = canvas.getByRole("group", { name: /^Section, / });
  await section.waitFor();
  const sectionId = await section.getAttribute("data-block-id");
  const insertedOrder = await canvas.locator('[data-container-id="root"] > [data-block-id]').evaluateAll(
    blocks => blocks.map(block => block.getAttribute("data-block-id")));
  assert.equal(insertedOrder[1], sectionId);
  assert.deepEqual(insertedOrder.filter(id => id !== sectionId), firstOrder);
  await section.click({ position: { x: 12, y: 12 } });
  await builder.getByRole("button", { name: "Add Heading", exact: true }).click();
  const properties = inspector.getByRole("complementary", { name: "Block settings", exact: true });
  await properties.getByRole("textbox", { name: "Text", exact: true }).fill("Project heading");
  await section.getByRole("heading", { name: "Project heading", exact: true }).waitFor();
  pass("vibe editor drops a section between blocks, nests a heading, and edits its selected properties");

  const draft = editor.getByRole("textbox", { name: "Describe a change", exact: true });
  const prompt = "Rename the heading to Prompted project.";
  await draft.fill(prompt);
  await editor.getByRole("tab", { name: "Preview", exact: true }).click();
  await editor.getByRole("tab", { name: "Design", exact: true }).click();
  assert.equal(await draft.inputValue(), prompt);
  await editor.getByRole("combobox", { name: "Request behavior", exact: true }).selectOption("fail");
  const send = editor.getByRole("button", { name: "Send request", exact: true });
  await send.click();
  assert.equal(await send.getAttribute("aria-disabled") === "true" || await send.isDisabled(), true);
  await editor.getByRole("alert").filter({ hasText: "Demo request failed" }).waitFor();
  assert.equal(await draft.inputValue(), prompt);
  await send.click();
  await editor.getByRole("button", { name: "Stop generation", exact: true }).click();
  await editor.getByRole("alert").filter({ hasText: "Request stopped" }).waitFor();
  assert.equal(await draft.inputValue(), prompt);
  await send.click();
  await editor.getByText("Preview the change on the canvas, then apply or discard it.", { exact: true }).waitFor();
  assert.equal(await editor.getByRole("log", { name: "Builder chat" }).getByText(prompt, { exact: true }).count(), 1);
  pass("vibe editor preserves a failed or stopped prompt across view changes and retries exactly one request");

  const inlineReview = editor.locator('[data-slot="vibe-builder-inline-review"]');
  await inlineReview.getByRole("button", { name: "Preview changes", exact: true }).click();
  await page.frameLocator('iframe[title="Proposed canvas preview"]').getByRole("heading", { name: "Prompted project.", exact: true }).waitFor();
  await inlineReview.getByRole("button", { name: "Apply changes", exact: true }).click();
  await section.getByRole("heading", { name: "Prompted project.", exact: true }).waitFor();
  await section.focus();
  await page.keyboard.press("Alt+ArrowDown");
  const reordered = await canvas.locator('[data-container-id="root"] > [data-block-id]').evaluateAll(
    blocks => blocks.map(block => block.getAttribute("data-block-id")));
  assert.equal(reordered[2], sectionId);
  const undo = editor.getByRole("button", { name: "Undo", exact: true }).first();
  const redo = editor.getByRole("button", { name: "Redo", exact: true }).first();
  await undo.click();
  const restored = await canvas.locator('[data-container-id="root"] > [data-block-id]').evaluateAll(
    blocks => blocks.map(block => block.getAttribute("data-block-id")));
  assert.deepEqual(restored, insertedOrder);
  await undo.click();
  await section.getByRole("heading", { name: "Project heading", exact: true }).waitFor();
  await redo.click();
  await section.getByRole("heading", { name: "Prompted project.", exact: true }).waitFor();
  pass("vibe editor previews and applies a prompt, then undoes and redoes prompted and manual edits together");

  await section.getByRole("group", { name: "Heading: Prompted project.", exact: true }).click();
  await draft.fill("Keep this unsent draft");
  await editor.getByRole("combobox", { name: "Save behavior", exact: true }).selectOption("fail");
  await editor.getByRole("button", { name: "Save session", exact: true }).click();
  await editor.getByRole("alert").filter({ hasText: "Demo save failed" }).waitFor();
  assert.equal(await draft.inputValue(), "Keep this unsent draft");
  await editor.getByRole("button", { name: "Retry save", exact: true }).click();
  await editor.getByRole("status").filter({ hasText: "Saved in this browser" }).waitFor();
  await page.reload();
  await editor.waitFor();
  assert.equal(await draft.inputValue(), "Keep this unsent draft");
  await canvas.getByRole("heading", { name: "Prompted project.", exact: true }).waitFor();
  assert.equal(await editor.getByRole("log", { name: "Builder chat" }).getByText(prompt, { exact: true }).count(), 1);
  assert.equal(await properties.getByRole("textbox", { name: "Text", exact: true }).inputValue(), "Prompted project.");
  await redo.waitFor();
  assert.equal(await undo.isDisabled(), false);
  pass("vibe editor retries failed saving and restores the document, selection, draft, conversation and undo history after reload");

  await builder.getByRole("button", { name: "Add Notice card", exact: true }).click();
  await properties.getByRole("textbox", { name: "Notice title", exact: true }).fill("Custom component");
  await canvas.getByRole("heading", { name: "Custom component", exact: true }).waitFor();
  await builder.getByRole("radio", { name: "Mobile", exact: true }).click();
  const padding = properties.getByRole("spinbutton", { name: /^Block padding/ });
  await padding.fill("28");
  await properties.getByText("Mobile styles", { exact: true }).waitFor();
  await properties.getByRole("button", { name: "Reset block padding", exact: true }).click();
  assert.equal(await padding.inputValue(), "");
  await builder.getByRole("radio", { name: "Desktop", exact: true }).click();
  await editor.getByRole("button", { name: "Reset demo", exact: true }).click();
  await resetDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await canvas.getByRole("heading", { name: "Custom component", exact: true }).waitFor();
  pass("vibe editor renders and edits a registered React block, resets a mobile override, and keeps work when reset is canceled");

  const starter = editor.getByRole("combobox", { name: "Starter page", exact: true });
  await starter.selectOption("product");
  const starterDialog = page.getByRole("alertdialog", { name: "Load another starter?" });
  await starterDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await canvas.getByRole("heading", { name: "Custom component", exact: true }).waitFor();
  await starter.selectOption("product");
  await starterDialog.getByRole("button", { name: "Load starter", exact: true }).click();
  await canvas.getByRole("heading", { name: "Tools for better weekends.", exact: true }).waitFor();
  await starter.selectOption("blank");
  await starterDialog.getByRole("button", { name: "Load starter", exact: true }).click();
  assert.equal(await canvas.locator("[data-block-id]").count(), 0);
  assert.equal(await draft.inputValue(), "");
  await starter.selectOption("architecture");
  await starterDialog.getByRole("button", { name: "Load starter", exact: true }).click();
  await canvas.getByRole("heading", { name: "Architecture shaped by place.", exact: true }).waitFor();
  pass("vibe editor confirms starter changes, preserves a canceled change, and resets all three starter pages");

  await page.setViewportSize({ width: 390, height: 844 });
  await editor.scrollIntoViewIfNeeded();
  const bounds = await editor.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  assert.ok(bounds.width <= 390 && bounds.scroll <= bounds.client + 1, "vibe editor overflows a phone viewport");
  await draft.fill("A draft on a narrow screen");
  await editor.getByRole("tab", { name: "Preview", exact: true }).click();
  await editor.getByRole("tab", { name: "Design", exact: true }).click();
  assert.equal(await draft.inputValue(), "A draft on a narrow screen");
  await draft.fill("");
  if (originalViewport) await page.setViewportSize(originalViewport);
  pass("vibe editor fits a phone width and preserves its prompt through view changes");
}
