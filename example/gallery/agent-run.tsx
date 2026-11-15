// packages/ai-ui/example/gallery/agent-run.tsx
import { useState } from "react";

import {
  ActionList,
  ActionResultCard,
  ActivityTrace,
  PlanCard,
  type PlanStep,
  ProgressSteps,
  RunCheckpoints,
  RunReplay,
  RunStatusBar,
  RunTimeline,
  StreamStatus,
  SubAgentSession,
  TaskList,
  ToolTrace,
  TruncationNotice,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const STARTED_AT = Date.now() - 42_000;

const REPLAY_EVENTS = [
  { id: "started", kind: "Run", label: "Inventory audit started", detail: "The planner queued checks for two warehouses." },
  { id: "stock", kind: "Checkpoint", label: "Inventory reconciled", detail: "1,280 stock records compared across two warehouses." },
  { id: "review", kind: "Approval", label: "Export approved", detail: "Dana approved the audit export." },
  { id: "saved", kind: "Checkpoint", label: "Audit report saved", detail: "inventory-audit.csv is ready for review." },
  { id: "completed", kind: "Run", label: "Inventory audit completed", detail: "All checks finished and the report was attached." },
];

const CHECKPOINTS = [
  { eventId: "stock", label: "Inventory reconciled", description: "After comparing stock records" },
  { eventId: "saved", label: "Audit report saved", description: "After writing the approved export" },
];

const TRACE = [
  { kind: "reasoning" as const, id: "r1", text: "The counter needs persistent state.\nCheck the existing store before adding one." },
  { kind: "tool" as const, id: "t1", name: "read_file", status: "complete" as const, input: { path: "src/store/index.ts" }, output: "export const store = createStore();", durationMs: 120 },
  { kind: "tool" as const, id: "t2", name: "read_file", status: "complete" as const, input: { path: "src/components/Counter.tsx" }, durationMs: 90 },
  { kind: "tool" as const, id: "t3", name: "read_file", status: "complete" as const, input: { path: "src/app/routes/settings/page.tsx" }, durationMs: 95 },
  { kind: "tool" as const, id: "t4", name: "edit_file", status: "running" as const, input: { path: "src/components/Counter.tsx" } },
  { kind: "tool" as const, id: "t5", name: "bash", status: "failed" as const, input: { command: "npm test -- counter" }, error: "1 failing: resets to zero", durationMs: 4200 },
];

export function AgentRunGallery() {
  const [steps, setSteps] = useState<PlanStep[]>([
    { id: "s1", title: "Scaffold the Vite project", status: "complete" },
    { id: "s2", title: "Build the counter with reset", status: "running" },
    { id: "s3", title: "Persist the count in local storage", status: "pending" },
    { id: "s4", title: "Write component tests", status: "pending" },
  ]);
  const [paused, setPaused] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [replayEventId, setReplayEventId] = useState<string | null>(null);

  return (
    <GallerySection id="gallery-agent" title="Agent runs and progress">
      <Demo title="Replay and checkpoints" className="grid w-full gap-3 md:grid-cols-2">
        <RunReplay events={REPLAY_EVENTS} eventId={replayEventId} onEventChange={setReplayEventId} />
        <RunCheckpoints checkpoints={CHECKPOINTS} selectedEventId={replayEventId} onCheckpointSelect={setReplayEventId} />
      </Demo>
      <Demo title="Run status bar" className="flex w-full flex-col gap-2">
        <RunStatusBar
          phase="generating"
          startedAt={STARTED_AT}
          running={1}
          queued={2}
          onStop={() => undefined}
          onPause={() => undefined}
          details={{ requestId: "req_7f3a", provider: "Marifai", model: "Core", stage: "Writing files", contextTokens: 128_000, outputTokens: 8192, queue: [{ id: "q1", label: "Write src/Counter.tsx", status: "running", snippet: "export function Counter() {" }] }}
        />
        <RunStatusBar phase="failed" elapsedMs={18_000} applied={0} onRetry={() => undefined} label="Provider timed out" />
      </Demo>
      <Demo title="Action list" className="grid w-full gap-3 md:grid-cols-2">
        <ActionList
          title="Build counter app"
          defaultOpen
          onOpenFile={() => undefined}
          steps={[
            { id: "1", kind: "file", path: "package.json", status: "complete" },
            { id: "2", kind: "file", path: "src/components/Counter.tsx", status: "complete" },
            { id: "3", kind: "command", command: "npm install", status: "running", output: "added 214 packages" },
            { id: "4", kind: "start", command: "npm run dev", status: "pending" },
          ]}
        />
        <ActionList
          title="Fix failing test"
          defaultOpen
          steps={[
            { id: "1", kind: "file", path: "src/Counter.test.tsx", status: "complete" },
            { id: "2", kind: "command", command: "npm test", status: "failed", output: "Expected 0, received 1" },
          ]}
        />
      </Demo>
      <Demo title="Progress notes and stream status" className="flex w-full max-w-xl flex-col gap-3">
        <ProgressSteps
          notes={[
            { label: "Reading 12 files", status: "complete", order: 1 },
            { label: "Planning changes", status: "complete", order: 2 },
            { label: "Writing src/Counter.tsx", status: "running", order: 3 },
          ]}
        />
        <StreamStatus stage="Reading sources" provisional />
        <StreamStatus queuePosition={2} etaSeconds={9} />
        <StreamStatus reconnecting />
      </Demo>
      <Demo title="Run timeline" className="w-full max-w-xl">
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border p-3">
          <RunTimeline
            onFileClick={() => undefined}
            stages={[
              { id: "bp", title: "Blueprint", status: "complete", description: "Counter app with persistence and tests" },
              {
                id: "code",
                title: "Code",
                status: "running",
                phases: [
                  { id: "p1", title: "Scaffold", status: "complete", files: [{ path: "package.json", status: "complete", linesAdded: 34 }, { path: "vite.config.ts", status: "complete", linesAdded: 12 }] },
                  { id: "p2", title: "Counter UI", status: "running", warnings: 1, files: [{ path: "src/components/Counter.tsx", status: "running", linesAdded: 86 }, { path: "src/styles.css", status: "pending" }] },
                  { id: "p3", title: "Persistence", status: "pending" },
                ],
              },
              { id: "deploy", title: "Deploy", status: "pending" },
            ]}
          />
        </div>
      </Demo>
      <Demo title="Plan card" className="w-full max-w-2xl">
        <PlanCard
          title="Counter app blueprint"
          summary="A small **React** counter with reset, persisted in local storage, covered by component tests."
          dependencies={["react@19.3.1", "vite@7.3.7", "@testing-library/react@16"]}
          colors={[
            { name: "Primary", value: "#2563eb" },
            { name: "Surface", value: "#f8fafc" },
          ]}
          sections={[{ title: "Pitfalls", items: ["Guard against negative counts", "Read storage after hydration"] }]}
          steps={steps}
          onStepsChange={setSteps}
          paused={paused}
          onPauseChange={setPaused}
        />
      </Demo>
      <Demo title="Tasks" className="w-full max-w-xl">
        <TaskList
          onRetry={() => undefined}
          onAnswer={(_, value) => setAnswer(value)}
          tasks={[
            { id: "1", title: "Collect supplier prices", status: "complete", detail: "48 items" },
            { id: "2", title: "Compare with last quarter", status: "failed", detail: "Spreadsheet was locked" },
            {
              id: "3",
              title: "Pick the reporting currency",
              status: answer ? "complete" : "needs-input",
              detail: answer ? `Answered: ${answer}` : undefined,
              question: { prompt: "Which currency should the report use?", options: ["USD", "EUR"] },
            },
          ]}
        />
      </Demo>
      <Demo title="Tool trace and activity" className="grid w-full gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border p-2">
          <ToolTrace items={TRACE} />
        </div>
        <ActivityTrace
          running
          events={[
            { id: "e1", kind: "stage", title: "Planning", status: "complete", durationMs: 2100 },
            { id: "e2", kind: "reasoning", title: "Decided to reuse the existing store" },
            { id: "e3", kind: "tool", title: "Edited Counter.tsx", status: "complete", durationMs: 640 },
            { id: "e4", kind: "tool", title: "Running tests", status: "running" },
          ]}
        />
      </Demo>
      <Demo title="Sub-agent session" className="w-full max-w-xl">
        <SubAgentSession title="Debugger" state="active" startedAt={STARTED_AT} toolCount={6} maxHeight="10rem">
          {["Reproduced the failure with npm test", "Counter resets to 1 instead of 0", "Found off-by-one in reset handler", "Patched reset to set 0", "Re-running tests"].map((line) => (
            <p key={line} className="text-sm">
              {line}
            </p>
          ))}
        </SubAgentSession>
      </Demo>
      <Demo title="Results and notices" className="flex w-full max-w-xl flex-col gap-3">
        <ActionResultCard kind="document" title="Q3 supplier report" description="Draft · not shared" onOpen={() => undefined} />
        <ActionResultCard kind="deployment" title="counter-app.example.dev" description="Production · 2 minutes ago" href="https://example.com" openLabel="Visit" />
        <TruncationNotice variant="omitted" omittedCount={38} />
        <TruncationNotice variant="incomplete" segments={3} onContinue={() => undefined} />
      </Demo>
    </GallerySection>
  );
}
