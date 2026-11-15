// packages/ai-ui/example/gallery/settings.tsx
import { useState } from "react";

import {
  type AgentParticipant,
  AgentPicker,
  type AgentSelection,
  BudgetNotice,
  ContextMeter,
  ContextSnapshot,
  type ContextSnapshotSection,
  McpServerList,
  type McpServer,
  type MemoryConflictEntry,
  type MemoryItem,
  MemoryManager,
  ModelCard,
  ModelConfigList,
  type ModelInfo,
  type ModelParameterValues,
  ModelParameters,
  ModelPicker,
  type ModelRole,
  mostConstrainedLimit,
  PromptLibrary,
  type ProviderConfig,
  ProviderHealth,
  ProviderSettings,
  type ProviderStatus,
  RunBudgetControl,
  type SavedPrompt,
  ToolAuditLog,
  type ToolAuditEntry,
  UsageDashboard,
  UsageLimitBanner,
  UsageLimitCard,
  UsageReceipt,
  type UsageRun,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const MODELS: ModelInfo[] = [
  { id: "claude-opus", name: "Claude Opus", provider: "Anthropic", contextWindow: 200_000, maxOutput: 32_000, capabilities: ["reasoning", "vision", "tools"], pricing: { input: 15, output: 75 }, health: "operational" },
  { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic", contextWindow: 1_000_000, maxOutput: 64_000, capabilities: ["reasoning", "vision", "tools"], pricing: { input: 3, output: 15 }, health: "operational" },
  { id: "claude-haiku", name: "Claude Haiku", provider: "Anthropic", contextWindow: 200_000, maxOutput: 8192, capabilities: ["vision", "tools"], pricing: { input: 0.8, output: 4 }, health: "degraded" },
  { id: "gpt-mini", name: "GPT mini", provider: "OpenAI", contextWindow: 128_000, maxOutput: 16_384, capabilities: ["tools"], pricing: { input: 0.15, output: 0.6 }, health: "operational" },
  { id: "llama-8b", name: "Llama 3.1 8B", provider: "Ollama", contextWindow: 128_000, free: true, local: true, health: "unknown" },
  { id: "qwen-coder", name: "Qwen 2.5 Coder 7B", provider: "Ollama", contextWindow: 32_000, capabilities: ["tools"], free: true, local: true, health: "down" },
];

const HOUR = 3_600_000;

function ModelsDemo() {
  const [model, setModel] = useState("claude-sonnet");
  const [parameters, setParameters] = useState<ModelParameterValues>({ effort: "high", maxTokens: 4000, temperature: 1, contextTokens: 120_000, timeoutSeconds: 120 });
  const selected = MODELS.find((item) => item.id === model) ?? MODELS[0]!;
  return (
    <div className="flex w-full flex-col gap-4 md:flex-row">
      <div className="flex flex-col gap-2">
        <ModelPicker models={MODELS} value={model} onValueChange={setModel} />
        <p className="text-xs text-muted-foreground">Try "son", "olla" or Free only.</p>
      </div>
      <ModelParameters model={selected} value={parameters} onValueChange={setParameters} defaults={{ effort: "medium", maxTokens: 16_000, temperature: 1, contextTokens: 120_000, timeoutSeconds: 120 }} className="flex-1" />
    </div>
  );
}

function ProvidersDemo() {
  const [providers, setProviders] = useState<ProviderConfig[]>([
    { id: "anthropic", name: "Anthropic", enabled: true, keySource: "saved", keyHint: "…7f3a", getKeyUrl: "https://console.anthropic.com/settings/keys", keyPrefix: "sk-ant-", health: "operational", modelCount: 3 },
    { id: "openai", name: "OpenAI", enabled: false, keySource: "environment", envName: "OPENAI_API_KEY", modelCount: 12 },
    { id: "ollama", name: "Ollama", kind: "local", enabled: true, baseUrl: "http://localhost:11434", defaultBaseUrl: "http://localhost:11434", health: "unknown", modelCount: 2 },
  ]);
  const [status, setStatus] = useState<ProviderStatus[]>(() => [
    { id: "anthropic", name: "Anthropic", state: "operational", latencyMs: 412, checkedAt: Date.now() - 4 * 60_000 },
    { id: "openai", name: "OpenAI", state: "degraded", latencyMs: 2840, checkedAt: Date.now() - 9 * 60_000, message: "Elevated error rates on chat completions" },
    { id: "ollama", name: "Ollama", state: "down", checkedAt: Date.now() - 60_000, message: "Connection refused at localhost:11434" },
  ]);
  const patch = (id: string, change: Partial<ProviderConfig>) => setProviders((list) => list.map((provider) => (provider.id === id ? { ...provider, ...change } : provider)));
  const verify = (id: string) =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        setStatus((list) =>
          list.map((item): ProviderStatus => {
            if (item.id !== id) return item;
            if (id === "ollama") return { id: item.id, name: item.name, state: "down", checkedAt: Date.now(), message: "Connection refused at localhost:11434" };
            return { id: item.id, name: item.name, state: "operational", latencyMs: 380 + id.length * 17, checkedAt: Date.now() };
          }),
        );
        resolve();
      }, 700),
    );
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <ProviderSettings
        providers={providers}
        onToggle={(id, enabled) => patch(id, { enabled })}
        onBaseUrlChange={(id, baseUrl) => patch(id, { baseUrl })}
        onSaveKey={(id, key) => patch(id, { keySource: "saved", keyHint: `…${key.slice(-4)}` })}
        onRemoveKey={(id) => patch(id, { keySource: "none" })}
        onTest={(id) => new Promise((resolve, reject) => setTimeout(() => (id === "ollama" ? reject(new Error("Couldn't reach http://localhost:11434. Is Ollama running?")) : resolve("Connected. 3 models available.")), 600))}
      />
      <ProviderHealth providers={status} onVerify={verify} onVerifyAll={() => Promise.all(status.map((item) => verify(item.id))).then(() => undefined)} />
    </div>
  );
}

function LocalModelsDemo() {
  const [progress, setProgress] = useState(0.38);
  const [state, setState] = useState<"downloading" | "paused" | "installed" | "available">("paused");
  const [active, setActive] = useState("llama");
  return (
    <div className="grid w-full gap-3 md:grid-cols-3">
      <ModelCard
        name="Qwen 2.5 Coder 7B"
        family="Qwen 2.5"
        parameters="7B"
        quantization="Q4_K_M"
        sizeBytes={4_680_000_000}
        contextWindow={32_000}
        status={state}
        progress={progress}
        speed={state === "downloading" ? 48_000_000 : undefined}
        onDownload={() => setState("downloading")}
        onPause={() => setState("paused")}
        onResume={() => {
          setState("downloading");
          setProgress((value) => Math.min(1, value + 0.2));
        }}
        onCancel={() => {
          setState("available");
          setProgress(0);
        }}
        onUse={() => setActive("qwen")}
        onDelete={() => setState("available")}
        active={active === "qwen"}
      />
      <ModelCard name="Llama 3.1 8B" family="Llama 3.1" parameters="8B" quantization="Q5_K_M" sizeBytes={5_730_000_000} contextWindow={128_000} status="installed" active={active === "llama"} onUse={() => setActive("llama")} onDelete={() => undefined} />
      <ModelCard name="Mistral Small 24B" parameters="24B" quantization="Q4_0" sizeBytes={13_400_000_000} status="error" error="Not enough disk space: 13.4 GB needed, 6.1 GB free." onDownload={() => undefined} />
    </div>
  );
}

function RolesDemo() {
  const [roles, setRoles] = useState<ModelRole[]>([
    { id: "planner", label: "Planner", description: "Breaks the request into steps", defaultModelId: "claude-sonnet", parameters: { effort: "high", maxTokens: 16_000 } },
    { id: "coder", label: "Coder", description: "Writes and edits files", defaultModelId: "claude-sonnet", modelId: "claude-opus", fallbackModelId: "claude-sonnet", parameters: { temperature: 0.2 } },
    { id: "reviewer", label: "Reviewer", description: "Checks the result before it is shown", defaultModelId: "claude-haiku" },
  ]);
  return (
    <ModelConfigList
      className="w-full"
      roles={roles}
      models={MODELS}
      ownKeyProviders={["Anthropic"]}
      onSave={(next) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            setRoles(next);
            resolve();
          }, 400),
        )
      }
      onTest={(role, modelId) => new Promise((resolve, reject) => setTimeout(() => (modelId === "qwen-coder" ? reject(new Error("Qwen 2.5 Coder is not running.")) : resolve(`${role.label} replied in ${420 + role.label.length * 30} ms`)), 500))}
    />
  );
}

function ContextDemo() {
  const [sections, setSections] = useState<ContextSnapshotSection[]>([
    { id: "system", label: "System prompt", tokens: 1200, content: "You are the Whitten Hardware assistant. Answer with prices from the current catalog and never promise stock you cannot see." },
    { id: "history", label: "Messages", tokens: 46_000, items: [{ id: "h1", label: "38 earlier messages", tokens: 41_000 }, { id: "h2", label: "Last reply", tokens: 5000 }] },
    { id: "files", label: "Files", items: [{ id: "f1", label: "inventory-october.csv", detail: "2,340 rows", tokens: 52_000 }, { id: "f2", label: "supplier-terms.pdf", detail: "6 pages", tokens: 9000 }] },
    { id: "tools", label: "Tools", tokens: 3800, items: [{ id: "t1", label: "search_catalog", tokens: 1400 }, { id: "t2", label: "create_purchase_order", tokens: 2400 }] },
  ]);
  const sum = (section: ContextSnapshotSection) => section.tokens ?? (section.items ?? []).reduce((total, item) => total + (item.tokens ?? 0), 0);
  const tokens = Object.fromEntries(sections.map((section) => [section.id, sum(section)]));
  const used = Object.values(tokens).reduce((total, value) => total + value, 0) + 800;
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <ContextMeter used={used} limit={200_000} segments={[{ label: "System", tokens: tokens.system ?? 0 }, { label: "History", tokens: tokens.history ?? 0 }, { label: "Files", tokens: tokens.files ?? 0 }, { label: "Tools", tokens: tokens.tools ?? 0 }]} />
        <ContextMeter used={186_000} limit={200_000} label="Long thread" compact />
        <BudgetNotice estimatedTokens={used} estimatedCost={(used * 3) / 1_000_000} spent={4.1} budget={5} onReview={() => undefined} />
      </div>
      <ContextSnapshot
        mode="pending"
        model="Claude Sonnet"
        sections={sections}
        onRemoveItem={(sectionId, itemId) =>
          setSections((list) =>
            list.map((section) => {
              if (section.id !== sectionId || !section.items) return section;
              const items = section.items.filter((item) => item.id !== itemId);
              const next: ContextSnapshotSection = { ...section, items };
              if (section.tokens !== undefined) next.tokens = items.reduce((total, item) => total + (item.tokens ?? 0), 0);
              return next;
            }),
          )
        }
      />
    </div>
  );
}

function UsageDemo() {
  const [cap, setCap] = useState<number | null>(200);
  const [runs] = useState<UsageRun[]>(() => {
    const now = Date.now();
    return [
      { id: "run-1041", title: "Weekly restock report", startedAt: now - 2 * HOUR, model: "Claude Sonnet", inputTokens: 84_000, outputTokens: 6200, cost: 0.345, status: "succeeded" },
      { id: "run-1040", title: "Supplier price comparison", startedAt: now - 5 * HOUR, model: "Claude Opus", inputTokens: 52_000, outputTokens: 9100, cost: 1.4625, status: "succeeded" },
      { id: "run-1039", title: "Paint SKU cleanup", startedAt: now - 26 * HOUR, model: "Claude Haiku", inputTokens: 31_000, outputTokens: 2400, cost: 0.0344, estimated: true, status: "failed" },
      { id: "run-1038", title: "Holiday hours email", startedAt: now - 30 * HOUR, model: "GPT mini", inputTokens: 4200, outputTokens: 900, cost: 0.0012, status: "succeeded" },
      { id: "run-1037", title: "Inventory forecast", startedAt: now - 50 * HOUR, model: "Claude Sonnet", inputTokens: 120_000, outputTokens: 11_000, cost: 0.525, estimated: true, status: "canceled" },
    ];
  });
  return <UsageDashboard runs={runs} limit={25} reserved={0.6} periodLabel="October" perRunCap={cap} onPerRunCapChange={setCap} exportName="october-usage" className="w-full" />;
}

function LimitsDemo() {
  const [dismissed, setDismissed] = useState(false);
  const [limits] = useState(() => [
    { id: "messages", label: "Messages", used: 172, limit: 200, unit: "messages", resetsAt: Date.now() + 3 * HOUR + 12 * 60_000 },
    { id: "deep", label: "Deep research", used: 4, limit: 5, unit: "deep research runs", resetsAt: Date.now() + 4 * 24 * HOUR },
    { id: "images", label: "Images", used: 12, limit: 100, unit: "images" },
  ]);
  const tightest = mostConstrainedLimit(limits)!;
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <UsageLimitCard limits={limits} actionLabel="Upgrade" onAction={() => undefined} />
      <div className="flex flex-col">
        <div className="rounded-t-lg border border-border bg-background px-3 py-3 text-sm text-muted-foreground">Ask anything…</div>
        {!dismissed ? <UsageLimitBanner limit={tightest} actionLabel="Upgrade" onAction={() => undefined} onDismiss={() => setDismissed(true)} /> : <div className="rounded-b-lg border border-t-0 border-border px-3 py-1.5 text-xs text-muted-foreground">Banner dismissed.</div>}
        <UsageReceipt
          className="mt-4"
          details={{ model: "Claude Haiku", requestedModel: "Claude Sonnet", provider: "Anthropic", reason: "Sonnet was overloaded, so the request fell back", fallbacks: [{ model: "Claude Sonnet", reason: "529 overloaded" }], inputTokens: 12_400, outputTokens: 860, cachedTokens: 9800, timings: { queueMs: 140, firstTokenMs: 620, totalMs: 3400 }, cost: 0.0134, requestId: "req_011CTq8demo4c2e" }}
        />
      </div>
    </div>
  );
}

function BudgetDemo() {
  const [source, setSource] = useState("team");
  const [max, setMax] = useState<number | null>(100);
  const [autoStop, setAutoStop] = useState(false);
  return (
    <RunBudgetControl
      className="w-full max-w-md"
      sources={[
        { id: "team", label: "Team credits", description: "Shared by the Whitten Hardware workspace", balance: 42.5 },
        { id: "byok", label: "Your Anthropic key", description: "Billed to your own account" },
        { id: "org", label: "Organization budget", disabled: true, reason: "An admin has to enable it first" },
      ]}
      sourceId={source}
      onSourceChange={setSource}
      maxPerMessage={max}
      onMaxPerMessageChange={setMax}
      autoStop={autoStop}
      onAutoStopChange={setAutoStop}
    />
  );
}

function ToolsDemo() {
  const [servers, setServers] = useState<McpServer[]>([
    { id: "fs", name: "Filesystem", transport: "stdio", target: "npx @modelcontextprotocol/server-filesystem ~/pos", status: "connected", enabled: true, tools: [{ name: "read_file", description: "Read a file from the allowed folders", parameters: [{ name: "path", type: "string", required: true }] }, { name: "list_directory", parameters: [{ name: "path", type: "string", required: true }] }] },
    { id: "postgres", name: "Inventory database", transport: "http", target: "https://mcp.example.com/inventory", status: "connected", enabled: true, tools: [{ name: "query", description: "Run a read-only SQL query", parameters: [{ name: "sql", type: "string", required: true }, { name: "limit", type: "number" }] }] },
    { id: "crm", name: "CRM", transport: "sse", target: "https://crm.example.com/mcp", status: "error", enabled: true, error: "401 Unauthorized: the token expired. Reconnect to sign in again." },
  ]);
  const [entries] = useState<ToolAuditEntry[]>(() => {
    const now = Date.now();
    return [
      { id: "a1", tool: "query", server: "Inventory database", status: "success", at: now - 4 * 60_000, durationMs: 182, actor: "Marifai", args: { sql: "select sku, on_hand from stock where on_hand < reorder_point", limit: 50 }, result: "37 rows" },
      { id: "a2", tool: "send_email", server: "Gmail", status: "denied", at: now - 12 * 60_000, actor: "Marifai", args: { to: "owner@example.com", subject: "Restock list" }, result: "Blocked: sending email needs approval." },
      { id: "a3", tool: "read_file", server: "Filesystem", status: "success", at: now - 20 * 60_000, durationMs: 12, actor: "Marifai", args: { path: "~/pos/reports/october.csv" } },
      { id: "a4", tool: "update_contact", server: "CRM", status: "error", at: now - 45 * 60_000, durationMs: 30_100, actor: "Marifai", args: { id: 8812, phone: "901-555-0142" }, result: "Timed out after 30 s" },
    ];
  });
  return (
    <div className="grid w-full gap-4 md:grid-cols-2">
      <McpServerList
        servers={servers}
        onToggle={(id, enabled) => setServers((list) => list.map((server) => (server.id === id ? { ...server, enabled } : server)))}
        onCheck={(id) =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              setServers((list) => list.map((server) => (server.id === id && server.id !== "crm" ? { ...server, status: "connected" } : server)));
              resolve();
            }, 700),
          )
        }
        onRemove={(id) => setServers((list) => list.filter((server) => server.id !== id))}
        onAdd={() => undefined}
      />
      <ToolAuditLog entries={entries} />
    </div>
  );
}

function PromptsDemo() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([
    { id: "p1", title: "Order follow-up", body: "Write a short, friendly note to {{customer}} about order {{order}}. Mention that it ships {{when}}.", tags: ["email", "customers"], favorite: true },
    { id: "p2", title: "Weekly sales summary", body: "Summarize this week's sales by department and call out anything more than 15% off last week.", tags: ["reports"] },
    { id: "p3", title: "Product description", body: "Write a product description for {{product}} in under 80 words for the website.", tags: ["catalog"] },
  ]);
  const [used, setUsed] = useState("");
  return (
    <div className="flex w-full flex-col gap-2">
      <PromptLibrary
        prompts={prompts}
        onUse={(text) => setUsed(text)}
        onSave={(prompt) => setPrompts((list) => (list.some((item) => item.id === prompt.id) ? list.map((item) => (item.id === prompt.id ? prompt : item)) : [...list, prompt]))}
        onDelete={(id) => setPrompts((list) => list.filter((prompt) => prompt.id !== id))}
        onFavoriteChange={(id, favorite) => setPrompts((list) => list.map((prompt) => (prompt.id === id ? { ...prompt, favorite } : prompt)))}
      />
      {used && (
        <p className="rounded-md border border-border bg-card p-2 text-sm">
          <span className="font-medium">Sent to the composer: </span>
          {used}
        </p>
      )}
    </div>
  );
}

function MemoryDemo() {
  const [memories, setMemories] = useState<MemoryItem[]>(() => [
    { id: "m1", text: "George wants the restock report every Monday at 8 AM.", status: "approved", confidence: 0.94, source: "Reports chat", category: "Preferences", createdAt: Date.now() - 6 * 24 * HOUR },
    { id: "m2", text: "The paint department is moving to aisle 12 in November.", status: "pending", confidence: 0.71, source: "Store layout chat", category: "Store", createdAt: Date.now() - 2 * HOUR },
    { id: "m3", text: "Use the October promo code FALL15 in customer emails.", status: "approved", confidence: 0.88, source: "Marketing chat", category: "Marketing", createdAt: Date.now() - 30 * 24 * HOUR, expiresAt: Date.now() - 24 * HOUR },
    { id: "m4", text: "Prefers prices without tax in quotes.", status: "rejected", confidence: 0.4, source: "Quote chat", category: "Preferences", createdAt: Date.now() - 3 * 24 * HOUR },
  ]);
  const [conflicts, setConflicts] = useState<MemoryConflictEntry[]>(() => [
    { id: "c1", existing: { id: "h1", text: "The store opens at 8 AM on weekdays.", status: "approved", source: "Hours chat" }, incoming: { id: "h2", text: "The store opens at 7 AM on weekdays starting November.", status: "pending", source: "Staffing chat" }, reason: "Different weekday opening times" },
  ]);
  const setStatus = (id: string, status: MemoryItem["status"]) => setMemories((list) => list.map((memory) => (memory.id === id ? { ...memory, status } : memory)));
  return (
    <MemoryManager
      className="w-full"
      memories={memories}
      onApprove={(id) => setStatus(id, "approved")}
      onReject={(id) => setStatus(id, "rejected")}
      onEdit={(id, text) => setMemories((list) => list.map((memory) => (memory.id === id ? { ...memory, text } : memory)))}
      onForget={(id) => setMemories((list) => list.filter((memory) => memory.id !== id))}
      conflicts={conflicts}
      onResolveConflict={(id, resolution) => {
        const conflict = conflicts.find((item) => item.id === id);
        setConflicts((list) => list.filter((item) => item.id !== id));
        if (!conflict) return;
        const kept = resolution.keep === "existing" ? [conflict.existing] : resolution.keep === "incoming" ? [conflict.incoming] : resolution.keep === "both" ? [conflict.existing, conflict.incoming] : [{ ...conflict.incoming, text: resolution.text }];
        setMemories((list) => [...kept.map((memory) => ({ ...memory, status: "approved" as const, createdAt: Date.now() })), ...list]);
      }}
    />
  );
}

function AgentsDemo() {
  const [value, setValue] = useState<AgentSelection>({ kind: "model", id: "claude-sonnet" });
  const [participants, setParticipants] = useState<AgentParticipant[]>([
    { id: "member-1", agentId: "claude-opus", role: "Lead" },
    { id: "member-2", agentId: "claude-haiku", role: "Researcher" },
  ]);
  return (
    <AgentPicker
      className="w-full max-w-lg"
      value={value}
      onValueChange={setValue}
      participants={participants}
      onParticipantsChange={setParticipants}
      agents={[
        ...MODELS.slice(0, 4).map((model) => ({ id: model.id, name: model.name, kind: "model" as const, description: model.provider })),
        { id: "research", name: "Research team", kind: "team", description: "A lead plans, two researchers search and a writer drafts" },
        { id: "review", name: "Code review pair", kind: "team", description: "One model writes, another reviews" },
        { id: "weekly", name: "Weekly report", kind: "template", description: "Pulls sales, inventory and staffing into one summary" },
        { id: "quote", name: "Customer quote", kind: "template", description: "Prices a list of items with current stock" },
      ]}
    />
  );
}

export function SettingsGallery() {
  return (
    <GallerySection id="gallery-settings" title="Models, usage and settings">
      <Demo title="Model picker and parameters" className="flex w-full">
        <ModelsDemo />
      </Demo>
      <Demo title="Providers, keys and health" className="flex w-full">
        <ProvidersDemo />
      </Demo>
      <Demo title="Local models" className="flex w-full">
        <LocalModelsDemo />
      </Demo>
      <Demo title="Models per role" className="flex w-full">
        <RolesDemo />
      </Demo>
      <Demo title="Context meter, snapshot and pre-send estimate" className="flex w-full">
        <ContextDemo />
      </Demo>
      <Demo title="Usage dashboard" className="flex w-full">
        <UsageDemo />
      </Demo>
      <Demo title="Plan limits and receipts" className="flex w-full">
        <LimitsDemo />
      </Demo>
      <Demo title="Run budget" className="flex w-full">
        <BudgetDemo />
      </Demo>
      <Demo title="MCP servers and tool audit log" className="flex w-full">
        <ToolsDemo />
      </Demo>
      <Demo title="Prompt library" className="flex w-full">
        <PromptsDemo />
      </Demo>
      <Demo title="Memory" className="flex w-full">
        <MemoryDemo />
      </Demo>
      <Demo title="Agent picker" className="flex w-full">
        <AgentsDemo />
      </Demo>
    </GallerySection>
  );
}
