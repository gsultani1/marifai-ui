// packages/ai-ui/src/components/model-picker.tsx
"use client";

import { Combobox } from "@base-ui/react/combobox";
import { BrainIcon, CheckIcon, ChevronsUpDownIcon, EyeIcon, SearchIcon, WrenchIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { badge, focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatModelPrice, formatTokenCount, groupModelsByProvider, HEALTH_LABELS, type ModelCapability, type ModelInfo, modelMatches } from "../lib/models.js";
import { usePortalContainer } from "../lib/portal.js";
import { HealthBadge } from "./provider-health.js";

const CAPABILITY: Partial<Record<ModelCapability, { label: string; icon: ReactNode }>> = {
  reasoning: { label: "Reasoning", icon: <BrainIcon aria-hidden="true" /> },
  vision: { label: "Vision", icon: <EyeIcon aria-hidden="true" /> },
  tools: { label: "Tools", icon: <WrenchIcon aria-hidden="true" /> },
};

export interface ModelPickerProps {
  models: ModelInfo[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Starts with only free models shown. */
  defaultFreeOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}

function describe(model: ModelInfo): string {
  return [
    model.provider,
    model.contextWindow ? `${formatTokenCount(model.contextWindow)} context` : "",
    ...(model.capabilities ?? []).map((capability) => CAPABILITY[capability]?.label ?? "").filter(Boolean),
    formatModelPrice(model),
    model.health && model.health !== "operational" ? HEALTH_LABELS[model.health] : "",
    model.deprecated ? "Deprecated" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Searchable model list grouped by provider: fuzzy search over names, ids
 * and providers, badges for context size, reasoning, vision, tools and
 * price, a health dot per model, and a free-only filter.
 */
export function ModelPicker({ models, value, defaultValue, onValueChange, defaultFreeOnly = false, disabled = false, placeholder = "Choose a model", label = "Model", className }: ModelPickerProps) {
  const container = usePortalContainer();
  const [selectedId, setSelectedId] = useControllableState<string | undefined>({ value, defaultValue, onChange: (next) => next !== undefined && onValueChange?.(next) });
  const [freeOnly, setFreeOnly] = useState(defaultFreeOnly);
  const selected = models.find((model) => model.id === selectedId) ?? null;
  const visible = useMemo(() => (freeOnly ? models.filter((model) => model.free || (model.pricing?.input === 0 && model.pricing.output === 0)) : models), [models, freeOnly]);
  const groups = useMemo(() => groupModelsByProvider(visible), [visible]);

  return (
    <Combobox.Root
      items={groups}
      value={selected}
      onValueChange={(next: ModelInfo | null) => {
        if (next) setSelectedId(next.id);
      }}
      itemToStringLabel={(model: ModelInfo) => model.name}
      isItemEqualToValue={(item: ModelInfo, current: ModelInfo) => item.id === current.id}
      filter={(model: ModelInfo, query: string) => modelMatches(model, query)}
      disabled={disabled}
    >
      <Combobox.Trigger
        aria-label={selected ? `${label}: ${selected.name}` : label}
        data-slot="model-picker"
        className={cn("inline-flex h-8 max-w-64 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:bg-accent", focusRing, className)}
      >
        {selected?.health && <HealthBadge state={selected.health} compact />}
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.name ?? placeholder}</span>
        <ChevronsUpDownIcon aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </Combobox.Trigger>
      <Combobox.Portal container={container}>
        <Combobox.Positioner sideOffset={6} align="start" className="z-50">
          <Combobox.Popup aria-label={`${label} list`} className={cn(popupSurface, "flex max-h-[min(28rem,var(--available-height))] w-[min(24rem,var(--available-width))] flex-col")}>
            <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <Combobox.Input aria-label={`Search ${label.toLowerCase()}s`} placeholder="Search models" className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs">
                <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} className="size-3.5 accent-primary" />
                Free only
              </label>
            </div>
            <Combobox.Empty className="px-3 py-3 text-sm text-muted-foreground empty:hidden">{freeOnly ? "No free models match." : "No models match."}</Combobox.Empty>
            <Combobox.List className="min-h-0 flex-1 overflow-y-auto p-1">
              {(group: { value: string; items: ModelInfo[] }) => (
                <Combobox.Group key={group.value} items={group.items} className="py-1">
                  <Combobox.GroupLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.value}</Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(model: ModelInfo) => (
                      <Combobox.Item
                        key={model.id}
                        value={model}
                        aria-label={`${model.name}, ${describe(model)}`}
                        className="flex cursor-default items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                      >
                        <span className="mt-1.5 flex w-2 justify-center">{model.health && <HealthBadge state={model.health} compact />}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex items-center gap-2">
                            <span className={cn("truncate font-medium", model.deprecated && "line-through")}>{model.name}</span>
                            {model.contextWindow !== undefined && <span className="font-mono text-xs">{formatTokenCount(model.contextWindow)}</span>}
                          </span>
                          <span className="flex flex-wrap items-center gap-1">
                            {(model.capabilities ?? []).map((capability) =>
                              CAPABILITY[capability] ? (
                                <span key={capability} className={badge}>
                                  {CAPABILITY[capability].icon}
                                  {CAPABILITY[capability].label}
                                </span>
                              ) : null,
                            )}
                            {(model.free || model.pricing) && <span className={cn(badge, model.free && "border-success/40")}>{model.free ? "Free" : `$${model.pricing!.input}/$${model.pricing!.output}`}</span>}
                            {model.local && <span className={badge}>Local</span>}
                          </span>
                        </span>
                        <Combobox.ItemIndicator className="mt-1">
                          <CheckIcon aria-hidden="true" className="size-4" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
