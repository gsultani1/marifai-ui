// packages/ai-ui/src/components/browser-request-table.tsx
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

const fields = [{ key: "method", label: "Method" }, { key: "status", label: "Status" }, { key: "type", label: "Request type" }] as const;

export function BrowserRequestTable({ requests, onInspect, className }: BrowserRequestTableProps) {
  const [filters, setFilters] = useState({ method: "", status: "", type: "" });
  // A filter whose value no longer occurs in the requests shows "All", so it must also stop filtering.
  const choices = fields.map((field) => {
    const values = [...new Set(requests.map((item) => item[field.key]))];
    return { ...field, values, value: values.includes(filters[field.key]) ? filters[field.key] : "" };
  });
  const rows = requests.filter((item) => choices.every(({ key, value }) => !value || item[key] === value));
  return <ControlPanel slot="browser-request-table" title="Browser requests" className={className}>
    <div className="grid gap-2 sm:grid-cols-3">
      {choices.map(({ key, label, values, value }) => <ChoiceField key={key} label={label} value={value} placeholder="All"
        options={values.map((option) => ({ value: option, label: option }))}
        onChange={(next) => setFilters({ ...filters, [key]: next })} />)}
    </div>
    {requests.length > 0 && <p role="status" className="text-xs text-muted-foreground">Showing {rows.length} of {requests.length} requests</p>}
    {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Recorded requests</caption>
      <thead><tr>{["Address", "Method", "Status", "Type", "Duration"].map((label) => <th key={label} scope="col" className="p-1">{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border">
        <th scope="row" className="p-1 text-left break-all"><ControlAction label="Inspect request" item={row.address} onClick={() => onInspect(row.id)} /> {row.address}</th>
        <td>{row.method}</td><td>{row.status}</td><td>{row.type}</td><td>{row.durationMs === undefined ? "Unavailable" : row.durationMs + " ms"}</td>
      </tr>)}</tbody>
    </table></div> : <p className="text-sm text-muted-foreground">{requests.length ? "No matching requests." : "No requests recorded."}</p>}
  </ControlPanel>;
}
