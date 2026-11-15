// packages/ai-ui/test/settings.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AgentParticipant,
  AgentPicker,
  type AgentSelection,
  ApiKeyField,
  BudgetNotice,
  budgetNoticeTone,
  changedRoles,
  clampModelParameters,
  ContextMeter,
  contextLevel,
  ContextSnapshot,
  estimateCost,
  fillPrompt,
  filterAuditEntries,
  formatModelPrice,
  formatTokenCount,
  formatUsageReceipt,
  HealthBadge,
  isLowOutputBudget,
  McpServerList,
  MemoryConflict,
  MemoryManager,
  ModelCard,
  ModelConfigList,
  type ModelInfo,
  type ModelParameterValues,
  ModelParameters,
  ModelPicker,
  modelMatches,
  type ModelRole,
  mostConstrainedLimit,
  normalizeBaseUrl,
  PromptLibrary,
  promptVariables,
  ProviderHealth,
  ProviderSettings,
  RunBudgetControl,
  ToolAuditLog,
  type ToolAuditEntry,
  UsageDashboard,
  type UsageDetails,
  UsageLimitBanner,
  UsageLimitCard,
  UsageReceipt,
  usageRunsToCsv,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const MODELS: ModelInfo[] = [
  { id: "claude-sonnet", name: "Claude Sonnet", provider: "Anthropic", contextWindow: 200_000, maxOutput: 64_000, capabilities: ["reasoning", "vision", "tools"], pricing: { input: 3, output: 15 }, health: "operational" },
  { id: "claude-haiku", name: "Claude Haiku", provider: "Anthropic", contextWindow: 200_000, maxOutput: 8192, capabilities: ["tools"], pricing: { input: 0.8, output: 4 }, health: "degraded" },
  { id: "llama-local", name: "Llama 3.1 8B", provider: "Ollama", contextWindow: 128_000, free: true, local: true, health: "unknown" },
];

describe("model helpers", () => {
  it("formats sizes and prices and matches fuzzily", () => {
    expect([8192, 200_000, 1_000_000, 1_500_000, 512].map(formatTokenCount)).toEqual(["8K", "200K", "1M", "1.5M", "512"]);
    expect(formatModelPrice(MODELS[0]!)).toBe("$3 in / $15 out per 1M tokens");
    expect(formatModelPrice(MODELS[2]!)).toBe("Free");
    expect(estimateCost(MODELS[0]!, 1_000_000, 100_000)).toBeCloseTo(4.5);
    expect(modelMatches(MODELS[0]!, "snt")).toBe(true);
    expect(modelMatches(MODELS[0]!, "ollama")).toBe(false);
    expect(modelMatches(MODELS[2]!, "ollama")).toBe(true);
  });
});

describe("ModelPicker and health", () => {
  it("searches, filters to free models and selects", async () => {
    const onValueChange = vi.fn();
    render(<ModelPicker models={MODELS} defaultValue="claude-haiku" onValueChange={onValueChange} />);
    const trigger = screen.getByRole("combobox", { name: "Model: Claude Haiku" });
    fireEvent.click(trigger);
    const search = await screen.findByRole("combobox", { name: "Search models" });
    expect(screen.getByText("Anthropic")).toBeTruthy();
    fireEvent.change(search, { target: { value: "llama" } });
    await waitFor(() => expect(screen.queryByRole("option", { name: /^Claude Sonnet/ })).toBeNull());
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Free only" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: /^Claude Sonnet/ })).toBeNull());
    const llama = screen.getByRole("option", { name: /^Llama 3.1 8B, Ollama, 128K context, Free, Not checked/ });
    fireEvent.click(llama);
    expect(onValueChange).toHaveBeenCalledWith("llama-local");
  });

  it("names health states in words and verifies providers", async () => {
    render(<HealthBadge state="degraded" detail="840 ms" compact />);
    expect(screen.getByRole("img", { name: "Degraded, 840 ms" })).toBeTruthy();
    let finish: () => void = () => undefined;
    const onVerify = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<ProviderHealth providers={[{ id: "anthropic", name: "Anthropic", state: "operational", latencyMs: 420, checkedAt: Date.now() - 60_000 }, { id: "openai", name: "OpenAI", state: "down", message: "Timed out after 30 s" }]} onVerify={onVerify} />);
    expect(screen.getByText("1 of 2 operational")).toBeTruthy();
    expect(screen.getByText("Timed out after 30 s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Verify Anthropic" }));
    expect(screen.getAllByText("Checking").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Verify Anthropic" })).toHaveProperty("disabled", true);
    await act(async () => finish());
    expect(onVerify).toHaveBeenCalledWith("anthropic");
    expect(screen.getByRole("button", { name: "Verify Anthropic" })).toHaveProperty("disabled", false);
  });
});

describe("providers and keys", () => {
  it("checks key prefixes and links to the key page", () => {
    const onSave = vi.fn();
    render(<ApiKeyField provider="Anthropic" source="none" prefix="sk-ant-" getKeyUrl="https://console.anthropic.com/settings/keys" onSave={onSave} />);
    expect(screen.getByRole("link", { name: /Get a key/ }).getAttribute("href")).toBe("https://console.anthropic.com/settings/keys");
    fireEvent.change(screen.getByLabelText("Anthropic API key"), { target: { value: "sk-wrong-1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert").textContent).toBe("Anthropic keys start with sk-ant-");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("toggles providers, validates base URLs and tests connections", async () => {
    expect(normalizeBaseUrl(" http://localhost:11434/ ")).toBe("http://localhost:11434");
    expect(normalizeBaseUrl("ftp://x")).toBeNull();
    const onToggle = vi.fn();
    const onBaseUrlChange = vi.fn();
    const onTest = vi.fn().mockRejectedValueOnce(new Error("Connection refused")).mockResolvedValue("12 models available");
    render(
      <ProviderSettings
        providers={[
          { id: "ollama", name: "Ollama", kind: "local", enabled: true, baseUrl: "http://localhost:11434", defaultBaseUrl: "http://localhost:11434", health: "operational" },
          { id: "openai", name: "OpenAI", enabled: false, keySource: "none" },
        ]}
        onToggle={onToggle}
        onBaseUrlChange={onBaseUrlChange}
        onSaveKey={vi.fn()}
        onTest={onTest}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Enable OpenAI" }));
    expect(onToggle).toHaveBeenCalledWith("openai", true);
    const url = screen.getByLabelText("Base URL");
    fireEvent.change(url, { target: { value: "localhost" } });
    fireEvent.blur(url);
    expect(screen.getByRole("alert").textContent).toBe("Enter an http:// or https:// address.");
    fireEvent.change(url, { target: { value: "http://192.168.1.20:11434/" } });
    fireEvent.blur(url);
    expect(onBaseUrlChange).toHaveBeenCalledWith("ollama", "http://192.168.1.20:11434");
    const ollama = screen.getByRole("region", { name: "Ollama" });
    fireEvent.click(within(ollama).getByRole("button", { name: "Test connection" }));
    expect(await within(ollama).findByText("Connection refused")).toBeTruthy();
    fireEvent.click(within(ollama).getByRole("button", { name: "Test connection" }));
    expect(await within(ollama).findByText("12 models available")).toBeTruthy();
  });

  it("shows local model download progress and actions", () => {
    const onPause = vi.fn();
    const onUse = vi.fn();
    const { rerender } = render(<ModelCard name="Llama 3.1 8B" quantization="Q4_K_M" sizeBytes={4_000_000_000} status="downloading" progress={0.25} speed={50_000_000} onPause={onPause} onCancel={vi.fn()} />);
    const bar = screen.getByRole("progressbar", { name: "Llama 3.1 8B" });
    expect(bar.getAttribute("aria-valuenow")).toBe("25");
    expect(screen.getByText(/about 1m 00s left/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onPause).toHaveBeenCalled();
    rerender(<ModelCard name="Llama 3.1 8B" status="installed" onUse={onUse} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Use" }));
    expect(onUse).toHaveBeenCalled();
    rerender(<ModelCard name="Llama 3.1 8B" status="error" error="Disk full" onDownload={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("Disk full");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("parameters and roles", () => {
  it("clamps to the model and warns when the output budget is low", () => {
    expect(clampModelParameters({ maxTokens: 100_000, temperature: 3, topP: -1 }, { maxOutput: 8192 })).toEqual({ maxTokens: 8192, temperature: 2, topP: 0 });
    expect(isLowOutputBudget({ effort: "high", maxTokens: 2000 })).toBe(true);
    expect(isLowOutputBudget({ effort: "low", maxTokens: 2000 })).toBe(false);
    function Demo() {
      const [value, setValue] = useState<ModelParameterValues>({ effort: "high", maxTokens: 2000, temperature: 1 });
      return <ModelParameters model={MODELS[0]!} value={value} onValueChange={setValue} defaults={{ effort: "medium", maxTokens: 16_000, temperature: 1 }} />;
    }
    render(<Demo />);
    expect(screen.getByRole("radio", { name: "High" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("textbox", { name: "Temperature" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByText("Fixed by this model")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Raise to 16K" }));
    expect(screen.queryByRole("button", { name: /Raise to/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    expect(screen.getByRole("radio", { name: "Medium" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toHaveProperty("disabled", true);
  });

  it("hides effort and unlocks sampling for models without reasoning", () => {
    render(<ModelParameters model={MODELS[1]!} value={{ temperature: 0.4 }} onValueChange={vi.fn()} />);
    expect(screen.queryByRole("radiogroup", { name: "Reasoning effort" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Temperature" }) as HTMLInputElement).disabled).toBe(false);
  });

  it("holds role overrides until saved and tests each role", async () => {
    const roles: ModelRole[] = [
      { id: "planner", label: "Planner", defaultModelId: "claude-sonnet", parameters: { effort: "high" } },
      { id: "coder", label: "Coder", defaultModelId: "claude-haiku", modelId: "claude-sonnet", fallbackModelId: "claude-haiku" },
    ];
    expect(changedRoles(roles, [roles[0]!, { ...roles[1]!, modelId: undefined }])).toEqual(["coder"]);
    const onSave = vi.fn();
    const onTest = vi.fn().mockResolvedValue("Replied in 640 ms");
    render(<ModelConfigList roles={roles} models={MODELS} onSave={onSave} onTest={onTest} ownKeyProviders={["Anthropic"]} />);
    const coder = screen.getByRole("listitem", { name: "Coder" });
    expect(within(coder).getByText("Override")).toBeTruthy();
    expect(within(coder).getByText("Falls back to Claude Haiku")).toBeTruthy();
    expect(within(coder).getByText("Your key")).toBeTruthy();
    fireEvent.click(within(coder).getByRole("button", { name: "Reset Coder to Claude Haiku" }));
    expect(screen.getByText("1 unsaved change")).toBeTruthy();
    expect(within(coder).getByText("Default")).toBeTruthy();
    fireEvent.click(within(coder).getByRole("button", { name: "Test Coder" }));
    expect(await within(coder).findByText("Replied in 640 ms")).toBeTruthy();
    expect(onTest).toHaveBeenCalledWith(expect.objectContaining({ id: "coder" }), "claude-haiku");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([roles[0], { id: "coder", label: "Coder", defaultModelId: "claude-haiku", fallbackModelId: "claude-haiku" }]));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(within(coder).getByText("Override")).toBeTruthy();
  });
});

describe("context", () => {
  it("reports levels and breaks down usage", () => {
    expect([contextLevel(50, 100), contextLevel(75, 100), contextLevel(95, 100)]).toEqual(["ok", "warning", "critical"]);
    render(<ContextMeter used={160_000} limit={200_000} segments={[{ label: "System", tokens: 4000 }, { label: "History", tokens: 120_000 }, { label: "Retrieved", tokens: 30_000 }]} />);
    const meter = screen.getByRole("meter", { name: "Context" });
    expect(meter.getAttribute("aria-valuetext")).toBe("160K of 200K tokens, 80%. Getting full; older messages may be summarized");
    const legend = screen.getByRole("list", { name: "Context breakdown" });
    expect(within(legend).getByText("Other")).toBeTruthy();
    expect(within(legend).getByText("6K")).toBeTruthy();
  });

  it("shows what will be sent and leaves items out", () => {
    const onRemoveItem = vi.fn();
    render(
      <ContextSnapshot
        mode="pending"
        model="Claude Sonnet"
        onRemoveItem={onRemoveItem}
        sections={[
          { id: "system", label: "System prompt", tokens: 900, content: "You are a helpful assistant for Whitten Hardware." },
          { id: "files", label: "Files", items: [{ id: "a", label: "inventory.csv", tokens: 12_000 }, { id: "b", label: "notes.md", tokens: 800 }] },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "What will be sent" })).toBeTruthy();
    expect(screen.getByText("Claude Sonnet · 14K tokens")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Files/ }));
    fireEvent.click(screen.getByRole("button", { name: "Leave out inventory.csv" }));
    expect(onRemoveItem).toHaveBeenCalledWith("files", "a");
    fireEvent.click(screen.getByRole("button", { name: /System prompt/ }));
    expect(screen.getByLabelText("System prompt text").textContent).toContain("Whitten Hardware");
  });
});

describe("usage", () => {
  const details: UsageDetails = {
    model: "Claude Haiku",
    requestedModel: "Claude Sonnet",
    provider: "Anthropic",
    reason: "Sonnet was overloaded",
    fallbacks: [{ model: "Claude Sonnet", reason: "529 overloaded" }],
    inputTokens: 1200,
    outputTokens: 340,
    cachedTokens: 800,
    timings: { queueMs: 120, firstTokenMs: 640, totalMs: 2100 },
    cost: 0.0024,
    estimated: true,
    requestId: "req_0123456789abcdef",
  };

  it("warns before sending near the budget", () => {
    expect(budgetNoticeTone(4, 0.5, 5)).toBe("warning");
    expect(budgetNoticeTone(4.8, 0.5, 5)).toBe("danger");
    const { rerender } = render(<BudgetNotice estimatedTokens={12_000} estimatedCost={0.18} spent={1} budget={5} />);
    expect(screen.getByRole("status").textContent).toContain("About 12K tokens · ~$0.18");
    rerender(<BudgetNotice estimatedTokens={12_000} estimatedCost={0.5} spent={4.8} budget={5} onReview={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("This would put you $0.30 over your $5.00 budget for today.");
  });

  it("opens a receipt with routing, timing and a redacted copy", async () => {
    expect(formatUsageReceipt(details)).toContain("Request: …cdef");
    expect(formatUsageReceipt(details, { redact: false })).toContain("req_0123456789abcdef");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<UsageReceipt details={details} />);
    const toggle = screen.getByRole("button", { expanded: false });
    expect(toggle.textContent).toContain("Claude Haiku · 1K in · 340 out · ~$0.0024 · 2s");
    expect(toggle.textContent).toContain("rerouted");
    fireEvent.click(toggle);
    expect(screen.getByText("Sonnet was overloaded")).toBeTruthy();
    expect(screen.getByText("1,200 tokens, 800 cached")).toBeTruthy();
    expect(screen.getByText("$0.0024 (estimated)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy receipt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Request: …cdef")));
  });

  it("filters, sorts and exports runs", () => {
    const runs = [
      { id: "r1", title: "Restock report", startedAt: Date.UTC(2026, 9, 20, 15), model: "Claude Sonnet", inputTokens: 40_000, outputTokens: 4000, cost: 0.18, status: "succeeded" as const },
      { id: "r2", title: "Price check", startedAt: Date.UTC(2026, 9, 21, 15), model: "Claude Haiku", inputTokens: 9000, outputTokens: 800, cost: 0.01, estimated: true, status: "failed" as const },
    ];
    expect(usageRunsToCsv(runs).split("\n")[2]).toBe("2026-10-21T15:00:00.000Z,r2,Price check,Claude Haiku,9000,800,0.010000,estimated,failed");
    render(<UsageDashboard runs={runs} limit={25} reserved={1} onPerRunCapChange={vi.fn()} perRunCap={200} />);
    expect(screen.getAllByText("$0.19")).toHaveLength(2);
    expect(screen.getByText("1 estimated")).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")[1]!.textContent).toContain("Price check");
    fireEvent.click(within(table).getByRole("button", { name: "Cost" }));
    expect(within(table).getAllByRole("row")[1]!.textContent).toContain("Restock report");
    expect(within(table).getByRole("columnheader", { name: "Cost" }).getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByRole("checkbox", { name: "Reported costs only" }));
    expect(within(table).getByText("1 of 2 runs")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Model" }), { target: { value: "Claude Haiku" } });
    expect(screen.getByText("No runs match these filters.")).toBeTruthy();
  });

  it("warns about limits and shows when they reset", () => {
    const limits = [
      { id: "messages", label: "Messages", used: 85, limit: 100, unit: "messages", resetsAt: Date.now() + 3 * 3_600_000 + 12 * 60_000 + 30_000 },
      { id: "images", label: "Image generations", used: 2, limit: 50 },
    ];
    expect(mostConstrainedLimit(limits)?.id).toBe("messages");
    const onAction = vi.fn();
    render(<UsageLimitCard limits={limits} actionLabel="Upgrade" onAction={onAction} />);
    expect(screen.getByText("15 left")).toBeTruthy();
    expect(screen.getByText(/Resets in 3h 12m/)).toBeTruthy();
    const { rerender } = render(<UsageLimitBanner limit={limits[0]!} actionLabel="Upgrade" onAction={onAction} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("You've used 85% of your messages.");
    rerender(<UsageLimitBanner limit={{ ...limits[0]!, used: 100 }} actionLabel="Upgrade" onAction={onAction} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("You've used all 100 messages.");
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    rerender(<UsageLimitBanner limit={limits[1]!} />);
    expect(document.querySelector("[data-slot=usage-limit-banner]")).toBeNull();
  });

  it("chooses who pays and caps a message", () => {
    const onSourceChange = vi.fn();
    const onMaxPerMessageChange = vi.fn();
    render(
      <RunBudgetControl
        sources={[
          { id: "team", label: "Team credits", balance: 42.5 },
          { id: "byok", label: "Your API key", disabled: true, reason: "Add a key in settings first" },
        ]}
        sourceId="team"
        onSourceChange={onSourceChange}
        maxPerMessage={50}
        onMaxPerMessageChange={onMaxPerMessageChange}
        autoStop
        onAutoStopChange={vi.fn()}
      />,
    );
    expect(screen.getByText("$42.50 left")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Your API key/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "$0.50" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "$5.00" }));
    expect(onMaxPerMessageChange).toHaveBeenCalledWith(500);
    fireEvent.click(screen.getByRole("button", { name: "No cap" }));
    expect(onMaxPerMessageChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("The run stops when it reaches the cap.")).toBeTruthy();
  });
});

describe("tools, prompts and memory", () => {
  it("lists MCP servers with tools, checks and removal", async () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    const onCheck = vi.fn().mockResolvedValue(undefined);
    render(
      <McpServerList
        servers={[
          { id: "fs", name: "Filesystem", transport: "stdio", target: "npx @modelcontextprotocol/server-filesystem ~/pos", status: "connected", enabled: true, tools: [{ name: "read_file", description: "Read a file", parameters: [{ name: "path", type: "string", required: true }] }] },
          { id: "crm", name: "CRM", transport: "http", status: "error", enabled: true, error: "401 Unauthorized" },
        ]}
        onToggle={onToggle}
        onRemove={onRemove}
        onCheck={onCheck}
      />,
    );
    expect(screen.getByText("401 Unauthorized")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Filesystem/ }));
    const tools = screen.getByRole("list", { name: "Filesystem tools" });
    expect(within(tools).getByText("read_file")).toBeTruthy();
    expect(within(tools).getByText(", required")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Enable CRM" }));
    expect(onToggle).toHaveBeenCalledWith("crm", false);
    fireEvent.click(screen.getByRole("button", { name: "Check Filesystem" }));
    await waitFor(() => expect(onCheck).toHaveBeenCalledWith("fs"));
    fireEvent.click(screen.getByRole("button", { name: "Remove CRM" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith("crm"));
  });

  it("filters the tool audit log and shows arguments", () => {
    const entries: ToolAuditEntry[] = [
      { id: "1", tool: "read_file", server: "Filesystem", status: "success", at: 1000, durationMs: 42, args: { path: "inventory.csv" } },
      { id: "2", tool: "send_email", server: "Gmail", status: "denied", at: 2000, actor: "Marifai", result: "Blocked by policy" },
      { id: "3", tool: "query", server: "Postgres", status: "error", at: 3000, durationMs: 2400, result: "relation does not exist" },
    ];
    expect(filterAuditEntries(entries, "inventory").map((entry) => entry.id)).toEqual(["1"]);
    expect(filterAuditEntries(entries, "", ["denied", "error"]).map((entry) => entry.id)).toEqual(["2", "3"]);
    render(<ToolAuditLog entries={entries} />);
    const items = () => screen.getAllByRole("listitem").filter((item) => item.hasAttribute("data-status"));
    expect(items().map((item) => item.getAttribute("data-status"))).toEqual(["error", "denied", "success"]);
    fireEvent.click(screen.getByRole("button", { name: /^Denied/ }));
    expect(items()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /send_email/ }));
    expect(screen.getByText("Blocked by policy")).toBeTruthy();
  });

  it("fills prompt variables, saves and deletes prompts", async () => {
    expect(promptVariables("Write to {{ customer }} about {{order}} for {{customer}}")).toEqual(["customer", "order"]);
    expect(fillPrompt("Hi {{name}}, {{missing}}", { name: "Dana" })).toBe("Hi Dana, {{missing}}");
    const onUse = vi.fn();
    const onSave = vi.fn();
    const onDelete = vi.fn();
    render(
      <PromptLibrary
        prompts={[
          { id: "p1", title: "Order follow-up", body: "Write a friendly note to {{customer}} about order {{order}}.", tags: ["email"] },
          { id: "p2", title: "Summarize sales", body: "Summarize this week's sales.", tags: ["reports"], favorite: true },
        ]}
        onUse={onUse}
        onSave={onSave}
        onDelete={onDelete}
        onFavoriteChange={vi.fn()}
      />,
    );
    const titles = screen.getAllByRole("listitem").map((item) => item.querySelector(".font-medium")?.textContent);
    expect(titles.slice(0, 2)).toEqual(["Summarize sales", "Order follow-up"]);
    fireEvent.click(screen.getByRole("button", { name: "Use Summarize sales" }));
    expect(onUse).toHaveBeenCalledWith("Summarize this week's sales.", expect.objectContaining({ id: "p2" }));
    fireEvent.click(screen.getByRole("button", { name: "Use Order follow-up" }));
    const form = screen.getByRole("form", { name: "Use Order follow-up" });
    expect(within(form).getByRole("button", { name: "Use prompt" })).toHaveProperty("disabled", true);
    fireEvent.change(within(form).getByLabelText("customer"), { target: { value: "Dana" } });
    fireEvent.change(within(form).getByLabelText("order"), { target: { value: "#1042" } });
    expect(within(form).getByLabelText("Preview").textContent).toBe("Write a friendly note to Dana about order #1042.");
    fireEvent.click(within(form).getByRole("button", { name: "Use prompt" }));
    expect(onUse).toHaveBeenLastCalledWith("Write a friendly note to Dana about order #1042.", expect.objectContaining({ id: "p1" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Order follow-up" }));
    fireEvent.change(screen.getByLabelText("Tags, separated by commas"), { target: { value: "email, customers" } });
    fireEvent.click(screen.getByRole("button", { name: "Save prompt" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", tags: ["email", "customers"] })));
    fireEvent.click(screen.getByRole("button", { name: "Delete Summarize sales" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("p2"));
  });

  it("reviews, edits and forgets memories, and resolves conflicts", async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onEdit = vi.fn();
    const onForget = vi.fn();
    const onResolveConflict = vi.fn();
    render(
      <MemoryManager
        memories={[
          { id: "m1", text: "Prefers weekly reports on Monday", status: "approved", confidence: 0.9, category: "Preferences" },
          { id: "m2", text: "Store closes at 6 PM on Saturdays", status: "pending", confidence: 0.62, source: "Hours chat", category: "Store" },
          { id: "m3", text: "Old promo code", status: "approved", expiresAt: Date.now() - 1000 },
        ]}
        onApprove={onApprove}
        onReject={onReject}
        onEdit={onEdit}
        onForget={onForget}
        conflicts={[{ id: "c1", existing: { id: "m4", text: "Opens at 8 AM", status: "approved" }, incoming: { id: "m5", text: "Opens at 7 AM", status: "pending" }, reason: "Different opening hours" }]}
        onResolveConflict={onResolveConflict}
      />,
    );
    expect(screen.getByText("3 saved · 1 to review")).toBeTruthy();
    expect(screen.getByText(/62% confident · from Hours chat/)).toBeTruthy();
    expect(screen.getByText("expired")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve: Store closes at 6 PM on Saturdays" }));
    expect(onApprove).toHaveBeenCalledWith("m2");
    fireEvent.click(screen.getByRole("button", { name: "Reject: Store closes at 6 PM on Saturdays" }));
    expect(onReject).toHaveBeenCalledWith("m2");
    fireEvent.click(screen.getByRole("button", { name: "Edit: Prefers weekly reports on Monday" }));
    fireEvent.change(screen.getByLabelText("Memory text"), { target: { value: "Prefers weekly reports on Monday morning" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).toHaveBeenCalledWith("m1", "Prefers weekly reports on Monday morning");
    fireEvent.click(screen.getByRole("button", { name: "Use new" }));
    expect(onResolveConflict).toHaveBeenCalledWith("c1", { keep: "incoming" });
    fireEvent.click(screen.getByRole("button", { name: "Forget: Old promo code" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Forget" }));
    await waitFor(() => expect(onForget).toHaveBeenCalledWith("m3"));
  });

  it("merges conflicting memories", () => {
    const onResolve = vi.fn();
    render(<MemoryConflict existing={{ id: "a", text: "Opens at 8 AM", status: "approved" }} incoming={{ id: "b", text: "Opens at 7 AM on weekdays", status: "pending" }} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole("button", { name: "Merge…" }));
    fireEvent.change(screen.getByLabelText("Merged memory"), { target: { value: "Opens at 7 AM on weekdays, 8 AM on weekends" } });
    fireEvent.click(screen.getByRole("button", { name: "Save merged" }));
    expect(onResolve).toHaveBeenCalledWith({ keep: "merged", text: "Opens at 7 AM on weekdays, 8 AM on weekends" });
  });
});

describe("AgentPicker", () => {
  it("switches kinds, picks an option and builds a team", () => {
    function Demo() {
      const [value, setValue] = useState<AgentSelection>({ kind: "model", id: "sonnet" });
      const [participants, setParticipants] = useState<AgentParticipant[]>([]);
      return (
        <>
          <AgentPicker
            value={value}
            onValueChange={setValue}
            participants={participants}
            onParticipantsChange={setParticipants}
            maxParticipants={2}
            agents={[
              { id: "sonnet", name: "Claude Sonnet", kind: "model" },
              { id: "haiku", name: "Claude Haiku", kind: "model" },
              { id: "research", name: "Research team", kind: "team", description: "Lead, researcher and writer" },
              { id: "weekly", name: "Weekly report", kind: "template" },
            ]}
          />
          <output>{JSON.stringify({ value, participants: participants.map((participant) => [participant.agentId, participant.role]) })}</output>
        </>
      );
    }
    render(<Demo />);
    expect(screen.getByRole("radio", { name: "Claude Sonnet" })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("tab", { name: "Team" }));
    fireEvent.click(screen.getByRole("radio", { name: /Research team/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(screen.getByRole("button", { name: "Add member" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("combobox", { name: "Member 2 model" }), { target: { value: "haiku" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Member 1 role" }), { target: { value: "Reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove member 1" }));
    expect(JSON.parse(screen.getByRole("status").textContent ?? "{}")).toEqual({ value: { kind: "team", id: "research" }, participants: [["haiku", "Researcher"]] });
  });
});
