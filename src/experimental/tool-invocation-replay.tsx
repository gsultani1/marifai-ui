// packages/ai-ui/src/experimental/tool-invocation-replay.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { ToolParameterForm, type ToolParameter, type ToolParameterValue } from "./tool-parameter-form.js";
export interface ReplayableToolCall { id: string; tool: string; outcome: string; arguments: Readonly<Record<string,ToolParameterValue>> }

export interface ToolInvocationReplayProps {
  call: ReplayableToolCall;
  parameters: readonly ToolParameter[];
  onReplay: (callId: string, values: Record<string,ToolParameterValue>) => void | Promise<void>;
  className?: string;
}

export function ToolInvocationReplay({ call, parameters, onReplay, className }: ToolInvocationReplayProps) {
  return <ControlPanel slot="tool-invocation-replay" title="Replay tool call" className={className}>
    <p className="text-sm break-words">{call.tool} · {call.outcome}</p>
    <ToolParameterForm key={call.id} title="Replay arguments" submitLabel="Request new invocation" parameters={parameters}
      initialValues={call.arguments} onSubmit={(values) => onReplay(call.id,values)} />
  </ControlPanel>;
}
