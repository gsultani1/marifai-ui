// packages/ai-ui/src/lib/format.ts
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit > 0 && value < 10 ? value.toFixed(1) : Math.round(value)} ${BYTE_UNITS[unit]}`;
}

export function fileExtension(name: string | undefined): string {
  const match = name ? /\.([a-z0-9]+)$/i.exec(name) : null;
  return match?.[1]?.toLowerCase() ?? "";
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "just now", "5 minutes ago", "in 2 hours". */
export function formatRelativeTime(value: Date | number, now: Date | number = Date.now(), locale?: string): string {
  const seconds = Math.round((new Date(value).getTime() - new Date(now).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (Math.abs(seconds) < 45) return "just now";
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(Math.round(seconds / 60), "minute");
}

/** Elapsed time as "8s", "1m 05s" or "2h 03m". */
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "";
  const total = Math.floor(milliseconds / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** 950 → "950", 1200 → "1.2K", 1048576 → "1M". */
export function formatCompactNumber(value: number, locale?: string): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Money or credits: formatAmount(12.5, "USD") → "$12.50"; formatAmount(1200, "credits") → "1,200 credits".
 * Any ISO 4217 code is formatted as currency; other units are appended as words.
 */
export function formatAmount(value: number, unit = "USD", locale?: string): string {
  if (!Number.isFinite(value)) return "";
  if (/^[A-Z]{3}$/.test(unit)) {
    return new Intl.NumberFormat(locale, { style: "currency", currency: unit, maximumFractionDigits: Math.abs(value) < 1 && value !== 0 ? 4 : 2 }).format(value);
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

/** Host name without "www." for showing where a link points; the input unchanged when it isn't a URL. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
