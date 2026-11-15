// packages/ai-ui/src/components/pricing-table.tsx
"use client";

import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { badge, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultRenderLink, type RenderLink } from "./breadcrumbs.js";
import { SegmentedControl } from "./segmented-control.js";
import { childHeadingLevel, type SiteAction, SiteActionButton, SiteSection, type SiteSectionProps } from "./site-section.js";

export type BillingPeriod = "monthly" | "yearly";

export interface YearlySavings {
  /** Money saved per year versus twelve monthly payments, rounded to cents. */
  amount: number;
  /** Whole percent saved, rounded down so it never overstates the discount. */
  percent: number;
}

/**
 * What paying `yearlyPrice` once saves versus twelve payments of
 * `monthlyPrice`. Zero when there is no saving or either price is invalid.
 */
export function yearlySavings(monthlyPrice: number, yearlyPrice: number): YearlySavings {
  const full = monthlyPrice * 12;
  if (!Number.isFinite(full) || !Number.isFinite(yearlyPrice) || monthlyPrice <= 0 || yearlyPrice < 0 || yearlyPrice >= full) return { amount: 0, percent: 0 };
  const saved = full - yearlyPrice;
  return { amount: Math.round(saved * 100) / 100, percent: Math.floor((saved / full) * 100 + 1e-9) };
}

export interface PlanFeature {
  label: ReactNode;
  /** False lists the feature as not included. */
  included?: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  description?: ReactNode;
  /** Price per month when billed monthly; null for plans priced on request. */
  monthlyPrice: number | null;
  /** Total per year when billed yearly; defaults to twelve monthly payments. */
  yearlyPrice?: number | null;
  /** Replaces the price, such as "Free" or "Call for a quote". */
  priceLabel?: ReactNode;
  features?: Array<string | PlanFeature>;
  /** Highlights the plan and shows a badge. */
  featured?: boolean;
  /** Badge text for a featured plan; defaults to `featuredLabel`. */
  badge?: string;
  /** Call to action, or a function of the billing period for period-specific links. */
  cta: SiteAction | ((period: BillingPeriod) => SiteAction);
}

function yearlyTotal(plan: PricingPlan): number | null {
  if (plan.yearlyPrice !== undefined) return plan.yearlyPrice;
  return plan.monthlyPrice === null ? null : plan.monthlyPrice * 12;
}

function planSavings(plan: PricingPlan): YearlySavings {
  const yearly = yearlyTotal(plan);
  return plan.monthlyPrice === null || yearly === null ? { amount: 0, percent: 0 } : yearlySavings(plan.monthlyPrice, yearly);
}

function formatMoney(value: number, currency: string, locale: string | undefined): string {
  const digits = Number.isInteger(value) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
  return new Intl.NumberFormat(locale, { style: "currency", currency, ...digits }).format(value);
}

export interface PricingTableProps extends SiteSectionProps {
  plans: PricingPlan[];
  period?: BillingPeriod;
  defaultPeriod?: BillingPeriod;
  onPeriodChange?: (period: BillingPeriod) => void;
  /** ISO 4217 code used to format every price. */
  currency?: string;
  locale?: string;
  /** Yearly prices as the monthly equivalent (with the yearly total below) or as the yearly total. */
  yearlyDisplay?: "per-month" | "per-year";
  /** Hides the billing period toggle; it is also hidden when no plan has a yearly price. */
  hidePeriodToggle?: boolean;
  periodLabel?: string;
  monthlyLabel?: string;
  yearlyLabel?: string;
  featuredLabel?: string;
  renderLink?: RenderLink;
}

const planColumns = (count: number) => (count >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : count === 3 ? "md:grid-cols-3" : count === 2 ? "sm:grid-cols-2 max-w-4xl mx-auto w-full" : "max-w-md mx-auto w-full");

/**
 * Plan cards with monthly and yearly prices formatted through Intl, a
 * billing period radio group that shows the yearly saving, a featured plan
 * badge, included and excluded features, and a call to action per plan.
 */
export function PricingTable({
  plans,
  period,
  defaultPeriod = "monthly",
  onPeriodChange,
  currency = "USD",
  locale,
  yearlyDisplay = "per-month",
  hidePeriodToggle = false,
  periodLabel = "Billing period",
  monthlyLabel = "Monthly",
  yearlyLabel = "Yearly",
  featuredLabel = "Most popular",
  headingLevel = 2,
  align = "center",
  renderLink = defaultRenderLink,
  children,
  ...props
}: PricingTableProps) {
  const [billing, setBilling] = useControllableState<BillingPeriod>({ value: period, defaultValue: defaultPeriod, onChange: onPeriodChange });
  const PlanHeading = `h${childHeadingLevel(headingLevel)}` as const;
  const savings = plans.map(planSavings);
  const best = Math.max(0, ...savings.map((saving) => saving.percent));
  const varied = new Set(savings.filter((saving) => saving.percent > 0).map((saving) => saving.percent)).size > 1;
  const showToggle = !hidePeriodToggle && plans.some((plan) => plan.yearlyPrice !== undefined);
  const money = (value: number) => formatMoney(value, currency, locale);

  return (
    <SiteSection data-slot="pricing-table" data-period={billing} headingLevel={headingLevel} align={align} {...props}>
      {showToggle && (
        <div className="flex justify-center">
          <SegmentedControl<BillingPeriod>
            label={periodLabel}
            value={billing}
            onValueChange={setBilling}
            options={[
              { value: "monthly", label: monthlyLabel },
              {
                value: "yearly",
                label: (
                  <>
                    {yearlyLabel}
                    {best > 0 && (
                      <span className="rounded-full border border-success/40 bg-success/10 px-1.5 text-xs font-medium text-foreground">
                        Save {varied ? "up to " : ""}
                        {best}%
                      </span>
                    )}
                  </>
                ),
              },
            ]}
          />
        </div>
      )}
      {plans.length > 0 && (
        <ul className={cn("grid items-stretch gap-6", planColumns(plans.length))}>
          {plans.map((plan, index) => {
            const saving = savings[index] ?? { amount: 0, percent: 0 };
            const yearly = yearlyTotal(plan);
            const isYearly = billing === "yearly" && yearly !== null;
            const price = plan.monthlyPrice === null ? null : isYearly ? (yearlyDisplay === "per-month" ? yearly / 12 : yearly) : plan.monthlyPrice;
            const perYear = isYearly && yearlyDisplay === "per-year";
            const action = typeof plan.cta === "function" ? plan.cta(billing) : plan.cta;
            const note =
              price === null || plan.priceLabel !== undefined
                ? null
                : !isYearly
                  ? "Billed monthly"
                  : perYear
                    ? saving.amount > 0
                      ? `Save ${money(saving.amount)} versus monthly`
                      : "Billed yearly"
                    : `Billed ${money(yearly)} yearly${saving.amount > 0 ? `, save ${money(saving.amount)}` : ""}`;
            return (
              <li key={plan.id} data-featured={plan.featured || undefined} className={cn(card, "relative flex flex-col gap-6 p-6", plan.featured && "border-primary shadow-md ring-1 ring-primary")}>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PlanHeading className="text-lg font-semibold text-foreground">
                      {plan.name}
                    </PlanHeading>
                    {plan.featured && <span className={cn(badge, "border-transparent bg-primary text-primary-foreground")}>{plan.badge ?? featuredLabel}</span>}
                  </div>
                  {plan.description && <div className="text-sm text-muted-foreground">{plan.description}</div>}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-1">
                    <span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">{plan.priceLabel ?? (price === null ? "Custom" : money(price))}</span>
                    {price !== null && plan.priceLabel === undefined && (
                      <span className="text-sm text-muted-foreground">
                        <span aria-hidden="true">{perYear ? "/yr" : "/mo"}</span>
                        <span className="sr-only">{perYear ? "per year" : "per month"}</span>
                      </span>
                    )}
                  </p>
                  {note && <p className="text-sm text-muted-foreground">{note}</p>}
                </div>
                <SiteActionButton
                  action={{ ...action, label: <>{action.label}{!action["aria-label"] && <span className="sr-only"> ({plan.name} plan)</span>}</> }}
                  variant={plan.featured ? "primary" : "outline"}
                  renderLink={renderLink}
                  className="w-full"
                />
                {plan.features && plan.features.length > 0 && (
                  <ul className="flex flex-col gap-2.5 border-t border-border pt-6 text-sm">
                    {plan.features.map((feature, featureIndex) => {
                      const item = typeof feature === "string" ? { label: feature, included: true } : feature;
                      const included = item.included !== false;
                      return (
                        <li key={featureIndex} className={cn("flex gap-2.5", included ? "text-foreground" : "text-muted-foreground")}>
                          {included ? <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <XIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                          <span>
                            {!included && <span className="sr-only">Not included: </span>}
                            {item.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {children}
    </SiteSection>
  );
}

export interface ComparisonRow {
  /** Stable key; defaults to the index. */
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  /** Rows with the same group are listed together under that group's heading row. */
  group?: string;
  /** Per plan id: true or false for a check or a dash, or text such as "5 per month". Missing counts as not included. */
  values: Record<string, boolean | ReactNode>;
}

export interface PlanComparisonProps extends Omit<ComponentProps<"div">, "children"> {
  plans: Array<Pick<PricingPlan, "id" | "name">>;
  rows: ComparisonRow[];
  /** Names the table; required for screen readers even when hidden. */
  caption: ReactNode;
  hideCaption?: boolean;
  /** Header of the first column. */
  featureLabel?: string;
  /** Spoken in place of a check mark. */
  yesLabel?: string;
  /** Spoken in place of a dash. */
  noLabel?: string;
  /** Tints this plan's column. */
  highlightPlanId?: string;
}

/** Groups consecutive rows sharing a group name. */
function groupRows(rows: ComparisonRow[]): Array<{ group: string | undefined; rows: ComparisonRow[] }> {
  const groups: Array<{ group: string | undefined; rows: ComparisonRow[] }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.group === row.group) last.rows.push(row);
    else groups.push({ group: row.group, rows: [row] });
  }
  return groups;
}

/**
 * Feature matrix comparing plans. Check and dash cells carry real text for
 * screen readers, rows and columns use header cells, and the feature column
 * stays pinned while the table scrolls sideways on small screens.
 */
export function PlanComparison({ plans, rows, caption, hideCaption = false, featureLabel = "Feature", yesLabel = "Included", noLabel = "Not included", highlightPlanId, className, ...props }: PlanComparisonProps) {
  const id = useId();
  const pinned = "sticky left-0 z-10 bg-card text-left shadow-[inset_-1px_0_0_var(--border)]";
  const tint = (planId: string) => planId === highlightPlanId && "bg-accent/60";
  const cell = (value: boolean | ReactNode) => {
    if (value === true)
      return (
        <>
          <CheckIcon aria-hidden="true" className="mx-auto size-4 text-foreground" />
          <span className="sr-only">{yesLabel}</span>
        </>
      );
    if (value === false || value === undefined || value === null)
      return (
        <>
          <MinusIcon aria-hidden="true" className="mx-auto size-4 text-muted-foreground" />
          <span className="sr-only">{noLabel}</span>
        </>
      );
    return value;
  };

  return (
    <div data-slot="plan-comparison" role="region" aria-labelledby={`${id}-caption`} tabIndex={0} className={cn("w-full overflow-x-auto rounded-lg border border-border bg-card text-card-foreground", focusRing, className)} {...props}>
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption id={`${id}-caption`} className={cn("px-4 py-3 text-left text-base font-semibold", hideCaption && "sr-only")}>
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={cn(pinned, "px-4 py-3 font-semibold")}>
              {featureLabel}
            </th>
            {plans.map((plan) => (
              <th key={plan.id} scope="col" className={cn("px-4 py-3 text-center font-semibold", tint(plan.id))}>
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        {groupRows(rows).map((section, sectionIndex) => (
          <tbody key={sectionIndex}>
            {section.group !== undefined && (
              <tr className="border-b border-border bg-muted/50">
                <th scope="rowgroup" colSpan={plans.length + 1} className="px-4 py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <span className="sticky left-4">{section.group}</span>
                </th>
              </tr>
            )}
            {section.rows.map((row, rowIndex) => (
                <tr key={row.id ?? rowIndex} className="border-b border-border last:border-b-0">
                  <th scope="row" className={cn(pinned, "max-w-[12rem] px-4 py-3 font-normal sm:max-w-none")}>
                    <span className="block font-medium text-foreground">{row.label}</span>
                    {row.description && <span className="block text-xs text-muted-foreground">{row.description}</span>}
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.id} className={cn("px-4 py-3 text-center text-foreground", tint(plan.id))}>
                      {cell(row.values[plan.id])}
                    </td>
                  ))}
                </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
