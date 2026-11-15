// packages/ai-ui/src/components/mcp-server-list.tsx
"use client";

import { Switch } from "@base-ui/react/switch";
import { ChevronRightIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon, ServerIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";

import { badge, button, buttonVariants, card, focusRing, iconButton, switchRoot, switchThumb, type Tone, toneDot } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { ConfirmDialog } from "./confirm-dialog.js";

export interface McpToolParameter {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  parameters?: McpToolParameter[];
}

export type McpServerStatus = "connected" | "connecting" | "error" | "disabled";

export interface McpServer {
  id: string;
  name: string;
  transport: "stdio" | "http" | "sse";
  /** URL for http and sse servers, command for stdio. */
  target?: string;
  status: McpServerStatus;
  enabled: boolean;
  tools?: McpTool[];
  error?: string;
}

const STATUS: Record<McpServerStatus, { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "success" },
  connecting: { label: "Connecting", tone: "info" },
  error: { label: "Error", tone: "danger" },
  disabled: { label: "Off", tone: "neutral" },
};

export interface McpServerListProps {
  servers: McpServer[];
  onToggle: (id: string, enabled: boolean) => void;
  /** Reconnects and lists the server's tools again. */
  onCheck?: (id: string) => void | Promise<void>;
  /** Removes a server after confirmation. */
  onRemove?: (id: string) => void;
  onAdd?: () => void;
  className?: string;
}

/**
 * Connected MCP servers: status, transport and tool count, an enable
 * switch, a reconnect check, removal with confirmation, and each server's
 * tools with their parameters.
 */
export function McpServerList({ servers, onToggle, onCheck, onRemove, onAdd, className }: McpServerListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<McpServer | null>(null);
  const id = useId();

  const toggleExpanded = (serverId: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });

  const check = async (serverId: string) => {
    setChecking((current) => new Set(current).add(serverId));
    try {
      await onCheck?.(serverId);
    } finally {
      setChecking((current) => {
        const next = new Set(current);
        next.delete(serverId);
        return next;
      });
    }
  };

  return (
    <section aria-labelledby={`${id}-title`} data-slot="mcp-server-list" className={cn("flex flex-col gap-2 text-sm", className)}>
      <div className="flex items-center gap-2">
        <h3 id={`${id}-title`} className="font-medium">
          MCP servers
        </h3>
        <span className="text-xs text-muted-foreground">
          {servers.filter((server) => server.status === "connected").length} connected
        </span>
        {onAdd && (
          <button type="button" onClick={onAdd} className={cn(button, buttonVariants.outline, "ml-auto h-7 px-2 text-xs", focusRing)}>
            <PlusIcon aria-hidden="true" />
            Add server
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {servers.map((server) => {
          const status = checking.has(server.id) ? STATUS.connecting : STATUS[server.enabled ? server.status : "disabled"];
          const open = expanded.has(server.id);
          const tools = server.tools ?? [];
          return (
            <li key={server.id} className={cn(card, "flex flex-col")}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button type="button" aria-expanded={open} aria-controls={`${id}-${server.id}`} disabled={tools.length === 0} onClick={() => toggleExpanded(server.id)} className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left disabled:cursor-default", focusRing)}>
                  <ChevronRightIcon aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-90", tools.length === 0 && "invisible")} />
                  <ServerIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{server.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tools.length} {tools.length === 1 ? "tool" : "tools"}
                  </span>
                </button>
                <span className={badge}>
                  <span aria-hidden="true" className={cn("size-2 rounded-full", toneDot[status.tone], status === STATUS.connecting && "motion-safe:animate-pulse")} />
                  {status.label}
                </span>
                <span className={cn(badge, "font-mono uppercase")}>{server.transport}</span>
                {onCheck && server.enabled && (
                  <button type="button" aria-label={`Check ${server.name}`} title="Check connection" disabled={checking.has(server.id)} onClick={() => void check(server.id)} className={cn(iconButton, "size-7", focusRing)}>
                    {checking.has(server.id) ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <RefreshCwIcon aria-hidden="true" />}
                  </button>
                )}
                {onRemove && (
                  <button type="button" aria-label={`Remove ${server.name}`} title="Remove" onClick={() => setRemoving(server)} className={cn(iconButton, "size-7 hover:text-destructive", focusRing)}>
                    <Trash2Icon aria-hidden="true" />
                  </button>
                )}
                <Switch.Root aria-label={`Enable ${server.name}`} checked={server.enabled} onCheckedChange={(checked) => onToggle(server.id, checked)} className={cn(switchRoot, focusRing)}>
                  <Switch.Thumb className={switchThumb} />
                </Switch.Root>
              </div>
              {server.target && <p className="truncate px-3 pb-2 pl-9 font-mono text-xs text-muted-foreground">{server.target}</p>}
              {server.status === "error" && server.enabled && server.error && (
                <p role="alert" className="px-3 pb-2 pl-9 text-xs font-medium text-destructive">
                  {server.error}
                </p>
              )}
              {open && (
                <ul id={`${id}-${server.id}`} aria-label={`${server.name} tools`} className="flex flex-col divide-y divide-border border-t border-border">
                  {tools.map((tool) => (
                    <li key={tool.name} className="flex flex-col gap-1 px-3 py-2 pl-9">
                      <span className="font-mono text-xs font-medium">{tool.name}</span>
                      {tool.description && <span className="text-xs text-muted-foreground">{tool.description}</span>}
                      {tool.parameters && tool.parameters.length > 0 && (
                        <ul aria-label={`${tool.name} parameters`} className="flex flex-wrap gap-1">
                          {tool.parameters.map((parameter) => (
                            <li key={parameter.name} title={parameter.description} className={cn(badge, "font-mono")}>
                              {parameter.name}
                              {parameter.type && <span className="text-muted-foreground">: {parameter.type}</span>}
                              {parameter.required && (
                                <>
                                  <span aria-hidden="true">*</span>
                                  <span className="sr-only">, required</span>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {servers.length === 0 && <p className="text-muted-foreground">No MCP servers yet.</p>}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={`Remove ${removing?.name ?? ""}?`}
        description="Its tools stop being available to the assistant. You can add it again later."
        confirmLabel="Remove"
        tone="destructive"
        onConfirm={() => {
          if (removing) onRemove?.(removing.id);
        }}
      />
    </section>
  );
}
