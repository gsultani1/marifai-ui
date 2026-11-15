// packages/ai-ui/src/components/automation-template-picker.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading } from "../lib/component-controls.js";
import { FilteredList } from "../lib/collection-controls.js";
export interface AutomationTemplateChoice { id: string; title: string; trigger: string; actions: readonly string[]; requiredInputs: readonly string[] }

export interface AutomationTemplatePickerProps {
  templates: readonly AutomationTemplateChoice[];
  onSelect: (id: string) => void;
  className?: string;
}

export function AutomationTemplatePicker({ templates, onSelect, className }: AutomationTemplatePickerProps) {
  return <ControlPanel slot="automation-template-picker" title="Automation templates" className={className}>
    <FilteredList items={templates} searchLabel="Search templates" searchText={(item) => [item.title,item.trigger,...item.actions]}
      empty="No matching templates." render={(item) => <>
        <ItemHeading title={item.title} detail={item.trigger}><ControlAction label="Use template" item={item.title} onClick={() => onSelect(item.id)} /></ItemHeading>
        <dl className="space-y-1 text-sm">
          <div><dt>Actions</dt><dd className="break-words text-muted-foreground">{item.actions.join(" → ") || "None"}</dd></div>
          <div><dt>Required inputs</dt><dd className="break-words text-muted-foreground">{item.requiredInputs.join(", ") || "None"}</dd></div>
        </dl>
      </>} />
  </ControlPanel>;
}
