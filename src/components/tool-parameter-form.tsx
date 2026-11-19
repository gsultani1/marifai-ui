// packages/ai-ui/src/components/tool-parameter-form.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ChoiceField, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";

export type ToolParameterValue = string | number | boolean;
interface ParameterBase { name: string; label: string; required?: boolean }
export type ToolParameter = ParameterBase & (
  | { kind: "string" | "number" | "boolean" }
  | { kind: "enum"; options: readonly { value: string; label: string }[] }
);
export interface ToolParameterFormProps {
  parameters: readonly ToolParameter[];
  initialValues?: Readonly<Record<string, ToolParameterValue>>;
  onSubmit: (values: Record<string, ToolParameterValue>) => void | Promise<void>;
  title?: string;
  submitLabel?: string;
  className?: string;
}

export function ToolParameterForm({ parameters, initialValues, onSubmit, title = "Tool parameters", submitLabel = "Submit arguments", className }: ToolParameterFormProps) {
  const [draft, setDraft] = useState(() => new Map(Object.entries(initialValues ?? {}).map(([key, value]) => [key, String(value)])));
  function update(key: string, value: string) {
    setDraft((current) => new Map(current).set(key, value));
  }
  function submit() {
    const values: [string, ToolParameterValue][] = [];
    for (const parameter of parameters) {
      const value = draft.get(parameter.name) ?? "";
      if (!value.trim()) {
        if (parameter.required) throw new Error(parameter.label + " is required.");
        continue;
      }
      switch (parameter.kind) {
        case "number": {
          const number = Number(value);
          if (!Number.isFinite(number)) throw new Error("Enter a valid number for " + parameter.label + ".");
          values.push([parameter.name, number]);
          break;
        }
        case "boolean":
          if (value !== "true" && value !== "false") throw new Error("Choose a value for " + parameter.label + ".");
          values.push([parameter.name, value === "true"]);
          break;
        case "enum":
          if (!parameter.options.some((option) => option.value === value)) throw new Error("Choose an available option for " + parameter.label + ".");
          values.push([parameter.name, value]);
          break;
        case "string":
          values.push([parameter.name, value]);
          break;
      }
    }
    return onSubmit(Object.fromEntries(values));
  }
  return <ControlPanel slot="tool-parameter-form" title={title} className={className}>
    <AsyncForm label={title} submitLabel={submitLabel} onSubmit={submit}>
      {!parameters.length && <p className="text-sm text-muted-foreground">No parameters to fill in.</p>}
      {parameters.map((parameter) => {
        const value = draft.get(parameter.name) ?? "";
        const label = parameter.label + (parameter.required ? " (required)" : "");
        if (parameter.kind === "boolean" || parameter.kind === "enum") {
          const options = parameter.kind === "enum" ? parameter.options : [{ value: "true", label: "True" }, { value: "false", label: "False" }];
          return <ChoiceField key={parameter.name} label={label} value={value} placeholder="Choose an option" options={options}
            onChange={(next) => update(parameter.name, next)} />;
        }
        return <Field key={parameter.name} label={label}><input className={fieldClass} value={value}
          inputMode={parameter.kind === "number" ? "decimal" : undefined} onChange={(event) => update(parameter.name, event.currentTarget.value)} /></Field>;
      })}
    </AsyncForm>
  </ControlPanel>;
}
