// packages/ai-ui/src/components/chat-audience-picker.tsx
"use client";

import { ControlPanel, ChoiceField } from "../lib/component-controls.js";

export interface ChatAudience { id: string; title: string; visibility: string; unavailableReason?: string }

export interface ChatAudiencePickerProps {
  audiences: readonly ChatAudience[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

export function ChatAudiencePicker({ audiences, value, onChange, className }: ChatAudiencePickerProps) {
  const audience = audiences.find((item) => item.id === value);
  return <ControlPanel slot="chat-audience-picker" title="Conversation audience" className={className}>
    {/* The audience cannot be cleared, so the prompt is offered only until one is chosen. */}
    <ChoiceField label="Audience" value={audience?.id ?? ""} placeholder="Choose an audience" required
      options={audiences.map((item) => ({ value:item.id,label:[item.title,item.unavailableReason].filter(Boolean).join(" · "),disabled:Boolean(item.unavailableReason) }))}
      onChange={(id) => { if (id) onChange(id); }} />
    <p aria-live="polite" className="text-sm break-words">{audience ? audience.visibility : "No audience chosen yet."}</p>
  </ControlPanel>;
}
