// packages/ai-ui/example/workspace.tsx
import { ArrowLeftIcon, ArrowRightIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  AssistantAgenda, AutomationRunControls, BrowserPageQueue, Button, ChatContextTray,
  CodeEditor, type CodeEditorHandle, type IdeProblem, IdeProblemsPanel, Textarea,
} from "../src/index.js";
import { focusRing } from "../src/lib/classes.js";
import { cn } from "../src/lib/cn.js";

const ORIGINAL = {
  "index.html": '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<title>Inventory workspace</title>\n<h1>Inventory workspace</h1>\n<p>Review incoming deliveries and the latest stock counts.</p>\n</html>',
  "inventory.html": '<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<title>Stock counts</title>\n<p>24 hammers and 40 tape measures are ready for pickup.</p>\n</html>',
};
const HOME = "index.html";
const PROJECT_FILES = ["index.html", "inventory.html"] as const;
const PREVIEW_POLICY = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; form-action \'none\'; base-uri \'none\'">';
const inputClass = cn("h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm", focusRing);
const sectionClass = "min-w-0 space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground";

function readFiles(): Record<string, string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem("marifai-ai-ui-workspace-files") ?? "null");
    if (saved && typeof saved === "object") {
      return Object.fromEntries(PROJECT_FILES.map((file) => {
        const value: unknown = Reflect.get(saved, file);
        return [file, typeof value === "string" ? value : ORIGINAL[file]];
      }));
    }
  } catch {
    // The workspace still opens if storage is blocked or contains invalid data.
  }
  return { ...ORIGINAL };
}

function pageContent(text: string) {
  const template = document.createElement("template");
  template.innerHTML = text;
  return template.content;
}

function pageTitle(content: DocumentFragment) {
  return content.querySelector("title")?.textContent?.trim() ?? "";
}

function problemsFor(file: string, source: string): IdeProblem[] {
  const doc = pageContent(source);
  const problems: IdeProblem[] = [];
  if (!pageTitle(doc)) {
    problems.push({ id: file + ":title", file, line: 1, severity: "error", message: "Add a nonempty page title." });
  }
  if (![...doc.querySelectorAll("h1")].some((heading) => heading.textContent?.trim())) {
    const opening = source.search(/<body\b/i);
    const line = opening === -1 ? 1 : source.slice(0, opening).split("\n").length;
    problems.push({ id: file + ":heading", file, line, severity: "warning", message: "Add a visible main heading." });
  }
  return problems;
}

function summarize(source: string) {
  const doc = pageContent(source);
  const title = pageTitle(doc);
  doc.querySelectorAll("title, script, style, template").forEach((element) => element.remove());
  const text = (doc.textContent ?? "").replace(/\s+/g, " ").trim();
  return [title, text.slice(0, 350)].filter(Boolean).join("\n") || "This page has no readable text.";
}

type WorkspaceTask = { id: string; title: string; done: boolean };
type ChatMessage = { id: number; question: string; answer: string };
type RunState = "idle" | "running" | "paused" | "complete";

export function WorkspaceDemo() {
  const [files, setFiles] = useState(readFiles);
  const [file, setFile] = useState(HOME);
  const [storedFiles, setStoredFiles] = useState(files);
  const [saveStatus, setSaveStatus] = useState("");
  const [history, setHistory] = useState([HOME]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [address, setAddress] = useState("/" + HOME);
  const [browserError, setBrowserError] = useState("");
  const [reload, setReload] = useState(0);
  const [included, setIncluded] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [run, setRun] = useState<RunState>("idle");
  const [step, setStep] = useState(0);
  const [runMessages, setRunMessages] = useState<string[]>([]);
  const runFiles = useRef(files);
  const editor = useRef<CodeEditorHandle>(null);
  const [target, setTarget] = useState<{ file: string; line: number } | null>(null);
  const currentPage = history[historyIndex] ?? HOME;
  const allProblems = PROJECT_FILES.flatMap((path) => problemsFor(path, files[path] ?? ""));
  const projectPages = PROJECT_FILES.map((path) => ({
    id: path, title: pageTitle(pageContent(files[path] ?? "")) || path, address: "/" + path, included: included.includes(path),
  }));

  useEffect(() => {
    if (target?.file === file && editor.current) {
      editor.current.revealLine(target.line);
      setTarget(null);
    }
  }, [file, target]);

  useEffect(() => {
    if (run !== "running") return;
    const nextFile = PROJECT_FILES[step];
    if (!nextFile) return;
    const timer = window.setTimeout(() => {
      const problems = problemsFor(nextFile, runFiles.current[nextFile] ?? "");
      setRunMessages((entries) => [...entries, nextFile + " · " + problems.length + (problems.length === 1 ? " issue" : " issues")]);
      setTasks((entries) => [
        ...entries,
        ...problems.filter((problem) => !entries.some((entry) => entry.id === problem.id))
          .map((problem) => ({ id: problem.id, title: problem.file + " — " + problem.message, done: false })),
      ]);
      setStep(step + 1);
      if (step + 1 === PROJECT_FILES.length) setRun("complete");
    }, 850);
    return () => window.clearTimeout(timer);
  }, [run, step]);

  function goTo(path: string) {
    setAddress("/" + path);
    setBrowserError("");
    if (path === currentPage) return;
    setHistory([...history.slice(0, historyIndex + 1), path]);
    setHistoryIndex(historyIndex + 1);
  }

  function moveHistory(delta: number) {
    const nextIndex = historyIndex + delta;
    const path = history[nextIndex];
    if (path === undefined) return;
    setHistoryIndex(nextIndex);
    setAddress("/" + path);
    setBrowserError("");
  }

  function navigate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = address.trim();
    if (!value) return;
    const path = value.replace(/^\//, "");
    if (PROJECT_FILES.some((file) => file === path)) {
      goTo(path);
      return;
    }
    let url: URL;
    try {
      url = new URL(value);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("Invalid URL");
    } catch {
      setBrowserError("Enter a project path or a full http:// or https:// address.");
      return;
    }
    window.open(url.href, "_blank", "noopener,noreferrer");
    setBrowserError("");
  }

  function saveFile(next: string) {
    const updated = { ...storedFiles, [file]: next };
    try {
      localStorage.setItem("marifai-ai-ui-workspace-files", JSON.stringify(updated));
      setStoredFiles(updated);
      setSaveStatus(file + " saved locally.");
    } catch {
      setSaveStatus("Browser storage is unavailable. Your edit is still open.");
    }
  }

  function selectProblem(problem: IdeProblem) {
    if (problem.file === file && editor.current) {
      editor.current.revealLine(problem.line);
    } else {
      setTarget({ file: problem.file, line: problem.line });
      setFile(problem.file);
    }
  }

  function reply(question: string, answer: string) {
    setMessages((entries) => [...entries, { id: entries.length, question, answer }]);
    setPrompt("");
  }

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request) return;
    const command = request.toLowerCase();
    if (command === "/summary") {
      const selected = included.length ? included : [currentPage];
      reply(request, selected.map((path) => summarize(files[path] ?? "")).join("\n\n"));
    } else if (command === "/review") {
      reply(request, allProblems.length
        ? allProblems.map((problem) => problem.file + ":" + problem.line + " — " + problem.message).join("\n")
        : "All project pages have a page title and main heading.");
    } else if (command === "/agenda") {
      const open = tasks.filter((task) => !task.done);
      reply(request, open.length ? open.map((task) => task.title).join("\n") : "There are no open workspace tasks.");
    } else {
      reply(request, "Available commands: /summary, /review, and /agenda.");
    }
  }

  function startRun() {
    runFiles.current = { ...files };
    setStep(0);
    setRunMessages([]);
    setRun("running");
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <h2 className="text-lg font-semibold tracking-tight">Workspace</h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section aria-label="Project browser" className={sectionClass}>
            <h3 className="text-sm font-semibold">Project browser</h3>
            <form className="flex flex-wrap items-center gap-1.5" onSubmit={navigate}>
              <Button size="icon" variant="ghost" aria-label="Go back" disabled={historyIndex === 0} onClick={() => moveHistory(-1)}><ArrowLeftIcon aria-hidden="true" /></Button>
              <Button size="icon" variant="ghost" aria-label="Go forward" disabled={historyIndex === history.length - 1} onClick={() => moveHistory(1)}><ArrowRightIcon aria-hidden="true" /></Button>
              <Button size="icon" variant="ghost" aria-label="Reload preview" onClick={() => setReload((value) => value + 1)}><RefreshCwIcon aria-hidden="true" /></Button>
              <input aria-label="Browser address" className={inputClass} value={address} onChange={(event) => setAddress(event.currentTarget.value)} />
              <Button size="sm" type="submit" variant="outline"><ExternalLinkIcon aria-hidden="true" /> Go</Button>
            </form>
            {browserError && <p role="alert" className="text-sm text-destructive">{browserError}</p>}
            <div role="group" aria-label="Project pages" className="flex flex-wrap gap-1.5">
              {PROJECT_FILES.map((path) => <Button key={path} size="sm" variant={path === currentPage ? "secondary" : "ghost"} aria-pressed={path === currentPage} onClick={() => goTo(path)}>{path}</Button>)}
            </div>
            <iframe
              key={currentPage + ":" + reload}
              title="Project page preview"
              sandbox=""
              referrerPolicy="no-referrer"
              className="h-48 w-full rounded-md border border-border bg-white"
              srcDoc={"<!doctype html>" + PREVIEW_POLICY + (files[currentPage] ?? "").replace(/^\s*<!doctype html>/i, "")}
            />
            <BrowserPageQueue pages={projectPages} onIncludeChange={(id, checked) => {
              setIncluded((entries) => checked ? [...entries, id] : entries.filter((entry) => entry !== id));
            }} />
          </section>
          <section aria-label="Project editor" className={sectionClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Project editor</h3>
              <Button size="sm" variant="outline" disabled={files[file] === storedFiles[file]} onClick={() => saveFile(files[file] ?? "")}>Save file</Button>
            </div>
            <div role="group" aria-label="Files" className="flex flex-wrap gap-1.5">
              {PROJECT_FILES.map((path) => <Button key={path} size="sm" variant={path === file ? "secondary" : "ghost"} aria-pressed={path === file} onClick={() => { setFile(path); setTarget(null); }}>{path}</Button>)}
            </div>
            <CodeEditor
              ref={editor} aria-label="Project source" language="html" className="h-48" value={files[file] ?? ""}
              onValueChange={(value) => { setFiles((entries) => ({ ...entries, [file]: value })); setSaveStatus(""); }} onSave={saveFile}
            />
            {saveStatus && <p role="status" className="text-xs text-muted-foreground">{saveStatus}</p>}
            <IdeProblemsPanel problems={allProblems} onOpen={selectProblem} />
          </section>
          <section aria-label="Workspace assistant" className={sectionClass}>
            <header>
              <h3 className="text-sm font-semibold">Workspace assistant</h3>
              <p className="text-xs text-muted-foreground">Local commands · /summary, /review, /agenda</p>
            </header>
            <ChatContextTray items={projectPages.filter((page) => page.included).map((page) => ({
              id: page.id, label: page.title, kind: "page", tokens: Math.ceil((files[page.id]?.length ?? 0) / 4),
            }))} onRemove={(id) => setIncluded((entries) => entries.filter((entry) => entry !== id))} />
            <div role="log" aria-label="Workspace conversation" className="max-h-56 space-y-2 overflow-y-auto">
              {messages.map((message) => (
                <div key={message.id} className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs font-medium">{message.question}</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">{message.answer}</p>
                </div>
              ))}
            </div>
            <form onSubmit={ask} className="space-y-2">
              <Textarea aria-label="Workspace message" value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} rows={2} />
              <Button size="sm" type="submit" disabled={!prompt.trim()}>Send command</Button>
            </form>
          </section>
          <section aria-label="Workspace tasks and runs" className={sectionClass}>
            <h3 className="text-sm font-semibold">Tasks and runs</h3>
            {run === "running" || run === "paused" ? (
              <AutomationRunControls name="Check project pages" state={run} completed={step} total={PROJECT_FILES.length} onStateChange={setRun} />
            ) : <Button size="sm" onClick={startRun}>{run === "complete" ? "Run checks again" : "Run workspace checks"}</Button>}
            <ul aria-label="Run activity" className="space-y-1 text-xs text-muted-foreground">
              {runMessages.map((message) => <li key={message}>{message}</li>)}
            </ul>
            <div aria-label="Task list" className="space-y-2">
              <h4 className="text-sm font-medium">Task list</h4>
              {tasks.length ? tasks.map((task) => (
                <label key={task.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-primary" checked={task.done} onChange={(event) => {
                    const done = event.currentTarget.checked;
                    setTasks((entries) => entries.map((entry) => entry.id === task.id ? { ...entry, done } : entry));
                  }} />
                  <span className={task.done ? "text-muted-foreground line-through" : undefined}>{task.title}</span>
                </label>
              )) : <p className="text-xs text-muted-foreground">No tasks yet.</p>}
            </div>
            <AssistantAgenda items={tasks.filter((task) => !task.done).map((task) => ({
              id: task.id, time: "Today", title: task.title, brief: "Open the matching IDE diagnostic to jump to the source.",
            }))} />
          </section>
        </div>
      </div>
    </div>
  );
}
