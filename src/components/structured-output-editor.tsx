// packages/ai-ui/src/components/structured-output-editor.tsx
"use client";

import { useId, useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";

export type StructuredOutputSchema = boolean | Record<string, unknown>;

export interface StructuredOutputEditorProps {
  initialValue?: string;
  onSubmit: (schema: StructuredOutputSchema) => void | Promise<void>;
  validationError?: string;
  className?: string;
}

export function StructuredOutputEditor({ initialValue = "{}", onSubmit, validationError, className }: StructuredOutputEditorProps) {
  const [value, setValue] = useState(initialValue);
  const errorId = useId();
  function parse(): StructuredOutputSchema {
    let result: unknown;
    try {
      result = JSON.parse(value);
    } catch (reason) {
      throw new Error("The schema is not valid JSON." + (reason instanceof Error && reason.message ? " " + reason.message : ""));
    }
    if (typeof result === "boolean") return result;
    if (result && typeof result === "object" && !Array.isArray(result)) return Object.fromEntries(Object.entries(result));
    throw new Error("A JSON Schema must be an object or a boolean.");
  }
  return <ControlPanel slot="structured-output-editor" title="Structured output" className={className}>
    <AsyncForm label="Structured output schema" submitLabel="Save schema" onSubmit={() => onSubmit(parse())}>
      <Field label="JSON Schema"><textarea rows={8} spellCheck={false} className={fieldClass + " font-mono"}
        aria-invalid={validationError ? true : undefined} aria-describedby={validationError ? errorId : undefined}
        value={value} onChange={(event) => setValue(event.currentTarget.value)} /></Field>
      {validationError && <p id={errorId} role="alert" className="text-sm text-destructive">{validationError}</p>}
    </AsyncForm>
  </ControlPanel>;
}
