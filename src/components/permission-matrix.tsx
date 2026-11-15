// packages/ai-ui/src/components/permission-matrix.tsx
"use client";

import { ChevronRightIcon, LockIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "../lib/cn.js";
import { SearchInput } from "./search-input.js";

export interface Permission {
  key: string;
  label: string;
  description?: string;
  category: string;
}

export interface Role {
  id: string;
  name: string;
  /** Always has every permission and cannot be edited, such as Owner. */
  locked?: boolean;
}

/** Role id to the permission keys it holds. */
export type PermissionGrants = Record<string, string[]>;

export interface PermissionMatrixProps {
  roles: Role[];
  permissions: Permission[];
  grants: PermissionGrants;
  onGrantsChange?: (grants: PermissionGrants) => void;
  /** Saved state; changed cells are marked and counted against it. */
  baseline?: PermissionGrants;
  readOnly?: boolean;
  /** Text above the table, such as save buttons. */
  toolbar?: ReactNode;
  className?: string;
}

function TriStateCheckbox({ checked, indeterminate, disabled, label, onChange }: { checked: boolean; indeterminate: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary disabled:opacity-60" />;
}

/** Number of cells that differ between two grant sets. */
export function countGrantChanges(grants: PermissionGrants, baseline: PermissionGrants): number {
  const roles = new Set([...Object.keys(grants), ...Object.keys(baseline)]);
  let changes = 0;
  for (const role of roles) {
    const now = new Set(grants[role] ?? []);
    const before = new Set(baseline[role] ?? []);
    for (const key of now) if (!before.has(key)) changes++;
    for (const key of before) if (!now.has(key)) changes++;
  }
  return changes;
}

/**
 * Roles across, permissions down, grouped by category: each category row
 * grants or revokes it for a role at once (showing how many of how many),
 * categories collapse, search filters and opens matching groups, the
 * permission column stays put while scrolling sideways, locked roles hold
 * everything, and edits are counted against the saved baseline.
 */
export function PermissionMatrix({ roles, permissions, grants, onGrantsChange, baseline, readOnly = false, toolbar, className }: PermissionMatrixProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const search = query.trim().toLowerCase();
  const visible = search ? permissions.filter((permission) => [permission.label, permission.key, permission.description ?? "", permission.category].some((text) => text.toLowerCase().includes(search))) : permissions;
  const categories = [...new Set(visible.map((permission) => permission.category))];
  const has = (role: Role, key: string) => role.locked || (grants[role.id] ?? []).includes(key);
  const changed = (role: Role, key: string) => baseline !== undefined && !role.locked && (grants[role.id] ?? []).includes(key) !== (baseline[role.id] ?? []).includes(key);
  const changes = baseline ? countGrantChanges(grants, baseline) : 0;

  const set = (role: Role, keys: string[], on: boolean) => {
    const current = new Set(grants[role.id] ?? []);
    for (const key of keys) {
      if (on) current.add(key);
      else current.delete(key);
    }
    onGrantsChange?.({ ...grants, [role.id]: permissions.map((permission) => permission.key).filter((key) => current.has(key)) });
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput label="Search permissions" placeholder="Search permissions" value={query} onValueChange={setQuery} resultCount={visible.length} className="w-64" />
        {baseline && (
          <span role="status" className="text-xs text-muted-foreground">
            {changes ? `${changes} unsaved ${changes === 1 ? "change" : "changes"}` : "No unsaved changes"}
          </span>
        )}
        {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Permissions by role</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th scope="col" className="sticky left-0 z-10 min-w-56 bg-muted px-3 py-2 text-left font-medium">
                Permission
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className="min-w-24 px-3 py-2 text-center font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {role.name}
                    {role.locked && <LockIcon aria-label="locked" className="size-3 text-muted-foreground" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {categories.map((category) => {
            const items = visible.filter((permission) => permission.category === category);
            const open = Boolean(search) || !collapsed.has(category);
            return (
              <tbody key={category}>
                <tr className="border-b border-border bg-muted/30">
                  <th scope="rowgroup" className="sticky left-0 z-10 bg-muted px-1 py-1.5 text-left">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => {
                        const next = new Set(collapsed);
                        if (next.has(category)) next.delete(category);
                        else next.add(category);
                        setCollapsed(next);
                      }}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-left font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronRightIcon aria-hidden="true" className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
                      {category}
                      <span className="font-normal text-muted-foreground">({items.length})</span>
                    </button>
                  </th>
                  {roles.map((role) => {
                    const count = items.filter((permission) => has(role, permission.key)).length;
                    return (
                      <td key={role.id} className="px-3 py-1.5 text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <TriStateCheckbox
                            checked={count === items.length}
                            indeterminate={count > 0 && count < items.length}
                            disabled={readOnly || Boolean(role.locked)}
                            label={`All ${category} permissions for ${role.name}, ${count} of ${items.length}`}
                            onChange={(checked) =>
                              set(
                                role,
                                items.map((permission) => permission.key),
                                checked,
                              )
                            }
                          />
                          <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
                            {count}/{items.length}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
                {open &&
                  items.map((permission) => (
                    <tr key={permission.key} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-1.5 pl-9 text-left font-normal">
                        <span className="block">{permission.label}</span>
                        {permission.description && <span className="block text-xs text-muted-foreground">{permission.description}</span>}
                      </th>
                      {roles.map((role) => (
                        <td key={role.id} className={cn("px-3 py-1.5 text-center", changed(role, permission.key) && "bg-warning/15")}>
                          <input
                            type="checkbox"
                            aria-label={`${permission.label} for ${role.name}${changed(role, permission.key) ? " (changed)" : ""}`}
                            checked={has(role, permission.key)}
                            disabled={readOnly || Boolean(role.locked)}
                            onChange={(event) => set(role, [permission.key], event.target.checked)}
                            className="size-4 accent-primary disabled:opacity-60"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            );
          })}
        </table>
        {categories.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No permissions match "{query}".</p>}
      </div>
    </div>
  );
}
