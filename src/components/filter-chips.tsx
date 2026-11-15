// packages/ai-ui/src/components/filter-chips.tsx
"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatCompactNumber } from "../lib/format.js";

export interface FilterChipOption {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface FilterChipsProps {
  options: FilterChipOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** One chip at a time when false; pressing it again clears the filter. */
  multiple?: boolean;
  label: string;
  /** Text of the button that clears every chip; false hides it. */
  clearLabel?: string | false;
  className?: string;
}

/** Toggle chips for filtering a list, with counts, a check on active chips and a clear button. Arrow keys move between chips. */
export function FilterChips({ options, value, defaultValue = [], onValueChange, multiple = true, label, clearLabel = "Clear", className }: FilterChipsProps) {
  const [selected, setSelected] = useControllableState<string[]>({ value, defaultValue, onChange: onValueChange });
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ToggleGroup aria-label={label} multiple={multiple} value={selected} onValueChange={(next: string[]) => setSelected(next)} className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <Toggle
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(
              "group inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent data-[disabled]:opacity-50 data-[pressed]:border-foreground/30 data-[pressed]:bg-accent [&_svg]:size-3.5",
              focusRing,
            )}
          >
            <CheckIcon aria-hidden="true" className="hidden group-data-[pressed]:block" />
            {option.icon}
            {option.label}
            {option.count !== undefined && <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums group-data-[pressed]:bg-background">{formatCompactNumber(option.count)}</span>}
          </Toggle>
        ))}
      </ToggleGroup>
      {clearLabel !== false && selected.length > 0 && (
        <button type="button" onClick={() => setSelected([])} className={cn("h-7 rounded-md px-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline", focusRing)}>
          {clearLabel}
        </button>
      )}
    </div>
  );
}
