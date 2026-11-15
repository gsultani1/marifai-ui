// packages/ai-ui/src/lib/classes.ts
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4";

export const collapsiblePanel =
  "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none";

export const collapsibleChevron =
  "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180 motion-reduce:transition-none";

export const shimmerText =
  "bg-[linear-gradient(90deg,var(--muted-foreground)_25%,var(--foreground)_50%,var(--muted-foreground)_75%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-safe:animate-shimmer";

export const popupSurface =
  "origin-[var(--transform-origin)] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none";

export const modalBackdrop =
  "fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none";

/** Centered modal dialog surface. */
export const modalPopup =
  "fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-xl outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none";

export const tooltipPopup =
  "origin-[var(--transform-origin)] rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[instant]:duration-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-none";

export const editorFrame =
  "relative min-h-32 overflow-hidden rounded-lg border border-border bg-code-background text-code-foreground";

/** Text-field surface shared by inputs; Base UI Field marks invalid controls with data-invalid. */
export const input =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-[invalid]:border-destructive";

export const button =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

export const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  destructive: "border border-destructive/50 bg-background text-destructive hover:bg-destructive/10",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Tinted surface whose text stays at full contrast; pair with toneIcon for the colored glyph. */
export const toneSurface: Record<Tone, string> = {
  neutral: "border-border bg-muted/50",
  info: "border-ring/40 bg-accent/60",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/50 bg-warning/10",
  danger: "border-destructive/40 bg-destructive/10",
};

export const toneIcon: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  info: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-ring",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export const badge =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3";

export const card = "rounded-lg border border-border bg-card text-card-foreground";

/** Base UI Tabs.List and Tabs.Tab as a compact pill toggle; pair the tab with focusRing. */
export const tabList = "flex gap-1 self-start rounded-lg bg-muted p-0.5";
export const tabTrigger = "h-7 rounded-md px-3 text-xs font-medium text-muted-foreground data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm";

/** Base UI Switch.Root and Switch.Thumb surfaces. */
export const switchRoot = "flex h-5 w-9 shrink-0 rounded-full bg-muted-foreground/40 p-0.5 transition-colors data-[checked]:bg-primary data-[disabled]:opacity-50";
export const switchThumb = "size-4 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-4 motion-reduce:transition-none";
