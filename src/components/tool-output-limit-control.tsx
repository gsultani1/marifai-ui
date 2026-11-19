// packages/ai-ui/src/components/tool-output-limit-control.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass, optionalNumber } from "../lib/component-controls.js";

export interface ToolOutputLimits { bytes?: number; items?: number }

export interface ToolOutputLimitControlProps {
  initialValue: ToolOutputLimits;
  policy: string;
  onSubmit: (limits: ToolOutputLimits) => void | Promise<void>;
  className?: string;
}

export function ToolOutputLimitControl({ initialValue, policy, onSubmit, className }: ToolOutputLimitControlProps) {
  const [bytes,setBytes] = useState(initialValue.bytes?.toString() ?? "");
  const [items,setItems] = useState(initialValue.items?.toString() ?? "");
  return <ControlPanel slot="tool-output-limit-control" title="Tool output limits" className={className}>
    <p className="text-sm break-words">{policy}</p>
    <AsyncForm label="Tool output limits" submitLabel="Save limits" onSubmit={() => {
      const byteLimit = optionalNumber(bytes,"Bytes",1,true);
      const itemLimit = optionalNumber(items,"Items",1,true);
      return onSubmit({...(byteLimit === undefined ? {} : {bytes:byteLimit}),...(itemLimit === undefined ? {} : {items:itemLimit})});
    }}>
      <Field label="Maximum bytes"><input inputMode="numeric" className={fieldClass} value={bytes} onChange={(event) => setBytes(event.currentTarget.value)} /></Field>
      <Field label="Maximum items"><input inputMode="numeric" className={fieldClass} value={items} onChange={(event) => setItems(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
