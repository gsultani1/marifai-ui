// packages/ai-ui/src/components/docs-viewer.tsx
"use client";

import { FileTextIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { extractHeadings } from "../lib/docs.js";
import { MessageContent } from "./message-content.js";
import { StatusPill } from "./status-pill.js";

export interface DocPage {
  id: string;
  title: string;
  /** Markdown. */
  content: string;
  /** Still being written. */
  generating?: boolean;
}

export interface DocsViewerProps {
  pages: DocPage[];
  activeId?: string;
  defaultActiveId?: string;
  onActiveChange?: (id: string) => void;
  /** Heading depth listed under "On this page". */
  tocDepth?: number;
  label?: string;
  className?: string;
}

const ID_PREFIX = "doc-";

/**
 * Generated documentation reader: a page list, the page rendered as
 * markdown, an "On this page" outline that tracks the section in view and
 * jumps on click, and a Generating badge while pages stream in.
 */
export function DocsViewer({ pages, activeId: activeProp, defaultActiveId, onActiveChange, tocDepth = 3, label = "Documentation", className }: DocsViewerProps) {
  const [activeId, setActiveId] = useControllableState({ value: activeProp, defaultValue: defaultActiveId ?? pages[0]?.id ?? "", onChange: onActiveChange });
  const [current, setCurrent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clicked = useRef<string | null>(null);
  const page = pages.find((item) => item.id === activeId) ?? pages[0];
  const headings = page ? extractHeadings(page.content, tocDepth) : [];
  const selector = Array.from({ length: tocDepth }, (_, index) => `h${index + 1}`).join(",");
  const signature = headings.map((heading) => heading.id).join("|");

  useLayoutEffect(() => {
    const elements = scrollRef.current?.querySelectorAll<HTMLElement>(`[data-slot="message-content"] :is(${selector})`) ?? [];
    const ids = signature ? signature.split("|") : [];
    elements.forEach((element, index) => {
      const headingId = ids[index];
      if (headingId) {
        element.id = `${ID_PREFIX}${headingId}`;
        element.tabIndex = -1;
        element.classList.add("scroll-mt-4");
      }
    });
  });

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = scroller.getBoundingClientRect();
        const headings = [...scroller.querySelectorAll<HTMLElement>(`[id^="${ID_PREFIX}"]`)];
        let found: string | null = null;
        for (const element of headings) {
          if (element.getBoundingClientRect().top <= box.top + 24) found = element.id.slice(ID_PREFIX.length);
          else break;
        }
        // At the bottom the last headings can't reach the top: keep a clicked heading that is in view, else the last one in view.
        if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
          const visible = headings.filter((element) => element.getBoundingClientRect().top < box.bottom).map((element) => element.id.slice(ID_PREFIX.length));
          found = clicked.current && visible.includes(clicked.current) ? clicked.current : (visible[visible.length - 1] ?? found);
        }
        setCurrent(found);
      });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", update);
    };
  }, [activeId, signature]);

  const jump = (headingId: string) => {
    const target = document.getElementById(`${ID_PREFIX}${headingId}`);
    if (!target) return;
    target.scrollIntoView({ block: "start", behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === false ? "smooth" : "auto" });
    target.focus({ preventScroll: true });
    clicked.current = headingId;
    setCurrent(headingId);
  };

  const anyGenerating = pages.some((item) => item.generating);
  const activeHeading = current ?? headings[0]?.id;

  return (
    <div data-slot="docs-viewer" className={cn("@container flex min-h-0 overflow-hidden rounded-lg border border-border bg-background", className)}>
      {pages.length > 1 && (
        <nav aria-label={`${label} pages`} className="hidden w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-muted/20 p-2 @2xl:flex">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === page?.id ? "page" : undefined}
              aria-label={item.generating ? `${item.title}, generating` : undefined}
              onClick={() => {
                setActiveId(item.id);
                scrollRef.current?.scrollTo({ top: 0 });
              }}
              className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground [&_svg]:size-4 [&_svg]:shrink-0", focusRing)}
            >
              <FileTextIcon aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.generating && <span aria-hidden="true" className="size-1.5 rounded-full bg-ring motion-safe:animate-pulse" />}
            </button>
          ))}
        </nav>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          {pages.length > 1 ? (
            <label className="flex min-w-0 items-center gap-2 text-sm @2xl:hidden">
              <span className="sr-only">Page</span>
              <select value={page?.id} onChange={(event) => setActiveId(event.target.value)} className={cn("h-8 min-w-0 rounded-md border border-input bg-background px-2", focusRing)}>
                {pages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <h2 className={cn("min-w-0 flex-1 truncate text-sm font-semibold", pages.length > 1 && "hidden @2xl:block")}>{page?.title ?? label}</h2>
          {anyGenerating && (
            <StatusPill tone="info" pulse live>
              Generating
            </StatusPill>
          )}
        </div>
        <div className="flex min-h-0 flex-1">
          <div ref={scrollRef} tabIndex={0} role="region" aria-label={page?.title ?? label} className="min-w-0 flex-1 overflow-y-auto px-6 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            {page ? <MessageContent streaming={Boolean(page.generating)} className="max-w-3xl">{page.content}</MessageContent> : <p className="text-sm text-muted-foreground">No documentation yet.</p>}
          </div>
          {headings.length > 1 && (
            <nav aria-label="On this page" className="hidden w-52 shrink-0 overflow-y-auto border-l border-border p-3 text-sm @4xl:block">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">On this page</p>
              <ul className="flex flex-col gap-0.5">
                {headings.map((heading) => (
                  <li key={heading.id} style={{ paddingLeft: `${(heading.level - Math.min(...headings.map((item) => item.level))) * 12}px` }}>
                    <a
                      href={`#${ID_PREFIX}${heading.id}`}
                      aria-current={heading.id === activeHeading ? "location" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        jump(heading.id);
                      }}
                      className={cn("block truncate rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground aria-[current=location]:font-medium aria-[current=location]:text-foreground", focusRing)}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
