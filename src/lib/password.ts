// packages/ai-ui/src/lib/password.ts
export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const defaultPasswordRules: PasswordRule[] = [
  { id: "length", label: "At least 12 characters", test: (password) => [...password].length >= 12 },
  { id: "lower", label: "A lowercase letter", test: (password) => /\p{Ll}/u.test(password) },
  { id: "upper", label: "An uppercase letter", test: (password) => /\p{Lu}/u.test(password) },
  { id: "number", label: "A number", test: (password) => /\p{Nd}/u.test(password) },
  { id: "symbol", label: "A symbol", test: (password) => /[^\p{L}\p{Nd}\s]/u.test(password) },
];

export interface PasswordScore {
  /** 0 for empty, otherwise 1 (very weak) to 5 (strong). */
  score: number;
  label: string;
  passed: string[];
  warnings: string[];
}

const COMMON = new Set([
  "password", "123456", "12345678", "123456789", "qwerty", "qwertyuiop", "letmein", "admin", "welcome", "iloveyou", "monkey", "dragon", "football", "baseball",
  "abc123", "111111", "sunshine", "princess", "master", "shadow", "trustno1", "login", "starwars", "whatever", "freedom", "superman", "hello", "secret", "changeme",
]);

const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

const LABELS = ["", "Very weak", "Weak", "Fair", "Good", "Strong"];

function hasSequence(password: string, length = 4): boolean {
  const lower = password.toLowerCase();
  for (const sequence of SEQUENCES) {
    const reversed = [...sequence].reverse().join("");
    for (let start = 0; start + length <= sequence.length; start++) {
      if (lower.includes(sequence.slice(start, start + length)) || lower.includes(reversed.slice(start, start + length))) return true;
    }
  }
  return false;
}

const unleet = (text: string) => [...text].map((character) => LEET[character] ?? character).join("");

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  const stripped = lower.replace(/[\d\W_]+$/u, "").replace(/^[\d\W_]+/u, "");
  return [lower, stripped, unleet(lower), unleet(stripped)].some((candidate) => candidate.length > 0 && COMMON.has(candidate));
}

/**
 * Scores a password by the rules it passes, then caps the score for patterns
 * that make passwords easy to guess: common passwords (including leetspeak
 * and trailing digits), repeated characters and keyboard or alphabet runs.
 */
export function scorePassword(password: string, rules: PasswordRule[] = defaultPasswordRules): PasswordScore {
  if (!password) return { score: 0, label: "", passed: [], warnings: [] };
  const passed = rules.filter((rule) => rule.test(password)).map((rule) => rule.id);
  const scale = rules.length ? 5 / rules.length : 1;
  let score = Math.max(1, Math.round(passed.length * scale));
  const warnings: string[] = [];
  if (isCommon(password)) {
    warnings.push("This is a commonly used password.");
    score = 1;
  }
  if (/(.)\1{3,}/u.test(password)) {
    warnings.push("Avoid repeating the same character.");
    score = Math.min(score, 2);
  }
  if (hasSequence(password)) {
    warnings.push("Avoid sequences like 1234 or qwer.");
    score = Math.min(score, 3);
  }
  return { score, label: LABELS[score] ?? "", passed, warnings };
}

export interface GeneratePasswordOptions {
  length?: number;
  lowercase?: boolean;
  uppercase?: boolean;
  digits?: boolean;
  symbols?: boolean;
  /** Leaves out characters that are easy to misread (0, O, 1, l, I). */
  excludeAmbiguous?: boolean;
}

const SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
};

const AMBIGUOUS = /[0O1lI]/g;

/** Unbiased random integer in [0, max) from the platform CSPRNG. */
function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0]!;
    if (value < limit) return value % max;
  }
}

/** Random password with at least one character from every enabled set, shuffled with the CSPRNG. */
export function generatePassword({ length = 20, lowercase = true, uppercase = true, digits = true, symbols = true, excludeAmbiguous = true }: GeneratePasswordOptions = {}): string {
  const enabled = Object.entries({ lowercase, uppercase, digits, symbols })
    .filter(([, on]) => on)
    .map(([name]) => {
      const set = SETS[name as keyof typeof SETS];
      return excludeAmbiguous ? set.replace(AMBIGUOUS, "") : set;
    });
  if (enabled.length === 0) throw new Error("Enable at least one character set");
  const size = Math.max(length, enabled.length);
  const all = enabled.join("");
  const characters = enabled.map((set) => set[randomIndex(set.length)]!);
  while (characters.length < size) characters.push(all[randomIndex(all.length)]!);
  for (let index = characters.length - 1; index > 0; index--) {
    const swap = randomIndex(index + 1);
    [characters[index], characters[swap]] = [characters[swap]!, characters[index]!];
  }
  return characters.join("");
}
