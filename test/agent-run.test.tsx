// packages/ai-ui/test/agent-run.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ActionList,
  ActionResultCard,
  ActivityTrace,
  aggregateStatus,
  createTagStreamParser,
  dedupeProgress,
  describeTool,
  extractQuickActions,
  groupTrace,
  parseArtifactSegments,
  PlanCard,
  type PlanStep,
  ProgressSteps,
  RunCheckpoints,
  RunReplay,
  RunStatusBar,
  RunTimeline,
  shortenPath,
  splitPackageSpecifier,
  StreamStatus,
  SubAgentSession,
  TaskList,
  ToolTrace,
  type TraceItem,
  TruncationNotice,
} from "../src/index.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("run replay and checkpoints", () => {
  const initialEvents = [
    { id: "start", label: "Run started", kind: "Run" },
    { id: "saved", label: "Report saved", kind: "Checkpoint" },
  ];
  const checkpoints = [{ eventId: "saved", label: "Report checkpoint" }];

  function ReplayExample({ extended }: { extended?: boolean }) {
    const [eventId, setEventId] = useState<string | null>(null);
    const events = extended
      ? [...initialEvents, { id: "done", label: "Run completed", kind: "Run" }]
      : initialEvents;
    return (
      <>
        <RunReplay events={events} eventId={eventId} onEventChange={setEventId} />
        <RunCheckpoints checkpoints={checkpoints} selectedEventId={eventId} onCheckpointSelect={setEventId} />
      </>
    );
  }

  it("keeps an explicitly selected checkpoint when events append, then returns to the latest event", () => {
    const { rerender } = render(<ReplayExample />);
    const replay = within(screen.getByRole("region", { name: "Run replay" }));
    const checkpoint = screen.getByRole("button", { name: "Report checkpoint" });
    expect(replay.getByRole<HTMLButtonElement>("button", { name: "Following latest" }).disabled).toBe(true);

    fireEvent.click(checkpoint);
    rerender(<ReplayExample extended />);
    expect(checkpoint.getAttribute("aria-pressed")).toBe("true");
    expect(replay.getByRole("slider").getAttribute("aria-valuetext")).toBe("Event 2 of 3, Report saved");

    fireEvent.click(replay.getByRole("button", { name: "Follow latest" }));
    expect(checkpoint.getAttribute("aria-pressed")).toBe("false");
    expect(replay.queryByText("Run completed")).not.toBeNull();
    expect(replay.getByRole<HTMLButtonElement>("button", { name: "Next event" }).disabled).toBe(true);
  });
});

describe("streaming parsers", () => {
  it("splits prose from artifacts, tolerates unclosed blocks and hides half-written tags while streaming", () => {
    const text = 'Here you go.\n<artifact type="react" title="Counter">\n```tsx\nexport default () => 1;\n```\n</artifact>\nDone. <artifact title="Next">partial';
    const segments = parseArtifactSegments(text);
    expect(segments.map((segment) => segment.type)).toEqual(["text", "artifact", "text", "artifact"]);
    expect(segments[1]).toMatchObject({ attributes: { type: "react", title: "Counter" }, content: "export default () => 1;", complete: true });
    expect(segments[3]).toMatchObject({ content: "partial", complete: false });
    expect(parseArtifactSegments("Start <arti", { streaming: true })).toEqual([{ type: "text", text: "Start " }]);
    expect(parseArtifactSegments("a < b")).toEqual([{ type: "text", text: "a < b" }]);
  });

  it("parses nested tags across chunk boundaries", () => {
    const events: string[] = [];
    const parser = createTagStreamParser(["artifact", "action"], {
      onText: (text) => events.push(`text:${text}`),
      onOpen: (tag, attributes) => events.push(`open:${tag}:${JSON.stringify(attributes)}`),
      onClose: (tag, _id, content) => events.push(`close:${tag}:${content.trim()}`),
    });
    for (const chunk of ['Intro <arti', 'fact id="a"><act', 'ion type="file" path="x.ts">code</ac', "tion></artifact> outro"]) parser.push(chunk);
    parser.end();
    expect(events).toEqual([
      "text:Intro ",
      'open:artifact:{"id":"a"}',
      'open:action:{"type":"file","path":"x.ts"}',
      "close:action:code",
      "close:artifact:",
      "text: outro",
    ]);
  });

  it("extracts capped, de-duplicated quick actions", () => {
    const reply =
      'Pick one.\n<quick-action type="message">Add tests</quick-action><quick-action type="implement" value="build it">Ship &amp; deploy</quick-action><quick-action>add tests</quick-action>';
    const { text, actions } = extractQuickActions(reply, { max: 4 });
    expect(text).toBe("Pick one.");
    expect(actions).toEqual([
      { type: "message", label: "Add tests", value: "Add tests" },
      { type: "implement", label: "Ship & deploy", value: "build it" },
    ]);
  });
});

describe("step status helpers", () => {
  it("aggregates statuses", () => {
    expect(aggregateStatus(["complete", "failed"])).toBe("failed");
    expect(aggregateStatus(["complete", "skipped"])).toBe("complete");
    expect(aggregateStatus(["complete", "complete"], false)).toBe("running");
    expect(aggregateStatus(["pending", "pending"])).toBe("pending");
  });
});

describe("ActionList", () => {
  it("opens when the first step arrives, labels each step and opens files", () => {
    const onOpenFile = vi.fn();
    vi.useFakeTimers();
    const { rerender } = render(<ActionList title="Build counter app" steps={[]} closed={false} onOpenFile={onOpenFile} />);
    const trigger = screen.getByRole("button", { name: /Build counter app/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    rerender(
      <ActionList
        title="Build counter app"
        closed={false}
        onOpenFile={onOpenFile}
        steps={[
          { id: "1", kind: "file", path: "src/App.tsx", status: "complete" },
          { id: "2", kind: "command", command: "npm install", status: "failed", output: "ERR! network" },
          { id: "3", kind: "start", command: "npm run dev", status: "pending" },
        ]}
      />,
    );
    act(() => {
      vi.runAllTimers();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.textContent).toContain("Failed");
    expect(trigger.textContent).toContain("1/3");
    fireEvent.click(screen.getByRole("button", { name: "src/App.tsx" }));
    expect(onOpenFile).toHaveBeenCalledWith("src/App.tsx");
    expect(screen.getByText("ERR! network")).toBeTruthy();
    expect(screen.getByText("npm run dev")).toBeTruthy();
  });
});

describe("RunStatusBar", () => {
  it("adapts the stop label, ticks elapsed time and offers retry only before side effects", () => {
    vi.useFakeTimers();
    const start = Date.now();
    const onStop = vi.fn();
    const { rerender } = render(<RunStatusBar phase="generating" startedAt={start} running={1} queued={2} onStop={onStop} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("status").textContent).toBe("Generating · 3s · 1 running · 2 queued");
    fireEvent.click(screen.getByRole("button", { name: "Stop generation" }));
    expect(onStop).toHaveBeenCalled();
    rerender(<RunStatusBar phase="applying" onStop={onStop} />);
    expect(screen.getByRole("button", { name: "Stop actions" })).toBeTruthy();
    rerender(<RunStatusBar phase="failed" applied={0} onRetry={() => undefined} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    rerender(<RunStatusBar phase="failed" applied={2} onRetry={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("2 changes already applied");
  });

  it("shows request details and copies a receipt", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<RunStatusBar phase="complete" elapsedMs={65_000} details={{ requestId: "req_1", provider: "Marifai", model: "Core", contextTokens: 128_000, outputTokens: 8000 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Request details" }));
    expect(screen.getByText("req_1")).toBeTruthy();
    expect(screen.getByText("context 128K · output 8K")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy receipt" }));
    expect(await screen.findByText("Receipt copied")).toBeTruthy();
    expect(JSON.parse(writeText.mock.calls[0]![0] as string)).toMatchObject({ requestId: "req_1" });
  });
});

describe("ProgressSteps", () => {
  it("dedupes by label, keeps order and shows the latest note collapsed", () => {
    const notes = [
      { label: "Reading files", status: "running" as const, order: 1 },
      { label: "Planning", status: "running" as const, order: 2 },
      { label: "Reading files", status: "complete" as const, order: 1 },
    ];
    expect(dedupeProgress(notes).map((note) => `${note.label}:${note.status}`)).toEqual(["Reading files:complete", "Planning:running"]);
    render(<ProgressSteps notes={notes} />);
    expect(screen.getByRole("status").textContent).toBe("Planning");
    fireEvent.click(screen.getByRole("button", { name: /Planning/ }));
    expect(screen.getAllByText("Reading files").length).toBeGreaterThan(0);
  });
});

describe("RunTimeline", () => {
  it("opens the active phase, collapses finished ones to a file count and opens files", () => {
    const onFileClick = vi.fn();
    render(
      <RunTimeline
        onFileClick={onFileClick}
        stages={[
          { id: "plan", title: "Blueprint", status: "complete" },
          {
            id: "code",
            title: "Code",
            status: "running",
            phases: [
              { id: "p1", title: "Scaffold", status: "complete", files: [{ path: "package.json", status: "complete", linesAdded: 20 }] },
              { id: "p2", title: "Counter UI", status: "running", warnings: 1, files: [{ path: "src/Counter.tsx", status: "running", linesAdded: 1200 }] },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("list", { name: "Run progress" })).toBeTruthy();
    expect(screen.getByText("1 files")).toBeTruthy();
    expect(screen.getByText("+1.2K")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "src/Counter.tsx" }));
    expect(onFileClick).toHaveBeenCalledWith("src/Counter.tsx");
    fireEvent.click(screen.getByRole("button", { name: /Scaffold/ }));
    expect(screen.getByRole("button", { name: "package.json" })).toBeTruthy();
  });
});

describe("PlanCard", () => {
  it("splits dependency specifiers and edits only unstarted steps while paused", () => {
    expect(splitPackageSpecifier("@scope/pkg@2.1.0")).toEqual({ name: "@scope/pkg", version: "2.1.0" });
    expect(splitPackageSpecifier("react")).toEqual({ name: "react" });
    function Harness() {
      const [steps, setSteps] = useState<PlanStep[]>([
        { id: "a", title: "Scaffold project", status: "complete" },
        { id: "b", title: "Build counter", status: "pending" },
      ]);
      const [paused, setPaused] = useState(false);
      return <PlanCard title="Counter app" dependencies={["react@19.3.1"]} colors={[{ name: "Primary", value: "#2563eb" }]} steps={steps} onStepsChange={setSteps} paused={paused} onPauseChange={setPaused} />;
    }
    render(<Harness />);
    expect(screen.getByRole("img", { name: "Primary, #2563eb" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Step 2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pause to edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Step 2" }), { target: { value: "Build counter with reset" } });
    fireEvent.change(screen.getByRole("textbox", { name: "New step" }), { target: { value: "Deploy" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.queryByRole("textbox", { name: "Step 1" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Step 2" }) as HTMLInputElement).value).toBe("Build counter with reset");
    expect((screen.getByRole("textbox", { name: "Step 3" }) as HTMLInputElement).value).toBe("Deploy");
    fireEvent.click(screen.getByRole("button", { name: "Remove step 3" }));
    expect(screen.queryByRole("textbox", { name: "Step 3" })).toBeNull();
  });
});

describe("TaskList", () => {
  it("retries failed tasks and answers open questions", () => {
    const onRetry = vi.fn();
    const onAnswer = vi.fn();
    render(
      <TaskList
        onRetry={onRetry}
        onAnswer={onAnswer}
        tasks={[
          { id: "1", title: "Fetch prices", status: "failed" },
          { id: "2", title: "Choose region", status: "needs-input", question: { prompt: "Which region?", options: ["US", "EU"] } },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("1");
    fireEvent.click(screen.getByRole("button", { name: "EU" }));
    expect(onAnswer).toHaveBeenCalledWith("2", "EU");
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "APAC" } });
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(onAnswer).toHaveBeenLastCalledWith("2", "APAC");
  });
});

describe("traces", () => {
  const items: TraceItem[] = [
    { kind: "reasoning", id: "r", text: "Look at the config first.\nThen run tests." },
    { kind: "tool", id: "1", name: "read_file", status: "complete", input: { path: "src/lib/deep/config.ts" } },
    { kind: "tool", id: "2", name: "read_file", status: "complete", input: { path: "src/app.ts" } },
    { kind: "tool", id: "3", name: "read_file", status: "running", input: { path: "src/b.ts" } },
    { kind: "tool", id: "4", name: "bash", status: "failed", input: { command: "npm test" }, error: "1 failing" },
  ];

  it("describes tools in plain English and groups finished calls", () => {
    expect(describeTool("readFile").done).toBe("Read");
    expect(describeTool("custom_tool").done).toBe("Ran custom tool");
    expect(shortenPath("src/lib/deep/config.ts")).toBe("…/deep/config.ts");
    expect(groupTrace(items).map((row) => row.type)).toEqual(["reasoning", "group", "tool", "tool"]);
    render(<ToolTrace items={items} />);
    const group = screen.getByRole("button", { name: /Read 2 files/ });
    fireEvent.click(group);
    expect(screen.getByRole("button", { name: /Read …\/deep\/config.ts/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reading src\/b.ts/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Failed to run npm test/ }));
    expect(screen.getByText("1 failing")).toBeTruthy();
  });

  it("caps activity events and opens while running", () => {
    const events = Array.from({ length: 5 }, (_, index) => ({ id: String(index), kind: "tool" as const, title: `Step ${index}`, durationMs: 1500 }));
    const onClear = vi.fn();
    const { rerender } = render(<ActivityTrace events={events} running maxEvents={3} />);
    expect(screen.getByRole("button", { name: /Activity/ }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("2 earlier events hidden")).toBeTruthy();
    expect(screen.queryByText("Step 0")).toBeNull();
    rerender(<ActivityTrace events={events} maxEvents={3} onClear={onClear} />);
    expect(screen.getByRole("button", { name: /Activity/ }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Clear activity" }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("status lines and cards", () => {
  it("shows queue position, reconnection and provisional state", () => {
    const { rerender } = render(<StreamStatus queuePosition={3} etaSeconds={12} />);
    expect(screen.getByRole("status").textContent).toBe("Position 3 in queue · about 12s");
    rerender(<StreamStatus reconnecting />);
    expect(screen.getByRole("status").textContent).toContain("Reconnecting to the same reply");
    rerender(<StreamStatus stage="Reading sources" provisional />);
    expect(screen.getByRole("status").textContent).toContain("may still change");
    rerender(<StreamStatus />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("explains truncation and continues incomplete work", () => {
    const onContinue = vi.fn();
    const { rerender } = render(<TruncationNotice variant="omitted" omittedCount={40} />);
    expect(screen.getByRole("status").textContent).toContain("40 earlier messages were left out");
    rerender(<TruncationNotice variant="incomplete" segments={3} onContinue={onContinue} pending />);
    fireEvent.click(screen.getByRole("button", { name: "Applying changes" }));
    expect(onContinue).not.toHaveBeenCalled();
    rerender(<TruncationNotice variant="incomplete" segments={3} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("links results and renders sub-agent sessions", () => {
    render(
      <>
        <ActionResultCard kind="event" title="Design review" description="Tue 10:00" href="https://calendar.example.com/e/1" />
        <ActionResultCard title="Unsafe" href="javascript:alert(1)" />
        <SubAgentSession title="Debugger" state="active" toolCount={4}>
          <p>Reproducing the failure</p>
        </SubAgentSession>
      </>,
    );
    expect(screen.getByRole("link", { name: "Open (opens in new tab)" }).getAttribute("href")).toBe("https://calendar.example.com/e/1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    const session = screen.getByRole("region", { name: "Debugger" });
    expect(within(session).getByText("4 tools")).toBeTruthy();
    expect(within(session).getByRole("log", { name: "Session output" }).textContent).toBe("Reproducing the failure");
  });
});
