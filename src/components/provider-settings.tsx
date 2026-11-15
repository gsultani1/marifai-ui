// packages/ai-ui/src/components/provider-settings.tsx
"use client";

import { Switch } from "@base-ui/react/switch";
import { ExternalLinkIcon, LoaderCircleIcon, PlugZapIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

import { button, buttonVariants, card, focusRing, input, switchRoot, switchThumb } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import type { HealthState } from "../lib/models.js";
import { safeUrl } from "../lib/safe-url.js";
import { HealthBadge } from "./provider-health.js";
import { SecretField, type SecretFieldProps } from "./secret-field.js";

export interface ApiKeyFieldProps extends Omit<SecretFieldProps, "label" | "action" | "validate"> {
  /** Provider name, e.g. "Anthropic". */
  provider: string;
  /** Page where a key is created, shown as "Get a key". */
  getKeyUrl?: string;
  /** Keys must start with this, e.g. "sk-ant-". */
  prefix?: string;
  minLength?: number;
}

/** API key entry for one provider: saved, from the environment or not set, with a link to create a key and a prefix check. */
export function ApiKeyField({ provider, getKeyUrl, prefix, minLength = 16, ...props }: ApiKeyFieldProps) {
  const href = safeUrl(getKeyUrl, ["https:"]);
  return (
    <SecretField
      label={`${provider} API key`}
      validate={(value) => (prefix && !value.startsWith(prefix) ? `${provider} keys start with ${prefix}` : value.length < minLength ? "That key looks too short." : null)}
      action={
        href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 rounded-sm text-xs underline underline-offset-2", focusRing)}>
            Get a key
            <ExternalLinkIcon aria-hidden="true" className="size-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : undefined
      }
      {...props}
    />
  );
}

export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  /** Local providers such as Ollama or LM Studio take a base URL instead of a key. */
  kind?: "cloud" | "local";
  baseUrl?: string;
  /** Shown as the placeholder and restored by Reset. */
  defaultBaseUrl?: string;
  /** Omit when the provider needs no key. */
  keySource?: SecretFieldProps["source"];
  keyHint?: string;
  envName?: string;
  getKeyUrl?: string;
  keyPrefix?: string;
  health?: HealthState;
  modelCount?: number;
}

export interface ProviderSettingsProps {
  providers: ProviderConfig[];
  onToggle: (id: string, enabled: boolean) => void;
  onBaseUrlChange?: (id: string, url: string) => void;
  onSaveKey?: (id: string, key: string) => void | Promise<void>;
  onRemoveKey?: (id: string) => void | Promise<void>;
  /** Tests the connection; resolve with a message to show, reject with the failure. */
  onTest?: (id: string) => Promise<string | void>;
  className?: string;
}

/** Normalizes a base URL to http(s) without a trailing slash, or null when it isn't one. */
export function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function BaseUrlField({ provider, onChange }: { provider: ProviderConfig; onChange: (url: string) => void }) {
  const [draft, setDraft] = useState({ for: provider.baseUrl ?? "", value: provider.baseUrl ?? "" });
  const value = draft.for === (provider.baseUrl ?? "") ? draft.value : (provider.baseUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const commit = (event?: FormEvent) => {
    event?.preventDefault();
    const next = value.trim() ? normalizeBaseUrl(value) : (provider.defaultBaseUrl ?? "");
    if (next === null) {
      setError("Enter an http:// or https:// address.");
      return;
    }
    setError(null);
    if (next !== provider.baseUrl) onChange(next);
    setDraft({ for: next, value: next });
  };

  return (
    <form onSubmit={commit} className="flex flex-col gap-1">
      <label htmlFor={`${id}-url`} className="text-xs font-medium">
        Base URL
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-url`}
          value={value}
          placeholder={provider.defaultBaseUrl ?? "http://localhost:11434"}
          spellCheck={false}
          inputMode="url"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setDraft({ for: provider.baseUrl ?? "", value: event.target.value });
            setError(null);
          }}
          onBlur={() => commit()}
          className={cn(input, "font-mono text-xs", focusRing, "focus-visible:ring-offset-0")}
        />
        {provider.defaultBaseUrl && provider.baseUrl !== provider.defaultBaseUrl && (
          <button type="button" onClick={() => onChange(provider.defaultBaseUrl!)} className={cn(button, buttonVariants.ghost, "h-9", focusRing)}>
            Reset
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Model providers with an enable switch each; enabled providers show their
 * base URL (local and OpenAI-compatible servers), API key, health and a
 * connection test.
 */
export function ProviderSettings({ providers, onToggle, onBaseUrlChange, onSaveKey, onRemoveKey, onTest, className }: ProviderSettingsProps) {
  const [tests, setTests] = useState<Record<string, { state: "running" | "ok" | "failed"; message: string }>>({});

  const test = async (provider: ProviderConfig) => {
    setTests((current) => ({ ...current, [provider.id]: { state: "running", message: "Testing…" } }));
    try {
      const message = await onTest?.(provider.id);
      setTests((current) => ({ ...current, [provider.id]: { state: "ok", message: message || `Connected to ${provider.name}.` } }));
    } catch (reason) {
      setTests((current) => ({ ...current, [provider.id]: { state: "failed", message: reason instanceof Error && reason.message ? reason.message : `Couldn't reach ${provider.name}.` } }));
    }
  };

  return (
    <div data-slot="provider-settings" className={cn("flex flex-col gap-3 text-sm", className)}>
      {providers.map((provider) => {
        const result = tests[provider.id];
        return (
          <section key={provider.id} aria-label={provider.name} data-enabled={provider.enabled || undefined} className={cn(card, "flex flex-col gap-3 p-3")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{provider.name}</span>
              {provider.kind === "local" && <span className="rounded-full border border-border px-2 text-xs">Local</span>}
              {provider.enabled && provider.health && <HealthBadge state={provider.health} />}
              {provider.modelCount !== undefined && <span className="text-xs text-muted-foreground">{provider.modelCount} models</span>}
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs">
                {provider.enabled ? "On" : "Off"}
                <Switch.Root aria-label={`Enable ${provider.name}`} checked={provider.enabled} onCheckedChange={(checked) => onToggle(provider.id, checked)} className={cn(switchRoot, focusRing)}>
                  <Switch.Thumb className={switchThumb} />
                </Switch.Root>
              </label>
            </div>
            {provider.enabled && (
              <>
                {(provider.kind === "local" || provider.baseUrl !== undefined) && onBaseUrlChange && <BaseUrlField provider={provider} onChange={(url) => onBaseUrlChange(provider.id, url)} />}
                {provider.keySource && onSaveKey && (
                  <ApiKeyField
                    provider={provider.name}
                    source={provider.keySource}
                    onSave={(key) => onSaveKey(provider.id, key)}
                    {...(provider.keyHint ? { hint: provider.keyHint } : {})}
                    {...(provider.envName ? { envName: provider.envName } : {})}
                    {...(provider.getKeyUrl ? { getKeyUrl: provider.getKeyUrl } : {})}
                    {...(provider.keyPrefix ? { prefix: provider.keyPrefix } : {})}
                    {...(onRemoveKey ? { onRemove: () => onRemoveKey(provider.id) } : {})}
                  />
                )}
                {onTest && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={result?.state === "running"} onClick={() => void test(provider)} className={cn(button, buttonVariants.outline, focusRing)}>
                      {result?.state === "running" ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <PlugZapIcon aria-hidden="true" />}
                      Test connection
                    </button>
                    <span role="status" className={cn("text-xs", result?.state === "failed" ? "font-medium text-destructive" : result?.state === "ok" ? "" : "text-muted-foreground")}>
                      {result?.message ?? ""}
                    </span>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
