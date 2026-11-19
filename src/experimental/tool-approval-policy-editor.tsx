// packages/ai-ui/src/experimental/tool-approval-policy-editor.tsx
"use client";

import { ChoiceField, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export type ToolPolicyValue = "ask" | "allow" | "deny";
export interface ToolApprovalPolicyRow {
  id: string; tool: string; value: ToolPolicyValue | null; effective: ToolPolicyValue;
  inheritedFrom?: string; available?: readonly ToolPolicyValue[]; unavailableReason?: string;
}

export interface ToolApprovalPolicyEditorProps {
  rules: readonly ToolApprovalPolicyRow[];
  onChange?: (id: string, rule: ToolPolicyValue | null) => void;
  pendingIds?: readonly string[];
  className?: string;
}

export function ToolApprovalPolicyEditor({ rules, onChange, pendingIds = [], className }: ToolApprovalPolicyEditorProps) {
  return <ControlPanel slot="tool-approval-policy-editor" title="Tool approval policy" className={className}>
    <ItemList items={rules} empty="No tool rules." render={(rule) => {
      const available = rule.available ?? ["ask","allow","deny"];
      const values = rule.value && !available.includes(rule.value) ? [...available,rule.value] : available;
      return <>
        <ItemHeading title={rule.tool} detail={["Effective: " + rule.effective,rule.inheritedFrom,rule.unavailableReason].filter(Boolean).join(" · ")} />
        {onChange && <ChoiceField label={"Rule for " + rule.tool} value={rule.value ?? ""} placeholder="Inherit"
          options={values.map((value) => ({ value,label:value[0]!.toUpperCase()+value.slice(1),disabled:!available.includes(value) }))}
          disabled={Boolean(rule.unavailableReason) || pendingIds.includes(rule.id)} onChange={(value) => onChange(rule.id,value || null)} />}
      </>;
    }} />
  </ControlPanel>;
}
