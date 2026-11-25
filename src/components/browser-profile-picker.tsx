// packages/ai-ui/src/components/browser-profile-picker.tsx
"use client";

import { ChoiceField, ControlPanel } from "../lib/component-controls.js";

export interface SelectableBrowserProfile { id: string; name: string; session: string; storage: string; unavailableReason?: string }

export interface BrowserProfilePickerProps {
  profiles: readonly SelectableBrowserProfile[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}

export function BrowserProfilePicker({ profiles, value, onChange, className }: BrowserProfilePickerProps) {
  const current = profiles.find((profile) => profile.id === value);
  return <ControlPanel slot="browser-profile-picker" title="Browser profile" className={className}>
    {profiles.length ? <ChoiceField label="Profile" value={current?.id ?? ""} placeholder="Choose a profile"
      options={profiles.map((item) => ({ value: item.id, label: [item.name, item.unavailableReason].filter(Boolean).join(" · "), disabled: Boolean(item.unavailableReason) }))}
      onChange={(id) => { if (id) onChange(id); }} /> : <p className="text-sm text-muted-foreground">No browser profiles are available.</p>}
    {current && <dl className="space-y-1 text-sm"><div><dt>Session</dt><dd className="text-muted-foreground">{current.session}</dd></div>
      <div><dt>Storage scope</dt><dd className="text-muted-foreground">{current.storage}</dd></div></dl>}
  </ControlPanel>;
}
