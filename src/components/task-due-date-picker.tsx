// packages/ai-ui/src/components/task-due-date-picker.tsx
"use client";

import { cn } from "../lib/cn.js";
import { DatePicker, type DatePickerProps } from "./date-picker.js";

export interface TaskDueDatePickerProps extends Omit<DatePickerProps, "label" | "defaultValue" | "value" | "onValueChange"> {
  value: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
}
export function TaskDueDatePicker({ label = "Due date", className, onChange, ...props }: TaskDueDatePickerProps) {
  return <div data-slot="task-due-date-picker" className={cn("flex min-w-0", className)}>
    <DatePicker {...props} label={label} onValueChange={onChange} />
  </div>;
}
