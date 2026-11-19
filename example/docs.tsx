// packages/ai-ui/example/docs.tsx
import "./docs.css";

import {
  ArrowDownIcon, ArrowRightIcon, ArrowUpRightIcon, BookOpenIcon, BoxesIcon, BracesIcon,
  CheckIcon, ChevronRightIcon, Code2Icon, Columns2Icon, FileCode2Icon, FlaskConicalIcon, GitCompareArrowsIcon,
  LayoutGridIcon, MessageSquareIcon, MoonIcon, PackageIcon, SearchIcon, SendIcon,
  SparklesIcon, SunIcon, TerminalIcon, WorkflowIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  Button, CodeBlock, CopyButton, Dialog, DialogContent, DialogTitle, DiffView, Message,
  Progress, StatusPill, Tabs, TabsContent, TabsList, TabsTrigger,
} from "../src/index.js";
import { CATEGORIES, catalog, featured, INSTALL, PACKAGE, PRESET, searchCatalog, type CatalogEntry, type Category } from "./docs-catalog.js";

const NPM_URL = "https://www.npmjs.com/package/" + PACKAGE;
export const MARIFAI_URL = "https://www.marifai.com/";
const PAGE_SIZE = 30;
const LOGO_LIGHT = new URL("../brand/logos/logo-horizontal.svg", import.meta.url).href;
const LOGO_DARK = new URL("../brand/logos/logo-horizontal-dark.svg", import.meta.url).href;
const FONT_LICENSES = [
  ["Inter", new URL("../brand/fonts/OFL-Inter.txt", import.meta.url).href],
  ["Jost", new URL("../brand/fonts/OFL-Jost.txt", import.meta.url).href],
  ["JetBrains Mono", new URL("../brand/fonts/OFL-JetBrainsMono.txt", import.meta.url).href],
] as const;

export function MarifaiWordmark({ dark }: { dark: boolean }) {
  return <span className="marifai-wordmark" aria-hidden="true">
    <img src={dark ? LOGO_DARK : LOGO_LIGHT} alt="" width={1121} height={166} />
    <span>UI</span>
  </span>;
}

const categoryIcons = {
  "AI & Chat": MessageSquareIcon,
  "Agents & Tools": WorkflowIcon,
  "Editors & Files": FileCode2Icon,
  Browser: Columns2Icon,
  "Tasks & Automation": CheckIcon,
  "Forms & Controls": BracesIcon,
  Foundations: BoxesIcon,
  Experimental: FlaskConicalIcon,
} satisfies Record<Category, typeof BoxesIcon>;

type Route =
  | { type: "home" }
  | { type: "docs" }
  | { type: "catalog" }
  | { type: "component"; id: string };

function currentRoute(): Route {
  const hash = window.location.hash;
  if (hash === "#docs" || hash === "#docs/install") return { type: "docs" };
  if (hash === "#components") return { type: "catalog" };
  if (hash.startsWith("#components/")) return { type: "component", id: hash.slice("#components/".length) };
  return { type: "home" };
}

function componentHref(entry: CatalogEntry) {
  return "#components/" + entry.id;
}

function SiteHeader({ route, dark, onToggleTheme, onSearch }: {
  route: Route; dark: boolean; onToggleTheme: () => void; onSearch: () => void;
}) {
  return (
    <header className="docs-header">
      <div className="docs-wrap docs-header-inner">
        <a href="#" className="docs-brand" aria-label="Marifai UI home">
          <MarifaiWordmark dark={dark} />
        </a>
        <nav aria-label="Main navigation" className="docs-top-nav">
          <a href="#docs" aria-current={route.type === "docs" ? "page" : undefined}>Docs</a>
          <a href="#components" aria-current={route.type === "catalog" || route.type === "component" ? "page" : undefined}>Components</a>
          <a href="#gallery">Playground</a>
          <a href={MARIFAI_URL} aria-label="Marifai main site" className="docs-main-site">
            Main site <ArrowUpRightIcon size={13} aria-hidden="true" />
          </a>
        </nav>
        <div className="docs-header-actions">
          <button type="button" className="docs-search-trigger" onClick={onSearch} aria-label="Search components" aria-keyshortcuts="Control+k Meta+k">
            <SearchIcon size={15} aria-hidden="true" />
            <span>Search components</span>
            <kbd>Ctrl K</kbd>
          </button>
          <a href={NPM_URL} className="docs-icon-button" aria-label="Package on npm" title="Package on npm"><PackageIcon size={17} aria-hidden="true" /></a>
          <button type="button" className="docs-icon-button" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={onToggleTheme}>
            {dark ? <SunIcon size={17} aria-hidden="true" /> : <MoonIcon size={17} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function ComponentSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const results = (query.trim() ? searchCatalog(query) : featured).slice(0, 10);

  function close() {
    onOpenChange(false);
    setQuery("");
  }

  function openTop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results[0]) {
      window.location.hash = componentHref(results[0]);
      close();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (next) onOpenChange(true); else close(); }}>
      <DialogContent size="lg" initialFocus={input} className="docs-search-panel">
        <DialogTitle>Search components</DialogTitle>
        <form onSubmit={openTop} className="docs-search-form">
          <SearchIcon size={17} aria-hidden="true" />
          <input ref={input} type="search" aria-label="Component name" placeholder="Search by name or category"
            value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          <button type="submit" tabIndex={-1} className="sr-only">Open first result</button>
        </form>
        <div className="docs-search-results">
          {results.map((entry) => <a href={componentHref(entry)} key={entry.id} onClick={close}>
            <span>{entry.name}</span><small>{entry.category}</small><ArrowRightIcon size={15} aria-hidden="true" />
          </a>)}
          {results.length === 0 && <p className="docs-empty">No matching components.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InstallLine() {
  return (
    <div className="docs-install-line">
      <TerminalIcon size={16} aria-hidden="true" />
      <code>{INSTALL}</code>
      <CopyButton value={INSTALL} label="Copy install command" size="sm" aria-label="Copy install command" />
    </div>
  );
}

function HeroPreview() {
  const [prompt, setPrompt] = useState("");
  const [turn, setTurn] = useState<{ prompt: string; answer: string } | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (turn && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [turn]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    const entry = searchCatalog(text)[0];
    setTurn({
      prompt: text,
      answer: entry
        ? `Try ${entry.name} from the ${entry.category} collection.`
        : "Try a component name like Message, ActionApproval, or DiffView. This preview searches the local catalog.",
    });
    setPrompt("");
  }

  return (
    <div className="docs-stage">
      <div className="docs-demo">
        <div className="docs-demo-header">
          <span className="docs-demo-icon"><SparklesIcon size={17} aria-hidden="true" /></span>
          <div><strong>Project assistant</strong><small>Interactive preview</small></div>
          <StatusPill tone="success" className="ml-auto">Ready</StatusPill>
        </div>
        <Tabs defaultValue="chat" variant="underline" className="docs-demo-tabs">
          <TabsList aria-label="Preview examples">
            <TabsTrigger value="chat"><MessageSquareIcon size={14} aria-hidden="true" /> Chat</TabsTrigger>
            <TabsTrigger value="diff"><GitCompareArrowsIcon size={14} aria-hidden="true" /> Diff</TabsTrigger>
            <TabsTrigger value="run"><WorkflowIcon size={14} aria-hidden="true" /> Run status</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" keepMounted="visited">
            <div ref={scrollArea} role="log" aria-label="Preview conversation" className="docs-demo-log">
              <Message from="user"><p className="docs-sample-user">{turn?.prompt ?? "Show me the changes to the landing page."}</p></Message>
              <Message from="assistant" className="docs-sample-answer">
                <span className="docs-message-icon"><SparklesIcon size={15} aria-hidden="true" /></span>
                <div>
                  <p>{turn?.answer ?? "I updated the headline and prepared the changes for review."}</p>
                  {!turn && <a href="#components/diff-view" className="docs-demo-file"><FileCode2Icon size={14} aria-hidden="true" /> app/page.tsx
                    <span><b>+3</b> <em>−1</em></span></a>}
                </div>
              </Message>
            </div>
            <form className="docs-preview-composer" onSubmit={send}>
              <input value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} maxLength={180}
                placeholder="Look up a component…" aria-label="Look up a component in the preview" />
              <Button type="submit" size="icon" aria-label="Send preview message" disabled={!prompt.trim()}><SendIcon size={15} aria-hidden="true" /></Button>
            </form>
          </TabsContent>
          <TabsContent value="diff" className="docs-demo-other">
            <DiffView oldValue={'<h1>Welcome</h1>\n<p>Find out more.</p>'} newValue={'<h1>Fieldwork Studio</h1>\n<p>Architecture shaped by place.</p>'} />
            <a href="#components/diff-view">Open DiffView <ArrowRightIcon size={14} aria-hidden="true" /></a>
          </TabsContent>
          <TabsContent value="run" className="docs-demo-other">
            <div className="docs-run-preview">
              <Progress label="Preparing release" value={75} />
              <ul><li><CheckIcon size={14} aria-hidden="true" /> Build passed</li><li><CheckIcon size={14} aria-hidden="true" /> Types checked</li>
                <li><StatusPill tone="warning">Review pending</StatusPill></li></ul>
            </div>
            <a href="#components/action-approval">Open ActionApproval <ArrowRightIcon size={14} aria-hidden="true" /></a>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ComponentLink({ entry }: { entry: CatalogEntry }) {
  const Icon = categoryIcons[entry.category];
  return (
    <a className="docs-component-card" href={componentHref(entry)}>
      <span className="docs-component-icon"><Icon size={17} aria-hidden="true" /></span>
      <span className="docs-component-name">{entry.name}</span>
      <ArrowUpRightIcon className="docs-card-arrow" size={15} aria-hidden="true" />
      <span className="docs-component-description">{entry.example?.description ?? entry.category}</span>
    </a>
  );
}

function Home() {
  return <>
    <section className="docs-wrap docs-hero">
      <div className="docs-hero-copy">
        <a className="docs-package" href={NPM_URL}><PackageIcon size={14} aria-hidden="true" /> {PACKAGE} <ArrowUpRightIcon size={13} aria-hidden="true" /></a>
        <h1>Build better<br />AI interfaces.</h1>
        <p>Composable React components for chat, agents, editors, and the screens they work in.</p>
        <div className="docs-hero-actions">
          <a className="docs-primary" href="#docs">Get started <ArrowRightIcon size={16} aria-hidden="true" /></a>
          <a className="docs-secondary" href="#components">Browse components</a>
        </div>
        <InstallLine />
      </div>
      <HeroPreview />
    </section>
    <section className="docs-wrap docs-home-catalog" aria-labelledby="featured-components">
      <div className="docs-section-heading">
        <div><h2 id="featured-components">Explore the components</h2><p>Start with a live example or explore all {catalog.length} component modules.</p></div>
        <a className="docs-text-link" href="#components">View catalog <ArrowRightIcon size={16} aria-hidden="true" /></a>
      </div>
      <div className="docs-card-grid">{featured.slice(0, 8).map((entry) => <ComponentLink key={entry.id} entry={entry} />)}</div>
    </section>
  </>;
}

function Sidebar({ route }: { route: Route }) {
  return (
    <aside className="docs-sidebar">
      <nav aria-label="Documentation navigation">
        <span className="docs-sidebar-heading">Getting started</span>
        <a href="#docs" aria-current={route.type === "docs" ? "page" : undefined}><BookOpenIcon size={15} aria-hidden="true" /> Installation</a>
        <a href="#components" aria-current={route.type === "catalog" ? "page" : undefined}><LayoutGridIcon size={15} aria-hidden="true" /> All components</a>
        <span className="docs-sidebar-heading docs-sidebar-heading-spaced">Live examples</span>
        {featured.map((entry) => <a key={entry.id} href={componentHref(entry)}
          aria-current={route.type === "component" && route.id === entry.id ? "page" : undefined}>{entry.name}</a>)}
        <a className="docs-sidebar-playground" href="#gallery">Open playground <ArrowUpRightIcon size={14} aria-hidden="true" /></a>
      </nav>
    </aside>
  );
}

function InstallDocs() {
  return (
    <article className="docs-article">
      <div className="docs-crumb">Docs <ChevronRightIcon size={14} aria-hidden="true" /> Installation</div>
      <h1>Installation</h1>
      <p className="docs-description">Add Marifai UI to a React 19 project with Tailwind CSS 4.</p>
      <section><h2>Install the package</h2><p>Run this in your app’s directory.</p><CodeBlock code={INSTALL} language="bash" title="Terminal" /></section>
      <section><h2>Load the preset</h2><p>Include the preset in your global Tailwind stylesheet to load component styles and theme tokens.</p>
        <CodeBlock code={PRESET} language="css" title="app.css" /></section>
      <section><h2>Import a component</h2><p>Import from the package root or use a component’s direct subpath.</p>
        <CodeBlock code={`import { Button } from "${PACKAGE}";\n\nexport function Example() {\n  return <Button>Continue</Button>;\n}`} language="tsx" title="Example.tsx" />
        <div className="docs-inline-links"><a className="docs-text-link" href="#components">Browse components <ArrowRightIcon size={15} aria-hidden="true" /></a>
          <a className="docs-text-link" href={NPM_URL}>View npm package <ArrowUpRightIcon size={15} aria-hidden="true" /></a></div>
      </section>
    </article>
  );
}

function CatalogPage() {
  const [filter, setFilter] = useState<Category | "All">("All");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const results = searchCatalog(query).filter((entry) => filter === "All" || filter === entry.category);
  return (
    <section className="docs-article">
      <div className="docs-crumb">Docs <ChevronRightIcon size={14} aria-hidden="true" /> Components</div>
      <h1>Components</h1>
      <p className="docs-description">Browse the React components exported by Marifai UI.</p>
      <div className="docs-catalog-controls">
        <label className="docs-catalog-query"><SearchIcon size={17} aria-hidden="true" />
          <input type="search" aria-label="Filter components" placeholder="Filter by component name…" value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setLimit(PAGE_SIZE); }} />
        </label>
        <div className="docs-filters" aria-label="Component categories">
          {(["All", ...CATEGORIES] as const).map((category) => <button type="button" key={category} aria-pressed={category === filter}
            onClick={() => { setFilter(category); setLimit(PAGE_SIZE); }}>{category}</button>)}
        </div>
      </div>
      <p className="docs-result-count" role="status">{results.length} {results.length === 1 ? "component" : "components"}</p>
      {results.length > 0 ? <div className="docs-card-grid">{results.slice(0, limit).map((entry) => <ComponentLink entry={entry} key={entry.id} />)}</div>
        : <div className="docs-empty"><p>No components match this search.</p>
          <Button variant="outline" onClick={() => { setFilter("All"); setQuery(""); }}>Clear search</Button></div>}
      {results.length > limit && <button type="button" className="docs-secondary docs-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
        Show more <ArrowDownIcon size={15} aria-hidden="true" />
      </button>}
    </section>
  );
}

function ComponentDocs({ id }: { id: string }) {
  const entry = catalog.find((item) => item.id === id);
  if (!entry) return <article className="docs-article"><h1>Component unavailable</h1>
    <p className="docs-description">Browse the catalog for current exports.</p><a className="docs-text-link" href="#components">Open the catalog</a></article>;

  const symbols = id === "tabs" ? ["Tabs", "TabsList", "TabsTrigger", "TabsContent"] : [entry.name];
  const example = entry.example;
  const rootImport = `import { ${symbols.join(", ")} } from "${PACKAGE}${entry.experimental ? "/experimental" : ""}";`;
  const directImports = entry.names.map(({ local, exported }) => local === exported ? local : `${local} as ${exported}`);
  const directImport = `import { ${directImports.join(", ")} } from "${PACKAGE}/${entry.experimental ? "experimental" : "components"}/${entry.id}";`;

  return (
    <article className="docs-article docs-detail">
      <div className="docs-crumb"><a href="#components">Components</a> <ChevronRightIcon size={14} aria-hidden="true" /> {entry.category}</div>
      <h1>{entry.name}</h1>
      {entry.experimental && <p className="docs-description">Experimental: not yet covered by tests or examples. Its name, props and behavior can change in any release.</p>}
      {example && <p className="docs-description">{example.description}</p>}
      {example?.render && <section className="docs-detail-demo">
        <Tabs defaultValue="preview" variant="underline">
          <TabsList aria-label={entry.name + " examples"}>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code"><Code2Icon size={15} aria-hidden="true" /> Code</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" keepMounted="visited"><div className="docs-detail-render">{example.render()}</div></TabsContent>
          <TabsContent value="code"><CodeBlock language="tsx" code={rootImport + "\n\n" + example.code} /></TabsContent>
        </Tabs>
      </section>}
      {example?.href && <a className="docs-demo-link" href={example.href}><span className="docs-component-icon"><Columns2Icon size={18} aria-hidden="true" /></span>
        <span><strong>Try the editor</strong><small>Chat, drag blocks, and review a change in the playground.</small></span>
        <ArrowRightIcon size={19} aria-hidden="true" /></a>}
      <section><h2>Import</h2><CodeBlock code={rootImport} language="tsx" title="Package import" />
        {example?.code && !example.render && <CodeBlock code={example.code} language="tsx" title="Usage" />}</section>
      <section><h2>Direct import</h2><CodeBlock code={directImport} language="tsx" title={entry.id} /></section>
      <a href="#components" className="docs-text-link">Back to the catalog <ArrowRightIcon size={15} aria-hidden="true" /></a>
    </article>
  );
}

export function DocumentationSite({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const [route, setRoute] = useState(currentRoute);
  const [search, setSearch] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function navigate() {
      setRoute(currentRoute());
      if (page.current) page.current.scrollTop = 0;
    }
    function shortcuts(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearch(true);
      }
    }
    window.addEventListener("hashchange", navigate);
    window.addEventListener("keydown", shortcuts);
    return () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener("keydown", shortcuts);
    };
  }, []);

  return (
    <div className="docs-site" ref={page}>
      <a className="docs-skip" href="#documentation-main" onClick={(event) => {
        event.preventDefault();
        document.getElementById("documentation-main")?.focus();
      }}>Skip to content</a>
      <SiteHeader route={route} dark={dark} onToggleTheme={onToggleTheme} onSearch={() => setSearch(true)} />
      <main id="documentation-main" tabIndex={-1} className={route.type === "home" ? "docs-main" : "docs-main docs-wrap docs-layout"}>
        {route.type === "home" ? <Home /> : <>
          <Sidebar route={route} />
          {route.type === "docs" && <InstallDocs />}
          {route.type === "catalog" && <CatalogPage />}
          {route.type === "component" && <ComponentDocs id={route.id} />}
        </>}
      </main>
      <footer className="docs-footer"><div className="docs-wrap">
        <a href="#" className="docs-brand" aria-label="Marifai UI"><MarifaiWordmark dark={dark} /></a>
        <a href="#docs">Documentation</a><a href="#gallery">Playground</a><a href={NPM_URL}>npm <ArrowUpRightIcon size={13} aria-hidden="true" /></a>
        <details className="docs-font-licenses"><summary>Font licenses</summary>
          <ul>{FONT_LICENSES.map(([name, url]) => <li key={name}><a href={url}>{name}</a></li>)}</ul>
        </details>
      </div></footer>
      <ComponentSearch open={search} onOpenChange={setSearch} />
    </div>
  );
}
