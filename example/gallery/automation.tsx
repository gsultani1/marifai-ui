// packages/ai-ui/example/gallery/automation.tsx
import { useRef, useState } from "react";

import {
  addDays,
  AutomationActionBuilder,
  AutomationChangeReview,
  AutomationConcurrencyEditor,
  AutomationDeadLetterQueue,
  AutomationDryRunReview,
  AutomationExecutionWindowIndicator,
  AutomationOccurrencePreview,
  AutomationPauseWindowEditor,
  AutomationRetryPolicyEditor,
  AutomationRunCancellation,
  AutomationRunHistory,
  AutomationRunInputForm,
  AutomationScheduleEditor,
  AutomationTemplatePicker,
  AutomationToggleList,
  AutomationTriggerPicker,
  parseTime,
  type AutomationActionStep,
  type AutomationHistoryRun,
  type AutomationOccurrence,
  type AutomationPauseWindow,
  type AutomationSchedule,
  type AutomationTriggerOption,
  type FailedAutomationDelivery,
  type ToggleableAutomation,
  type ToolParameter,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

/** Thursday, November 19, 2026, 9:00 AM: a fixed "now" so the previews stay the same on every load. */
const NOW = new Date(2026, 10, 19, 9, 0);
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TRIGGERS: AutomationTriggerOption[] = [
  { id: "manual", label: "Run on request", kind: "manual", description: "Starts only when someone on the team requests a run." },
  { id: "weekly", label: "Store schedule", kind: "scheduled", description: "Runs on the days and at the time set in the schedule." },
  { id: "low-stock", label: "Stock below reorder point", kind: "event", description: "Runs when any product's on-hand count drops below its reorder point." },
  { id: "price-file", label: "New supplier price file", kind: "event", description: "Runs when a supplier uploads a new price list." },
];

const ACTIONS = [
  { id: "count", label: "Count stock in the paint aisle" },
  { id: "draft-po", label: "Draft a purchase order" },
  { id: "email", label: "Email the supplier" },
  { id: "post", label: "Post a summary to #store-ops" },
  { id: "prices", label: "Update shelf prices" },
];

const TEMPLATES = [
  { id: "restock", title: "Low stock restock", trigger: "When stock falls below the reorder point", actions: ["Draft a purchase order", "Email the supplier"], requiredInputs: ["Supplier", "Reorder threshold"], triggerId: "low-stock", actionIds: ["draft-po", "email"] },
  { id: "digest", title: "Morning stock digest", trigger: "Every weekday at 6:30 AM", actions: ["Count stock in the paint aisle", "Post a summary to #store-ops"], requiredInputs: [], triggerId: "weekly", actionIds: ["count", "post"] },
  { id: "price", title: "Supplier price update", trigger: "When a supplier uploads a new price file", actions: ["Update shelf prices", "Post a summary to #store-ops"], requiredInputs: ["Supplier"], triggerId: "price-file", actionIds: ["prices", "post"] },
];

const ORIGINAL = { trigger: "Store schedule", schedule: "Weekly on Mon at 7:00 AM (America/Chicago)", actions: ["Count stock in the paint aisle", "Email the supplier"] };

const TIME_ZONES = ["America/Chicago", "America/Denver", "America/Los_Angeles", "America/New_York"];

const DELIVERIES: FailedAutomationDelivery[] = [
  { id: "d1", title: "Restock email to Orgill", reason: "Mailbox full (552)", kind: "Email", timestamp: "Nov 19, 6:02 AM" },
  { id: "d2", title: "Shelf price webhook", reason: "POS returned HTTP 503", kind: "Webhook", timestamp: "Nov 19, 6:05 AM" },
  { id: "d3", title: "Summary post to #store-ops", reason: "Channel was archived", kind: "Chat", timestamp: "Nov 19, 6:07 AM", retryUnavailableReason: "Choose a new channel before retrying" },
];

const PAYLOADS: Record<string, string> = {
  d1: "to: orders@orgill.example\nsubject: Purchase order 1187\nattachments: po-1187.pdf",
  d2: "POST /pos/prices\n{ \"sku\": \"PNT-EXT-1G\", \"price\": 38.99 }",
  d3: "channel: #store-ops\ntext: Paint aisle count finished, 3 products below reorder point.",
};

const RUN_PARAMETERS: ToolParameter[] = [
  { name: "supplier", label: "Supplier", kind: "enum", required: true, options: [{ value: "orgill", label: "Orgill" }, { value: "do-it-best", label: "Do it Best" }] },
  { name: "threshold", label: "Reorder threshold", kind: "number" },
  { name: "note", label: "Note for the buyer", kind: "string" },
  { name: "rush", label: "Rush delivery", kind: "boolean" },
];

function scheduledRuns(schedule: AutomationSchedule, count: number): Date[] {
  const time = schedule.time ? parseTime(schedule.time) : null;
  if (!time) return [];
  const at = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hours, time.minutes);
  if (schedule.frequency === "once") return schedule.date && at(schedule.date) > NOW ? [at(schedule.date)] : [];
  const runs: Date[] = [];
  for (let offset = 0; runs.length < count && offset < 60; offset++) {
    const run = at(addDays(NOW, offset));
    if (run > NOW && (schedule.frequency === "daily" || schedule.weekdays.includes(run.getDay()))) runs.push(run);
  }
  return runs;
}

function paused(run: Date, pause: AutomationPauseWindow) {
  return run.getTime() >= Date.parse(pause.start) && run.getTime() < Date.parse(pause.end);
}

function describeSchedule(schedule: AutomationSchedule) {
  const parts = schedule.time ? parseTime(schedule.time) : null;
  const time = parts ? timeFormat.format(new Date(2026, 0, 1, parts.hours, parts.minutes)) : "no time set";
  const days = schedule.frequency === "weekly" ? "Weekly on " + [...schedule.weekdays].sort((a, b) => a - b).map((day) => DAY_NAMES[day]).join(", ")
    : schedule.frequency === "daily" ? "Daily" : "Once on " + (schedule.date ? dayFormat.format(schedule.date) : "no date");
  return `${days} at ${time} (${schedule.timeZone})`;
}

export function AutomationGallery() {
  const nextStep = useRef(3);
  const [template, setTemplate] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<string | null>("weekly");
  const [steps, setSteps] = useState<AutomationActionStep[]>([
    { id: "step-1", label: "Count stock in the paint aisle", detail: "Uses the latest scanner counts" },
    { id: "step-2", label: "Email the supplier" },
  ]);
  const [draft, setDraft] = useState<AutomationSchedule>({ frequency: "weekly", date: null, time: "06:30", timeZone: "America/Chicago", weekdays: [1, 3, 5] });
  const [schedule, setSchedule] = useState(draft);
  const [pause, setPause] = useState<AutomationPauseWindow>({ start: "2026-11-26T00:00", end: "2026-11-28T00:00" });
  const [retrySaved, setRetrySaved] = useState("");
  const [concurrencySaved, setConcurrencySaved] = useState("");
  const [deliveries, setDeliveries] = useState(DELIVERIES);
  const [retrying, setRetrying] = useState<string[]>([]);
  const [inspected, setInspected] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [automations, setAutomations] = useState<ToggleableAutomation[]>([
    { id: "digest", title: "Morning stock digest", enabled: true, nextRun: "Next run Fri, Nov 20 at 6:30 AM" },
    { id: "restock", title: "Low stock restock", enabled: false },
    { id: "price", title: "Supplier price update", enabled: true, nextRun: "Waiting for a price file" },
    { id: "staffing", title: "Weekend staffing post", enabled: false, unavailableReason: "Reconnect Slack to turn this on" },
  ]);
  const [toggling, setToggling] = useState<string[]>([]);
  const [runs, setRuns] = useState<AutomationHistoryRun[]>([
    { id: "run-3", title: "Morning stock digest", startedAt: "Nov 19, 6:30 AM", status: "Running", detail: "Counting the paint aisle" },
    { id: "run-2", title: "Supplier price update", startedAt: "Nov 18, 9:12 PM", status: "Succeeded", detail: "214 shelf prices updated" },
    { id: "run-1", title: "Low stock restock", startedAt: "Nov 18, 2:40 PM", status: "Failed", detail: "Supplier email bounced" },
  ]);
  const [openedRun, setOpenedRun] = useState<string | null>(null);
  const nextRun = useRef(4);

  const draftRun = scheduledRuns(draft, 8).find((run) => !paused(run, pause));
  const occurrences = scheduledRuns(schedule, 5).map((run): AutomationOccurrence => ({
    id: run.toISOString(),
    localDate: dayFormat.format(run),
    localTime: timeFormat.format(run),
    state: paused(run, pause) ? "skipped" : "scheduled",
    ...(paused(run, pause) ? { detail: "Inside the pause window" } : {}),
  }));
  const applied = TEMPLATES.find((item) => item.id === template);
  const opened = runs.find((run) => run.id === openedRun);
  const current = runs.find((run) => run.id === "run-3");

  function applyTemplate(id: string) {
    const chosen = TEMPLATES.find((item) => item.id === id);
    if (!chosen) return;
    setTemplate(id);
    setTrigger(chosen.triggerId);
    setSteps(chosen.actionIds.map((actionId) => ({ id: "step-" + nextStep.current++, label: ACTIONS.find((action) => action.id === actionId)?.label ?? actionId })));
  }

  function retry(id: string) {
    setRetrying((ids) => [...ids, id]);
    setTimeout(() => {
      setDeliveries((items) => items.filter((item) => item.id !== id));
      setRetrying((ids) => ids.filter((item) => item !== id));
      setInspected((item) => (item === id ? null : item));
    }, 1200);
  }

  function toggle(id: string, enabled: boolean) {
    setToggling((ids) => [...ids, id]);
    setTimeout(() => {
      setAutomations((items) => items.map((item) => (item.id === id ? { ...item, enabled } : item)));
      setToggling((ids) => ids.filter((item) => item !== id));
    }, 700);
  }

  return (
    <GallerySection id="gallery-automation" title="Automations">
      <Demo title="Templates, triggers and actions" className="grid w-full items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AutomationTemplatePicker templates={TEMPLATES} onSelect={applyTemplate} />
        <div className="min-w-0 space-y-2">
          <AutomationTriggerPicker triggers={TRIGGERS} value={trigger} onChange={setTrigger} />
          <p role="status" className="text-sm text-muted-foreground">{applied ? `Using the ${applied.title} template.` : "Not based on a template."}</p>
        </div>
        <AutomationActionBuilder steps={steps} actions={ACTIONS}
          onAdd={(actionId) => setSteps((items) => [...items, { id: "step-" + nextStep.current++, label: ACTIONS.find((action) => action.id === actionId)?.label ?? actionId }])}
          onRemove={(stepId) => setSteps((items) => items.filter((item) => item.id !== stepId))}
          onReorder={(ids) => setSteps((items) => ids.flatMap((id) => items.filter((item) => item.id === id)))} />
      </Demo>
      <Demo title="Schedule, pause window and execution window" className="grid w-full items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AutomationScheduleEditor initialValue={schedule} timeZones={TIME_ZONES} onDraftChange={setDraft}
          {...(draftRun ? { nextRun: `${dayFormat.format(draftRun)} at ${timeFormat.format(draftRun)} (${draft.timeZone})` } : {})}
          onSubmit={async (value) => { await wait(600); setSchedule(value); }} />
        <AutomationOccurrencePreview occurrences={occurrences} timeZone={schedule.timeZone} />
        <div className="min-w-0 space-y-3">
          <AutomationPauseWindowEditor initialValue={pause} onSubmit={async (value) => { await wait(500); setPause(value); }} />
          <AutomationExecutionWindowIndicator window={{ eligible: false, reason: "Shelf price updates run only while the store is closed, 8:00 PM to 7:00 AM.", nextEligibleAt: "Today at 8:00 PM" }} />
        </div>
      </Demo>
      <Demo title="Retries, concurrency and failed deliveries" className="grid w-full items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <AutomationRetryPolicyEditor initialValue={{ attempts: 3, delaySeconds: 60, mode: "exponential" }}
            onSubmit={async (policy) => { await wait(500); setRetrySaved(`Retries saved: up to ${policy.attempts} attempts, ${policy.mode} delay from ${policy.delaySeconds} seconds.`); }} />
          <p role="status" className="text-sm text-muted-foreground">{retrySaved}</p>
        </div>
        <div className="min-w-0 space-y-2">
          <AutomationConcurrencyEditor initialValue={{ maxActiveRuns: 1, overlapPolicyId: "queue" }}
            policies={[{ id: "skip", label: "Skip the new run" }, { id: "queue", label: "Queue the new run" }, { id: "replace", label: "Stop the active run and start over" }]}
            onSubmit={async (value) => { await wait(500); setConcurrencySaved(`Concurrency saved: up to ${value.maxActiveRuns} active ${value.maxActiveRuns === 1 ? "run" : "runs"}.`); }} />
          <p role="status" className="text-sm text-muted-foreground">{concurrencySaved}</p>
        </div>
        <div className="min-w-0 space-y-2">
          <AutomationDeadLetterQueue deliveries={deliveries} pendingIds={retrying} onRetry={retry} onInspect={setInspected} />
          {inspected && PAYLOADS[inspected] && (
            <figure className="rounded-md border border-border bg-muted/30 p-2">
              <figcaption className="text-xs text-muted-foreground">Payload · {DELIVERIES.find((item) => item.id === inspected)?.title}</figcaption>
              <pre className="mt-1 text-xs break-words whitespace-pre-wrap"><code>{PAYLOADS[inspected]}</code></pre>
            </figure>
          )}
        </div>
      </Demo>
      <Demo title="Review before saving" className="grid w-full items-start gap-3 md:grid-cols-2">
        <AutomationChangeReview before={ORIGINAL} after={{
          trigger: TRIGGERS.find((item) => item.id === trigger)?.label ?? "No trigger",
          schedule: describeSchedule(schedule),
          actions: steps.map((step) => step.label),
        }} />
        <div className="min-w-0 space-y-2">
          <AutomationDryRunReview onReviewApproval={setReviewing} actions={[
            { id: "po", title: "Draft a purchase order", requiresApproval: true, detail: "Purchase order total $612.40 to Orgill",
              affectedItems: ["Exterior latex paint, 1 gal × 8", "Painter's tape, 2 in × 24", "Roller covers, 9 in × 30"] },
            { id: "mail", title: "Email the supplier", detail: "Sends one email with the purchase order attached", affectedItems: ["orders@orgill.example"] },
            { id: "summary", title: "Post a summary to #store-ops", detail: "Changes no products", affectedItems: [] },
          ]} />
          <p role="status" className="text-sm text-muted-foreground">{reviewing ? "The purchase order is waiting for a manager's sign-off." : ""}</p>
        </div>
      </Demo>
      <Demo title="Runs" className="grid w-full items-start gap-3 md:grid-cols-2">
        <AutomationToggleList automations={automations} pendingIds={toggling} onToggle={toggle} />
        <div className="min-w-0 space-y-2">
          <AutomationRunHistory runs={runs} onOpen={setOpenedRun} />
          {opened && <p role="status" className="text-sm text-muted-foreground">Showing {opened.title} from {opened.startedAt}: {opened.status.toLowerCase()}{opened.detail ? ", " + opened.detail.toLowerCase() : ""}.</p>}
        </div>
        <AutomationRunInputForm automationId="restock" automationName="Low stock restock" parameters={RUN_PARAMETERS} initialValues={{ threshold: 12 }}
          onRun={async (_id, values) => {
            await wait(700);
            const supplier = values.supplier === "orgill" ? "Orgill" : "Do it Best";
            setRuns((items) => [{ id: "run-" + nextRun.current++, title: "Low stock restock", startedAt: "Just now", status: "Queued", detail: "Ordering from " + supplier }, ...items]);
          }} />
        <AutomationRunCancellation runId="run-3" name="Morning stock digest, started Nov 19 at 6:30 AM"
          affected={["The paint aisle count stops where it is", "The summary post to #store-ops is not sent"]}
          {...(current?.status === "Cancelled" ? { unavailableReason: "This run was cancelled." } : {})}
          onConfirm={async (id) => {
            await wait(800);
            setRuns((items) => items.map((run) => (run.id === id ? { ...run, status: "Cancelled", detail: "Cancelled by you" } : run)));
          }} />
      </Demo>
    </GallerySection>
  );
}
