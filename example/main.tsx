// packages/ai-ui/example/main.tsx
import "./style.css";

import { MoonIcon, SunIcon } from "lucide-react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { focusRing } from "../src/lib/classes.js";
import { cn } from "../src/lib/cn.js";
import { Toaster } from "../src/index.js";
import { ChatDemo } from "./chat.js";
import { DocumentationSite, MARIFAI_URL, MarifaiWordmark } from "./docs.js";
import { GalleryDemo } from "./gallery.js";
import { WorkbenchDemo } from "./workbench.js";
import { WorkspaceDemo } from "./workspace.js";

const PAGES = {
  chat: { title: "Chat", href: "#chat" },
  workbench: { title: "Workbench", href: "#workbench" },
  workspace: { title: "Workspace", href: "#workspace" },
  gallery: { title: "Gallery", href: "#gallery" },
} as const;

type Page = keyof typeof PAGES;

function pageFromHash(): Page | "docs" {
  if (location.hash === "#workbench") return "workbench";
  if (location.hash === "#workspace") return "workspace";
  if (location.hash.startsWith("#gallery")) return "gallery";
  if (location.hash === "#chat") return "chat";
  return "docs";
}

/** Follows a host-set data-theme first, then the system preference. */
function initialDark(): boolean {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function App() {
  const [page, setPage] = useState(pageFromHash);
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const toggleTheme = () => setDark(!dark);
  if (page === "docs") return <DocumentationSite dark={dark} onToggleTheme={toggleTheme} />;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 sm:gap-4">
        <a href="#" aria-label="Marifai UI home" className={cn("shrink-0 rounded-sm", focusRing)}><MarifaiWordmark dark={dark} /></a>
        <nav aria-label="Demos" className="flex min-w-0 gap-1 overflow-x-auto text-sm">
          <a href={MARIFAI_URL} aria-label="Marifai main site" className={cn(
            "shrink-0 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            focusRing,
          )}>Main site</a>
          {(Object.keys(PAGES) as Page[]).map((key) => (
            <a
              key={key}
              href={PAGES[key].href}
              aria-current={page === key ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
                focusRing,
              )}
            >
              {PAGES[key].title}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            "ml-auto inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-sm hover:bg-accent [&_svg]:size-4",
            focusRing,
          )}
        >
          {dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}
          <span className="max-sm:sr-only">{dark ? "Use light theme" : "Use dark theme"}</span>
        </button>
      </header>
      <main className="min-h-0 flex-1">
        {page === "workbench" && <WorkbenchDemo />}
        {page === "workspace" && <WorkspaceDemo />}
        {page === "gallery" && <GalleryDemo />}
        {page === "chat" && <ChatDemo />}
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster>
      <App />
    </Toaster>
  </StrictMode>,
);
