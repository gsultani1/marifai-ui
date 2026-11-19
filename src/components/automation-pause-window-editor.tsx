// packages/ai-ui/src/components/automation-pause-window-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";

export interface AutomationPauseWindow { start: string; end: string }

export interface AutomationPauseWindowEditorProps {
  initialValue?: AutomationPauseWindow;
  onSubmit: (window: AutomationPauseWindow) => void | Promise<void>;
  className?: string;
}

export function AutomationPauseWindowEditor({ initialValue, onSubmit, className }: AutomationPauseWindowEditorProps) {
  const [start, setStart] = useState(initialValue?.start ?? "");
  const [end, setEnd] = useState(initialValue?.end ?? "");
  return <ControlPanel slot="automation-pause-window-editor" title="Automation pause window" className={className}>
    <AsyncForm label="Pause interval" submitLabel="Save pause window" onSubmit={() => {
      if (!start || !end) throw new Error("Choose when the pause starts and ends.");
      const from = Date.parse(start);
      const to = Date.parse(end);
      if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error("Enter a valid start and end.");
      if (to <= from) throw new Error("Choose an end after the start.");
      return onSubmit({ start, end });
    }}>
      <Field label="Pause starts"><input type="datetime-local" className={fieldClass} value={start} onChange={(event) => setStart(event.currentTarget.value)} /></Field>
      <Field label="Pause ends"><input type="datetime-local" className={fieldClass} value={end} onChange={(event) => setEnd(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
