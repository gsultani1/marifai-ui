// packages/ai-ui/src/components/runtime-selector.tsx
"use client";

import { Select } from "@base-ui/react/select";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { badge, focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export type RuntimeStatus = "ready" | "starting" | "unavailable";

export interface RuntimeOption {
  id: string;
  /** e.g. "Python" or "Node.js". */
  name: string;
  version?: string;
  description?: string;
  icon?: ReactNode;
  status?: RuntimeStatus;
  recommended?: boolean;
}

export interface RuntimeSelectorProps {
  runtimes: RuntimeOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const STATUS: Record<RuntimeStatus, { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-success" },
  starting: { label: "Starting", dot: "bg-warning" },
  unavailable: { label: "Unavailable", dot: "bg-muted-foreground" },
};

const title = (runtime: RuntimeOption) => (runtime.version ? `${runtime.name} ${runtime.version}` : runtime.name);

/** Picks where code runs: runtimes with versions, readiness, a recommended choice and unavailable ones disabled. */
export function RuntimeSelector({ runtimes, value, defaultValue, onValueChange, label = "Runtime", disabled, className }: RuntimeSelectorProps) {
  const container = usePortalContainer();
  const items = runtimes.map((runtime) => ({ value: runtime.id, label: title(runtime) }));

  return (
    <Select.Root
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (next !== null) onValueChange?.(next);
      }}
      disabled={disabled}
    >
      <Select.Trigger aria-label={label} data-slot="runtime-selector" className={cn("inline-flex h-8 max-w-64 min-w-0 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm hover:bg-accent/50 disabled:opacity-50 data-[popup-open]:bg-accent", focusRing, className)}>
        <Select.Value placeholder="Select a runtime" className="truncate" />
        <Select.Icon className="ml-auto shrink-0">
          <ChevronsUpDownIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50">
          <Select.Popup className={cn(popupSurface, "max-h-[min(24rem,var(--available-height))] w-[min(22rem,var(--available-width))] min-w-[var(--anchor-width)] overflow-y-auto p-1")}>
            <Select.List>
              {runtimes.map((runtime) => {
                const status = runtime.status ?? "ready";
                return (
                  <Select.Item
                    key={runtime.id}
                    value={runtime.id}
                    label={title(runtime)}
                    disabled={status === "unavailable"}
                    className="flex cursor-default items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:opacity-60 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
                  >
                    {runtime.icon && <span className="mt-0.5 text-muted-foreground">{runtime.icon}</span>}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <Select.ItemText className="truncate font-medium">{title(runtime)}</Select.ItemText>
                        {runtime.recommended && <span className={badge}>Recommended</span>}
                      </span>
                      {runtime.description && <span className="text-xs text-muted-foreground">{runtime.description}</span>}
                      <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS[status].dot)} />
                        {STATUS[status].label}
                      </span>
                    </span>
                    <Select.ItemIndicator className="mt-0.5">
                      <CheckIcon aria-hidden="true" />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
