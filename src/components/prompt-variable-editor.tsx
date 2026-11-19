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
      const missing = names.filter((name) => !draft.get(name)?.trim());
      if (missing.length) throw new Error("Fill in every prompt variable: " + missing.join(", ") + ".");
      return onSubmit(values,preview);
    }}>
      {names.length ? names.map((name) => <Field key={name} label={name}><input className={fieldClass} value={draft.get(name) ?? ""} aria-required="true"
        onChange={(event) => { const value = event.currentTarget.value; setDraft((old) => new Map(old).set(name,value)); }} /></Field>)
        : <p className="text-sm text-muted-foreground">This prompt has no variables.</p>}
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Filled prompt preview</h4>
        <p className={contentBlock}>{preview}</p>
      </div>
    </AsyncForm>
  </ControlPanel>;
}
