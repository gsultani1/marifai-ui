// packages/ai-ui/src/components/kanban-board.tsx
"use client";

import { CalendarIcon, GripVerticalIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { type ComponentProps, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useId, useState } from "react";

import { focusRing, iconButton, toneSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { rankBetween, startOfDay, toDate } from "../lib/dates.js";
import { ActionMenu } from "./action-menu.js";

export interface KanbanColumn {
  id: string;
  title: string;
  /** Work-in-progress limit; the header warns when exceeded. */
  limit?: number;
}

export interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  /** Sort key within the column; use `rankBetween` for new positions. */
  rank: number;
  description?: string;
  labels?: Array<{ text: string; color?: string }>;
  assignee?: string;
  due?: Date | string;
}

export interface KanbanBoardProps extends Omit<ComponentProps<"section">, "children"> {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onCardMove: (cardId: string, columnId: string, rank: number) => void;
  onCardAdd?: (columnId: string, title: string) => void;
  onCardClick?: (card: KanbanCard) => void;
  /** Replaces the card body. */
  renderCard?: (card: KanbanCard) => ReactNode;
  label?: string;
  readOnly?: boolean;
}

interface Drag {
  card: KanbanCard;
  start: { x: number; y: number };
  pointer: { x: number; y: number };
  offset: { x: number; y: number };
  width: number;
  active: boolean;
  target: { columnId: string; index: number } | null;
}

function sortCards(cards: KanbanCard[], columnId: string): KanbanCard[] {
  return cards.filter((card) => card.columnId === columnId).sort((a, b) => a.rank - b.rank);
}

/** Rank for dropping at `index` among `cards` (already excluding the moving card). */
export function rankAt(cards: KanbanCard[], index: number): number {
  return rankBetween(cards[index - 1]?.rank, cards[index]?.rank);
}

/**
 * Task board with columns and cards. Drag cards with mouse, pen or touch
 * (the card stays dimmed in place, a line shows where it lands, Escape
 * cancels), or use the keyboard:
 * Alt+Left/Right moves a card between columns and Alt+Up/Down reorders it;
 * every card also has a Move menu. Columns show work-in-progress limits and
 * accept new cards inline. Order uses fractional ranks, so a move updates
 * one card.
 */
export function KanbanBoard({ columns, cards, onCardMove, onCardAdd, onCardClick, renderCard, label = "Board", readOnly = false, className, ...props }: KanbanBoardProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [adding, setAdding] = useState<{ columnId: string; title: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const id = useId();

  useEffect(() => {
    if (!drag?.active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrag(null);
        setAnnouncement("Move cancelled");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drag?.active]);

  const columnTitle = (columnId: string) => columns.find((column) => column.id === columnId)?.title ?? columnId;

  const move = (card: KanbanCard, columnId: string, index: number) => {
    const target = sortCards(cards, columnId).filter((item) => item.id !== card.id);
    const clamped = Math.max(0, Math.min(index, target.length));
    onCardMove(card.id, columnId, rankAt(target, clamped));
    setAnnouncement(`${card.title} moved to ${columnTitle(columnId)}, position ${clamped + 1} of ${target.length + 1}`);
    requestAnimationFrame(() => document.getElementById(`${id}-card-${card.id}`)?.focus());
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, card: KanbanCard) => {
    if (readOnly || !event.altKey) return;
    const columnIndex = columns.findIndex((column) => column.id === card.columnId);
    const list = sortCards(cards, card.columnId);
    const index = list.findIndex((item) => item.id === card.id);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const next = columns[columnIndex + (event.key === "ArrowLeft" ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      move(card, next.id, Math.min(index, sortCards(cards, next.id).length));
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const nextIndex = index + (event.key === "ArrowUp" ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= list.length) return;
      event.preventDefault();
      move(card, card.columnId, nextIndex);
    }
  };

  const targetFor = (x: number, y: number, card: KanbanCard): Drag["target"] => {
    const column = document.elementFromPoint?.(x, y)?.closest<HTMLElement>("[data-kanban-column]");
    const columnId = column?.dataset.kanbanColumn;
    if (!column || !columnId) return null;
    const others = [...column.querySelectorAll<HTMLElement>("[data-kanban-card]")].filter((element) => element.dataset.kanbanCard !== card.id);
    let index = others.length;
    for (let position = 0; position < others.length; position++) {
      const rect = others[position]!.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        index = position;
        break;
      }
    }
    return { columnId, index };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, card: KanbanCard) => {
    if (readOnly || event.button !== 0 || (event.target as HTMLElement).closest("[data-no-drag]")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ card, start: { x: event.clientX, y: event.clientY }, pointer: { x: event.clientX, y: event.clientY }, offset: { x: event.clientX - rect.left, y: event.clientY - rect.top }, width: rect.width, active: false, target: null });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const active = drag.active || Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > 5;
    if (!active) return;
    setDrag({ ...drag, active, pointer: { x: event.clientX, y: event.clientY }, target: targetFor(event.clientX, event.clientY, drag.card) });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const { card, active, target } = drag;
    setDrag(null);
    if (!active) {
      onCardClick?.(card);
      return;
    }
    if (target) move(card, target.columnId, target.index);
  };

  const formatDue = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const today = startOfDay(new Date());

  const cardBody = (card: KanbanCard) =>
    renderCard ? (
      renderCard(card)
    ) : (
      <>
        {card.labels && card.labels.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {card.labels.map((item) => (
              <span key={item.text} className="rounded-full border px-1.5 text-[10px] font-medium" style={{ borderColor: item.color ?? "var(--border)" }}>
                {item.text}
              </span>
            ))}
          </span>
        )}
        <span className="font-medium">{card.title}</span>
        {card.description && <span className="line-clamp-2 text-xs text-muted-foreground">{card.description}</span>}
        {(card.assignee || card.due) && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {card.due && (
              <span className={cn("inline-flex items-center gap-1", startOfDay(toDate(card.due)) < today && "font-medium text-destructive")}>
                <CalendarIcon aria-hidden="true" className="size-3" />
                {formatDue.format(toDate(card.due))}
                {startOfDay(toDate(card.due)) < today && <span className="sr-only"> (overdue)</span>}
              </span>
            )}
            {card.assignee && <span className="ml-auto truncate">{card.assignee}</span>}
          </span>
        )}
      </>
    );

  return (
    <section aria-label={label} data-slot="kanban-board" className={cn("flex min-h-0 flex-col gap-2 text-sm", className)} {...props}>
      <p id={`${id}-help`} className="sr-only">
        Press Alt and the left or right arrow to move a card to another column, Alt and up or down to reorder it.
      </p>
      <div className="flex min-h-0 gap-3 overflow-x-auto pb-2" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDrag(null)}>
        {columns.map((column) => {
          const list = sortCards(cards, column.id);
          const over = column.limit !== undefined && list.length > column.limit;
          const showIndicator = drag?.active && drag.target?.columnId === column.id;
          const dragging = drag?.active ? drag.card.id : null;
          const others = list.filter((card) => card.id !== dragging);
          return (
            <div
              key={column.id}
              role="group"
              aria-labelledby={`${id}-column-${column.id}`}
              data-kanban-column={column.id}
              className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2", over ? "border-destructive/60" : "border-border", showIndicator && "ring-2 ring-ring/40")}
            >
              <div className="flex items-center gap-2 px-1">
                <h3 id={`${id}-column-${column.id}`} className="min-w-0 flex-1 truncate font-medium">
                  {column.title}
                </h3>
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", over ? cn("border font-medium", toneSurface.danger) : "text-muted-foreground")}>
                  {column.limit !== undefined ? `${list.length} / ${column.limit}` : list.length}
                  {over && <span className="sr-only"> (over the limit)</span>}
                </span>
              </div>
              <ol className="flex min-h-12 flex-col gap-2">
                {list.map((card, index) => (
                  <li key={card.id} className="relative">
                    {showIndicator && card.id !== dragging && drag.target?.index === others.indexOf(card) && <span aria-hidden="true" className="absolute -top-1.5 right-0 left-0 h-0.5 rounded bg-primary" />}
                    <div
                      data-kanban-card={card.id}
                      onPointerDown={(event) => onPointerDown(event, card)}
                      className={cn("group flex touch-none items-start gap-1 rounded-md border border-border bg-card p-2.5 text-card-foreground shadow-xs select-none hover:border-muted-foreground", !readOnly && "cursor-grab", card.id === dragging && "border-dashed opacity-40")}
                    >
                      <div
                        id={`${id}-card-${card.id}`}
                        role="button"
                        tabIndex={0}
                        aria-describedby={readOnly ? undefined : `${id}-help`}
                        aria-keyshortcuts={readOnly ? undefined : "Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onCardClick?.(card);
                          } else onCardKeyDown(event, card);
                        }}
                        className={cn("flex min-w-0 flex-1 flex-col gap-1.5 rounded-sm", focusRing)}
                      >
                        {cardBody(card)}
                      </div>
                      {!readOnly && (
                        <span data-no-drag="" className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                          <ActionMenu
                            align="end"
                            trigger={
                              <button type="button" aria-label={`Move ${card.title}`} className={cn(iconButton, "size-6", focusRing)}>
                                <MoreHorizontalIcon aria-hidden="true" />
                              </button>
                            }
                            items={[
                              ...columns.filter((item) => item.id !== column.id).map((item) => ({ id: item.id, label: `Move to ${item.title}`, onSelect: () => move(card, item.id, sortCards(cards, item.id).length) })),
                              { type: "separator" as const, id: "sep" },
                              { id: "top", label: "Move to top", disabled: index === 0, onSelect: () => move(card, column.id, 0) },
                              { id: "bottom", label: "Move to bottom", disabled: index === list.length - 1, onSelect: () => move(card, column.id, list.length) },
                            ]}
                          />
                        </span>
                      )}
                    </div>
                  </li>
                ))}
                {showIndicator && drag.target?.index === others.length && <li aria-hidden="true" className="h-0.5 rounded bg-primary" />}
                {list.length === 0 && !showIndicator && <li className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">{readOnly ? "No cards" : "Drop cards here"}</li>}
              </ol>
              {onCardAdd && !readOnly && (
                adding?.columnId === column.id ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const title = adding.title.trim();
                      if (title) onCardAdd(column.id, title);
                      setAdding({ columnId: column.id, title: "" });
                    }}
                  >
                    <input
                      autoFocus
                      aria-label={`New card in ${column.title}`}
                      placeholder="Card title, then Enter"
                      value={adding.title}
                      onChange={(event) => setAdding({ columnId: column.id, title: event.target.value })}
                      onKeyDown={(event) => event.key === "Escape" && setAdding(null)}
                      onBlur={() => !adding.title.trim() && setAdding(null)}
                      className={cn("h-8 w-full rounded-md border border-input bg-background px-2", focusRing)}
                    />
                  </form>
                ) : (
                  <button type="button" onClick={() => setAdding({ columnId: column.id, title: "" })} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2 text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground", focusRing)}>
                    <PlusIcon aria-hidden="true" className="size-4" />
                    Add card
                    <span className="sr-only"> to {column.title}</span>
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      {drag?.active && (
        <div aria-hidden="true" className="pointer-events-none fixed z-50 flex rotate-2 flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 text-card-foreground opacity-95 shadow-lg" style={{ left: drag.pointer.x - drag.offset.x, top: drag.pointer.y - drag.offset.y, width: drag.width }}>
          <span className="flex items-center gap-1">
            <GripVerticalIcon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{drag.card.title}</span>
          </span>
        </div>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
