// packages/ai-ui/test/site.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BlogCard, BlogGrid, formatPostDate } from "../src/components/blog-card.js";
import type { LinkRenderProps } from "../src/components/breadcrumbs.js";
import { characterCount, ContactForm, type ContactValues, isValidEmail, validateContact } from "../src/components/contact-form.js";
import { CtaSection } from "../src/components/cta-section.js";
import { Faq, type FaqItem, faqJsonLd, filterFaqItems } from "../src/components/faq.js";
import { FeatureGrid } from "../src/components/feature-grid.js";
import { Hero } from "../src/components/hero.js";
import { LogoCloud } from "../src/components/logo-cloud.js";
import { NewsletterSignup } from "../src/components/newsletter-signup.js";
import { type BillingPeriod, PlanComparison, type PricingPlan, PricingTable, yearlySavings } from "../src/components/pricing-table.js";
import { SiteFooter } from "../src/components/site-footer.js";
import { SiteHeader, type SiteNavEntry } from "../src/components/site-header.js";
import { childHeadingLevel, SiteActionButton, SiteSection } from "../src/components/site-section.js";
import { formatStatValue, StatsBand } from "../src/components/stats-band.js";
import { TeamGrid } from "../src/components/team-grid.js";
import { Testimonials } from "../src/components/testimonials.js";

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

/** A router-style renderLink that marks its output so tests can tell it was used. */
const routerLink = ({ children, ...props }: LinkRenderProps) => (
  <a data-router="" {...props}>
    {children}
  </a>
);

/** A client-side router link: it handles the click itself instead of letting the browser navigate. */
const spaLink = ({ children, onClick, ...props }: LinkRenderProps) => (
  <a
    {...props}
    onClick={(event) => {
      event.preventDefault();
      onClick?.();
    }}
  >
    {children}
  </a>
);

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("site helpers", () => {
  it("computes yearly savings rounded down and never negative", () => {
    expect(yearlySavings(10, 96)).toEqual({ amount: 24, percent: 20 });
    expect(yearlySavings(29, 290)).toEqual({ amount: 58, percent: 16 });
    expect(yearlySavings(19.99, 199)).toEqual({ amount: 40.88, percent: 17 });
    expect(yearlySavings(10, 120)).toEqual({ amount: 0, percent: 0 });
    expect(yearlySavings(10, 150)).toEqual({ amount: 0, percent: 0 });
    expect(yearlySavings(10, 0)).toEqual({ amount: 120, percent: 100 });
    expect(yearlySavings(0, 0)).toEqual({ amount: 0, percent: 0 });
    expect(yearlySavings(-5, 10)).toEqual({ amount: 0, percent: 0 });
    expect(yearlySavings(10, -1)).toEqual({ amount: 0, percent: 0 });
    expect(yearlySavings(Number.NaN, 10)).toEqual({ amount: 0, percent: 0 });
    expect(yearlySavings(10, Number.POSITIVE_INFINITY)).toEqual({ amount: 0, percent: 0 });
  });

  it("validates contact values field by field", () => {
    const valid: ContactValues = { name: "Dana Ortiz", email: "dana@example.com", phone: "", topic: "", message: "Do you rent tile saws by the day?" };
    expect(validateContact(valid)).toEqual({});
    expect(validateContact({ name: " ", email: "", phone: "", topic: "", message: "" })).toEqual({
      name: "Enter your name.",
      email: "Enter your email address.",
      message: "Enter a message.",
    });
    expect(validateContact({ ...valid, email: "dana@example" }).email).toBe("Enter an email address like name@example.com.");
    expect(validateContact({ ...valid, name: "x".repeat(101) }).name).toBe("Keep your name to 100 characters or fewer.");
    expect(validateContact(valid, { requirePhone: true }).phone).toBe("Enter your phone number.");
    expect(validateContact({ ...valid, phone: "(555) 010-4477" })).toEqual({});
    expect(validateContact({ ...valid, phone: "+1 555 010 4477" })).toEqual({});
    expect(validateContact({ ...valid, phone: "555-01" }).phone).toBe("Enter a phone number with 7 to 15 digits.");
    expect(validateContact({ ...valid, phone: "call me 5550104477" }).phone).toBe("Enter a phone number with 7 to 15 digits.");
    expect(validateContact({ ...valid, phone: "1".repeat(16) }).phone).toBe("Enter a phone number with 7 to 15 digits.");
    expect(validateContact(valid, { topics: ["rental", "paint"] }).topic).toBe("Choose a topic.");
    expect(validateContact({ ...valid, topic: "other" }, { topics: ["rental"] }).topic).toBe("Choose a topic.");
    expect(validateContact({ ...valid, topic: "rental" }, { topics: ["rental"] })).toEqual({});
    expect(validateContact({ ...valid, message: "  Hi there  " }).message).toBe("Add a little more detail: at least 10 characters.");
    expect(validateContact({ ...valid, message: "a".repeat(1001) }).message).toBe("Shorten your message to 1,000 characters or fewer.");
    expect(validateContact({ ...valid, message: "a".repeat(20) }, { messageMaxLength: 20 })).toEqual({});
    expect(validateContact({ ...valid, message: "abc" }, { messageMinLength: 3 })).toEqual({});
  });

  it("checks email shape and counts characters as people do", () => {
    expect(isValidEmail("owner@riverside-hardware.example.com")).toBe(true);
    expect(isValidEmail("  dana@example.com ")).toBe(true);
    for (const bad of ["", "dana", "dana@", "@example.com", "dana@example", "dana@@example.com", "dana @example.com", "dana@example..com", "dana@.example.com", `${"a".repeat(250)}@example.com`]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
    expect(characterCount("Paint 🎨")).toBe(7);
  });

  it("escapes FAQ structured data so it cannot leave its script tag", () => {
    const items: FaqItem[] = [
      { id: "a", question: "Do you cut keys?", answer: "Yes, </script><script>alert(1)</script> & more" },
      { id: "b", question: "Hours?", answer: <strong>Rich</strong>, answerText: "7 to 7 daily" },
      { id: "c", question: "Rich only", answer: <em>No plain text</em> },
    ];
    const json = faqJsonLd(items);
    expect(json).not.toMatch(/[<>&]/);
    const data = JSON.parse(json) as { "@type": string; mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.map((entry) => entry.name)).toEqual(["Do you cut keys?", "Hours?"]);
    expect(data.mainEntity[0]!.acceptedAnswer.text).toBe("Yes, </script><script>alert(1)</script> & more");
    expect(data.mainEntity[1]!.acceptedAnswer.text).toBe("7 to 7 daily");
  });

  it("filters FAQ items by every word, ignoring case and accents", () => {
    const items: FaqItem[] = [
      { id: "1", question: "Can you match a paint color?", answer: "Bring a chip and we match it in minutes." },
      { id: "2", question: "Do you offer delivery?", answer: <span>Rich</span>, answerText: "Same-day local delivery over $50." },
      { id: "3", question: "Crème finish options?", answer: "Matte and satin." },
    ];
    expect(filterFaqItems(items, "")).toBe(items);
    expect(filterFaqItems(items, "PAINT chip").map((item) => item.id)).toEqual(["1"]);
    expect(filterFaqItems(items, "same-day").map((item) => item.id)).toEqual(["2"]);
    expect(filterFaqItems(items, "creme").map((item) => item.id)).toEqual(["3"]);
    expect(filterFaqItems(items, "paint delivery")).toEqual([]);
  });

  it("formats post dates, stats and heading levels", () => {
    expect(formatPostDate("2026-03-05", "en-US")).toEqual({ dateTime: "2026-03-05", text: "Mar 5, 2026" });
    expect(formatPostDate(new Date("2026-03-05T15:00:00Z"), "en-US")?.dateTime).toBe("2026-03-05T15:00:00.000Z");
    expect(formatPostDate("not a date")).toBeNull();
    expect(formatStatValue({ value: 12000, suffix: "+" }, "en-US")).toBe("12,000+");
    expect(formatStatValue({ value: 0.98, format: { style: "percent" } }, "en-US")).toBe("98%");
    expect(formatStatValue({ value: 1500000, format: { notation: "compact" } }, "en-US")).toBe("1.5M");
    expect(formatStatValue({ value: "24/7" })).toBe("24/7");
    expect(formatStatValue({ value: Number.NaN, suffix: "+" })).toBe("");
    expect(formatStatValue({ value: 1234.5 }, "de-DE")).toBe("1.234,5");
    expect(childHeadingLevel(2)).toBe(3);
    expect(childHeadingLevel(6)).toBe(6);
  });
});

describe("SiteSection and SiteActionButton", () => {
  it("names the section by its title and renders actions as links or buttons", () => {
    const onClick = vi.fn();
    render(
      <SiteSection title="Services" eyebrow="What we do" description="Everything for the job." headingLevel={3}>
        <SiteActionButton action={{ label: "Visit", href: "/visit" }} renderLink={routerLink} />
        <SiteActionButton action={{ label: "Call", onClick, "aria-label": "Call the store" }} variant="outline" />
      </SiteSection>,
    );
    const section = screen.getByRole("region", { name: "Services" });
    expect(within(section).getByRole("heading", { level: 3, name: "Services" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Visit" }).hasAttribute("data-router")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Call the store" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

const NAV: SiteNavEntry[] = [
  { label: "Home", href: "/" },
  {
    label: "Services",
    items: [
      { label: "Key cutting", href: "/services/keys", description: "Copies while you wait" },
      { label: "Paint matching", href: "/services/paint" },
    ],
  },
  { label: "Tool rental", href: "/rental" },
];

describe("SiteHeader", () => {
  it("marks the most specific current link and opens dropdown groups", () => {
    render(<SiteHeader brand="Riverside Hardware" brandHref="/" nav={NAV} currentPath="/services/paint/colors" skipLinkHref="#main" renderLink={routerLink} />);
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
    const trigger = within(nav).getByRole("button", { name: "Services" });
    expect(trigger.getAttribute("data-current")).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const paint = screen.getByRole("link", { name: "Paint matching" });
    expect(paint.getAttribute("aria-current")).toBe("page");
    expect(paint.hasAttribute("data-router")).toBe(true);
    expect(screen.getByRole("link", { name: /Key cutting/ }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Copies while you wait")).toBeTruthy();
  });

  it("honors an explicit current link and the brand label", () => {
    render(<SiteHeader brand={<svg aria-hidden="true" />} brandHref="/" brandLabel="Riverside Hardware home" nav={[{ label: "Deals", href: "/deals", current: true }, { label: "Home", href: "/" }]} currentPath="/" />);
    expect(screen.getByRole("link", { name: "Riverside Hardware home" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Deals" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });

  it("opens the menu panel as a dialog that closes on Escape and returns focus", async () => {
    render(<SiteHeader brand="Riverside Hardware" nav={NAV} currentPath="/rental" menuFooter={<a href="tel:+15550104477">Call the store</a>} />);
    const menuButton = screen.getByRole("button", { name: "Open menu" });
    menuButton.focus();
    fireEvent.click(menuButton);
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    const panelNav = within(dialog).getByRole("navigation", { name: "Main" });
    expect(within(panelNav).getByRole("link", { name: "Tool rental" }).getAttribute("aria-current")).toBe("page");
    expect(within(dialog).getByRole("list", { name: "Services" })).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "Call the store" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(menuButton));
  });

  it("closes the menu when a link is followed and supports controlled state", async () => {
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <SiteHeader brand="Riverside Hardware" nav={NAV} menuOpen={open} onMenuOpenChange={setOpen} renderLink={spaLink} />
          <output data-testid="state">{open ? "open" : "closed"}</output>
        </>
      );
    }
    render(<Controlled />);
    const dialog = await screen.findByRole("dialog", { name: "Menu" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Key cutting" }));
    expect(screen.getByTestId("state").textContent).toBe("closed");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByTestId("state").textContent).toBe("open");
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Close menu" }));
    expect(screen.getByTestId("state").textContent).toBe("closed");
  });

  it("shows a border once the page scrolls when sticky", () => {
    const { rerender } = render(<SiteHeader brand="Riverside Hardware" nav={NAV} sticky />);
    const header = screen.getByRole("banner");
    expect(header.hasAttribute("data-scrolled")).toBe(false);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(header.hasAttribute("data-scrolled")).toBe(true);
    rerender(<SiteHeader brand="Riverside Hardware" nav={NAV} />);
    expect(header.hasAttribute("data-scrolled")).toBe(false);
  });

  it("leaves out navigation and the menu button without links", () => {
    render(<SiteHeader brand="Riverside Hardware" actions={<button type="button">Cart</button>} />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cart" })).toBeTruthy();
  });
});

describe("Hero", () => {
  it("renders the page heading, actions through renderLink and the media slot", () => {
    const onClick = vi.fn();
    render(
      <Hero
        eyebrow="Family owned since 1979"
        title="Everything for the job, close to home"
        description="Tools, paint and hardware with advice from people who use them."
        primaryAction={{ label: "Shop the aisles", href: "/shop" }}
        secondaryAction={{ label: "Get directions", onClick }}
        media={<img src="/store.jpg" alt="The store front on Main Street" />}
        layout="split"
        background="grid"
        renderLink={routerLink}
      >
        <p>Open 7 days</p>
      </Hero>,
    );
    const region = screen.getByRole("region", { name: "Everything for the job, close to home" });
    expect(region.getAttribute("data-layout")).toBe("split");
    expect(within(region).getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shop the aisles" }).hasAttribute("data-router")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Get directions" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "The store front on Main Street" })).toBeTruthy();
    expect(region.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText("Open 7 days")).toBeTruthy();
  });

  it("takes a heading level and draws no backdrop by default", () => {
    render(<Hero title="Spring sale" headingLevel={2} />);
    const region = screen.getByRole("region", { name: "Spring sale" });
    expect(within(region).getByRole("heading", { level: 2, name: "Spring sale" })).toBeTruthy();
    expect(region.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(within(region).queryByRole("link")).toBeNull();
  });
});

describe("FeatureGrid", () => {
  it("lists features with nested headings and descriptive links", () => {
    render(
      <FeatureGrid
        title="Services"
        columns={4}
        items={[
          { id: "keys", title: "Key cutting", description: "Copies in minutes.", href: "/keys" },
          { id: "paint", title: "Paint matching", description: "Bring a chip.", href: "/paint", linkLabel: "See colors" },
          { id: "rent", title: "Tool rental" },
        ]}
      />,
    );
    const section = screen.getByRole("region", { name: "Services" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Key cutting", "Paint matching", "Tool rental"]);
    expect(screen.getByRole("link", { name: "Learn more (Key cutting)" }).getAttribute("href")).toBe("/keys");
    expect(screen.getByRole("link", { name: "See colors (Paint matching)" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("renders no list for empty items", () => {
    render(<FeatureGrid title="Services" items={[]} variant="plain" />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});

const PLANS: PricingPlan[] = [
  { id: "diy", name: "DIY", monthlyPrice: 0, priceLabel: "Free", features: ["Weekly deals email", { label: "Free delivery", included: false }], cta: { label: "Join free", href: "/join" } },
  { id: "pro", name: "Pro", monthlyPrice: 29, yearlyPrice: 290, featured: true, features: ["10% off tools", "Free delivery"], cta: (period) => ({ label: "Start Pro", href: `/join/pro?billing=${period}` }) },
  { id: "crew", name: "Crew", monthlyPrice: 79, yearlyPrice: 711, features: ["15% off everything"], cta: { label: "Start Crew", href: "/join/crew" } },
  { id: "fleet", name: "Fleet", monthlyPrice: null, features: ["Net 30 terms"], cta: { label: "Talk to us", href: "/contact" } },
];

describe("PricingTable", () => {
  it("formats prices, switches billing period and shows the yearly saving", () => {
    const onPeriodChange = vi.fn();
    render(<PricingTable title="Contractor membership" plans={PLANS} onPeriodChange={onPeriodChange} />);
    const group = screen.getByRole("radiogroup", { name: "Billing period" });
    const monthly = within(group).getByRole("radio", { name: "Monthly" });
    const yearly = within(group).getByRole("radio", { name: /Yearly/ });
    expect(monthly.getAttribute("aria-checked")).toBe("true");
    expect(yearly.textContent).toContain("Save up to 25%");
    const pro = screen.getByRole("heading", { name: "Pro" }).closest("li")!;
    expect(within(pro).getByText("$29")).toBeTruthy();
    expect(within(pro).getByText("Billed monthly")).toBeTruthy();
    expect(within(pro).getByText("Most popular")).toBeTruthy();
    expect(within(pro).getByRole("link", { name: "Start Pro (Pro plan)" }).getAttribute("href")).toBe("/join/pro?billing=monthly");
    const diy = screen.getByRole("heading", { name: "DIY" }).closest("li")!;
    expect(within(diy).getByText("Free")).toBeTruthy();
    expect(within(diy).getByText("Not included:")).toBeTruthy();
    const fleet = screen.getByRole("heading", { name: "Fleet" }).closest("li")!;
    expect(within(fleet).getByText("Custom")).toBeTruthy();

    fireEvent.click(yearly);
    expect(onPeriodChange).toHaveBeenCalledWith("yearly");
    expect(yearly.getAttribute("aria-checked")).toBe("true");
    expect(within(pro).getByText("$24.17")).toBeTruthy();
    expect(within(pro).getByText("Billed $290 yearly, save $58")).toBeTruthy();
    expect(within(pro).getByRole("link", { name: "Start Pro (Pro plan)" }).getAttribute("href")).toBe("/join/pro?billing=yearly");
    const crew = screen.getByRole("heading", { name: "Crew" }).closest("li")!;
    expect(within(crew).getByText("$59.25")).toBeTruthy();
    expect(within(crew).getByText("Billed $711 yearly, save $237")).toBeTruthy();
  });

  it("supports controlled periods, yearly totals and other currencies", () => {
    function Controlled() {
      const [period, setPeriod] = useState<BillingPeriod>("yearly");
      return <PricingTable title="Plans" plans={PLANS.slice(1, 3)} period={period} onPeriodChange={setPeriod} yearlyDisplay="per-year" currency="EUR" locale="de-DE" />;
    }
    render(<Controlled />);
    const pro = screen.getByRole("heading", { name: "Pro" }).closest("li")!;
    expect(within(pro).getByText("290 €")).toBeTruthy();
    expect(within(pro).getByText("per year")).toBeTruthy();
    expect(within(pro).getByText("Save 58 € versus monthly")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(within(pro).getByText("29 €")).toBeTruthy();
    expect(within(pro).getByText("per month")).toBeTruthy();
  });

  it("hides the toggle when no plan has a yearly price", () => {
    render(<PricingTable title="Plans" plans={[PLANS[0]!, PLANS[3]!]} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });
});

describe("PlanComparison", () => {
  it("renders a captioned matrix with spoken yes and no cells", () => {
    render(
      <PlanComparison
        caption="Compare memberships"
        plans={PLANS.slice(0, 3)}
        highlightPlanId="pro"
        rows={[
          { label: "Weekly deals", group: "Savings", values: { diy: true, pro: true, crew: true } },
          { label: "Tool discount", group: "Savings", values: { diy: false, pro: "10%", crew: "15%" } },
          { label: "Free delivery", group: "Service", description: "Within 15 miles", values: { pro: true, crew: true } },
        ]}
      />,
    );
    const region = screen.getByRole("region", { name: "Compare memberships" });
    expect(region.getAttribute("tabindex")).toBe("0");
    const table = within(region).getByRole("table", { name: "Compare memberships" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Feature", "DIY", "Pro", "Crew"]);
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Savings", "Weekly deals", "Tool discount", "Service", "Free deliveryWithin 15 miles"]);
    const delivery = within(table).getByRole("row", { name: /Free delivery/ });
    const cells = within(delivery).getAllByRole("cell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Not included", "Included", "Included"]);
    expect(cells[1]!.className).toContain("bg-accent");
    expect(within(within(table).getByRole("row", { name: /Tool discount/ })).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Not included", "10%", "15%"]);
  });
});

describe("Testimonials", () => {
  const items = [
    { id: "1", quote: "They matched our trim color from a single chip.", name: "Marcus Bell", role: "Owner", company: "Bell Painting", rating: 5 },
    { id: "2", quote: "Rental counter had the tile saw ready at 6 am.", name: "Priya Shah", role: "Contractor" },
    { id: "3", quote: "Best key copies in town.", name: "Lena", avatarUrl: "https://example.com/lena.jpg" },
  ];

  it("marks up quotes as figures with captions, initials and ratings", () => {
    render(<Testimonials title="What customers say" items={items} />);
    const figures = screen.getAllByRole("figure");
    expect(figures).toHaveLength(3);
    const first = figures[0]!;
    expect(first.querySelector("blockquote")?.textContent).toBe("They matched our trim color from a single chip.");
    expect(first.querySelector("figcaption")?.textContent).toBe("MBMarcus BellOwner, Bell Painting");
    expect(within(first).getByRole("img", { name: "Rating: 5 out of 5" })).toBeTruthy();
    expect(within(figures[1]!).queryByRole("img")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("features the first quote outside the grid", () => {
    render(<Testimonials title="What customers say" items={items} layout="featured" />);
    expect(screen.getAllByRole("figure")).toHaveLength(3);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("figure")[0]!.closest("li")).toBeNull();
  });
});

const FAQ_ITEMS: FaqItem[] = [
  { id: "keys", question: "How long does key cutting take?", answer: "Most keys are cut in under five minutes." },
  { id: "paint", question: "Can you match a paint color?", answer: "Yes. Bring a chip, swatch or photo." },
  { id: "delivery", question: "Do you deliver?", answer: <p>Local delivery within 15 miles.</p>, answerText: "Local delivery within 15 miles." },
];

describe("Faq", () => {
  it("opens one answer at a time by default", () => {
    render(<Faq title="Questions" items={FAQ_ITEMS} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
    const keys = screen.getByRole("button", { name: "How long does key cutting take?" });
    const paint = screen.getByRole("button", { name: "Can you match a paint color?" });
    expect(keys.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(keys);
    expect(keys.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(paint);
    expect(paint.getAttribute("aria-expanded")).toBe("true");
    expect(keys.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps several open in multiple mode and reports controlled changes", () => {
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState<string[]>(["keys"]);
      return (
        <Faq
          title="Questions"
          items={FAQ_ITEMS}
          multiple
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Controlled />);
    expect(screen.getByRole("button", { name: "How long does key cutting take?" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Do you deliver?" }));
    expect(onValueChange).toHaveBeenLastCalledWith(["keys", "delivery"]);
    expect(screen.getByRole("button", { name: "How long does key cutting take?" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Do you deliver?" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("filters with search, announces the count and shows a no-results message", () => {
    render(<Faq title="Questions" items={FAQ_ITEMS} searchable />);
    const search = screen.getByRole("searchbox", { name: "Search questions" });
    fireEvent.change(search, { target: { value: "delivery" } });
    expect(screen.getAllByRole("button", { expanded: false }).map((button) => button.textContent)).toEqual(["Do you deliver?"]);
    expect(screen.getByText("1 result")).toBeTruthy();
    fireEvent.change(search, { target: { value: "lumber" } });
    expect(screen.getByText('No questions match "lumber".')).toBeTruthy();
    expect(screen.getByText("0 results")).toBeTruthy();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(3);
  });

  it("emits escaped FAQPage JSON-LD when asked", () => {
    const { container, rerender } = render(<Faq title="Questions" items={[{ id: "x", question: "Tags?", answer: "Use </script> carefully" }]} structuredData />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain("\\u003c/script\\u003e");
    expect(script?.textContent).not.toContain("</script>");
    rerender(<Faq title="Questions" items={FAQ_ITEMS} />);
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("LogoCloud", () => {
  it("requires accessible names for image and node logos", () => {
    render(
      <LogoCloud
        title="Brands we carry"
        muted
        items={[
          { name: "Northwind Tools", src: "https://example.com/northwind.svg", width: 120, height: 40 },
          { name: "Contoso Paint", logo: <svg aria-hidden="true" />, href: "https://example.com/contoso" },
          { name: "Fabrikam" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Brands we carry" })).toBeTruthy();
    const image = screen.getByRole("img", { name: "Northwind Tools" });
    expect(image.className).toContain("grayscale");
    expect(screen.getByRole("link", { name: "Contoso Paint" }).getAttribute("href")).toBe("https://example.com/contoso");
    expect(screen.getByRole("img", { name: "Fabrikam" }).textContent).toBe("Fabrikam");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("CtaSection", () => {
  it("renders the title, description and actions in both styles", () => {
    const { rerender } = render(<CtaSection title="Ready for your next project?" description="Stop by or call ahead." primaryAction={{ label: "Get directions", href: "/visit" }} secondaryAction={{ label: "Call us", href: "tel:+15550104477" }} />);
    const region = screen.getByRole("region", { name: "Ready for your next project?" });
    expect(region.getAttribute("data-variant")).toBe("banner");
    expect(screen.getByRole("link", { name: "Get directions" }).className).toContain("bg-primary-foreground");
    rerender(<CtaSection title="Ready for your next project?" variant="card" headingLevel={3} primaryAction={{ label: "Get directions", href: "/visit" }} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Get directions" }).className).toContain("bg-primary");
    expect(screen.queryByRole("link", { name: "Call us" })).toBeNull();
  });
});

describe("SiteFooter", () => {
  it("renders columns, social links, the current year and back to top", () => {
    render(
      <SiteFooter
        brand="Riverside Hardware"
        blurb="412 Main Street"
        columns={[
          { title: "Shop", links: [{ label: "Tools", href: "/tools" }, { label: "Paint", href: "/paint" }] },
          { title: "Help", links: [{ label: "Contact", href: "/contact" }] },
        ]}
        social={[{ label: "Riverside Hardware on Facebook", href: "https://example.com/facebook", icon: <svg /> }]}
        newsletter={<p>Newsletter here</p>}
        copyrightHolder="Riverside Hardware Co."
        legal="All rights reserved."
        legalLinks={[{ label: "Privacy", href: "/privacy" }]}
        renderLink={routerLink}
      />,
    );
    const footer = screen.getByRole("contentinfo");
    const nav = within(footer).getByRole("navigation", { name: "Footer" });
    expect(within(nav).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Shop", "Help"]);
    expect(within(nav).getByRole("link", { name: "Paint" }).hasAttribute("data-router")).toBe(true);
    expect(within(screen.getByRole("list", { name: "Social media" })).getByRole("link", { name: "Riverside Hardware on Facebook" })).toBeTruthy();
    expect(screen.getByText(`${new Date().getFullYear()}`, { exact: false })).toBeTruthy();
    expect(footer.textContent).toContain(`© ${new Date().getFullYear()} Riverside Hardware Co. All rights reserved.`);
    expect(within(screen.getByRole("list", { name: "Legal" })).getByRole("link", { name: "Privacy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to top" }).getAttribute("href")).toBe("#top");
    expect(screen.getByText("Newsletter here")).toBeTruthy();
  });

  it("uses a fixed year and can hide the back-to-top link", () => {
    render(<SiteFooter copyrightHolder="Riverside Hardware" year={2024} backToTopHref={false} />);
    expect(screen.getByRole("contentinfo").textContent).toBe("© 2024 Riverside Hardware");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});

describe("NewsletterSignup", () => {
  it("validates the address and links the error to the field", async () => {
    const onSubscribe = vi.fn();
    render(<NewsletterSignup title="Weekly deals" onSubscribe={onSubscribe} />);
    const form = screen.getByRole("form", { name: "Weekly deals" });
    const field = within(form).getByRole("textbox", { name: "Email address" });
    fireEvent.click(within(form).getByRole("button", { name: "Subscribe" }));
    expect(onSubscribe).not.toHaveBeenCalled();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const error = screen.getByText("Enter your email address.");
    expect(field.getAttribute("aria-describedby")?.split(" ")).toContain(error.id);
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "dana@example" } });
    expect(screen.getByText("Enter an email address like name@example.com.")).toBeTruthy();
    fireEvent.change(field, { target: { value: "dana@example.com" } });
    expect(field.getAttribute("aria-invalid")).toBeNull();
  });

  it("shows pending, ignores double submits, then announces success and clears", async () => {
    const pending = deferred();
    const onSubscribe = vi.fn(() => pending.promise);
    render(<NewsletterSignup onSubscribe={onSubscribe} />);
    const field = screen.getByRole("textbox", { name: "Email address" });
    fireEvent.change(field, { target: { value: "  dana@example.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    const busy = screen.getByRole("button", { name: "Subscribing…" });
    expect(busy.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(busy);
    fireEvent.submit(busy.closest("form")!);
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    expect(onSubscribe).toHaveBeenCalledWith("dana@example.com", { email: "dana@example.com", consent: false });
    expect(screen.getByRole("status").textContent).toBe("Subscribing…");
    await act(async () => pending.resolve());
    expect(screen.getByRole("status").textContent).toBe("Thanks for subscribing. Check your inbox to confirm your address.");
    expect((field as HTMLInputElement).value).toBe("");
    fireEvent.change(field, { target: { value: "d" } });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("reports failures and enforces consent", async () => {
    const onSubscribe = vi.fn(() => Promise.reject(new Error("offline")));
    render(<NewsletterSignup onSubscribe={onSubscribe} consentLabel="Email me deals and store news" errorMessage={(error) => `Failed: ${(error as Error).message}`} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: "dana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    expect(onSubscribe).not.toHaveBeenCalled();
    const consent = screen.getByRole("checkbox", { name: "Email me deals and store news" });
    expect(consent.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(consent.getAttribute("aria-describedby")!)?.textContent).toBe("Check the box to agree before subscribing.");
    fireEvent.click(consent);
    expect(consent.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
    });
    expect(onSubscribe).toHaveBeenCalledWith("dana@example.com", { email: "dana@example.com", consent: true });
    expect(screen.getByRole("status").textContent).toBe("Failed: offline");
  });
});

const TOPICS = [
  { value: "rental", label: "Tool rental" },
  { value: "paint", label: "Paint matching" },
];

function fillContact(values: Partial<Record<"Name" | "Email" | "Phone" | "Message", string>>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${label}`) }), { target: { value } });
  }
}

describe("ContactForm", () => {
  it("validates on blur, then on submit focuses the first problem with linked errors", () => {
    const onSubmit = vi.fn();
    render(<ContactForm onSubmit={onSubmit} topics={TOPICS} aria-label="Contact us" />);
    const name = screen.getByRole("textbox", { name: /^Name/ });
    fireEvent.blur(name);
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.queryByText("Enter your email address.")).toBeNull();
    fireEvent.change(name, { target: { value: "Dana Ortiz" } });
    expect(screen.queryByText("Enter your name.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).not.toHaveBeenCalled();
    const email = screen.getByRole("textbox", { name: /^Email/ });
    expect(document.activeElement).toBe(email);
    const emailError = screen.getByText("Enter your email address.");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")?.split(" ")).toContain(emailError.id);
    expect(screen.getByText("Choose a topic.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /^Topic/ }).getAttribute("aria-invalid")).toBe("true");
    const message = screen.getByRole("textbox", { name: /^Message/ });
    expect(message.tagName).toBe("TEXTAREA");
    expect(message.getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByText("Enter a message.").id);
    expect(screen.queryByText(/phone number/)).toBeNull();
  });

  it("counts characters left against the limit", () => {
    render(<ContactForm onSubmit={vi.fn()} messageMaxLength={20} />);
    expect(screen.getByText("20 characters left")).toBeTruthy();
    fillContact({ Message: "a".repeat(25) });
    expect(screen.getByText("5 characters over the limit")).toBeTruthy();
    fireEvent.blur(screen.getByRole("textbox", { name: /^Message/ }));
    expect(screen.getByText("Shorten your message to 20 characters or fewer.")).toBeTruthy();
  });

  it("chooses a topic, submits trimmed values once and resets after success", async () => {
    const pending = deferred();
    const onSubmit = vi.fn(() => pending.promise);
    render(<ContactForm onSubmit={onSubmit} topics={TOPICS} />);
    fillContact({ Name: " Dana Ortiz ", Email: "dana@example.com", Phone: "(555) 010-4477", Message: "  Do you rent tile saws by the day?  " });
    fireEvent.click(screen.getByRole("combobox", { name: /^Topic/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Tool rental" }));
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: /^Topic/ }).textContent).toContain("Tool rental"));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.submit(screen.getByRole("button", { name: "Sending…" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ name: "Dana Ortiz", email: "dana@example.com", phone: "(555) 010-4477", topic: "rental", message: "Do you rent tile saws by the day?" });
    expect(screen.getByRole("status").textContent).toBe("Sending…");
    expect(screen.getByRole("textbox", { name: /^Name/ }).matches(":disabled")).toBe(true);
    await act(async () => pending.resolve());
    expect(screen.getByRole("status").textContent).toBe("Thanks, your message has been sent. We will get back to you soon.");
    expect((screen.getByRole("textbox", { name: /^Name/ }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: /^Message/ }) as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText("Enter your name.")).toBeNull();
  });

  it("keeps values and shows the error when sending fails", async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error("network")));
    render(<ContactForm onSubmit={onSubmit} phone="hidden" />);
    expect(screen.queryByRole("textbox", { name: /^Phone/ })).toBeNull();
    fillContact({ Name: "Dana", Email: "dana@example.com", Message: "Need a quote for 40 sheets of drywall." });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: "Dana", email: "dana@example.com", phone: "", topic: "", message: "Need a quote for 40 sheets of drywall." });
    expect(screen.getByRole("status").textContent).toBe("Your message could not be sent. Check your connection and try again.");
    expect((screen.getByRole("textbox", { name: /^Name/ }) as HTMLInputElement).value).toBe("Dana");
  });

  it("silently drops submissions that fill the honeypot", () => {
    const onSubmit = vi.fn();
    const onSpam = vi.fn();
    const { container } = render(<ContactForm onSubmit={onSubmit} onSpam={onSpam} />);
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]')!;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    fillContact({ Name: "Bot", Email: "bot@example.com", Message: "Buy cheap watches today!!" });
    fireEvent.change(trap, { target: { value: "https://example.com/spam" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSpam).toHaveBeenCalledWith(expect.objectContaining({ email: "bot@example.com" }));
    expect(screen.getByRole("status").textContent).toBe("Thanks, your message has been sent. We will get back to you soon.");
  });

  it("requires the phone when asked", () => {
    render(<ContactForm onSubmit={vi.fn()} phone="required" />);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(screen.getByText("Enter your phone number.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /^Phone/ }).getAttribute("aria-required")).toBe("true");
  });
});

describe("BlogCard and BlogGrid", () => {
  const post = {
    title: "How to pick the right drill bit",
    href: "/blog/drill-bits",
    excerpt: "Wood, metal or masonry: a quick guide.",
    image: { src: "https://example.com/bits.jpg" },
    category: "Guides",
    author: { name: "Sam Whitten" },
    date: "2026-03-05",
    readingMinutes: 5,
  };

  it("makes the title the only link and formats metadata", () => {
    render(<BlogCard post={post} locale="en-US" renderLink={routerLink} />);
    const article = screen.getByRole("article");
    const links = within(article).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]!.textContent).toBe("How to pick the right drill bit");
    expect(links[0]!.hasAttribute("data-router")).toBe(true);
    expect(links[0]!.className).toContain("after:inset-0");
    expect(within(article).getByRole("heading", { level: 3 })).toBeTruthy();
    expect(article.querySelector("time")?.getAttribute("dateTime")).toBe("2026-03-05");
    expect(within(article).getByText("Mar 5, 2026")).toBeTruthy();
    expect(within(article).getByText("5 min read")).toBeTruthy();
    expect(within(article).getByText("SW")).toBeTruthy();
    expect(article.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("lists cards one heading level below the section", () => {
    render(<BlogGrid title="From the workshop" headingLevel={3} posts={[post, { title: "Winterize your outdoor faucets", href: "/blog/faucets" }]} />);
    expect(screen.getByRole("heading", { level: 3, name: "From the workshop" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

describe("TeamGrid", () => {
  it("shows people with initials and named icon links", () => {
    render(
      <TeamGrid
        title="Meet the team"
        members={[
          { name: "Dana Ortiz", role: "Paint desk", bio: "Twenty years matching colors.", links: [{ label: "Email Dana Ortiz", href: "mailto:dana@example.com", icon: <svg /> }] },
          { name: "Sam Whitten", role: "Owner", photoUrl: "https://example.com/sam.jpg" },
        ]}
      />,
    );
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Dana Ortiz", "Sam Whitten"]);
    expect(screen.getByText("DO")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Dana Ortiz links" })).getByRole("link", { name: "Email Dana Ortiz" }).getAttribute("href")).toBe("mailto:dana@example.com");
  });
});

describe("StatsBand", () => {
  it("renders a description list of formatted numbers", () => {
    const { container } = render(
      <StatsBand
        title="By the numbers"
        locale="en-US"
        variant="band"
        items={[
          { label: "Years on Main Street", value: 47 },
          { label: "Items in stock", value: 32000, suffix: "+", description: "From fasteners to lumber" },
          { label: "Same-day delivery", value: 0.98, format: { style: "percent" } },
        ]}
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect([...container.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Years on Main Street", "Items in stock", "Same-day delivery"]);
    expect([...container.querySelectorAll("dd")].map((detail) => detail.textContent)).toEqual(["47", "32,000+", "From fasteners to lumber", "98%"]);
    expect(screen.getByRole("region", { name: "By the numbers" }).getAttribute("data-variant")).toBe("band");
  });
});
