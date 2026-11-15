// packages/ai-ui/src/lib/secrets.ts
/** Well-known credential formats, matched anywhere in text. */
const TOKEN_PATTERNS = [
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{40,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bsb_secret_[A-Za-z0-9_-]{16,}/g,
  /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /(?<=[a-z][a-z0-9+.-]*:\/\/[^:/\s@]+:)[^@\s/]+(?=@)/gi,
];

/** Values assigned to names that look sensitive: API_KEY=..., "password": "...", token: ... */
const ASSIGNMENT = /\b([A-Za-z0-9_.-]*(?:secret|token|passw(?:or)?d|pwd|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?secret|auth)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*["']?([^\s"'`,;#}]{4,})/gi;

/** Character ranges of likely secrets in `text`, sorted and merged. */
export function findSecretRanges(text: string): Array<[start: number, end: number]> {
  const ranges: Array<[number, number]> = [];
  for (const pattern of TOKEN_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) ranges.push([match.index, match.index + match[0].length]);
  }
  ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(ASSIGNMENT)) {
    const value = match[2]!;
    if (/^(?:true|false|null|undefined|none|\$\{.*\}|process\.env.*|<.*>|\*+|x+)$/i.test(value)) continue;
    const start = match.index + match[0].length - value.length;
    ranges.push([start, start + value.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** Replaces likely secrets with a fixed mask, e.g. for logs and previews. */
export function maskSecrets(text: string, mask = "••••••••"): string {
  let result = "";
  let cursor = 0;
  for (const [start, end] of findSecretRanges(text)) {
    result += text.slice(cursor, start) + mask;
    cursor = end;
  }
  return result + text.slice(cursor);
}

/** True when text has NUL bytes or mostly control characters, as decoded binary files do. */
export function looksBinary(text: string, sample = 8000): boolean {
  const head = text.slice(0, sample);
  if (!head) return false;
  if (head.includes("\u0000")) return true;
  let control = 0;
  for (let index = 0; index < head.length; index++) {
    const code = head.charCodeAt(index);
    if ((code < 9 || (code > 13 && code < 32)) && code !== 27) control++;
  }
  return control / head.length > 0.1;
}
