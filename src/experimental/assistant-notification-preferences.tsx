// packages/ai-ui/src/experimental/assistant-notification-preferences.tsx
"use client";

import { useState } from "react";
import { AsyncForm, ControlPanel } from "../lib/component-controls.js";

export interface AssistantNotificationOption { id: string; channel: string; event: string; enabled: boolean }

export interface AssistantNotificationPreferencesProps {
  options: readonly AssistantNotificationOption[];
  onSave: (values: Readonly<Record<string, boolean>>) => void | Promise<void>;
  className?: string;
}

export function AssistantNotificationPreferences({ options, onSave, className }: AssistantNotificationPreferencesProps) {
  const [changes, setChanges] = useState(() => new Map<string, boolean>());
  return <ControlPanel slot="assistant-notification-preferences" title="Notification preferences" className={className}>
    <AsyncForm label="Notification preferences" submitLabel="Save preferences" disabled={!options.length}
      onSubmit={() => onSave(Object.fromEntries(options.map((item) => [item.id, changes.get(item.id) ?? item.enabled])))}>
      {options.map((item) => <label key={item.id} className="block text-sm">
        <input type="checkbox" checked={changes.get(item.id) ?? item.enabled} onChange={(event) => {
          const checked = event.currentTarget.checked;
          setChanges((current) => new Map(current).set(item.id, checked));
        }} /> {item.channel} · {item.event}
      </label>)}
      {!options.length && <p className="text-sm text-muted-foreground">No channels available.</p>}
    </AsyncForm>
  </ControlPanel>;
}
