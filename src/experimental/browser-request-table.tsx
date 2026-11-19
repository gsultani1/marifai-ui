// packages/ai-ui/src/experimental/browser-request-table.tsx
"use client";

import { useState } from "react";
import { ChoiceField, ControlAction, ControlPanel } from "../lib/component-controls.js";

/** Provide only display-safe, redacted request data. */
export interface InspectedBrowserRequest { id: string; address: string; method: string; status: string; type: string; durationMs?: number }

export interface BrowserRequestTableProps {
  requests: readonly InspectedBrowserRequest[];
  onInspect: (id: string) => void;
  className?: string;
}

export function BrowserRequestTable({ requests, onInspect, className }: BrowserRequestTableProps) {
  const [filters, setFilters] = useState({ method: "", status: "", type: "" });
  const fields = [{ key: "method", label: "Method" }, { key: "status", label: "Status" }, { key: "type", label: "Request type" }] as const;
  const rows = requests.filter((item) => fields.every(({ key }) => !filters[key] || item[key] === filters[key]));
  return <ControlPanel slot="browser-request-table" title="Browser requests" className={className}>
    <div className="grid gap-2 sm:grid-cols-3">
      {fields.map(({ key, label }) => <ChoiceField key={key} label={label} value={filters[key]} placeholder="All"
        options={[...new Set(requests.map((item) => item[key]))].map((value) => ({ value, label: value }))}
        onChange={(value) => setFilters({ ...filters, [key]: value })} />)}
    </div>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Recorded requests</caption>
      <thead><tr>{["Address", "Method", "Status", "Type", "Duration"].map((label) => <th key={label} scope="col" className="p-1">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">
        <th scope="row" className="p-1 text-left break-all"><ControlAction label="Inspect request" item={row.address} onClick={() => onInspect(row.id)} /> {row.address}</th>
        <td>{row.method}</td><td>{row.status}</td><td>{row.type}</td><td>{row.durationMs === undefined ? "Unavailable" : row.durationMs + " ms"}</td>
      </tr>)}</tbody>
    </table></div> : <p className="text-sm text-muted-foreground">No matching requests.</p>}
  </ControlPanel>;
}
