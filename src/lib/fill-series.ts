// packages/ai-ui/src/lib/fill-series.ts
const DAY_NAMES = [
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
];

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMBERED = /^(.*?)(\d+)(\D*)$/;

const decimals = (value: string) => (value.includes(".") ? value.split(".")[1]!.length : 0);

/** The common step when values form an arithmetic sequence, else undefined. */
function constantStep(values: number[]): number | undefined {
  if (values.length < 2) return undefined;
  const step = values[1]! - values[0]!;
  const tolerance = 1e-9 * Math.max(1, ...values.map(Math.abs));
  for (let index = 2; index < values.length; index++) {
    if (Math.abs(values[index]! - values[index - 1]! - step) > tolerance) return undefined;
  }
  return step;
}

function matchCase(word: string, sample: string): string {
  if (sample === sample.toUpperCase()) return word.toUpperCase();
  if (sample === sample.toLowerCase()) return word.toLowerCase();
  return word;
}

/**
 * Next `count` values after `values`, as a spreadsheet fill handle does:
 * arithmetic number series, ISO dates by day step, numbered text such as
 * "Item-007", day and month names; anything else repeats the pattern. A
 * single number repeats; a single date or numbered text counts up by one.
 */
export function inferFillSeries(values: readonly string[], count: number): string[] {
  if (values.length === 0 || count <= 0) return [];
  const repeat = () => Array.from({ length: count }, (_, index) => values[index % values.length]!);

  if (values.every((value) => NUMBER.test(value.trim()))) {
    const numbers = values.map(Number);
    const step = constantStep(numbers);
    if (step === undefined) return repeat();
    const places = Math.max(...values.map(decimals));
    return Array.from({ length: count }, (_, index) => {
      const next = numbers.at(-1)! + step * (index + 1);
      return places > 0 ? String(Number(next.toFixed(places))) : String(Math.round(next));
    });
  }

  if (values.every((value) => ISO_DATE.test(value))) {
    const days = values.map((value) => {
      const [, year, month, day] = ISO_DATE.exec(value)!;
      return Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000;
    });
    const step = values.length === 1 ? 1 : constantStep(days);
    if (step === undefined) return repeat();
    return Array.from({ length: count }, (_, index) => new Date((days.at(-1)! + step * (index + 1)) * 86_400_000).toISOString().slice(0, 10));
  }

  for (const names of DAY_NAMES) {
    const lower = names.map((name) => name.toLowerCase());
    const indexes = values.map((value) => lower.indexOf(value.toLowerCase()));
    if (indexes.every((index) => index !== -1)) {
      const step = values.length === 1 ? 1 : constantStep(indexes);
      if (step === undefined) return repeat();
      const sample = values.at(-1)!;
      return Array.from({ length: count }, (_, index) => {
        const position = (((indexes.at(-1)! + step * (index + 1)) % names.length) + names.length) % names.length;
        return matchCase(names[position]!, sample);
      });
    }
  }

  const parts = values.map((value) => NUMBERED.exec(value));
  if (parts.every(Boolean) && parts.every((part) => part![1] === parts[0]![1] && part![3] === parts[0]![3])) {
    const numbers = parts.map((part) => Number(part![2]));
    const step = values.length === 1 ? 1 : constantStep(numbers);
    if (step === undefined) return repeat();
    const width = Math.max(...parts.map((part) => (part![2]!.startsWith("0") ? part![2]!.length : 0)));
    return Array.from({ length: count }, (_, index) => {
      const next = Math.max(0, numbers.at(-1)! + step * (index + 1));
      return `${parts[0]![1]}${String(next).padStart(width, "0")}${parts[0]![3]}`;
    });
  }

  return repeat();
}
