// packages/ai-ui/scripts/check-css.mjs
// Compiles the preset with the Tailwind CSS v4 CLI, with automatic source
// detection disabled, to prove the preset's @source picks up the component
// classes and its @theme tokens resolve.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(root, '.css-check-'));

const EXPECTED = [
  '.bg-code-background',
  '.text-code-keyword',
  'color: var(--code-keyword)',
  '.text-success',
  '.text-warning',
  '@keyframes ai-shimmer',
  '--collapsible-panel-height',
  '[data-role="user"]',
  '[data-panel-open]',
  '--code-keyword: oklch(',
  '--ansi-yellow: oklch(',
  '.xterm-helper-textarea',
];

try {
  const input = join(work, 'input.css');
  const output = join(work, 'output.css');
  writeFileSync(input, '@import "tailwindcss" source(none);\n@import "../src/styles/preset.css";\n');
  execFileSync(process.execPath, [join(root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'), '-i', input, '-o', output], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const css = readFileSync(output, 'utf8');
  const missing = EXPECTED.filter((needle) => !css.includes(needle));
  if (missing.length > 0) {
    console.error(`preset check failed; missing from compiled CSS: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`preset check passed: ${EXPECTED.length} expectations, ${css.length} bytes of CSS`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
