// packages/ai-ui/example/gallery/tools-models.tsx
import { useState } from "react";

import {
  ModelBenchmarkScorecard,
  ModelFallbackOrder,
  PromptEvaluationTable,
  PromptVariableEditor,
  ResponseFormatPicker,
  StructuredOutputEditor,
  ToolApprovalPolicyEditor,
  ToolArgumentDiff,
  ToolExecutionReceipt,
  ToolInvocationReplay,
  ToolOutputLimitControl,
  ToolParameterForm,
  ToolRegistryPicker,
  ToolResourcePicker,
  ToolResultCompare,
  ToolResultExportMenu,
  type FallbackModel,
  type ToolApprovalPolicyRow,
  type ToolOutputLimits,
  type ToolParameter,
  type ToolParameterValue,
  type ToolPolicyValue,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const REGISTRY = [
  { id: "inventory", name: "check_inventory", description: "Look up stock for a SKU at each store", capabilities: ["inventory", "read"] },
  { id: "orders", name: "lookup_order", description: "Find an order by number or customer email", capabilities: ["orders", "read"] },
  { id: "purchase", name: "create_purchase_order", description: "Draft a purchase order for a supplier", capabilities: ["inventory", "write"] },
  { id: "web", name: "web_search", description: "Search supplier sites and product manuals", capabilities: ["read", "web"] },
  { id: "email", name: "send_email", description: "Email a customer from the store account", capabilities: ["email", "write"], unavailableReason: "Connect Gmail first" },
];

const RESOURCES = [
  { id: "catalog", title: "Product catalog", address: "file:///store/catalog.csv", description: "12,400 SKUs with prices, aisles and suppliers" },
  { id: "warranty", title: "Warranty terms", address: "https://example.com/policies/warranty", description: "Coverage for power tools and outdoor equipment" },
  { id: "prices", title: "Supplier price list", address: "https://example.com/suppliers/prices-2026.xlsx", description: "Wholesale prices updated every Monday" },
];

const PURCHASE_PARAMETERS: ToolParameter[] = [
  { name: "supplier", label: "Supplier", kind: "enum", required: true, options: [{ value: "northfield", label: "Northfield Supply" }, { value: "lakeside", label: "Lakeside Tools" }] },
  { name: "sku", label: "SKU", kind: "string", required: true },
  { name: "quantity", label: "Quantity", kind: "number", required: true },
  { name: "rush", label: "Rush delivery", kind: "boolean" },
];

const INVENTORY_PARAMETERS: ToolParameter[] = [
  { name: "sku", label: "SKU", kind: "string", required: true },
  { name: "location", label: "Store", kind: "enum", options: [{ value: "main-street", label: "Main Street" }, { value: "airport-road", label: "Airport Road" }] },
  { name: "include_backorders", label: "Include backorders", kind: "boolean" },
];

const TIMED_OUT_CALL = {
  id: "call_8842",
  tool: "check_inventory",
  outcome: "Timed out after 30 s",
  arguments: { sku: "DRL-20V", location: "main-street", include_backorders: false },
};

const ARGUMENT_CHANGES = [
  { id: "location", key: "location", before: "main-street", after: "airport-road" },
  { id: "backorders", key: "include_backorders", before: "false", after: "true" },
  { id: "timeout", key: "timeout_ms", before: "30000" },
  { id: "fields", key: "fields", after: "on_hand\naisle\nnext_delivery" },
];

const RECEIPT = {
  requestedTool: "check_inventory",
  actualTool: "check_inventory_v2",
  outcome: "Succeeded: 3 units at Airport Road",
  durationMs: 412,
  usage: "1 call, 1,240 tokens",
  redactedInputs: '{\n  "sku": "DRL-20V",\n  "location": "airport-road",\n  "api_key": "[redacted]"\n}',
};

const EXPORT_FORMATS = [
  { id: "csv", label: "CSV spreadsheet" },
  { id: "json", label: "JSON file" },
  { id: "md", label: "Markdown table" },
  { id: "pdf", label: "PDF report", disabled: true },
];

const POLICY_TOOLS = [
  { id: "inventory", tool: "check_inventory", inherited: "allow", inheritedFrom: "Read-only tools" },
  { id: "purchase", tool: "create_purchase_order", inherited: "ask", inheritedFrom: "Write tools" },
  { id: "refund", tool: "issue_refund", inherited: "ask", inheritedFrom: "Payment tools", available: ["ask", "deny"] },
  { id: "shell", tool: "run_shell", inherited: "deny", inheritedFrom: "Organization policy", unavailableReason: "Locked by your administrator" },
] as const;

const BENCHMARKS = [
  { id: "sonnet", model: "Claude Sonnet", quality: 91, latencyMs: 820, cost: 3 },
  { id: "haiku", model: "Claude Haiku", quality: 84, latencyMs: 310, cost: 0.8 },
  { id: "llama", model: "Llama 3.1 8B (local)", quality: 71, latencyMs: 540 },
];

const BENCHMARK_NOTES: Record<string, string> = {
  sonnet: "Claude Sonnet answered 118 store support questions correctly and called check_inventory every time it was needed.",
  haiku: "Claude Haiku was the fastest hosted model and missed mostly warranty edge cases.",
  llama: "Llama 3.1 8B runs on the store server, so it has no per-token cost; it struggled with multi-step returns.",
};

const RESPONSE_FORMATS = [
  { id: "text", label: "Plain text" },
  { id: "markdown", label: "Markdown", requirements: "Headings, lists and tables render in the chat." },
  { id: "json", label: "JSON object", requirements: "Mention JSON in the prompt so the model returns a valid object." },
  { id: "schema", label: "JSON Schema", requirements: "Uses the schema saved under Structured output.", unavailableReason: "Not supported by Llama 3.1 8B" },
];

const PRODUCT_SCHEMA = JSON.stringify({
  type: "object",
  properties: { sku: { type: "string" }, price: { type: "number" }, aisle: { type: "string" } },
  required: ["sku", "price"],
}, null, 2);

const REPLY_PROMPT = "Write a {{tone}} reply to {{customer_name}} about order {{order_number}} and explain the {{product}} warranty.";

const EVALUATIONS = [
  { id: "refund", name: "Refund window", expected: "Says returns are accepted for 30 days with a receipt.", actual: "Says returns are accepted for 30 days with a receipt.", result: "passed" },
  { id: "stock", name: "Stock lookup", expected: "Calls check_inventory before answering.", actual: "Answered from memory without calling a tool.", result: "failed" },
  { id: "tone", name: "Greeting tone", expected: "Friendly and under 40 words.", actual: "Still running.", result: "pending" },
] as const;

function describeValues(values: Record<string, ToolParameterValue>) {
  return Object.entries(values).map(([key, value]) => key + "=" + String(value)).join(", ");
}

export function ToolsModelsGallery() {
  const [toolIds, setToolIds] = useState<string[]>(["inventory", "orders"]);
  const [resourceId, setResourceId] = useState<string | null>("catalog");
  const [purchase, setPurchase] = useState("");
  const [replay, setReplay] = useState("");
  const [exported, setExported] = useState("");
  const [limits, setLimits] = useState<ToolOutputLimits>({ bytes: 32_768, items: 25 });
  const [policy, setPolicy] = useState<Record<string, ToolPolicyValue | null>>({ inventory: null, purchase: "ask", refund: "deny", shell: null });
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [benchmark, setBenchmark] = useState<string | null>(null);
  const [fallbacks, setFallbacks] = useState<FallbackModel[]>([
    { id: "sonnet", name: "Claude Sonnet", provider: "Anthropic" },
    { id: "haiku", name: "Claude Haiku", provider: "Anthropic" },
    { id: "llama", name: "Llama 3.1 8B", provider: "Ollama" },
  ]);
  const [format, setFormat] = useState<string | null>("markdown");
  const [schemaError, setSchemaError] = useState<string | undefined>(undefined);
  const [schemaStatus, setSchemaStatus] = useState("");
  const [filledPrompt, setFilledPrompt] = useState("");
  const [evaluation, setEvaluation] = useState<string | null>(null);

  const rules: ToolApprovalPolicyRow[] = POLICY_TOOLS.map((tool) => {
    const value = policy[tool.id] ?? null;
    return {
      id: tool.id,
      tool: tool.tool,
      value,
      effective: value ?? tool.inherited,
      inheritedFrom: value ? undefined : tool.inheritedFrom,
      available: "available" in tool ? tool.available : undefined,
      unavailableReason: "unavailableReason" in tool ? tool.unavailableReason : undefined,
    };
  });

  function changeRule(id: string, value: ToolPolicyValue | null) {
    setSavingIds((current) => [...current, id]);
    window.setTimeout(() => {
      setPolicy((current) => ({ ...current, [id]: value }));
      setSavingIds((current) => current.filter((saving) => saving !== id));
    }, 600);
  }

  return (
    <GallerySection id="gallery-tools-models" title="Tools, models and prompts">
      <Demo title="Tool registry and resources" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <ToolRegistryPicker tools={REGISTRY} selectedIds={toolIds} onSelectionChange={(id, selected) => {
            setToolIds((current) => selected ? [...current, id] : current.filter((toolId) => toolId !== id));
          }} />
          <p role="status" className="text-sm text-muted-foreground">
            {toolIds.length ? "The assistant can call " + REGISTRY.filter((tool) => toolIds.includes(tool.id)).map((tool) => tool.name).join(", ") + "." : "The assistant has no tools."}
          </p>
        </div>
        <ToolResourcePicker resources={RESOURCES} selectedId={resourceId} onSelect={setResourceId} />
      </Demo>

      <Demo title="Tool arguments and replay" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <ToolParameterForm title="Purchase order arguments" submitLabel="Draft purchase order" parameters={PURCHASE_PARAMETERS}
            initialValues={{ supplier: "northfield", sku: "DRL-20V", quantity: 12 }}
            onSubmit={async (values) => {
              await new Promise((resolve) => window.setTimeout(resolve, 400));
              setPurchase("create_purchase_order called with " + describeValues(values) + ".");
            }} />
          <p role="status" className="text-sm text-muted-foreground">{purchase}</p>
        </div>
        <div className="min-w-0 space-y-2">
          <ToolInvocationReplay call={TIMED_OUT_CALL} parameters={INVENTORY_PARAMETERS} onReplay={async (callId, values) => {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
            setReplay("Replay of " + callId + " queued with " + describeValues(values) + ".");
          }} />
          <p role="status" className="text-sm text-muted-foreground">{replay}</p>
        </div>
        <ToolArgumentDiff changes={ARGUMENT_CHANGES} />
        <ToolExecutionReceipt receipt={RECEIPT} />
      </Demo>

      <Demo title="Tool results and limits" className="grid w-full items-start gap-3 md:grid-cols-2">
        <ToolResultCompare
          left={{ label: "Monday run", text: "sku: DRL-20V\non_hand: 3\naisle: 14\nreorder: no" }}
          right={{ label: "Tuesday run", text: "sku: DRL-20V\non_hand: 0\naisle: 14\nreorder: yes" }} />
        <div className="min-w-0 space-y-3">
          <div className="space-y-2">
            <ToolResultExportMenu formats={EXPORT_FORMATS} onExport={(id) => {
              setExported("Exported the stock check as " + (EXPORT_FORMATS.find((item) => item.id === id)?.label ?? id) + ".");
            }} />
            <p role="status" className="text-sm text-muted-foreground">{exported}</p>
          </div>
          <div className="space-y-2">
            <ToolOutputLimitControl initialValue={limits}
              policy="Output over a limit is cut off and the assistant is told how much was left out."
              onSubmit={async (next) => {
                await new Promise((resolve) => window.setTimeout(resolve, 400));
                setLimits(next);
              }} />
            <p role="status" className="text-sm text-muted-foreground">
              Saved limits: {limits.bytes === undefined ? "no byte limit" : limits.bytes.toLocaleString("en-US") + " bytes"}, {limits.items === undefined ? "no item limit" : limits.items + " items"}.
            </p>
          </div>
        </div>
      </Demo>

      <Demo title="Approval rules per tool" className="w-full max-w-2xl">
        <ToolApprovalPolicyEditor rules={rules} onChange={changeRule} pendingIds={savingIds} />
      </Demo>

      <Demo title="Models and response formats" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <ModelBenchmarkScorecard results={BENCHMARKS} units={{ quality: "pts", cost: "USD per 1M input tokens" }} onOpen={setBenchmark} />
          <p role="status" className="text-sm text-muted-foreground">{benchmark && BENCHMARK_NOTES[benchmark]}</p>
        </div>
        <ModelFallbackOrder models={fallbacks} onReorder={(ids) => {
          setFallbacks((current) => ids.flatMap((id) => current.filter((model) => model.id === id)));
        }} />
        <ResponseFormatPicker formats={RESPONSE_FORMATS} value={format} onChange={setFormat} />
        <div className="min-w-0 space-y-2">
          <StructuredOutputEditor initialValue={PRODUCT_SCHEMA} validationError={schemaError} onSubmit={async (schema) => {
            await new Promise((resolve) => window.setTimeout(resolve, 400));
            if (typeof schema === "object" && !("type" in schema)) {
              setSchemaError("Add a top-level \"type\" so the model knows what to return.");
              setSchemaStatus("");
              return;
            }
            setSchemaError(undefined);
            setSchemaStatus("Product extraction schema saved.");
          }} />
          <p role="status" className="text-sm text-muted-foreground">{schemaStatus}</p>
        </div>
      </Demo>

      <Demo title="Prompt variables and evaluations" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <PromptVariableEditor prompt={REPLY_PROMPT} initialValues={{ tone: "friendly", customer_name: "Dana Whitfield" }}
            onSubmit={(_values, filled) => setFilledPrompt(filled)} />
          <p role="status" className="text-sm text-muted-foreground">{filledPrompt && "Added to the composer: " + filledPrompt}</p>
        </div>
        <div className="min-w-0 space-y-2">
          <PromptEvaluationTable evaluations={EVALUATIONS} onOpen={setEvaluation} />
          <p role="status" className="text-sm text-muted-foreground">
            {evaluation && "Showing the transcript for " + EVALUATIONS.find((item) => item.id === evaluation)?.name + "."}
          </p>
        </div>
      </Demo>
    </GallerySection>
  );
}
