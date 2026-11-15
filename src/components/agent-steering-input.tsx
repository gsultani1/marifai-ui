// packages/ai-ui/src/components/agent-steering-input.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel, Field, fieldClass } from "../lib/component-controls.js";


export interface AgentSteeringInputProps {
  onSend: (message: string) => void | Promise<void>;
  initialMessage?: string;
  unavailableReason?: string;
  className?: string;
}

export function AgentSteeringInput({ onSend, initialMessage = "", unavailableReason, className }: AgentSteeringInputProps) {
  const [message, setMessage] = useState(initialMessage);
  return <ControlPanel slot="agent-steering-input" title="Steer agent" className={className}>
    {unavailableReason && <p className="text-sm">{unavailableReason}</p>}
    <AsyncForm label="Send steering message" submitLabel="Send steering" disabled={Boolean(unavailableReason) || !message.trim()}
      onSubmit={async () => { await onSend(message.trim()); setMessage(""); }}>
      <Field label="Steering message"><textarea className={fieldClass} value={message} onChange={(event) => setMessage(event.currentTarget.value)} /></Field>
    </AsyncForm>
  </ControlPanel>;
}
