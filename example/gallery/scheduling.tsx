// packages/ai-ui/example/gallery/scheduling.tsx
import { useState } from "react";

import {
  addDays,
  type CalendarEvent,
  DatePicker,
  DateRangePicker,
  type DateRangeValue,
  EventCalendar,
  KanbanBoard,
  type KanbanCard,
  type KanbanColumn,
  startOfDay,
  startOfWeek,
  Timeline,
  type TimelineItem,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const TODAY = startOfDay(new Date());
const MONDAY = addDays(startOfWeek(TODAY, 0), 1);

function at(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const date = addDays(base, dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const EVENTS: CalendarEvent[] = [
  { id: "standup", title: "Stand-up", start: at(MONDAY, -7, 9), end: at(MONDAY, -7, 9, 30), recurrence: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", color: "var(--chart-2)" },
  { id: "truck", title: "Orgill truck delivery", start: at(MONDAY, 1, 10), end: at(MONDAY, 1, 11, 30), location: "Dock B", color: "var(--chart-1)" },
  { id: "count", title: "Cycle count: aisle 7", start: at(MONDAY, 1, 10, 30), end: at(MONDAY, 1, 12), color: "var(--chart-3)" },
  { id: "vendor", title: "Vendor call", start: at(MONDAY, 2, 14), end: at(MONDAY, 2, 15), location: "Zoom" },
  { id: "payroll", title: "Payroll cutoff", start: at(MONDAY, 3, 0), end: at(MONDAY, 3, 0), allDay: true, color: "var(--chart-4)" },
  { id: "inventory", title: "Quarterly inventory", start: at(MONDAY, 0, 0), end: at(MONDAY, 1, 0), allDay: true, readOnly: true },
  { id: "training", title: "Forklift training", start: at(MONDAY, 4, 13), end: at(MONDAY, 4, 16), location: "Warehouse", color: "var(--chart-5)" },
  { id: "close", title: "Saturday close", start: at(MONDAY, 5, 16), end: at(MONDAY, 5, 18), location: "Front counter" },
];

const COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "To do" },
  { id: "doing", title: "In progress", limit: 2 },
  { id: "done", title: "Done" },
];

const CARDS: KanbanCard[] = [
  { id: "c1", columnId: "todo", title: "Reorder paint rollers", rank: 1, labels: [{ text: "Purchasing", color: "var(--chart-1)" }], due: addDays(TODAY, 2) },
  { id: "c2", columnId: "todo", title: "Update aisle signage", rank: 2, assignee: "Dana" },
  { id: "c3", columnId: "todo", title: "Return damaged mower", rank: 3, description: "RMA 4471, ships Friday.", due: addDays(TODAY, -1) },
  { id: "c4", columnId: "doing", title: "Count drawers", rank: 1, assignee: "Luis", labels: [{ text: "Cash", color: "var(--chart-4)" }] },
  { id: "c5", columnId: "doing", title: "Price check: fasteners", rank: 2 },
  { id: "c6", columnId: "done", title: "Clean key machine", rank: 1, assignee: "Dana" },
];

const ACTIVITY: TimelineItem[] = [
  { id: "t1", title: "Drawer 2 counted", time: at(TODAY, 0, 8, 5), description: "$412.50 · balanced", tone: "success" },
  { id: "t2", title: "Shift swapped", time: at(TODAY, 0, 7, 40), description: "Luis covers Saturday close.", badges: ["manual"] },
  { id: "t3", title: "Orgill sync failed", time: at(TODAY, -1, 22, 15), description: "FTP timeout; retried at 22:30.", tone: "danger" },
  { id: "t4", title: "Price file imported", time: at(TODAY, -1, 6), description: "1,284 SKUs updated.", tone: "info" },
];

export function SchedulingGallery() {
  const [events, setEvents] = useState(EVENTS);
  const [cards, setCards] = useState(CARDS);
  const [delivery, setDelivery] = useState<Date | null>(addDays(TODAY, 3));
  const [range, setRange] = useState<DateRangeValue | null>({ start: addDays(TODAY, -6), end: TODAY });
  const [lastAction, setLastAction] = useState("Drag an event, or click an empty slot to add one.");

  return (
    <GallerySection id="gallery-scheduling" title="Calendar, date pickers and boards">
      <Demo title="Event calendar" className="flex w-full flex-col gap-2">
        <EventCalendar
          events={events}
          defaultView="week"
          height={420}
          scrollToHour={8}
          onEventChange={(event, change) => {
            setEvents((current) => current.map((item) => (item.id === event.id ? { ...item, ...change } : item)));
            setLastAction(`Moved "${event.title}" to ${change.start.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`);
          }}
          onCreate={(slot) => {
            const id = `new-${events.length + 1}`;
            setEvents((current) => [...current, { id, title: "New event", ...slot }]);
            setLastAction(`Created an event at ${slot.start.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`);
          }}
          onEventClick={(occurrence) => setLastAction(`Opened "${occurrence.event.title}".`)}
          className="w-full"
        />
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {lastAction}
        </p>
      </Demo>
      <Demo title="Date pickers">
        <DatePicker label="Delivery date" value={delivery} onValueChange={setDelivery} min={TODAY} />
        <DateRangePicker label="Report period" value={range} onValueChange={setRange} max={TODAY} />
      </Demo>
      <Demo title="Kanban board" className="w-full">
        <KanbanBoard
          label="Store tasks"
          columns={COLUMNS}
          cards={cards}
          onCardMove={(cardId, columnId, rank) => setCards((current) => current.map((card) => (card.id === cardId ? { ...card, columnId, rank } : card)))}
          onCardAdd={(columnId, title) =>
            setCards((current) => {
              const ranks = current.filter((card) => card.columnId === columnId).map((card) => card.rank);
              return [...current, { id: `c${current.length + 1}`, columnId, title, rank: ranks.length ? Math.max(...ranks) + 1 : 1 }];
            })
          }
          className="w-full"
        />
      </Demo>
      <Demo title="Activity timeline" className="w-full max-w-lg">
        <Timeline items={ACTIVITY} groupByDay className="w-full" />
      </Demo>
    </GallerySection>
  );
}
