// packages/ai-ui/src/components/composer-options.tsx
"use client";

import { Popover } from "@base-ui/react/popover";
import { Switch } from "@base-ui/react/switch";
import { SlidersHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { focusRing, popupSurface, switchRoot, switchThumb } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";
import { SegmentedControl, type SegmentedOption } from "./segmented-control.js";

export interface ComposerTool {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  icon?: ReactNode;
}

export interface ComposerOptionsProps {
  effort?: string;
  efforts?: SegmentedOption[];
  onEffortChange?: (effort: string) => void;
  reasoning?: boolean;
  onReasoningChange?: (on: boolean) => void;
  tools?: ComposerTool[];
  onToolsChange?: (tools: ComposerTool[]) => void;
  label?: string;
  className?: string;
}

const DEFAULT_EFFORTS: SegmentedOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/**
 * Per-message options in one popover: effort level, extended reasoning, and
 * which tools the model may use. The trigger summarizes the current choice.
 */
export function ComposerOptions({ effort, efforts = DEFAULT_EFFORTS, onEffortChange, reasoning, onReasoningChange, tools, onToolsChange, label = "Options", className }: ComposerOptionsProps) {
  const container = usePortalContainer();
  const enabledTools = tools?.filter((tool) => tool.enabled).length ?? 0;
  const effortLabel = efforts.find((option) => option.value === effort)?.label;
  const summary = [typeof effortLabel === "string" ? effortLabel : null, reasoning ? "Reasoning" : null, tools ? `${enabledTools} ${enabledTools === 1 ? "tool" : "tools"}` : null].filter(Boolean).join(" · ");

  return (
    <Popover.Root>
      <Popover.Trigger aria-label={`${label}: ${summary}`} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground data-[popup-open]:bg-accent [&_svg]:size-4", focusRing, className)}>
        <SlidersHorizontalIcon aria-hidden="true" />
        <span aria-hidden="true" className="max-sm:hidden">
          {summary || label}
        </span>
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner side="top" align="start" sideOffset={8} className="z-50">
          <Popover.Popup aria-label={label} className={cn(popupSurface, "flex w-80 flex-col gap-4 p-3 outline-none")}>
            {effort !== undefined && onEffortChange && (
              <div className="flex flex-col gap-1.5">
                <span aria-hidden="true" className="text-xs font-medium text-muted-foreground">
                  Effort
                </span>
                <SegmentedControl label="Effort" size="sm" fullWidth value={effort} onValueChange={onEffortChange} options={efforts} />
              </div>
            )}
            {reasoning !== undefined && onReasoningChange && (
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="flex flex-col">
                  <span className="font-medium">Extended reasoning</span>
                  <span className="text-xs text-muted-foreground">Thinks longer before answering.</span>
                </span>
                <Switch.Root checked={reasoning} onCheckedChange={onReasoningChange} className={cn(switchRoot, focusRing)}>
                  <Switch.Thumb className={switchThumb} />
                </Switch.Root>
              </label>
            )}
            {tools && onToolsChange && (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-xs font-medium text-muted-foreground">Tools</legend>
                {tools.map((tool) => (
                  <label key={tool.id} className="flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 text-sm hover:bg-accent/50">
                    <input type="checkbox" checked={tool.enabled} onChange={(event) => onToolsChange(tools.map((item) => (item.id === tool.id ? { ...item, enabled: event.target.checked } : item)))} className="mt-0.5 size-4 accent-primary" />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5 font-medium [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
                        {tool.icon}
                        {tool.label}
                      </span>
                      {tool.description && <span className="text-xs text-muted-foreground">{tool.description}</span>}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
