// packages/ai-ui/src/components/response-format-picker.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface ResponseFormatOption { id: string; label: string; requirements?: string; unavailableReason?: string }

export interface ResponseFormatPickerProps {
  formats: readonly ResponseFormatOption[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

export function ResponseFormatPicker({ formats, value, onChange, className }: ResponseFormatPickerProps) {
  const selected = formats.find((format) => format.id === value);
  return <ControlPanel slot="response-format-picker" title="Response format" className={className}>
    {formats.length ? <>
      <ChoiceField label="Format" value={selected?.id ?? ""} placeholder="Choose a format"
        options={formats.map(({ id, label, unavailableReason }) => ({ value: id, label: unavailableReason ? label + " (" + unavailableReason + ")" : label, disabled: Boolean(unavailableReason) }))}
        onChange={(id) => { if (id) onChange(id); }} />
      <div aria-live="polite">{selected?.requirements && <p className="text-sm break-words">{selected.requirements}</p>}</div>
    </> : <p className="text-sm text-muted-foreground">No response formats available.</p>}
  </ControlPanel>;
}
