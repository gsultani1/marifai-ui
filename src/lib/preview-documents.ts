// packages/ai-ui/src/lib/preview-documents.ts
/** A self-contained preview document and what it needs; spread it into InteractivePreview. */
export interface PreviewDocument {
  html: string;
  allowedOrigins: string[];
  /** The document needs scripts to render. Spreading a preview document into InteractivePreview opts in to running them. */
  allowScripts: boolean;
  /** The document compiles WebAssembly or evaluates code at runtime. */
  allowEval?: boolean;
}

/**
 * A UTF-8 JavaScript data URL. Loading code by URL instead of inlining it
 * keeps the HTML parser from rewriting raw strings such as "</script>" or
 * ending the tag early.
 */
export function scriptDataUrl(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return `data:text/javascript;base64,${btoa(binary)}`;
}

/** Bare-specifier map preview documents use by default: React 19 from esm.sh. */
export const DEFAULT_PREVIEW_IMPORTS: Readonly<Record<string, string>> = {
  react: "https://esm.sh/react@19.3.1",
  "react/": "https://esm.sh/react@19.3.1/",
  "react-dom": "https://esm.sh/react-dom@19.3.1",
  "react-dom/": "https://esm.sh/react-dom@19.3.1/",
};
export const DEFAULT_BABEL_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@7.29.10/babel.min.js";
export const DEFAULT_PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";

/** JSON safe to place inside a script element. */
export function escapeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Reduces each entry to its http(s) origin and drops anything else. */
export function previewOrigins(values: readonly string[] | undefined): string[] {
  const origins = new Set<string>();
  for (const value of values ?? []) {
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
    } catch {
      continue;
    }
  }
  return [...origins];
}

export interface SvgPreviewOptions {
  background?: "checkerboard" | "white" | "transparent";
}

const SVG_BACKGROUNDS = {
  checkerboard: "background:repeating-conic-gradient(#e5e7eb 0 25%,#fff 0 50%) 0 0/16px 16px",
  white: "background:#fff",
  transparent: "background:transparent",
};

/**
 * A document that shows an SVG centered and scaled to fit. The image loads
 * through an img element, so scripts inside the SVG never run.
 */
export function createSvgPreview(svg: string, { background = "checkerboard" }: SvgPreviewOptions = {}): PreviewDocument {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;${SVG_BACKGROUNDS[background]}}img{max-width:100%;max-height:100vh}</style>
</head>
<body><img alt="" src="${escapeAttribute(src)}"></body>
</html>`;
  return { html, allowedOrigins: [], allowScripts: false };
}

export interface PythonPreviewOptions {
  pyodideUrl?: string;
  /** Pyodide packages to load before running, beyond those detected from imports. */
  packages?: string[];
}

/**
 * A document that runs Python in the preview with Pyodide (WebAssembly)
 * and prints stdout and stderr; exceptions also reach `onRuntimeError`.
 * It sets `allowEval`, which Pyodide needs.
 */
export function createPythonPreview(code: string, { pyodideUrl = DEFAULT_PYODIDE_URL, packages = [] }: PythonPreviewOptions = {}): PreviewDocument {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#fff;color:#111}#status{padding:6px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-family:system-ui,sans-serif}#out{margin:0;padding:12px;white-space:pre-wrap;word-break:break-word}.err{color:#b91c1c}</style>
<script src="${escapeAttribute(pyodideUrl)}"></script>
</head>
<body>
<div id="status" role="status">Loading Python…</div>
<pre id="out"></pre>
<script type="application/json" id="ai-ui-source">${escapeJson(code)}</script>
<script type="application/json" id="ai-ui-packages">${escapeJson(packages)}</script>
<script type="module">
const out = document.getElementById("out");
const status = document.getElementById("status");
const write = (text, error) => {
  const line = document.createElement("span");
  if (error) line.className = "err";
  line.textContent = text + "\\n";
  out.appendChild(line);
};
const source = JSON.parse(document.getElementById("ai-ui-source").textContent);
const packages = JSON.parse(document.getElementById("ai-ui-packages").textContent);
const started = performance.now();
try {
  const pyodide = await loadPyodide({ stdout: (text) => write(text), stderr: (text) => write(text, true) });
  status.textContent = "Loading packages…";
  if (packages.length) await pyodide.loadPackage(packages);
  await pyodide.loadPackagesFromImports(source);
  status.textContent = "Running…";
  const result = await pyodide.runPythonAsync(source);
  if (result !== undefined && result !== null) write(String(result));
  status.textContent = "Finished in " + ((performance.now() - started) / 1000).toFixed(1) + " s";
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  write(message, true);
  status.textContent = "Stopped with an error";
  console.error(message.trim().split("\\n").slice(-1)[0] || message);
}
</script>
</body>
</html>`;
  return { html, allowedOrigins: previewOrigins([pyodideUrl]), allowScripts: true, allowEval: true };
}

export interface ProjectPreviewOptions {
  /** HTML file to open; defaults to index.html, then the first HTML file, then a page that loads the main script. */
  entry?: string;
  /** Bare-specifier map, merged over React 19 from esm.sh. */
  imports?: Record<string, string>;
  /** Babel standalone build, loaded when the project has TypeScript or JSX. */
  babelUrl?: string;
  allowedOrigins?: readonly string[];
}

const SCRIPT_EXTENSIONS = /\.(m?js|jsx|tsx?)$/;
const MODULE_EXTENSIONS = /\.(m?js|jsx|tsx?|json|css)$/;
const MAIN_CANDIDATES = ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js", "src/index.tsx", "src/index.jsx", "src/index.js", "main.tsx", "main.jsx", "main.js", "index.tsx", "index.jsx", "index.js", "app.js"];

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

/** Resolves a reference in an HTML or CSS file to a project path, or null for remote and data URLs. */
function resolveReference(from: string, reference: string): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) return null;
  const clean = reference.split(/[?#]/)[0] ?? "";
  if (clean.startsWith("/")) return normalizePath(clean);
  const base = from.split("/").slice(0, -1).join("/");
  return normalizePath(base ? `${base}/${clean}` : clean);
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function inlineCssUrls(css: string, from: string, files: Record<string, string>): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, _quote: string, reference: string) => {
    const path = resolveReference(from, reference);
    return path && path.endsWith(".svg") && path in files ? `url("${svgDataUrl(files[path]!)}")` : match;
  });
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find((value) => value !== undefined);
}

const LOADER = `const files = JSON.parse(document.getElementById("ai-ui-files").textContent);
const entries = JSON.parse(document.getElementById("ai-ui-entries").textContent);
const urls = new Map();
const SPECIFIER = /(\\bimport\\s*(?:[\\w*{}\\s,$]+\\sfrom\\s*)?|\\bexport\\s*(?:[\\w*{}\\s,$]+\\sfrom\\s*)|\\bimport\\s*\\(\\s*)(['"])([^'"\\n]+)\\2/g;
const resolve = (from, specifier) => {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;
  const parts = specifier.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop(); else parts.push(part);
  }
  const path = parts.join("/");
  for (const candidate of [path, path + ".tsx", path + ".ts", path + ".jsx", path + ".js", path + ".mjs", path + "/index.tsx", path + "/index.ts", path + "/index.jsx", path + "/index.js"]) {
    if (Object.prototype.hasOwnProperty.call(files, candidate)) return candidate;
  }
  throw new Error("Cannot find " + specifier + " imported by " + from);
};
const load = async (path, chain) => {
  if (urls.has(path)) return urls.get(path);
  if (chain.includes(path)) throw new Error("Circular import: " + chain.concat(path).join(" → "));
  let code = files[path];
  if (path.endsWith(".css")) {
    code = "const style = document.createElement('style'); style.textContent = " + JSON.stringify(code) + "; document.head.appendChild(style); export default " + JSON.stringify(code) + ";";
  } else if (path.endsWith(".json")) {
    code = "export default " + code + ";";
  } else {
    if (/\\.(tsx?|jsx)$/.test(path)) code = Babel.transform(code, { filename: path, presets: [["react", { runtime: "automatic" }], "typescript"] }).code;
    const targets = {};
    for (const match of code.matchAll(SPECIFIER)) {
      const target = resolve(path, match[3]);
      if (target) targets[match[3]] = await load(target, chain.concat(path));
    }
    code = code.replace(SPECIFIER, (match, before, quote, specifier) => (targets[specifier] ? before + quote + targets[specifier] + quote : match));
  }
  const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  urls.set(path, url);
  return url;
};
try {
  for (const entry of entries) await import(await load(entry, []));
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
}`;

/**
 * Bundles a multi-file web project into one preview document: stylesheets
 * and classic scripts are inlined, ES modules (including TypeScript and
 * JSX, compiled with Babel in the frame) load from blob URLs with relative
 * imports resolved between project files, CSS and JSON can be imported,
 * SVG references become data URLs and bare imports use an import map.
 */
export function createProjectPreview(files: Record<string, string>, options: ProjectPreviewOptions = {}): PreviewDocument {
  const project: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) project[normalizePath(path)] = content;
  const paths = Object.keys(project);
  const entryPath = options.entry ? normalizePath(options.entry) : paths.includes("index.html") ? "index.html" : paths.find((path) => path.endsWith(".html"));
  const main = MAIN_CANDIDATES.find((path) => path in project) ?? paths.find((path) => SCRIPT_EXTENSIONS.test(path));
  let page = entryPath && entryPath in project ? project[entryPath]! : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><div id="app"></div>${main ? `<script type="module" src="/${main}"></script>` : ""}</body></html>`;
  const from = entryPath ?? "index.html";
  const entries: string[] = [];

  page = page.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = attribute(tag, "href");
    const path = href ? resolveReference(from, href) : null;
    if (!/\brel\s*=\s*["']?stylesheet/i.test(tag) || !path || !(path in project)) return tag;
    return `<style data-file="${escapeAttribute(path)}">${inlineCssUrls(project[path]!, path, project).replace(/<\/style/gi, "<\\/style")}</style>`;
  });
  page = page.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attributes: string, body: string) => {
    const src = attribute(` ${attributes}`, "src");
    const path = src ? resolveReference(from, src) : null;
    if (!path || !(path in project)) return tag;
    if (/\btype\s*=\s*["']?module/i.test(attributes) || /\.(tsx?|jsx)$/.test(path)) {
      entries.push(path);
      return "";
    }
    return body.trim() ? tag : `<script src="${scriptDataUrl(project[path]!)}"></script>`;
  });
  page = page.replace(/(\s(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi, (match, before: string, quote: string, reference: string) => {
    const path = resolveReference(from, reference);
    return path && path.endsWith(".svg") && path in project ? `${before}${quote}${svgDataUrl(project[path]!)}${quote}` : match;
  });

  const modules: Record<string, string> = {};
  for (const path of paths) if (MODULE_EXTENSIONS.test(path)) modules[path] = project[path]!;
  const needsBabel = paths.some((path) => /\.(tsx?|jsx)$/.test(path));
  const imports = { ...DEFAULT_PREVIEW_IMPORTS, ...options.imports };
  const babelUrl = options.babelUrl ?? DEFAULT_BABEL_URL;
  const head = `<script type="importmap">${escapeJson({ imports })}</script>${needsBabel && entries.length ? `<script src="${escapeAttribute(babelUrl)}"></script>` : ""}`;
  const loader = entries.length
    ? `<script type="application/json" id="ai-ui-files">${escapeJson(modules)}</script><script type="application/json" id="ai-ui-entries">${escapeJson(entries)}</script><script type="module">${LOADER}</script>`
    : "";
  page = /<head(?:\s[^>]*)?>/i.test(page) ? page.replace(/<head(?:\s[^>]*)?>/i, (tag) => tag + head) : head + page;
  page = /<\/body>/i.test(page) ? page.replace(/<\/body>/i, `${loader}</body>`) : page + loader;
  const allowedOrigins = previewOrigins([...Object.values(imports), ...(needsBabel && entries.length ? [babelUrl] : []), ...(options.allowedOrigins ?? [])]);
  return { html: page, allowedOrigins, allowScripts: true };
}
