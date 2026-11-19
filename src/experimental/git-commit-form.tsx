// packages/ai-ui/src/experimental/git-commit-form.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass, ItemList } from "../lib/component-controls.js";

export interface StagedCommitFile { id: string; path: string }
export interface GitCommitDraft { summary: string; body: string; fileIds: string[] }

export interface GitCommitFormProps {
  stagedFiles: readonly StagedCommitFile[];
  initialValue?: Pick<GitCommitDraft, "summary" | "body">;
  onCommit: (draft: GitCommitDraft) => void | Promise<void>;
  className?: string;
}

export function GitCommitForm({ stagedFiles, initialValue, onCommit, className }: GitCommitFormProps) {
  const [summary,setSummary] = useState(initialValue?.summary ?? "");
  const [body,setBody] = useState(initialValue?.body ?? "");
  return <ControlPanel slot="git-commit-form" title="Commit staged files" className={className}>
    <ItemList items={stagedFiles} empty="No staged files." render={(item) => <p className="text-sm break-all">{item.path}</p>} />
    <AsyncForm label="Commit staged files" submitLabel="Commit" disabled={!stagedFiles.length} onSubmit={async () => {
      if (!summary.trim()) throw new Error("Enter a commit summary.");
      await onCommit({ summary:summary.trim(), body:body.trim(), fileIds:stagedFiles.map((item) => item.id) });
      setSummary(""); setBody("");
    }}>
      <Field label="Summary"><input className={fieldClass} value={summary} onChange={(event) => setSummary(event.currentTarget.value)} /></Field>
      <Field label="Description"><textarea className={fieldClass} value={body} onChange={(event) => setBody(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
