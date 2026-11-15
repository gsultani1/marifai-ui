// packages/ai-ui/src/components/model-config-list.tsx
"use client";

import { FlaskConicalIcon, KeyRoundIcon, LoaderCircleIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { badge, button, buttonVariants, card, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { formatTokenCount, type ModelInfo } from "../lib/models.js";
import type { ModelParameterValues } from "./model-parameters.js";
import { ModelPicker } from "./model-picker.js";

export interface ModelRole {
  id: string;
  /** e.g. "Planner", "Coder" or "Reviewer". */
  label: string;
  description?: string;
  defaultModelId: string;
  /** Replaces the default for this role. */
  modelId?: string;
  /** Used when the chosen model fails. */
  fallbackModelId?: string;
  parameters?: Pick<ModelParameterValues, "temperature" | "maxTokens" | "effort">;
}

export interface ModelConfigListProps {
  roles: ModelRole[];
  models: ModelInfo[];
  onSave: (roles: ModelRole[]) => void | Promise<void>;
  /** Sends a test prompt to the role's model; resolve with a note such as the latency. */
  onTest?: (role: ModelRole, modelId: string) => Promise<string | void>;
  /** Providers billed to the user's own key, marked "Your key". */
  ownKeyProviders?: string[];
  className?: string;
}

type TestResult = { state: "running" | "ok" | "failed"; message: string };

/** Roles whose chosen model differs between two lists, by id. */
export function changedRoles(saved: readonly ModelRole[], draft: readonly ModelRole[]): string[] {
  return draft.filter((role) => (saved.find((item) => item.id === role.id)?.modelId ?? undefined) !== (role.modelId ?? undefined)).map((role) => role.id);
}

/**
 * Which model each agent role uses: the default or an override, its
 * parameters, fallback and billing, with a test per role, reset to the
 * default, and unsaved changes held until Save.
 */
export function ModelConfigList({ roles, models, onSave, onTest, ownKeyProviders = [], className }: ModelConfigListProps) {
  const [state, setState] = useState({ source: roles, draft: roles });
  const draft = state.source === roles ? state.draft : roles;
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = changedRoles(roles, draft);
  const modelName = (modelId: string | undefined) => models.find((model) => model.id === modelId)?.name ?? modelId ?? "";

  const update = (roleId: string, modelId: string | undefined) => {
    setState({
      source: roles,
      draft: draft.map((role) => {
        if (role.id !== roleId) return role;
        const next: ModelRole = { ...role };
        if (modelId === undefined || modelId === role.defaultModelId) delete next.modelId;
        else next.modelId = modelId;
        return next;
      }),
    });
    setTests((current) => {
      const next = { ...current };
      delete next[roleId];
      return next;
    });
  };

  const test = async (role: ModelRole) => {
    const modelId = role.modelId ?? role.defaultModelId;
    setTests((current) => ({ ...current, [role.id]: { state: "running", message: `Testing ${modelName(modelId)}…` } }));
    try {
      const note = await onTest?.(role, modelId);
      setTests((current) => ({ ...current, [role.id]: { state: "ok", message: note || `${modelName(modelId)} responded.` } }));
    } catch (reason) {
      setTests((current) => ({ ...current, [role.id]: { state: "failed", message: reason instanceof Error && reason.message ? reason.message : `${modelName(modelId)} didn't respond.` } }));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "Couldn't save the model settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-slot="model-config-list" className={cn("flex flex-col gap-2 text-sm", className)}>
      <ul className="flex flex-col gap-2">
        {draft.map((role) => {
          const modelId = role.modelId ?? role.defaultModelId;
          const model = models.find((item) => item.id === modelId);
          const result = tests[role.id];
          const dirty = changed.includes(role.id);
          return (
            <li key={role.id} aria-label={role.label} data-changed={dirty || undefined} className={cn(card, "flex flex-col gap-2 p-3", dirty && "border-ring")}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="flex min-w-40 flex-1 flex-col">
                  <span className="font-medium">
                    {role.label}
                    {dirty && <span className="ml-2 text-xs font-normal">· Unsaved</span>}
                  </span>
                  {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
                </div>
                <ModelPicker label={`${role.label} model`} models={models} value={modelId} onValueChange={(next) => update(role.id, next)} />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className={cn(badge, role.modelId && "border-primary/40")}>{role.modelId ? "Override" : "Default"}</span>
                {role.parameters?.temperature !== undefined && <span className={badge}>Temperature {role.parameters.temperature}</span>}
                {role.parameters?.maxTokens !== undefined && <span className={badge}>{formatTokenCount(role.parameters.maxTokens)} max tokens</span>}
                {role.parameters?.effort && <span className={badge}>{role.parameters.effort} effort</span>}
                {model && ownKeyProviders.includes(model.provider) && (
                  <span className={badge}>
                    <KeyRoundIcon aria-hidden="true" />
                    Your key
                  </span>
                )}
                {role.fallbackModelId && <span className="text-xs text-muted-foreground">Falls back to {modelName(role.fallbackModelId)}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onTest && (
                  <button type="button" aria-label={`Test ${role.label}`} disabled={result?.state === "running"} onClick={() => void test(role)} className={cn(button, buttonVariants.outline, "h-7 px-2 text-xs", focusRing)}>
                    {result?.state === "running" ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <FlaskConicalIcon aria-hidden="true" />}
                    Test
                  </button>
                )}
                {role.modelId && (
                  <button type="button" aria-label={`Reset ${role.label} to ${modelName(role.defaultModelId)}`} onClick={() => update(role.id, undefined)} className={cn(button, buttonVariants.ghost, "h-7 px-2 text-xs", focusRing)}>
                    <RotateCcwIcon aria-hidden="true" />
                    Reset
                  </button>
                )}
                <span role="status" className={cn("text-xs", result?.state === "failed" ? "font-medium text-destructive" : result?.state === "running" ? "text-muted-foreground" : "")}>
                  {result?.message ?? ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {(changed.length > 0 || error) && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
          <span role="status" className="flex-1">
            {changed.length > 0 ? `${changed.length} unsaved ${changed.length === 1 ? "change" : "changes"}` : ""}
          </span>
          {error && (
            <span role="alert" className="w-full text-xs font-medium text-destructive sm:order-first sm:w-auto">
              {error}
            </span>
          )}
          <button type="button" disabled={saving || changed.length === 0} onClick={() => setState({ source: roles, draft: roles })} className={cn(button, buttonVariants.ghost, focusRing)}>
            Discard
          </button>
          <button type="button" disabled={saving || changed.length === 0} onClick={() => void save()} className={cn(button, buttonVariants.primary, focusRing)}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
