// packages/ai-ui/src/components/terminal-view.tsx
"use client";

import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

import type { TerminalBuffer } from "../lib/terminal-buffer.js";
import type { TerminalProps } from "./terminal.js";

interface TerminalViewProps extends Omit<TerminalProps, "ref" | "initialContent" | "onLoadError" | "aria-label"> {
  buffer: TerminalBuffer;
  label: string;
}

const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/** Resolves any CSS color (including oklch and variables) to an sRGB hex string xterm.js can use. */
function resolveColor(probe: HTMLElement, context: CanvasRenderingContext2D | null, value: string): string {
  probe.style.color = value;
  const computed = getComputedStyle(probe).color;
  if (!context) return computed;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = computed;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function readTheme(element: HTMLElement): ITheme {
  const probe = document.createElement("span");
  probe.style.display = "none";
  element.appendChild(probe);
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const color = (value: string) => resolveColor(probe, context, value);
  const theme: ITheme = {
    background: color("var(--code-background)"),
    foreground: color("var(--code-foreground)"),
    cursor: color("var(--foreground)"),
    cursorAccent: color("var(--code-background)"),
    selectionBackground: color("color-mix(in oklab, var(--ring) 35%, transparent)"),
  };
  for (const name of ANSI) {
    const value = color(`var(--ansi-${name})`);
    theme[name] = value;
    theme[`bright${name[0]!.toUpperCase()}${name.slice(1)}` as keyof ITheme] = value as never;
  }
  probe.remove();
  return theme;
}

export function TerminalView({ buffer, label, onData, onResize, readOnly = false, scrollback = 5000, fontSize = 13, screenReaderMode = false, className }: TerminalViewProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const callbacks = useRef({ onData, onResize });
  const initial = useRef({ scrollback, fontSize, screenReaderMode, label });
  const interactive = Boolean(onData) && !readOnly;

  useEffect(() => {
    callbacks.current = { onData, onResize };
  });

  useEffect(() => {
    if (!container) return;
    const options = initial.current;
    const terminal = new XTerm({
      convertEol: true,
      scrollback: options.scrollback,
      fontSize: options.fontSize,
      fontFamily: getComputedStyle(container).fontFamily,
      screenReaderMode: options.screenReaderMode,
      disableStdin: true,
      cursorBlink: false,
      theme: readTheme(container),
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.textarea?.setAttribute("aria-label", `${options.label} input`);
    terminalRef.current = terminal;

    const safeFit = () => {
      if (container.clientWidth > 0 && container.clientHeight > 0) fit.fit();
    };
    safeFit();

    let frame = 0;
    const flush = () => {
      frame = 0;
      const data = buffer.take();
      if (data) terminal.write(data);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const unsubscribe = buffer.subscribe(schedule);
    flush();

    const detach = buffer.attach({
      focus: () => terminal.focus(),
      fit: safeFit,
      clear: () => terminal.reset(),
      terminal,
    });

    const data = terminal.onData((input) => callbacks.current.onData?.(input));
    const resize = terminal.onResize((size) => callbacks.current.onResize?.(size));
    const observer = new ResizeObserver(() => safeFit());
    observer.observe(container);

    const retheme = () => {
      terminal.options.theme = readTheme(container);
    };
    const themeObserver = new MutationObserver(retheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    scheme?.addEventListener("change", retheme);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      data.dispose();
      resize.dispose();
      observer.disconnect();
      themeObserver.disconnect();
      scheme?.removeEventListener("change", retheme);
      detach();
      terminalRef.current = null;
      terminal.dispose();
    };
  }, [container, buffer]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.disableStdin = !interactive;
    terminal.options.cursorBlink = interactive;
    terminal.options.cursorInactiveStyle = interactive ? "outline" : "none";
  }, [interactive, container]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = fontSize;
    terminal.options.scrollback = scrollback;
    terminal.options.screenReaderMode = screenReaderMode;
    buffer.view?.fit();
  }, [fontSize, scrollback, screenReaderMode, buffer, container]);

  return (
    <div role="region" aria-label={label} data-slot="terminal" data-interactive={interactive || undefined} className={className}>
      <div ref={setContainer} className="absolute inset-0 p-2 font-mono" />
    </div>
  );
}
