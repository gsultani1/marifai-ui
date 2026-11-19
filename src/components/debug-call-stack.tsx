// packages/ai-ui/src/components/debug-call-stack.tsx
"use client";

import { ChoiceField, ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";
import type { EditorSourceLocation } from "./editor-symbol-outline.js";

export interface DebugStackFrame { id: string; label: string; source?: EditorSourceLocation }
export interface DebugThread { id: string; label: string; frames: readonly DebugStackFrame[] }
export interface DebugCallStackProps {
  threads: readonly DebugThread[];
  threadId: string | null;
  frameId?: string | null;
  onThreadChange: (id: string) => void;
  onFrameChange: (threadId: string, frameId: string) => void;
  onOpenSource?: (source: EditorSourceLocation) => void;
  className?: string;
}
export function DebugCallStack({ threads, threadId, frameId, onThreadChange, onFrameChange, onOpenSource, className }: DebugCallStackProps) {
  const thread = threads.find((item) => item.id === threadId);
  return <ControlPanel slot="debug-call-stack" title="Call stack" className={className}>
    <ChoiceField label="Thread" value={thread?.id ?? ""} placeholder="Select a thread"
      options={threads.map((item) => ({ value: item.id, label: item.label }))} onChange={(id) => { if (id) onThreadChange(id); }} />
    <ItemList items={thread?.frames ?? []} empty="No stack frames." render={(frame) => {
      const source = frame.source;
      return <ItemHeading title={frame.label} detail={source && source.file + ":" + source.line}>
        <ControlAction label="Select frame" item={frame.label} disabled={frame.id === frameId}
          onClick={() => { if (thread) onFrameChange(thread.id, frame.id); }} />
        <ControlAction label="Open source" item={frame.label} onClick={source && onOpenSource && (() => onOpenSource(source))} />
      </ItemHeading>;
    }} />
  </ControlPanel>;
}
