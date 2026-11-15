// packages/ai-ui/src/components/csv-column-mapper.tsx
"use client";

import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react";
import { useId } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";

export interface ColumnField {
  id: string;
  label: string;
  required?: boolean;
  /** Other header names that mean this field, such as "qty" for quantity. */
  aliases?: string[];
  description?: string;
}

/** Field id to source column index, or null to skip the field. */
export type ColumnMapping = Record<string, number | null>;

export function normalizeHeader(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Guesses a column for each field: exact matches on the id, label or an
 * alias win, then headers that contain one of those names. Each column is
 * used at most once, in field order.
 */
export function autoMapColumns(headers: string[], fields: ColumnField[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  const names = (field: ColumnField) => [field.id, field.label, ...(field.aliases ?? [])].map(normalizeHeader).filter(Boolean);
  for (const field of fields) {
    const candidates = names(field);
    const exact = normalized.findIndex((header, index) => !used.has(index) && candidates.includes(header));
    mapping[field.id] = exact >= 0 ? exact : null;
    if (exact >= 0) used.add(exact);
  }
  for (const field of fields) {
    if (mapping[field.id] !== null) continue;
    const candidates = names(field).filter((name) => name.length >= 3);
    const partial = normalized.findIndex((header, index) => !used.has(index) && candidates.some((name) => header.includes(name) || (header.length >= 3 && name.includes(header))));
    if (partial >= 0) {
      mapping[field.id] = partial;
      used.add(partial);
    }
  }
  return mapping;
}

/** Turns rows into records keyed by field id; skipped fields are left out. */
export function applyColumnMapping(rows: string[][], mapping: ColumnMapping): Array<Record<string, string>> {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) if (column !== null && column !== undefined) record[field] = row[column] ?? "";
    return record;
  });
}

export interface CsvColumnMapperProps {
  headers: string[];
  /** Data rows, without the header row. */
  rows: string[][];
  fields: ColumnField[];
  mapping?: ColumnMapping;
  defaultMapping?: ColumnMapping;
  onMappingChange?: (mapping: ColumnMapping) => void;
  onConfirm?: (mapping: ColumnMapping, records: Array<Record<string, string>>) => void;
  confirmLabel?: string;
  previewRows?: number;
  className?: string;
}

/**
 * Maps the columns of an imported file to your fields: guesses from header
 * names and aliases, shows sample values for each choice, flags required
 * fields left unmapped and columns used twice, and previews the first rows
 * exactly as they will import.
 */
export function CsvColumnMapper({ headers, rows, fields, mapping, defaultMapping, onMappingChange, onConfirm, confirmLabel, previewRows = 5, className }: CsvColumnMapperProps) {
  const [current, setCurrent] = useControllableState<ColumnMapping>({ value: mapping, defaultValue: defaultMapping ?? autoMapColumns(headers, fields), onChange: onMappingChange });
  const id = useId();
  const samples = (column: number | null | undefined) =>
    column === null || column === undefined
      ? []
      : rows
          .map((row) => row[column]?.trim() ?? "")
          .filter(Boolean)
          .slice(0, 3);
  const missing = fields.filter((field) => field.required && (current[field.id] === null || current[field.id] === undefined));
  const counts = new Map<number, number>();
  for (const column of Object.values(current)) if (column !== null && column !== undefined) counts.set(column, (counts.get(column) ?? 0) + 1);
  const duplicated = fields.filter((field) => {
    const column = current[field.id];
    return column !== null && column !== undefined && (counts.get(column) ?? 0) > 1;
  });
  const mappedFields = fields.filter((field) => current[field.id] !== null && current[field.id] !== undefined);
  const preview = applyColumnMapping(rows.slice(0, previewRows), current);
  const blocked = missing.length > 0 || duplicated.length > 0;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Column mapping</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              Field
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              <span className="sr-only">maps from</span>
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Column in file
            </th>
            <th scope="col" className="hidden py-2 font-medium sm:table-cell">
              Sample values
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const column = current[field.id];
            const isMissing = missing.includes(field);
            const isDuplicate = duplicated.includes(field);
            const selectId = `${id}-${field.id}`;
            const values = samples(column);
            return (
              <tr key={field.id} className="border-b border-border align-top last:border-0">
                <td className="py-2 pr-3">
                  <label htmlFor={selectId} className="font-medium">
                    {field.label}
                    {field.required && <span className="text-muted-foreground"> (required)</span>}
                  </label>
                  {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                </td>
                <td aria-hidden="true" className="py-2.5 pr-3 text-muted-foreground">
                  <ArrowRightIcon className="size-4" />
                </td>
                <td className="py-2 pr-3">
                  <select
                    id={selectId}
                    value={column === null || column === undefined ? "" : String(column)}
                    aria-invalid={isMissing || isDuplicate || undefined}
                    aria-describedby={isMissing || isDuplicate ? `${selectId}-problem` : undefined}
                    onChange={(event) => setCurrent({ ...current, [field.id]: event.target.value === "" ? null : Number(event.target.value) })}
                    className={cn("h-8 w-full min-w-36 rounded-md border border-input bg-background px-2 text-sm aria-invalid:border-destructive", focusRing, "focus-visible:ring-offset-0")}
                  >
                    <option value="">{field.required ? "Choose a column" : "Don't import"}</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Column ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  {(isMissing || isDuplicate) && (
                    <p id={`${selectId}-problem`} className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangleIcon aria-hidden="true" className="size-3.5" />
                      {isMissing ? "Required" : "Column used for another field"}
                    </p>
                  )}
                </td>
                <td className="hidden py-2.5 text-xs text-muted-foreground sm:table-cell">{values.length ? values.join(" · ") : column === null || column === undefined ? "" : "Empty in the first rows"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {mappedFields.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium text-muted-foreground">
            Preview of the first {Math.min(previewRows, rows.length)} of {rows.length} rows
          </h4>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {mappedFields.map((field) => (
                    <th key={field.id} scope="col" className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((record, index) => (
                  <tr key={index} className="border-t border-border">
                    {mappedFields.map((field) => (
                      <td key={field.id} className="max-w-48 truncate px-2 py-1.5">
                        {record[field.id] || <span className="text-muted-foreground">Empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {onConfirm && (
        <div className="flex items-center justify-end gap-3">
          {blocked && (
            <p role="status" className="text-xs text-muted-foreground">
              {missing.length > 0 ? `Map ${missing.map((field) => field.label).join(", ")} to continue.` : "Each column can map to one field."}
            </p>
          )}
          <button type="button" disabled={blocked} onClick={() => onConfirm(current, applyColumnMapping(rows, current))} className={cn(button, buttonVariants.primary, focusRing)}>
            {confirmLabel ?? `Import ${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
          </button>
        </div>
      )}
    </div>
  );
}
