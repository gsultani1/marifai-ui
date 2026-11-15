// packages/ai-ui/src/components/debug-watch-expressions.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlAction, ControlPanel, Field, fieldClass, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface DebugWatchExpression { id: string; expression: string; value?: string; error?: string }

export interface DebugWatchExpressionsProps {
  expressions: readonly DebugWatchExpression[];
  onSave: (expression: string, id?: string) => void | Promise<void>;
  onRemove?: (id: string) => void;
  onRefresh?: (id: string) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function DebugWatchExpressions({ expressions, onSave, onRemove, onRefresh, pendingIds = [], className }: DebugWatchExpressionsProps) {
  const [editId,setEdit] = useState<string>();
  const [text,setText] = useState("");
  const editing = expressions.find((item) => item.id === editId);
  return <ControlPanel slot="debug-watch-expressions" title="Watch expressions" className={className}>
    <ItemList items={expressions} empty="No watch expressions." render={(item) => <ItemHeading title={item.expression} detail={item.error ?? item.value ?? "Not evaluated"}>
      <ControlAction label="Edit" item={item.expression} disabled={pendingIds.includes(item.id)} onClick={() => { setEdit(item.id); setText(item.expression); }} />
      <ControlAction label="Refresh" item={item.expression} disabled={pendingIds.includes(item.id)} onClick={onRefresh && (() => onRefresh(item.id))} />
      <ControlAction label="Remove" item={item.expression} disabled={pendingIds.includes(item.id)} onClick={onRemove && (() => onRemove(item.id))} />
    </ItemHeading>} />
    <AsyncForm label="Watch expression" submitLabel={editing ? "Save expression" : "Add expression"} disabled={!text.trim() || Boolean(editId && !editing)}
      onSubmit={async () => { await onSave(text.trim(),editId); setEdit(undefined); setText(""); }}>
      <Field label="Expression"><input className={fieldClass} value={text} onChange={(event) => setText(event.currentTarget.value)} /></Field>
      {editId && <ControlAction label="Cancel editing" onClick={() => { setEdit(undefined); setText(""); }} />}
    </AsyncForm>
  </ControlPanel>;
}
