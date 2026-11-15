// packages/ai-ui/example/gallery/site.tsx
import { ArrowRightIcon, DrillIcon, KeyRoundIcon, MailIcon, MessageCircleIcon, PaletteIcon, PhoneIcon, RssIcon, TruckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { BlogGrid, type BlogPost } from "../../src/components/blog-card.js";
import type { RenderLink } from "../../src/components/breadcrumbs.js";
import { ContactForm, type ContactTopic } from "../../src/components/contact-form.js";
import { CtaSection } from "../../src/components/cta-section.js";
import { Faq, type FaqItem } from "../../src/components/faq.js";
import { FeatureGrid, type FeatureItem } from "../../src/components/feature-grid.js";
import { Hero } from "../../src/components/hero.js";
import { LogoCloud, type LogoItem } from "../../src/components/logo-cloud.js";
import { NewsletterSignup } from "../../src/components/newsletter-signup.js";
import { type ComparisonRow, PlanComparison, type PricingPlan, PricingTable } from "../../src/components/pricing-table.js";
import { Rating } from "../../src/components/rating.js";
import { type FooterSocialLink, SiteFooter } from "../../src/components/site-footer.js";
import { SiteHeader, type SiteNavEntry } from "../../src/components/site-header.js";
import { SiteActionButton } from "../../src/components/site-section.js";
import { type StatItem, StatsBand } from "../../src/components/stats-band.js";
import { TeamGrid, type TeamMember } from "../../src/components/team-grid.js";
import { type Testimonial, Testimonials } from "../../src/components/testimonials.js";
import { Demo, GallerySection } from "./section.js";

const SITE = "https://riverside-hardware.example.com";

const NAV: SiteNavEntry[] = [
  { label: "Home", href: `${SITE}/` },
  {
    label: "Shop",
    items: [
      { label: "Tools", href: `${SITE}/shop/tools`, description: "Hand and power tools from trusted brands" },
      { label: "Paint", href: `${SITE}/shop/paint`, description: "Interior, exterior and stains" },
      { label: "Lumber", href: `${SITE}/shop/lumber`, description: "Cut to length while you wait" },
      { label: "Garden", href: `${SITE}/shop/garden`, description: "Soil, seed and outdoor power" },
    ],
  },
  {
    label: "Services",
    items: [
      { label: "Key cutting", href: `${SITE}/services/key-cutting`, icon: <KeyRoundIcon aria-hidden="true" /> },
      { label: "Paint matching", href: `${SITE}/services/paint-matching`, icon: <PaletteIcon aria-hidden="true" /> },
      { label: "Tool rental", href: `${SITE}/services/tool-rental`, icon: <DrillIcon aria-hidden="true" /> },
      { label: "Local delivery", href: `${SITE}/services/delivery`, icon: <TruckIcon aria-hidden="true" /> },
    ],
  },
  { label: "Pro membership", href: `${SITE}/pro` },
  { label: "Contact", href: `${SITE}/contact` },
];

const FEATURES: FeatureItem[] = [
  { id: "keys", icon: <KeyRoundIcon />, title: "Key cutting", description: "House, padlock and most car keys copied in under five minutes, guaranteed to work or we recut free.", href: `${SITE}/services/key-cutting` },
  { id: "paint", icon: <PaletteIcon />, title: "Paint matching", description: "Bring a chip, a cabinet door or a photo. Our spectrophotometer matches it while you shop.", href: `${SITE}/services/paint-matching` },
  { id: "rental", icon: <DrillIcon />, title: "Tool rental", description: "Tile saws, floor sanders, post hole augers and more by the half day, day or week.", href: `${SITE}/services/tool-rental` },
  { id: "delivery", icon: <TruckIcon />, title: "Local delivery", description: "Same-day delivery within 15 miles on orders placed before noon, free over $99.", href: `${SITE}/services/delivery` },
];

const STATS: StatItem[] = [
  { label: "Years on Main Street", value: 47 },
  { label: "Items in stock", value: 32000, suffix: "+", description: "From single screws to full lumber loads" },
  { label: "Keys cut last year", value: 18400 },
  { label: "Deliveries on time", value: 0.98, format: { style: "percent" } },
];

const PLANS: PricingPlan[] = [
  {
    id: "homeowner",
    name: "Homeowner",
    description: "For weekend projects around the house.",
    monthlyPrice: 0,
    priceLabel: "Free",
    features: ["Member-only weekly deals", "Paint color history on file", { label: "Tool and lumber discounts", included: false }, { label: "Net 30 house account", included: false }],
    cta: { label: "Join free", href: `${SITE}/pro/join?plan=homeowner` },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For contractors and serious remodelers.",
    monthlyPrice: 29,
    yearlyPrice: 290,
    featured: true,
    features: ["10% off tools and lumber", "Free local delivery", "Priority rental reservations", { label: "Net 30 house account", included: false }],
    cta: (period) => ({ label: "Start Pro", href: `${SITE}/pro/join?plan=pro&billing=${period}` }),
  },
  {
    id: "crew",
    name: "Crew",
    description: "For crews with several trucks on the road.",
    monthlyPrice: 79,
    yearlyPrice: 790,
    features: ["15% off everything", "Free delivery, any order size", "Up to 5 crew cards", "Net 30 house account"],
    cta: (period) => ({ label: "Start Crew", href: `${SITE}/pro/join?plan=crew&billing=${period}` }),
  },
];

const COMPARISON: ComparisonRow[] = [
  { label: "Weekly deals email", group: "Savings", values: { homeowner: true, pro: true, crew: true } },
  { label: "Tool and lumber discount", group: "Savings", values: { homeowner: false, pro: "10%", crew: "15%" } },
  { label: "Free local delivery", group: "Service", description: "Within 15 miles", values: { homeowner: false, pro: "Orders over $50", crew: true } },
  { label: "Rental reservations", group: "Service", values: { homeowner: "Same day", pro: "7 days ahead", crew: "14 days ahead" } },
  { label: "Crew cards", group: "Account", values: { homeowner: false, pro: "1", crew: "Up to 5" } },
  { label: "Net 30 house account", group: "Account", values: { homeowner: false, pro: false, crew: true } },
];

const TESTIMONIALS: Testimonial[] = [
  { id: "bell", quote: "They matched a 20-year-old trim color from a chip the size of my thumbnail. The client never knew which wall was repainted.", name: "Marcus Bell", role: "Owner", company: "Bell Painting Co.", rating: 5 },
  { id: "shah", quote: "The rental counter had the tile saw cleaned and ready at 6:30 in the morning. That saved us half a day.", name: "Priya Shah", role: "Project manager", company: "Shah Remodeling", rating: 5 },
  { id: "nguyen", quote: "I came in for one hinge and left knowing how to fix the whole door. Real advice, no upselling.", name: "Tom Nguyen", role: "Homeowner", rating: 4 },
];

const FAQS: FaqItem[] = [
  { id: "hours", question: "What are your store hours?", answer: "Monday to Saturday 7 am to 7 pm, Sunday 9 am to 5 pm. The rental counter opens at 6:30 am on weekdays." },
  { id: "keys", question: "How long does key cutting take?", answer: "Most house and padlock keys take under five minutes. Transponder car keys take about 20 minutes and need the original key." },
  { id: "paint", question: "Can you match a paint color from a photo?", answer: "Yes, though a physical chip gives the closest match. Bring a sample at least the size of a quarter if you can." },
  { id: "rental", question: "Do rentals need a deposit?", answer: "Yes. Most tools need a card on file and a refundable deposit of $50 to $250 depending on the tool. Pro members skip the deposit." },
  { id: "delivery", question: "How far do you deliver?", answer: "We deliver within 15 miles of the store. Orders placed before noon arrive the same day." },
  { id: "returns", question: "What is your return policy?", answer: "Unused items with a receipt can be returned within 90 days. Custom-tinted paint and cut lumber cannot be returned." },
];

const LOGOS: LogoItem[] = [
  { name: "Northwind Tools", href: "https://example.com/northwind" },
  { name: "Contoso Paint", href: "https://example.com/contoso" },
  { name: "Fabrikam Fasteners", href: "https://example.com/fabrikam" },
  { name: "Tailspin Lumber", href: "https://example.com/tailspin" },
  { name: "Litware Electric", href: "https://example.com/litware" },
  { name: "Proseware Garden", href: "https://example.com/proseware" },
];

const TOPICS: ContactTopic[] = [
  { value: "order", label: "An order or delivery" },
  { value: "rental", label: "Tool rental" },
  { value: "pro", label: "Pro membership" },
  { value: "other", label: "Something else" },
];

const POSTS: BlogPost[] = [
  { title: "How to pick the right drill bit for wood, metal and masonry", href: `${SITE}/blog/drill-bits`, excerpt: "A quick guide to twist, brad point, spade and masonry bits, and the one mistake that dulls them fastest.", category: "Guides", author: { name: "Sam Whitten" }, date: "2026-10-12", readingMinutes: 6 },
  { title: "Winterize your outdoor faucets in 15 minutes", href: `${SITE}/blog/winterize-faucets`, excerpt: "Shut-off valves, insulated covers and draining the line: everything you need before the first hard freeze.", category: "Seasonal", author: { name: "Dana Ortiz" }, date: "2026-10-03", readingMinutes: 4 },
  { title: "Choosing a sheen: flat, eggshell, satin or semi-gloss", href: `${SITE}/blog/paint-sheen`, excerpt: "Which finish hides flaws, which one scrubs clean, and where each belongs in your home.", category: "Paint", author: { name: "Luis Romero" }, date: "2026-09-21", readingMinutes: 5 },
];

const TEAM: TeamMember[] = [
  { name: "Sam Whitten", role: "Owner", bio: "Third generation behind the counter and the person to ask about old house hardware.", links: [{ label: "Email Sam Whitten", href: "mailto:sam@example.com", icon: <MailIcon /> }] },
  { name: "Dana Ortiz", role: "Paint desk lead", bio: "Twenty years of color matching, from historic trim to kitchen cabinets.", links: [{ label: "Email Dana Ortiz", href: "mailto:dana@example.com", icon: <MailIcon /> }] },
  { name: "Luis Romero", role: "Rental counter", bio: "Keeps every saw sharp and every sander tuned before it leaves the shop.", links: [{ label: "Call Luis Romero at the rental counter", href: "tel:+15550104478", icon: <PhoneIcon /> }] },
  { name: "Ava Chen", role: "Pro desk", bio: "Handles contractor quotes, house accounts and next-morning lumber orders.", links: [{ label: "Email Ava Chen", href: "mailto:ava@example.com", icon: <MailIcon /> }] },
];

const SOCIAL: FooterSocialLink[] = [
  { label: "Email Riverside Hardware", href: "mailto:hello@example.com", icon: <MailIcon /> },
  { label: "Call Riverside Hardware", href: "tel:+15550104477", icon: <PhoneIcon /> },
  { label: "Text Riverside Hardware", href: "sms:+15550104477", icon: <MessageCircleIcon /> },
  { label: "Riverside Hardware news feed", href: `${SITE}/feed.xml`, icon: <RssIcon /> },
];

/** Resolves after a short delay; addresses or messages containing "fail" are rejected to show the error state. */
function simulateSend(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => (text.includes("fail") ? reject(new Error("The server did not respond.")) : resolve()), 900);
  });
}

function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        RH
      </span>
      <span className="truncate">Riverside Hardware</span>
    </span>
  );
}

function StoreIllustration() {
  return (
    <svg role="img" aria-label="Illustration of the Riverside Hardware storefront with an awning and tools in the window" viewBox="0 0 480 320" className="h-auto w-full rounded-xl border border-border bg-muted">
      <rect x="60" y="70" width="360" height="230" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
      <rect x="40" y="40" width="400" height="44" rx="6" fill="var(--primary)" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <path key={index} d={`M${40 + index * 50} 84 h50 l-8 26 h-34 Z`} fill={index % 2 ? "var(--chart-1)" : "var(--card)"} stroke="var(--border)" />
      ))}
      <rect x="90" y="140" width="130" height="120" rx="4" fill="var(--muted)" stroke="var(--border)" />
      <rect x="260" y="140" width="130" height="160" rx="4" fill="var(--muted)" stroke="var(--border)" />
      <path d="M115 240 l40 -70 l12 7 l-40 70 Z" fill="var(--chart-2)" />
      <rect x="160" y="200" width="40" height="40" rx="3" fill="var(--chart-3)" />
      <rect x="320" y="210" width="8" height="16" rx="2" fill="var(--foreground)" />
      <circle cx="240" cy="62" r="10" fill="var(--primary-foreground)" />
    </svg>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-hidden rounded-xl border border-border bg-background">{children}</div>;
}

export function SiteGallery() {
  const [path, setPath] = useState(`${SITE}/services/paint-matching`);
  /** Keeps every demo link on the gallery page and moves the header's current page. */
  const renderLink: RenderLink = ({ href, children, onClick, ...props }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        if (href.startsWith(SITE)) setPath(href);
        onClick?.();
      }}
    >
      {children}
    </a>
  );

  return (
    <GallerySection id="gallery-site" title="Site sections">
      <Demo title="Site header" className="flex w-full flex-col gap-2">
        <Frame>
          <SiteHeader
            brand={<Brand />}
            brandHref={`${SITE}/`}
            nav={NAV}
            currentPath={path}
            label="Riverside Hardware"
            skipLinkHref="#gallery-site-hero"
            renderLink={renderLink}
            actions={<SiteActionButton action={{ label: <><PhoneIcon aria-hidden="true" />(555) 010-4477</>, href: "tel:+15550104477" }} variant="outline" className="max-lg:hidden" renderLink={renderLink} />}
            menuFooter={<SiteActionButton action={{ label: <><PhoneIcon aria-hidden="true" />Call the store</>, href: "tel:+15550104477" }} size="lg" renderLink={renderLink} />}
          />
        </Frame>
        <p className="text-sm text-muted-foreground">Current page: {path.replace(SITE, "") || "/"}</p>
      </Demo>
      <Demo title="Hero" className="flex w-full flex-col">
        <Frame>
          <Hero
            id="gallery-site-hero"
            tabIndex={-1}
            layout="split"
            background="gradient"
            headingLevel={4}
            eyebrow="Family owned on Main Street since 1979"
            title="Everything for the job, ten minutes from home"
            description="Tools, paint, lumber and honest advice from people who use what they sell. Order online for pickup in an hour."
            primaryAction={{ label: "Order for pickup", href: `${SITE}/shop`, icon: <ArrowRightIcon aria-hidden="true" /> }}
            secondaryAction={{ label: "Get directions", href: `${SITE}/visit` }}
            media={<StoreIllustration />}
            renderLink={renderLink}
            className="outline-none"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Rating readOnly value={4.8} size="sm" label="Average customer rating" />
              <span>4.8 from 1,240 local reviews</span>
            </div>
          </Hero>
        </Frame>
      </Demo>
      <Demo title="Feature grid" className="flex w-full flex-col">
        <Frame>
          <FeatureGrid eyebrow="In-store services" title="More than a place to buy screws" description="The services that keep contractors and homeowners coming back." headingLevel={4} columns={4} items={FEATURES} renderLink={renderLink} />
        </Frame>
      </Demo>
      <Demo title="Stats band" className="flex w-full flex-col">
        <Frame>
          <StatsBand title="By the numbers" headingLevel={4} variant="band" locale="en-US" items={STATS} />
        </Frame>
      </Demo>
      <Demo title="Pricing table" className="flex w-full flex-col">
        <Frame>
          <PricingTable
            eyebrow="Pro membership"
            title="Save on every job"
            description="Pick a plan for your crew. Switch or cancel any time; yearly plans get two months free."
            headingLevel={4}
            plans={PLANS}
            locale="en-US"
            renderLink={renderLink}
          >
            <p className="text-center text-sm text-muted-foreground">Prices in US dollars, before sales tax.</p>
          </PricingTable>
        </Frame>
      </Demo>
      <Demo title="Plan comparison" className="flex w-full flex-col">
        <PlanComparison caption="Compare Pro membership plans" plans={PLANS} rows={COMPARISON} highlightPlanId="pro" />
      </Demo>
      <Demo title="Testimonials" className="flex w-full flex-col">
        <Frame>
          <Testimonials title="What our customers say" headingLevel={4} align="center" layout="featured" columns={2} items={TESTIMONIALS} />
        </Frame>
      </Demo>
      <Demo title="FAQ" className="flex w-full flex-col">
        <Frame>
          <Faq title="Frequently asked questions" headingLevel={4} align="center" items={FAQS} defaultValue={["hours"]} searchable structuredData />
        </Frame>
      </Demo>
      <Demo title="Logo cloud" className="flex w-full flex-col">
        <Frame>
          <LogoCloud title="Brands we carry" headingLevel={4} items={LOGOS} muted renderLink={renderLink} />
        </Frame>
      </Demo>
      <Demo title="Call to action" className="flex w-full flex-col gap-4">
        <Frame>
          <CtaSection
            title="Ready for your next project?"
            description="Stop by the store or call ahead and we will have your order pulled and waiting at the front counter."
            headingLevel={4}
            primaryAction={{ label: "Get directions", href: `${SITE}/visit` }}
            secondaryAction={{ label: "Call (555) 010-4477", href: "tel:+15550104477" }}
            renderLink={renderLink}
          />
        </Frame>
        <Frame>
          <CtaSection variant="card" align="start" title="Opening a house account?" description="Pro desk staff set up Net 30 terms for contractors in one visit." headingLevel={4} primaryAction={{ label: "Talk to the Pro desk", href: `${SITE}/pro/desk` }} renderLink={renderLink} />
        </Frame>
      </Demo>
      <Demo title="Newsletter signup" className="flex w-full flex-col">
        <div className="w-full max-w-lg">
          <NewsletterSignup
            title="Weekly deals, no spam"
            description="One email every Thursday with member prices and workshop dates. Use an address containing fail to see the error state."
            headingLevel={4}
            consentLabel="Email me deals and store news. Unsubscribe at any time."
            onSubscribe={(email) => simulateSend(email)}
          />
        </div>
      </Demo>
      <Demo title="Contact form" className="flex w-full flex-col">
        <div className="w-full max-w-2xl">
          <ContactForm aria-label="Contact Riverside Hardware" topics={TOPICS} onSubmit={(values) => simulateSend(values.message)} />
        </div>
      </Demo>
      <Demo title="Blog cards" className="flex w-full flex-col">
        <Frame>
          <BlogGrid title="From the workshop" description="How-to guides from the people behind the counter." headingLevel={4} posts={POSTS} locale="en-US" renderLink={renderLink} />
        </Frame>
      </Demo>
      <Demo title="Team grid" className="flex w-full flex-col">
        <Frame>
          <TeamGrid title="Meet the team" headingLevel={4} columns={4} members={TEAM} renderLink={renderLink} />
        </Frame>
      </Demo>
      <Demo title="Site footer" className="flex w-full flex-col">
        <Frame>
          <SiteFooter
            brand={<Brand />}
            blurb="412 Main Street, Riverside. Open 7 am to 7 pm Monday to Saturday, 9 am to 5 pm Sunday."
            columns={[
              { title: "Shop", links: [{ label: "Tools", href: `${SITE}/shop/tools` }, { label: "Paint", href: `${SITE}/shop/paint` }, { label: "Lumber", href: `${SITE}/shop/lumber` }, { label: "Garden", href: `${SITE}/shop/garden` }] },
              { title: "Services", links: [{ label: "Key cutting", href: `${SITE}/services/key-cutting` }, { label: "Tool rental", href: `${SITE}/services/tool-rental` }, { label: "Local delivery", href: `${SITE}/services/delivery` }] },
              { title: "Company", links: [{ label: "About us", href: `${SITE}/about` }, { label: "Careers", href: `${SITE}/careers` }, { label: "Contact", href: `${SITE}/contact` }] },
            ]}
            social={SOCIAL}
            newsletter={<NewsletterSignup title="Get weekly deals" headingLevel={4} hideLabel layout="stacked" onSubscribe={(email) => simulateSend(email)} />}
            copyrightHolder="Riverside Hardware Co."
            legal="All rights reserved."
            legalLinks={[{ label: "Privacy", href: `${SITE}/privacy` }, { label: "Terms", href: `${SITE}/terms` }]}
            backToTopHref="#gallery-site"
            headingLevel={4}
            label="Riverside Hardware footer"
            renderLink={renderLink}
          />
        </Frame>
      </Demo>
    </GallerySection>
  );
}
