// packages/ai-ui/src/components/model-selector.tsx
"use client";

import { Select } from "@base-ui/react/select";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

export interface ModelOption {
  id: string;
  name: string;
  description?: string | undefined;
  /** Options sharing a provider are grouped under it. */
  provider?: string | undefined;
  icon?: ReactNode;
  disabled?: boolean | undefined;
}

export interface ModelSelectorProps {
  models: ModelOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  disabled?: boolean;
  placeholder?: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function ModelSelector({
  models,
  value,
  defaultValue,
  onValueChange,
  disabled,
  placeholder = "Select a model",
  className,
  "aria-label": ariaLabel = "Model",
}: ModelSelectorProps) {
  const container = usePortalContainer();
  const items = useMemo(() => models.map((model) => ({ value: model.id, label: model.name })), [models]);
  const groups = useMemo(() => {
    const byProvider = new Map<string, ModelOption[]>();
    for (const model of models) {
      const key = model.provider ?? "";
      byProvider.set(key, [...(byProvider.get(key) ?? []), model]);
    }
    return [...byProvider.entries()];
  }, [models]);

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
      <Select.Trigger
        aria-label={ariaLabel}
        data-slot="model-selector"
        className={cn(
          "inline-flex h-8 max-w-56 min-w-0 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:bg-accent",
          focusRing,
          className,
        )}
      >
        <Select.Value placeholder={placeholder} className="truncate" />
        <Select.Icon className="shrink-0">
          <ChevronsUpDownIcon aria-hidden="true" className="size-3.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50">
          <Select.Popup
            className={cn(
              popupSurface,
              "max-h-[min(24rem,var(--available-height))] w-[min(20rem,var(--available-width))] min-w-[var(--anchor-width)] overflow-y-auto p-1",
            )}
          >
            <Select.List>
              {groups.map(([provider, options]) =>
                provider ? (
                  <Select.Group key={provider} className="py-1">
                    <Select.GroupLabel className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      {provider}
                    </Select.GroupLabel>
                    {options.map((model) => (
                      <ModelItem key={model.id} model={model} />
                    ))}
                  </Select.Group>
                ) : (
                  options.map((model) => <ModelItem key={model.id} model={model} />)
                ),
              )}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function ModelItem({ model }: { model: ModelOption }) {
  return (
    <Select.Item
      value={model.id}
      label={model.name}
      disabled={model.disabled}
      className="flex cursor-default items-start gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
    >
      {model.icon && <span className="mt-0.5 text-muted-foreground">{model.icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <Select.ItemText className="truncate font-medium">{model.name}</Select.ItemText>
        {model.description && <span className="text-xs text-muted-foreground">{model.description}</span>}
      </span>
      <Select.ItemIndicator className="mt-0.5">
        <CheckIcon aria-hidden="true" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
