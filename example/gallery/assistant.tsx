// packages/ai-ui/example/gallery/assistant.tsx
import { useState } from "react";

import {
  AssistantAvailabilityPicker,
  AssistantAvailabilityPollReview,
  AssistantConflictReview,
  AssistantContactPicker,
  AssistantDailyBriefing,
  AssistantDailyPlanEditor,
  AssistantDraftReview,
  AssistantFollowUpList,
  AssistantInboxTriage,
  AssistantNotificationPreferences,
  AssistantReminderEditor,
  AssistantRoutineChecklist,
  AssistantRoutineEditor,
  MeetingActionsReview,
  MeetingPrepCard,
  PersonalCommitmentsTimeline,
  type AssistantFollowUp,
  type AssistantInboxItem,
  type AssistantNotificationOption,
  type AssistantReminderValue,
  type AssistantRoutineDraft,
  type AssistantScheduleConflict,
  type DailyPlanTask,
  type MeetingActionSuggestion,
  type RoutineChecklistStep,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const GRID = "grid w-full grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3";

const BRIEFING = {
  agenda: [
    { id: "a1", title: "Supplier call with Orgill", detail: "9:00 AM · Spring order and fill rates" },
    { id: "a2", title: "Interview for weekend cashier", detail: "1:30 PM · Back office" },
  ],
  priorities: [
    { id: "p1", title: "Confirm the lumber delivery window", detail: "Truck arrives Friday" },
    { id: "p2", title: "Sign off on the paint promotion", detail: "Signage prints at 3 PM" },
  ],
  followUps: [{ id: "f1", title: "Reply to Luis about the mower repair", detail: "He asked for a quote yesterday" }],
};

const BLOCKS = [
  { id: "early", label: "7:30 to 9:00 AM" },
  { id: "midday", label: "11:00 AM to 12:30 PM" },
  { id: "lunch", label: "12:30 to 1:30 PM", unavailable: true },
  { id: "late", label: "3:00 to 5:00 PM" },
];

const COMMITMENTS = [
  { id: "c1", title: "Parent-teacher conference", day: "Today", time: "4:30 PM", source: "School email" },
  { id: "c2", title: "Pick up dry cleaning", day: "Today", source: "Reminder" },
  { id: "c3", title: "Dinner with the Patels", day: "Saturday", time: "7:00 PM", source: "Calendar invite" },
  { id: "c4", title: "Renew the truck registration", day: "Monday", source: "Mailed notice" },
];

const SLOTS = [
  { id: "tue-9", label: "Tue 9:00 AM" },
  { id: "tue-11", label: "Tue 11:00 AM", unavailableReason: "Delivery check-in" },
  { id: "wed-2", label: "Wed 2:00 PM" },
  { id: "thu-10", label: "Thu 10:30 AM" },
];

const POLL_PARTICIPANTS = [
  { id: "dana", label: "Dana Whitten" },
  { id: "sam", label: "Sam Patel" },
  { id: "rosa", label: "Rosa Lin" },
];

const POLL_SLOTS = [
  { id: "mon-8", label: "Mon 8:00 AM", responses: { dana: "yes", sam: "maybe", rosa: "yes" } },
  { id: "tue-4", label: "Tue 4:00 PM", responses: { dana: "no", sam: "yes" } },
  { id: "wed-7", label: "Wed 7:30 AM", responses: { dana: "yes", sam: "yes", rosa: "yes" } },
] as const;

const CONTACTS = [
  { id: "dana", label: "Dana Whitten", kind: "person", detail: "Store manager" },
  { id: "sam", label: "Sam Patel", kind: "person", detail: "Contractor account" },
  { id: "floor", label: "Floor staff", kind: "group", detail: "9 people" },
  { id: "suppliers", label: "Regional suppliers", kind: "group", detail: "Orgill, Do it Best" },
] as const;

const MEETING = {
  title: "Quarterly review with Orgill",
  time: "Thursday, 2:00 PM to 3:00 PM",
  agenda: ["Q3 fill rates and backorders", "Spring promotion allowances", "Freight minimums for small orders"],
  attendees: ["Dana Whitten", "Orgill account rep", "Sam Patel"],
  materials: [
    { id: "fill", title: "Q3 fill rate report" },
    { id: "promo", title: "Spring promotion calendar" },
  ],
  questions: ["Can lead times on deck screws drop below two weeks?", "Is the freight minimum negotiable for mixed pallets?"],
};

const ZONES = ["America/Chicago", "America/Denver", "America/New_York"];

const INITIAL_ROUTINE: AssistantRoutineDraft = {
  title: "Opening routine",
  steps: [
    { id: "unlock", title: "Unlock doors and disarm the alarm" },
    { id: "till", title: "Count the till" },
    { id: "orders", title: "Check overnight web orders" },
  ],
  frequency: "daily",
  time: "07:15",
  timeZone: "America/Chicago",
};

function pause(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Note({ children }: { children: string }) {
  return <p role="status" className="text-sm text-muted-foreground">{children}</p>;
}

export function AssistantGallery() {
  const [briefingNote, setBriefingNote] = useState("Nothing opened yet.");
  const [timelineNote, setTimelineNote] = useState("4 commitments this week.");
  const [prepNote, setPrepNote] = useState("2 materials attached.");
  const [conflictNote, setConflictNote] = useState("2 conflicts to resolve.");
  const [tasks, setTasks] = useState<DailyPlanTask[]>([
    { id: "t1", title: "Count the cash drawer", blockId: "early" },
    { id: "t2", title: "Call the paint rep", blockId: null },
    { id: "t3", title: "Restock the fastener aisle", blockId: "late" },
  ]);
  const [followUps, setFollowUps] = useState<AssistantFollowUp[]>([
    { id: "u1", title: "Call Luis about the mower repair", detail: "He wants a quote before Friday.", due: "Today, 4:00 PM" },
    { id: "u2", title: "Email Sam the deck stain estimate", due: "Tomorrow" },
    { id: "u3", title: "Check on the backordered faucets", detail: "Orgill said they ship this week." },
  ]);
  const [followUpPending, setFollowUpPending] = useState<string[]>([]);
  const [inbox, setInbox] = useState<AssistantInboxItem[]>([
    { id: "i1", title: "Invoice from Orgill", kind: "Email", detail: "Due in 10 days" },
    { id: "i2", title: "Voicemail from Rosa Lin", kind: "Voicemail", detail: "Asks about a key copy order", allowed: ["follow-up", "defer"] },
    { id: "i3", title: "Weekly sales summary", kind: "Report", allowed: ["file"] },
  ]);
  const [inboxNote, setInboxNote] = useState("3 items waiting.");
  const [draftNote, setDraftNote] = useState("Waiting for your review.");
  const [slot, setSlot] = useState<string | null>("wed-2");
  const [proposed, setProposed] = useState("No time proposed yet.");
  const [conflicts, setConflicts] = useState<AssistantScheduleConflict[]>([
    {
      id: "k1",
      title: "Supplier call overlaps the staff huddle",
      commitments: ["9:00 AM Supplier call with Orgill", "9:15 AM Staff huddle"],
      resolutions: [
        { id: "move", label: "Move the huddle to 10:00 AM", detail: "Everyone on shift is free then." },
        { id: "skip", label: "Skip the huddle this week", detail: "Post the notes in the staff chat instead." },
      ],
    },
    {
      id: "k2",
      title: "Lumber delivery overlaps lunch with Sam",
      commitments: ["12:00 PM Lumber delivery", "12:30 PM Lunch with Sam Patel"],
      resolutions: [{ id: "later", label: "Push lunch to 1:30 PM" }],
    },
  ]);
  const [resolving, setResolving] = useState<string[]>([]);
  const [contact, setContact] = useState<string | null>("dana");
  const [actions, setActions] = useState<MeetingActionSuggestion[]>([
    { id: "m1", title: "Send Orgill the revised spring order", detail: "Dana agreed to add two pallets of mulch." },
    { id: "m2", title: "Ask for a freight quote on mixed pallets" },
  ]);
  const [actionNote, setActionNote] = useState("2 suggested actions.");
  const [reminders, setReminders] = useState<AssistantReminderValue[]>([]);
  const [routineNote, setRoutineNote] = useState("Runs daily at 7:15 AM.");
  const [steps, setSteps] = useState<RoutineChecklistStep[]>([
    { id: "s1", title: "Unlock doors and disarm the alarm", checked: true },
    { id: "s2", title: "Count the till", checked: false },
    { id: "s3", title: "Check overnight web orders", checked: false },
  ]);
  const [notifications, setNotifications] = useState<AssistantNotificationOption[]>([
    { id: "push-brief", channel: "Push", event: "Morning briefing", enabled: true },
    { id: "text-delivery", channel: "Text", event: "Delivery arrived", enabled: true },
    { id: "email-week", channel: "Email", event: "Weekly sales recap", enabled: false },
  ]);

  function finishFollowUp(id: string, snooze: boolean) {
    setFollowUpPending((current) => [...current, id]);
    void pause().then(() => {
      setFollowUpPending((current) => current.filter((entry) => entry !== id));
      setFollowUps((current) => {
        const item = current.find((entry) => entry.id === id);
        const rest = current.filter((entry) => entry.id !== id);
        return snooze && item ? [...rest, { ...item, due: "Next Monday" }] : rest;
      });
    });
  }

  function choose(conflictId: string, resolutionId: string) {
    const conflict = conflicts.find((entry) => entry.id === conflictId);
    const resolution = conflict?.resolutions.find((entry) => entry.id === resolutionId);
    setResolving((current) => [...current, conflictId]);
    void pause().then(() => {
      setResolving((current) => current.filter((entry) => entry !== conflictId));
      setConflicts((current) => current.filter((entry) => entry.id !== conflictId));
      if (resolution) setConflictNote("Resolved: " + resolution.label + ".");
    });
  }

  return (
    <GallerySection id="gallery-assistant" title="Assistant planning and meetings">
      <Demo title="Daily briefing and plan" className={GRID}>
        <div className="space-y-2">
          <AssistantDailyBriefing briefing={BRIEFING} onOpen={(_section, id) => {
            const item = [...BRIEFING.agenda, ...BRIEFING.priorities, ...BRIEFING.followUps].find((entry) => entry.id === id);
            if (item) setBriefingNote("Opened " + item.title + ".");
          }} />
          <Note>{briefingNote}</Note>
        </div>
        <AssistantDailyPlanEditor tasks={tasks} blocks={BLOCKS}
          onReorder={(ids) => setTasks((current) => ids.flatMap((id) => current.filter((task) => task.id === id)))}
          onPlace={(taskId, blockId) => setTasks((current) => current.map((task) => task.id === taskId ? { ...task, blockId } : task))} />
        <div className="space-y-2">
          <PersonalCommitmentsTimeline items={COMMITMENTS} onOpen={(id) => {
            const item = COMMITMENTS.find((entry) => entry.id === id);
            if (item) setTimelineNote("Opened the " + (item.source ?? "source").toLowerCase() + " for " + item.title + ".");
          }} />
          <Note>{timelineNote}</Note>
        </div>
      </Demo>

      <Demo title="Follow-ups, inbox and drafts" className={GRID}>
        <AssistantFollowUpList items={followUps} pendingIds={followUpPending}
          onComplete={(id) => finishFollowUp(id, false)} onSnooze={(id) => finishFollowUp(id, true)} />
        <div className="space-y-2">
          <AssistantInboxTriage items={inbox} onOpen={(id) => setInboxNote("Opened " + (inbox.find((item) => item.id === id)?.title ?? "item") + ".")}
            onTriage={(id, action) => {
              const item = inbox.find((entry) => entry.id === id);
              setInbox((current) => current.filter((entry) => entry.id !== id));
              setInboxNote((action === "file" ? "Filed " : action === "defer" ? "Deferred " : "Added a follow-up for ") + (item?.title ?? "item") + ".");
            }} />
          <Note>{inboxNote}</Note>
        </div>
        <div className="space-y-2">
          <AssistantDraftReview recipient="Sam Patel · Patel Decks"
            initialText={"Hi Sam,\n\nThe cedar boards you asked about arrive Thursday. We can hold twelve for you until Saturday.\n\nThanks,\nDana"}
            onDecide={async (decision) => {
              await pause();
              setDraftNote(decision === "approve" ? "Draft sent to Sam Patel." : "Returned to the assistant for revision.");
            }} />
          <Note>{draftNote}</Note>
        </div>
      </Demo>

      <Demo title="Scheduling and contacts" className={GRID}>
        <AssistantAvailabilityPicker slots={SLOTS} timeZone="America/Chicago" value={slot} onChange={setSlot} />
        <div className="space-y-2">
          <AssistantAvailabilityPollReview slots={POLL_SLOTS} participants={POLL_PARTICIPANTS} timeZone="America/Chicago"
            onPropose={async (id) => {
              await pause();
              setProposed("Proposed " + (POLL_SLOTS.find((entry) => entry.id === id)?.label ?? id) + " to everyone.");
            }} />
          <Note>{proposed}</Note>
        </div>
        <div className="space-y-2">
          <AssistantConflictReview conflicts={conflicts} pendingIds={resolving} onChoose={choose} />
          <Note>{conflictNote}</Note>
        </div>
        <AssistantContactPicker contacts={CONTACTS} value={contact} onSelect={(id) => setContact(id)} />
      </Demo>

      <Demo title="Meeting preparation and actions" className={GRID}>
        <div className="space-y-2">
          <MeetingPrepCard meeting={MEETING} onOpenMaterial={(id) => setPrepNote("Opened " + (MEETING.materials.find((item) => item.id === id)?.title ?? "material") + ".")} />
          <Note>{prepNote}</Note>
        </div>
        <div className="space-y-2">
          <MeetingActionsReview actions={actions} onDecide={async (id, decision, title) => {
            await pause();
            setActions((current) => current.filter((item) => item.id !== id));
            setActionNote(decision === "accept" ? "Added to tasks: " + title + "." : "Dismissed one suggestion.");
          }} />
          <Note>{actionNote}</Note>
        </div>
      </Demo>

      <Demo title="Reminders, routines and notifications" className={GRID}>
        <div className="space-y-2">
          <AssistantReminderEditor timeZone="America/Chicago" onSubmit={async (value) => {
            await pause();
            setReminders((current) => [...current, value]);
          }} />
          {reminders.length > 0 && (
            <ul aria-label="Saved reminders" className="list-disc ps-5 text-sm">
              {reminders.map((reminder, index) => (
                <li key={index}>{reminder.title} · {reminder.date.toLocaleDateString()} at {reminder.time}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <AssistantRoutineEditor initialValue={INITIAL_ROUTINE} timeZones={ZONES} onSubmit={async (draft) => {
            await pause();
            setRoutineNote(draft.title + " saved with " + draft.steps.length + (draft.steps.length === 1 ? " step." : " steps."));
          }} />
          <Note>{routineNote}</Note>
        </div>
        <AssistantRoutineChecklist occurrenceId="open-thu" occurrenceLabel="Opening routine · Thursday" steps={steps}
          onChange={(_occurrence, stepId, checked) => setSteps((current) => current.map((step) => step.id === stepId ? { ...step, checked } : step))} />
        <AssistantNotificationPreferences options={notifications} onSave={async (values) => {
          await pause();
          setNotifications((current) => current.map((option) => ({ ...option, enabled: values[option.id] ?? option.enabled })));
        }} />
      </Demo>
    </GallerySection>
  );
}
