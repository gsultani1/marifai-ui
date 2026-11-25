// packages/ai-ui/src/components/browser-site-permissions.tsx
"use client";

import { ChoiceField, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export type BrowserPermissionValue = "allow" | "ask" | "block";
export interface BrowserSitePermission {
  id: string;
  label: string;
  effective: BrowserPermissionValue;
  value?: BrowserPermissionValue;
  available?: readonly BrowserPermissionValue[];
  unavailableReason?: string;
}

export interface BrowserSitePermissionsProps {
  origin: string;
  permissions: readonly BrowserSitePermission[];
  onChange?: (id: string, value: BrowserPermissionValue) => void;
  pendingIds?: readonly string[];
  className?: string;
}

const labels: Record<BrowserPermissionValue, string> = { allow: "Allow", ask: "Ask", block: "Block" };

export function BrowserSitePermissions({ origin, permissions, onChange, pendingIds = [], className }: BrowserSitePermissionsProps) {
  return <ControlPanel slot="browser-site-permissions" title="Site permissions" className={className}>
    <p className="text-sm break-all">{origin}</p>
    <ItemList items={permissions} empty="No permissions available." render={(permission) => {
      const current = permission.value ?? permission.effective;
      const values = permission.available ?? ["ask", "allow", "block"];
      const pending = pendingIds.includes(permission.id);
      return <>
        <ItemHeading title={permission.label} detail={["Effective: " + labels[permission.effective], permission.unavailableReason, pending ? "Saving…" : ""].filter(Boolean).join(" · ")} />
        {onChange && <ChoiceField label={"Set " + permission.label} value={current}
          options={Array.from(new Set([...values, current]), (value) => ({ value, label: labels[value], disabled: !values.includes(value) }))}
          disabled={Boolean(permission.unavailableReason) || pending}
          onChange={(value) => { if (value) onChange(permission.id, value); }} />}
      </>;
    }} />
  </ControlPanel>;
}
