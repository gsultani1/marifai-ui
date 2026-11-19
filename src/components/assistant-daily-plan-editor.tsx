// packages/ai-ui/src/components/assistant-daily-plan-editor.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";
import { OrderedList } from "../lib/collection-controls.js";
export interface DailyPlanTask { id: string; title: string; blockId: string | null }
export interface DailyPlanBlock { id: string; label: string; unavailable?: boolean }

export interface AssistantDailyPlanEditorProps {
  tasks: readonly DailyPlanTask[];
  blocks: readonly DailyPlanBlock[];
  onReorder: (ids: string[]) => void;
  onPlace: (taskId: string, blockId: string | null) => void;
  className?: string;
}

export function AssistantDailyPlanEditor({ tasks, blocks, onReorder, onPlace, className }: AssistantDailyPlanEditorProps) {
  return <ControlPanel slot="assistant-daily-plan-editor" title="Daily plan" className={className}>
    <OrderedList items={tasks} label="Daily priorities" itemLabel={(item) => item.title} onReorder={onReorder}
      render={(item) => <>
        <strong className="block font-medium">{item.title}</strong>
        <ChoiceField label={"Time block for " + item.title} value={item.blockId ?? ""} placeholder="Unscheduled"
          options={blocks.map((block) => ({value:block.id,label:block.label,disabled:block.unavailable}))}
          onChange={(blockId) => onPlace(item.id,blockId || null)} />
      </>} />
  </ControlPanel>;
}
