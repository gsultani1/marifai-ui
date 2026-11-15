// packages/ai-ui/src/components/prompt-variable-editor.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass, contentBlock } from "../lib/component-controls.js";
import { fillPrompt, promptVariables } from "./prompt-library.js";

export interface PromptVariableEditorProps {
  prompt: string;
  initialValues?: Readonly<Record<string,string>>;
  onSubmit: (values: Record<string,string>, filled: string) => void | Promise<void>;
  className?: string;
}

export function PromptVariableEditor({ prompt, initialValues, onSubmit, className }: PromptVariableEditorProps) {
  const [draft, setDraft] = useState(() => new Map(Object.entries(initialValues ?? {})));
  const names = promptVariables(prompt);
  const values = Object.fromEntries(names.map((name) => [name,draft.get(name) ?? ""]));
  const preview = fillPrompt(prompt,values);
  return <ControlPanel slot="prompt-variable-editor" title="Prompt variables" className={className}>
    <AsyncForm label="Prompt variables" submitLabel="Use filled prompt" onSubmit={() => {
      if (names.some((name) => !draft.get(name)?.trim())) throw new Error("Fill all prompt variables.");
      return onSubmit(values,preview);
    }}>
      {names.map((name) => <Field key={name} label={name}><input className={fieldClass} value={draft.get(name) ?? ""}
        onChange={(event) => { const value = event.currentTarget.value; setDraft((old) => new Map(old).set(name,value)); }} /></Field>)}
      <p aria-label="Filled prompt preview" className={contentBlock}>{preview}</p>
    </AsyncForm>
  </ControlPanel>;
}
