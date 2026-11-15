// packages/ai-ui/scripts/browser-general.mjs
import assert from "node:assert/strict";

import AxeBuilder from "@axe-core/playwright";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectClean(page, include, label, exclude = []) {
  let builder = new AxeBuilder({ page }).include(include).withTags(WCAG);
  for (const selector of exclude) builder = builder.exclude(selector);
  const report = await builder.analyze();
  const found = report.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target.join(" ")) }));
  assert.deepEqual(found, [], `${label}: accessibility violations`);
}

const focused = (page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");

async function checkPrimitives(page, pass) {
  const section = page.locator("#gallery-primitives");
  await section.scrollIntoViewIfNeeded();

  const actions = section.getByRole("button", { name: "Order 1042 actions" });
  await actions.focus();
  await page.keyboard.press("Enter");
  const exportItem = page.getByRole("menuitem", { name: "Export" });
  await exportItem.waitFor();
  for (let step = 0; step < 12 && !(await exportItem.evaluate((element) => element === document.activeElement)); step++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const csv = page.getByRole("menuitem", { name: "CSV" });
  await csv.waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("CSV"));
  await expectClean(page, '[role="menu"]', "open nested dropdown menu");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.activeElement?.textContent?.includes("Export"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Order 1042 actions" || document.activeElement?.textContent?.includes("Order 1042 actions"));
  pass("dropdown menu opens a submenu with Arrow Right, returns with Arrow Left and gives focus back on Escape");

  const addProduct = section.getByRole("button", { name: "Add product" });
  await addProduct.click();
  const dialog = page.getByRole("dialog", { name: "Add product" });
  await dialog.getByRole("region", { name: "Product details" }).waitFor();
  await expectClean(page, '[role="dialog"]', "product dialog");
  await dialog.getByRole("button", { name: "Save product" }).click();
  await dialog.waitFor({ state: "detached" });
  await section.getByText("Saved Claw hammer, 16 oz to the catalog.").waitFor();
  assert.ok(await addProduct.evaluate((element) => element === document.activeElement), "focus did not return to the dialog trigger");
  pass("dialog form submits, closes and returns focus to its trigger");

  await section.getByRole("button", { name: /Bin C7-09/ }).focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Count stock" }).click();
  await section.getByText("Started a count for bin C7-09.").waitFor();
  pass("context menu opens from the keyboard with Shift+F10");

  const menubar = section.getByRole("menubar", { name: "Price sheet editor" });
  await menubar.getByRole("menuitem", { name: "File" }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await focused(page), "Edit");
  await page.keyboard.press("Escape");
  await section.getByRole("button", { name: "Services" }).click();
  const keys = page.locator('[data-slot="navigation-menu-link"]').filter({ hasText: "Key cutting" });
  await keys.click();
  await section.getByText("Current page: /services/keys").waitFor();
  await section.getByRole("button", { name: "Services" }).click();
  assert.equal(await keys.getAttribute("aria-current"), "page");
  await page.keyboard.press("Escape");
  pass("menubar moves between menus with arrows and the navigation menu routes and marks the current page");
}

async function checkControls(page, pass) {
  const section = page.locator("#gallery-controls");
  await section.scrollIntoViewIfNeeded();

  const group = section.getByRole("group", { name: "Departments to sync" });
  const all = group.getByRole("checkbox", { name: "Select all" });
  assert.equal(await all.getAttribute("aria-checked"), "mixed");
  await all.click();
  assert.equal(await all.getAttribute("aria-checked"), "true");
  const children = group.getByRole("checkbox").filter({ hasNot: page.getByText("Select all") });
  for (const child of await group.getByRole("checkbox").all()) assert.equal(await child.getAttribute("aria-checked"), "true");
  await all.click();
  assert.equal(await all.getAttribute("aria-checked"), "false");
  assert.ok((await children.count()) >= 4);
  pass("select all checkbox goes mixed, checks every department and clears them");

  const radios = section.getByRole("radiogroup", { name: "Delivery method" });
  await radios.getByRole("radio", { name: /In-store pickup/ }).focus();
  await page.keyboard.press("ArrowDown");
  const delivery = radios.getByRole("radio", { name: /Local delivery/ });
  assert.equal(await delivery.getAttribute("aria-checked"), "true");
  assert.ok(await delivery.evaluate((element) => element === document.activeElement || element.contains(document.activeElement)));
  pass("radio cards move selection with the arrow keys");

  const supplier = section.getByRole("combobox", { name: "Primary supplier" });
  await supplier.fill("lum");
  const options = page.getByRole("listbox").getByRole("option");
  await options.first().waitFor();
  const matches = await options.allTextContents();
  assert.match(matches[0] ?? "", /^Lakeside Lumber/);
  assert.ok(matches.every((text) => /lum/i.test(text)), `unfiltered suppliers: ${matches.join(", ")}`);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await supplier.inputValue(), "Lakeside Lumber");
  pass("combobox filters suppliers as you type and picks one from the keyboard");

  const hours = section.getByRole("spinbutton", { name: "Closes at Hours" });
  await hours.focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await hours.getAttribute("aria-valuenow"), "7");
  await section.getByText("Saved as 19:00").waitFor();
  const table = section.getByRole("region", { name: "Inventory" });
  await table.getByRole("button", { name: "On hand" }).click();
  assert.equal(await table.getByRole("columnheader", { name: /On hand/ }).getAttribute("aria-sort"), "ascending");
  assert.match(await table.locator("tbody tr").first().textContent(), /Paint roller kit/);
  pass("time picker steps hours from the keyboard and the table sorts by a column");

  const pill = section.locator('[data-slot="tabs-trigger"][data-active]').first();
  const idle = section.locator('[data-slot="tabs-trigger"]:not([data-active])').first();
  const background = (locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.notEqual(await background(pill), await background(idle), "the active pill tab has no selected style");
  pass("the active pill tab is styled from Base UI's data-active attribute");
}

async function checkDisplay(page, pass) {
  const section = page.locator("#gallery-display");
  await section.scrollIntoViewIfNeeded();

  const carousel = section.getByRole("region", { name: "Cordless drill photos" });
  await carousel.getByRole("button", { name: "Next slide" }).click();
  await page.keyboard.press("ArrowRight");
  await carousel.locator("[aria-live]").filter({ hasText: "Slide 3 of 5: Battery" }).waitFor();
  assert.equal(await carousel.getByRole("button", { name: "Show slide 3: Battery" }).getAttribute("aria-current"), "true");
  const slides = carousel.locator('[data-slot="carousel-slide"]');
  const inert = await slides.evaluateAll((elements) => elements.map((element) => element.hasAttribute("inert")));
  assert.equal(inert.filter((value) => !value).length, 1, "only the current slide should be reachable");
  pass("carousel moves by button and arrow key, announces the slide and makes hidden slides inert");

  const list = section.getByRole("list", { name: "Pick list for order 4471" });
  await list.getByRole("button", { name: "Reorder Claw hammer 16 oz" }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await section.locator('[aria-live="assertive"]').filter({ hasText: "Moved Claw hammer 16 oz to position 3 of 6." }).waitFor();
  assert.match(await list.locator(":scope > li").nth(2).textContent(), /^3\. ?Claw hammer 16 oz/);
  pass("sortable list picks up, moves and drops an item from the keyboard and announces it");

  const skus = section.getByRole("listbox", { name: "SKU catalog, 10,000 items" });
  await skus.focus();
  await page.keyboard.press("End");
  const active = await skus.getAttribute("aria-activedescendant");
  assert.ok(active, "no active option after End");
  assert.equal(await page.locator(`[id="${active}"]`).getAttribute("aria-posinset"), "10000");
  assert.ok((await skus.getByRole("option").count()) < 40, "the virtual list rendered too many rows");
  await page.keyboard.press("Enter");
  await section.getByText("Selected MSH-169993").waitFor();
  pass("virtual list renders a window of a 10,000-row catalog and reaches the last row from the keyboard");

  const grid = section.getByRole("grid", { name: "Daily sales, last 26 weeks" });
  await grid.locator('[role="gridcell"][tabindex="0"]').focus();
  await page.keyboard.press("ArrowLeft");
  const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  assert.match(label, /^(\d+|No) sales? on .+, \d{4}$/);
  await page.getByText(label, { exact: true }).waitFor();
  pass("calendar heatmap moves by day from the keyboard with a label and tooltip for each cell");

  await section.getByRole("button", { name: "Start automatic slide show" }).first().waitFor();
  const marquee = section.locator('[data-slot="marquee"]').filter({ hasText: "" }).first();
  assert.ok(await marquee.evaluate((element) => element.hasAttribute("data-static")), "marquee kept moving under reduced motion");
  assert.equal(await section.getByRole("button", { name: "Pause Supplier logos" }).count(), 0);
  pass("carousel autoplay and the marquee stay still under reduced motion");

  await expectClean(page, "#gallery-display", "data display section with the heatmap tooltip open");
}

async function checkSite(page, pass) {
  const section = page.locator("#gallery-site");
  await section.scrollIntoViewIfNeeded();

  const nav = section.getByRole("navigation", { name: "Riverside Hardware" });
  const services = nav.getByRole("button", { name: "Services" });
  await services.click();
  assert.equal(await services.getAttribute("aria-expanded"), "true");
  assert.equal(await page.getByRole("link", { name: "Paint matching", exact: true }).getAttribute("aria-current"), "page");
  await page.keyboard.press("Escape");
  assert.equal(await services.getAttribute("aria-expanded"), "false");
  pass("site header dropdown opens, marks the current page and closes on Escape");

  const billing = section.getByRole("radiogroup", { name: "Billing period" });
  assert.match(await billing.getByRole("radio", { name: /Yearly/ }).textContent(), /Save 16%/);
  await billing.getByRole("radio", { name: /Monthly/ }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await billing.getByRole("radio", { name: /Yearly/ }).getAttribute("aria-checked"), "true");
  await section.getByText("$24.17").first().waitFor();
  await section.getByText("Billed $290 yearly, save $58").waitFor();
  await section.getByText("$65.83").first().waitFor();
  assert.match(await section.getByRole("link", { name: "Start Pro (Pro plan)" }).getAttribute("href"), /billing=yearly$/);
  pass("pricing switches to yearly billing from the keyboard and shows the savings");

  const contact = section.getByRole("form", { name: "Contact Riverside Hardware" });
  await contact.getByRole("button", { name: "Send message" }).click();
  const name = contact.getByRole("textbox", { name: "Name" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-invalid") === "true");
  assert.ok(await name.evaluate((element) => element === document.activeElement), "focus did not move to the first invalid field");
  await contact.getByText("Enter your name.").waitFor();
  await name.fill("Dana Ortiz");
  await contact.getByRole("textbox", { name: "Email" }).fill("dana@example.com");
  await contact.getByRole("combobox", { name: /Topic/ }).click();
  await page.getByRole("option", { name: "Tool rental", exact: true }).click();
  await contact.getByRole("textbox", { name: /Message/ }).fill("Do you rent a floor sander this weekend?");
  await contact.getByRole("button", { name: "Send message" }).click();
  await contact.getByText("Thanks, your message has been sent. We will get back to you soon.").waitFor();
  assert.equal(await name.inputValue(), "");
  const newsletter = section.getByRole("form", { name: "Weekly deals, no spam" });
  await newsletter.getByRole("textbox").fill("fail@example.com");
  await newsletter.getByRole("checkbox").click();
  await newsletter.getByRole("button", { name: "Subscribe" }).click();
  await newsletter.getByText("We could not sign you up just now. Try again in a moment.").waitFor();
  pass("contact form moves focus to the first error, submits and resets, and the newsletter reports a failure");

  await page.setViewportSize({ width: 375, height: 800 });
  await section.scrollIntoViewIfNeeded();
  const overflow = await section.evaluate((element) => element.scrollWidth - element.clientWidth);
  assert.ok(overflow <= 1, `site sections overflow a phone screen by ${overflow}px`);
  const open = section.getByRole("button", { name: "Open menu" });
  await open.click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await menu.waitFor();
  await expectClean(page, '[role="dialog"]', "mobile site menu");
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });
  assert.ok(await open.evaluate((element) => element === document.activeElement), "focus did not return to the menu button");
  await open.click();
  await menu.getByRole("link", { name: "Key cutting" }).click();
  await menu.waitFor({ state: "detached" });
  await section.getByText("Current page: /services/key-cutting").waitFor();
  await page.waitForFunction(() => document.getAnimations().every((animation) => !(animation instanceof CSSTransition)));
  await expectClean(page, "#gallery-primitives, #gallery-controls, #gallery-display, #gallery-site", "general sections on a phone");
  await page.setViewportSize({ width: 1280, height: 900 });
  pass("site sections fit a phone and the mobile menu traps focus, closes on navigation and returns focus");
}

/** Interaction checks for the general-purpose primitives, controls, display components and site sections in the gallery. */
export async function checkGeneral(page, pass) {
  await checkPrimitives(page, pass);
  await checkControls(page, pass);
  await checkDisplay(page, pass);
  await checkSite(page, pass);
}
