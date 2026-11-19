// packages/ai-ui/test/tools-models.test.tsx
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  type PromptEvaluation,
  type RegistryTool,
  type ToolApprovalPolicyRow,
  type ToolParameter,
} from "../src/index.js";
import { isDisabled } from "./helpers.js";

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

function textbox(name: string) {
  return screen.getByRole("textbox", { name }) as HTMLInputElement;
}

function combobox(name: string) {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

describe("ModelBenchmarkScorecard", () => {
  const results = [
    { id: "sonnet", model: "Claude Sonnet", quality: 91, latencyMs: 820, cost: 3 },
    { id: "llama", model: "Llama 3.1 8B", quality: 74, cost: Number.NaN },
  ];

  it("lists each model's quality, latency and cost with units and marks missing metrics unavailable", () => {
    render(<ModelBenchmarkScorecard results={results} units={{ quality: "pts", cost: "USD per 1M tokens" }} />);
    const panel = screen.getByRole("region", { name: "Model benchmarks" });
    const [sonnet, llama] = within(panel).getAllByRole("listitem");
    expect(within(sonnet!).getByText("Claude Sonnet")).toBeTruthy();
    expect(within(sonnet!).getAllByRole("term").map((term) => term.textContent)).toEqual(["Quality", "Latency", "Cost"]);
    expect(within(sonnet!).getAllByRole("definition").map((value) => value.textContent)).toEqual(["91 pts", "820 ms", "3 USD per 1M tokens"]);
    expect(within(llama!).getAllByRole("definition").map((value) => value.textContent)).toEqual(["74 pts", "Unavailable", "Unavailable"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens a model by id from a button named after that model", () => {
    const onOpen = vi.fn();
    render(<ModelBenchmarkScorecard results={results} units={{ quality: "pts", cost: "USD" }} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Llama 3.1 8B" }));
    expect(onOpen).toHaveBeenCalledWith("llama");
  });

  it("shows an empty state without results", () => {
    render(<ModelBenchmarkScorecard results={[]} units={{ quality: "pts", cost: "USD" }} />);
    expect(screen.getByText("No benchmark results.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("ModelFallbackOrder", () => {
  const models = [
    { id: "sonnet", name: "Claude Sonnet", provider: "Anthropic" },
    { id: "haiku", name: "Claude Haiku", provider: "Anthropic" },
    { id: "llama", name: "Llama 3.1 8B" },
  ];

  it("explains the order and reports the new order of ids after a keyboard move", () => {
    const onReorder = vi.fn();
    render(<ModelFallbackOrder models={models} onReorder={onReorder} />);
    expect(screen.getByText("Models are tried in order, from top to bottom.")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Fallback models" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Claude Sonnet · Anthropic", "Claude Haiku · Anthropic", "Llama 3.1 8B"]);
    const handle = screen.getByRole("button", { name: "Reorder Llama 3.1 8B" });
    act(() => handle.focus());
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(onReorder).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Llama 3.1 8B" }), { key: "Enter" });
    expect(onReorder).toHaveBeenCalledWith(["sonnet", "llama", "haiku"]);
  });

  it("locks every handle while disabled", () => {
    const onReorder = vi.fn();
    render(<ModelFallbackOrder models={models} onReorder={onReorder} disabled />);
    const handles = screen.getAllByRole("button", { name: /^Reorder / }) as HTMLButtonElement[];
    expect(handles.every((handle) => handle.disabled)).toBe(true);
    fireEvent.keyDown(handles[0]!, { key: " " });
    fireEvent.keyDown(handles[0]!, { key: "ArrowDown" });
    fireEvent.keyDown(handles[0]!, { key: " " });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("shows an empty state without models", () => {
    render(<ModelFallbackOrder models={[]} onReorder={vi.fn()} />);
    expect(screen.getByText("No fallback models.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("PromptEvaluationTable", () => {
  const evaluations: PromptEvaluation[] = [
    { id: "refund", name: "Refund window", expected: "Mentions the 30-day window", actual: "Mentions the 30-day window", result: "passed" },
    { id: "stock", name: "Stock lookup", expected: "Calls check_inventory", actual: "Answered without a tool call", result: "failed" },
    { id: "tone", name: "Greeting tone", expected: "Friendly and brief", actual: "", result: "pending" },
  ];

  it("shows expected and actual output per evaluation with the result in words in a keyboard-scrollable table", () => {
    render(<PromptEvaluationTable evaluations={evaluations} />);
    const table = screen.getByRole("table", { name: "Expected and actual outputs" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Evaluation", "Expected", "Actual", "Result"]);
    const row = screen.getByRole("rowheader", { name: "Stock lookup" }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Calls check_inventory", "Answered without a tool call", "Failed"]);
    expect(screen.getByRole("region", { name: "Evaluation results" }).tabIndex).toBe(0);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("filters by result and tells no matches apart from no evaluations", () => {
    const { rerender } = render(<PromptEvaluationTable evaluations={evaluations} />);
    fireEvent.change(combobox("Result"), { target: { value: "failed" } });
    expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Stock lookup"]);
    rerender(<PromptEvaluationTable evaluations={evaluations.slice(0, 1)} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("No matching evaluations.")).toBeTruthy();
    fireEvent.change(combobox("Result"), { target: { value: "" } });
    expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Refund window"]);
    rerender(<PromptEvaluationTable evaluations={[]} />);
    expect(screen.getByText("No evaluations.")).toBeTruthy();
  });

  it("opens an evaluation by id from an actions column named after the row", () => {
    const onOpen = vi.fn();
    render(<PromptEvaluationTable evaluations={evaluations} onOpen={onOpen} />);
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Stock lookup" }).textContent).toBe("Stock lookup");
    fireEvent.click(screen.getByRole("button", { name: "Open Stock lookup" }));
    expect(onOpen).toHaveBeenCalledWith("stock");
  });
});

describe("PromptVariableEditor", () => {
  const prompt = "Draft a reply to {{customer}} about order {{order}}. Thank {{customer}} for shopping with us.";

  it("fills variables into a live preview and submits the values with the filled prompt", async () => {
    const onSubmit = vi.fn();
    render(<PromptVariableEditor prompt={prompt} initialValues={{ customer: "Dana" }} onSubmit={onSubmit} />);
    expect(screen.getAllByRole("textbox").map((input) => input.getAttribute("aria-required"))).toEqual(["true", "true"]);
    expect(textbox("customer").value).toBe("Dana");
    expect(screen.getByRole("heading", { name: "Filled prompt preview" })).toBeTruthy();
    expect(screen.getByText("Draft a reply to Dana about order {{order}}. Thank Dana for shopping with us.")).toBeTruthy();
    fireEvent.change(textbox("order"), { target: { value: "4471" } });
    expect(screen.getByText("Draft a reply to Dana about order 4471. Thank Dana for shopping with us.")).toBeTruthy();
    await click(screen.getByRole("button", { name: "Use filled prompt" }));
    expect(onSubmit).toHaveBeenCalledWith({ customer: "Dana", order: "4471" }, "Draft a reply to Dana about order 4471. Thank Dana for shopping with us.");
  });

  it("blocks submission and names the variables that are still empty", async () => {
    const onSubmit = vi.fn();
    render(<PromptVariableEditor prompt={prompt} onSubmit={onSubmit} />);
    fireEvent.change(textbox("order"), { target: { value: "   " } });
    await click(screen.getByRole("button", { name: "Use filled prompt" }));
    expect(screen.getByRole("alert").textContent).toBe("Fill in every prompt variable: customer, order.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces an error thrown by the submit handler", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("The prompt service is offline."));
    render(<PromptVariableEditor prompt={prompt} initialValues={{ customer: "Dana", order: "4471" }} onSubmit={onSubmit} />);
    await click(screen.getByRole("button", { name: "Use filled prompt" }));
    expect(screen.getByRole("alert").textContent).toBe("The prompt service is offline.");
  });

  it("says when a prompt has no variables and submits it unchanged", async () => {
    const onSubmit = vi.fn();
    render(<PromptVariableEditor prompt="Summarize today's sales." onSubmit={onSubmit} />);
    expect(screen.getByText("This prompt has no variables.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    await click(screen.getByRole("button", { name: "Use filled prompt" }));
    expect(onSubmit).toHaveBeenCalledWith({}, "Summarize today's sales.");
  });
});

describe("ResponseFormatPicker", () => {
  const formats = [
    { id: "text", label: "Plain text" },
    { id: "json", label: "JSON object", requirements: "Ask for JSON in the prompt as well." },
    { id: "schema", label: "JSON Schema", unavailableReason: "Not supported by Llama 3.1 8B" },
  ];

  it("reports the chosen format and announces its requirements", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ResponseFormatPicker formats={formats} value={null} onChange={onChange} />);
    expect(combobox("Format").value).toBe("");
    fireEvent.change(combobox("Format"), { target: { value: "json" } });
    expect(onChange).toHaveBeenCalledWith("json");
    rerender(<ResponseFormatPicker formats={formats} value="json" onChange={onChange} />);
    const requirements = screen.getByText("Ask for JSON in the prompt as well.");
    expect(requirements.closest("[aria-live]")?.getAttribute("aria-live")).toBe("polite");
  });

  it("keeps unavailable formats disabled with the reason in their name and ignores the placeholder", () => {
    const onChange = vi.fn();
    render(<ResponseFormatPicker formats={formats} value="text" onChange={onChange} />);
    expect((screen.getByRole("option", { name: "JSON Schema (Not supported by Llama 3.1 8B)" }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(combobox("Format"), { target: { value: "schema" } });
    fireEvent.change(combobox("Format"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an empty state without formats", () => {
    render(<ResponseFormatPicker formats={[]} value={null} onChange={vi.fn()} />);
    expect(screen.getByText("No response formats available.")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("StructuredOutputEditor", () => {
  it("parses the schema and submits it as an object", async () => {
    const onSubmit = vi.fn();
    render(<StructuredOutputEditor onSubmit={onSubmit} />);
    expect(textbox("JSON Schema").value).toBe("{}");
    fireEvent.change(textbox("JSON Schema"), { target: { value: '{"type":"object","properties":{"sku":{"type":"string"}},"required":["sku"]}' } });
    await click(screen.getByRole("button", { name: "Save schema" }));
    expect(onSubmit).toHaveBeenCalledWith({ type: "object", properties: { sku: { type: "string" } }, required: ["sku"] });
  });

  it("accepts boolean schemas and rejects arrays and invalid JSON with an alert", async () => {
    const onSubmit = vi.fn();
    render(<StructuredOutputEditor initialValue="true" onSubmit={onSubmit} />);
    await click(screen.getByRole("button", { name: "Save schema" }));
    expect(onSubmit).toHaveBeenCalledWith(true);
    fireEvent.change(textbox("JSON Schema"), { target: { value: '["sku"]' } });
    await click(screen.getByRole("button", { name: "Save schema" }));
    expect(screen.getByRole("alert").textContent).toBe("A JSON Schema must be an object or a boolean.");
    fireEvent.change(textbox("JSON Schema"), { target: { value: '{"type":' } });
    await click(screen.getByRole("button", { name: "Save schema" }));
    expect(screen.getByRole("alert").textContent).toMatch(/^The schema is not valid JSON\./);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("ties a server validation error to the editor and surfaces a failed save", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("The schema registry is unavailable."));
    const { rerender } = render(<StructuredOutputEditor onSubmit={onSubmit} validationError="Property sku must declare a type." />);
    const editor = textbox("JSON Schema");
    const error = screen.getByRole("alert");
    expect(error.textContent).toBe("Property sku must declare a type.");
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    expect(editor.getAttribute("aria-describedby")).toBe(error.id);
    rerender(<StructuredOutputEditor onSubmit={onSubmit} />);
    expect(editor.getAttribute("aria-invalid")).toBeNull();
    await click(screen.getByRole("button", { name: "Save schema" }));
    expect(screen.getByRole("alert").textContent).toBe("The schema registry is unavailable.");
  });
});

describe("ToolApprovalPolicyEditor", () => {
  const rules: ToolApprovalPolicyRow[] = [
    { id: "search", tool: "web_search", value: null, effective: "allow", inheritedFrom: "Workspace default" },
    { id: "refund", tool: "issue_refund", value: "ask", effective: "ask" },
    { id: "email", tool: "send_email", value: "allow", effective: "allow", available: ["ask", "deny"] },
    { id: "shell", tool: "run_shell", value: null, effective: "deny", inheritedFrom: "Organization policy", unavailableReason: "Locked by your administrator" },
  ];

  it("shows each tool's effective rule and where it comes from in words, read-only without a handler", () => {
    render(<ToolApprovalPolicyEditor rules={rules} />);
    expect(screen.getByText("Effective: Allow · Inherited from Workspace default")).toBeTruthy();
    expect(screen.getByText("Effective: Deny · Inherited from Organization policy · Locked by your administrator")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("sets and clears a rule and offers only the values the tool allows", () => {
    const onChange = vi.fn();
    render(<ToolApprovalPolicyEditor rules={rules} onChange={onChange} />);
    const refund = combobox("Rule for issue_refund");
    expect(refund.value).toBe("ask");
    fireEvent.change(refund, { target: { value: "deny" } });
    expect(onChange).toHaveBeenLastCalledWith("refund", "deny");
    fireEvent.change(refund, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("refund", null);
    const email = combobox("Rule for send_email");
    expect(within(email).getAllByRole("option").map((option) => [option.textContent, (option as HTMLOptionElement).disabled]))
      .toEqual([["Inherit", false], ["Ask", false], ["Deny", false], ["Allow", true]]);
    onChange.mockClear();
    fireEvent.change(email, { target: { value: "allow" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("locks rules that are saving or unavailable and says a rule is saving", () => {
    render(<ToolApprovalPolicyEditor rules={rules} onChange={vi.fn()} pendingIds={["refund"]} />);
    expect(combobox("Rule for issue_refund").disabled).toBe(true);
    expect(screen.getByText("Effective: Ask · Saving")).toBeTruthy();
    expect(combobox("Rule for run_shell").disabled).toBe(true);
    expect(combobox("Rule for web_search").disabled).toBe(false);
  });

  it("shows an empty state without rules", () => {
    render(<ToolApprovalPolicyEditor rules={[]} />);
    expect(screen.getByText("No tool rules.")).toBeTruthy();
  });
});

describe("ToolArgumentDiff", () => {
  it("names each argument as changed, added or removed and diffs its values", () => {
    render(<ToolArgumentDiff changes={[
      { id: "query", key: "query", before: "cordless drill", after: "cordless drill 20V" },
      { id: "limit", key: "limit", after: "10" },
      { id: "region", key: "region", before: "us-east" },
    ]} />);
    expect(screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["query · Changed", "limit · Added", "region · Removed"]);
    const [query, limit, region] = screen.getAllByRole("listitem");
    expect(within(query!).getByText(/1 line added, 1 line removed/)).toBeTruthy();
    expect(within(limit!).getByText(/1 line added, 0 lines removed/)).toBeTruthy();
    expect(within(region!).getByText(/0 lines added, 1 line removed/)).toBeTruthy();
    expect(within(query!).getByRole("region", { name: "Changes to query" }).textContent).toContain("cordless drill 20V");
  });

  it("shows an empty state without changes", () => {
    render(<ToolArgumentDiff changes={[]} />);
    expect(screen.getByText("No argument changes.")).toBeTruthy();
  });
});

describe("ToolExecutionReceipt", () => {
  it("records the tool, outcome, duration, usage and redacted inputs", () => {
    render(<ToolExecutionReceipt receipt={{
      requestedTool: "check_inventory", actualTool: "check_inventory", outcome: "Succeeded", durationMs: 412,
      usage: "1,240 tokens", redactedInputs: '{"sku":"DRL-20V","api_key":"[redacted]"}',
    }} />);
    const panel = screen.getByRole("region", { name: "Tool execution receipt" });
    expect(within(panel).getAllByRole("term").map((term) => term.textContent)).toEqual(["Requested tool", "Actual tool", "Outcome", "Duration", "Usage"]);
    expect(within(panel).getAllByRole("definition").map((value) => value.textContent)).toEqual(["check_inventory", "check_inventory", "Succeeded", "412 ms", "1,240 tokens"]);
    expect(screen.getByRole("heading", { name: "Redacted inputs" }).nextElementSibling?.textContent).toBe('{"sku":"DRL-20V","api_key":"[redacted]"}');
    expect(screen.queryByText(/instead of the requested/)).toBeNull();
  });

  it("says when a different tool ran and marks missing details unavailable", () => {
    render(<ToolExecutionReceipt receipt={{ requestedTool: "check_inventory", actualTool: "check_inventory_v2", outcome: "Succeeded", durationMs: Number.NaN }} />);
    expect(screen.getByText("check_inventory_v2 ran instead of the requested check_inventory.")).toBeTruthy();
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Redacted inputs" })).toBeNull();
  });
});

describe("ToolInvocationReplay", () => {
  const parameters: ToolParameter[] = [
    { name: "query", label: "Query", kind: "string", required: true },
    { name: "limit", label: "Limit", kind: "number" },
    { name: "in_stock", label: "In stock only", kind: "boolean" },
  ];
  const call = { id: "call-7", tool: "check_inventory", outcome: "Timed out after 30 s", arguments: { query: "cordless drill", limit: 5, in_stock: true } };

  it("prefills the original arguments and requests a new invocation with the edited values", async () => {
    const onReplay = vi.fn();
    render(<ToolInvocationReplay call={call} parameters={parameters} onReplay={onReplay} />);
    expect(screen.getByText("check_inventory · Timed out after 30 s")).toBeTruthy();
    expect(screen.getByRole("form", { name: "Replay arguments" })).toBeTruthy();
    expect(textbox("Query (required)").value).toBe("cordless drill");
    expect(combobox("In stock only").value).toBe("true");
    fireEvent.change(textbox("Limit"), { target: { value: "10" } });
    await click(screen.getByRole("button", { name: "Request new invocation" }));
    expect(onReplay).toHaveBeenCalledWith("call-7", { query: "cordless drill", limit: 10, in_stock: true });
  });

  it("starts from the new call's arguments when a different call is shown", () => {
    const { rerender } = render(<ToolInvocationReplay call={call} parameters={parameters} onReplay={vi.fn()} />);
    fireEvent.change(textbox("Query (required)"), { target: { value: "edited" } });
    rerender(<ToolInvocationReplay call={{ ...call, id: "call-8", arguments: { query: "claw hammer" } }} parameters={parameters} onReplay={vi.fn()} />);
    expect(textbox("Query (required)").value).toBe("claw hammer");
    expect(textbox("Limit").value).toBe("");
  });

  it("surfaces a failed replay request", async () => {
    render(<ToolInvocationReplay call={call} parameters={parameters} onReplay={vi.fn().mockRejectedValue(new Error("The tool server refused the call."))} />);
    await click(screen.getByRole("button", { name: "Request new invocation" }));
    expect(screen.getByRole("alert").textContent).toBe("The tool server refused the call.");
  });
});

describe("ToolOutputLimitControl", () => {
  const policy = "Output over a limit is truncated and the model is told it was cut.";

  it("shows the policy and saves whole-number limits, leaving blank ones out", async () => {
    const onSubmit = vi.fn();
    render(<ToolOutputLimitControl initialValue={{ bytes: 65536 }} policy={policy} onSubmit={onSubmit} />);
    expect(screen.getByText(policy)).toBeTruthy();
    expect(textbox("Maximum bytes").value).toBe("65536");
    expect(textbox("Maximum items").value).toBe("");
    fireEvent.change(textbox("Maximum items"), { target: { value: "50" } });
    await click(screen.getByRole("button", { name: "Save limits" }));
    expect(onSubmit).toHaveBeenLastCalledWith({ bytes: 65536, items: 50 });
    fireEvent.change(textbox("Maximum bytes"), { target: { value: "" } });
    await click(screen.getByRole("button", { name: "Save limits" }));
    expect(onSubmit).toHaveBeenLastCalledWith({ items: 50 });
  });

  it("rejects fractions and values below one, naming the field by its label", async () => {
    const onSubmit = vi.fn();
    render(<ToolOutputLimitControl initialValue={{}} policy={policy} onSubmit={onSubmit} />);
    fireEvent.change(textbox("Maximum items"), { target: { value: "2.5" } });
    await click(screen.getByRole("button", { name: "Save limits" }));
    expect(screen.getByRole("alert").textContent).toBe("Maximum items must be a whole number of at least 1.");
    fireEvent.change(textbox("Maximum items"), { target: { value: "" } });
    fireEvent.change(textbox("Maximum bytes"), { target: { value: "0" } });
    await click(screen.getByRole("button", { name: "Save limits" }));
    expect(screen.getByRole("alert").textContent).toBe("Maximum bytes must be a whole number of at least 1.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces a failed save", async () => {
    render(<ToolOutputLimitControl initialValue={{ items: 20 }} policy={policy} onSubmit={vi.fn().mockRejectedValue(new Error("Limits are managed by your organization."))} />);
    await click(screen.getByRole("button", { name: "Save limits" }));
    expect(screen.getByRole("alert").textContent).toBe("Limits are managed by your organization.");
  });
});

describe("ToolParameterForm", () => {
  const parameters: ToolParameter[] = [
    { name: "sku", label: "SKU", kind: "string", required: true },
    { name: "quantity", label: "Quantity", kind: "number" },
    { name: "gift_wrap", label: "Gift wrap", kind: "boolean" },
    { name: "delivery", label: "Delivery", kind: "enum", options: [{ value: "pickup", label: "Pickup at the counter" }, { value: "courier", label: "Courier" }] },
  ];

  it("submits typed values for every kind of parameter", async () => {
    const onSubmit = vi.fn();
    render(<ToolParameterForm parameters={parameters} onSubmit={onSubmit} />);
    expect(screen.getByRole("region", { name: "Tool parameters" })).toBeTruthy();
    fireEvent.change(textbox("SKU (required)"), { target: { value: "DRL-20V" } });
    fireEvent.change(textbox("Quantity"), { target: { value: "3" } });
    fireEvent.change(combobox("Gift wrap"), { target: { value: "false" } });
    fireEvent.change(combobox("Delivery"), { target: { value: "courier" } });
    await click(screen.getByRole("button", { name: "Submit arguments" }));
    expect(onSubmit).toHaveBeenCalledWith({ sku: "DRL-20V", quantity: 3, gift_wrap: false, delivery: "courier" });
  });

  it("requires required parameters, leaves out blank optional ones and rejects invalid numbers", async () => {
    const onSubmit = vi.fn();
    render(<ToolParameterForm parameters={parameters} onSubmit={onSubmit} />);
    await click(screen.getByRole("button", { name: "Submit arguments" }));
    expect(screen.getByRole("alert").textContent).toBe("SKU is required.");
    fireEvent.change(textbox("SKU (required)"), { target: { value: "DRL-20V" } });
    fireEvent.change(textbox("Quantity"), { target: { value: "three" } });
    await click(screen.getByRole("button", { name: "Submit arguments" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid number for Quantity.");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(textbox("Quantity"), { target: { value: "" } });
    await click(screen.getByRole("button", { name: "Submit arguments" }));
    expect(onSubmit).toHaveBeenCalledWith({ sku: "DRL-20V" });
  });

  it("rejects an initial value that is no longer one of the options", async () => {
    const onSubmit = vi.fn();
    render(<ToolParameterForm parameters={parameters} initialValues={{ sku: "DRL-20V", delivery: "drone" }} onSubmit={onSubmit} />);
    expect(combobox("Delivery").value).toBe("");
    await click(screen.getByRole("button", { name: "Submit arguments" }));
    expect(screen.getByRole("alert").textContent).toBe("Choose an available option for Delivery.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uses a custom title and submit label and says when there is nothing to fill in", async () => {
    const onSubmit = vi.fn();
    render(<ToolParameterForm parameters={[]} title="Restock inputs" submitLabel="Run restock" onSubmit={onSubmit} />);
    expect(screen.getByRole("form", { name: "Restock inputs" })).toBeTruthy();
    expect(screen.getByText("No parameters to fill in.")).toBeTruthy();
    await click(screen.getByRole("button", { name: "Run restock" }));
    expect(onSubmit).toHaveBeenCalledWith({});
  });
});

describe("ToolRegistryPicker", () => {
  const tools: RegistryTool[] = [
    { id: "search", name: "web_search", description: "Search the public web", capabilities: ["web", "search"] },
    { id: "inventory", name: "check_inventory", description: "Look up stock by SKU", capabilities: ["store", "search"] },
    { id: "email", name: "send_email", description: "Send email from the store account", capabilities: ["email"], unavailableReason: "Connect Gmail first" },
  ];

  it("searches tools and filters them by capability", () => {
    render(<ToolRegistryPicker tools={tools} selectedIds={[]} onSelectionChange={vi.fn()} />);
    const capability = combobox("Capability");
    expect(within(capability).getAllByRole("option").map((option) => option.textContent)).toEqual(["All", "email", "search", "store", "web"]);
    fireEvent.change(capability, { target: { value: "store" } });
    expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(["Select check_inventory"]);
    fireEvent.change(capability, { target: { value: "" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tools" }), { target: { value: "public web" } });
    expect(screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(["Select web_search"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tools" }), { target: { value: "spreadsheet" } });
    expect(screen.getByText("No matching tools.")).toBeTruthy();
  });

  it("selects and deselects tools and explains why a tool is unavailable", () => {
    const onSelectionChange = vi.fn();
    render(<ToolRegistryPicker tools={tools} selectedIds={["search"]} onSelectionChange={onSelectionChange} />);
    const search = screen.getByRole("checkbox", { name: "Select web_search" }) as HTMLInputElement;
    expect(search.checked).toBe(true);
    fireEvent.click(search);
    expect(onSelectionChange).toHaveBeenLastCalledWith("search", false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select check_inventory" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith("inventory", true);
    expect(screen.getByText("Send email from the store account · email · Connect Gmail first")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Select send_email" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("lets an unavailable tool that is already selected be removed", () => {
    const onSelectionChange = vi.fn();
    render(<ToolRegistryPicker tools={tools} selectedIds={["email"]} onSelectionChange={onSelectionChange} />);
    const email = screen.getByRole("checkbox", { name: "Select send_email" }) as HTMLInputElement;
    expect([email.checked, email.disabled]).toEqual([true, false]);
    fireEvent.click(email);
    expect(onSelectionChange).toHaveBeenCalledWith("email", false);
  });

  it("shows an empty state when no tools are registered", () => {
    render(<ToolRegistryPicker tools={[]} selectedIds={[]} onSelectionChange={vi.fn()} />);
    expect(screen.getByText("No tools registered.")).toBeTruthy();
  });
});

describe("ToolResourcePicker", () => {
  const resources = [
    { id: "catalog", title: "Product catalog", address: "file:///data/catalog.csv", description: "10,000 SKUs with prices" },
    { id: "policies", title: "Store policies", address: "https://example.com/policies", description: "Returns and warranty rules" },
  ];

  it("shows each resource's address and description, searches all three and selects by id", () => {
    const onSelect = vi.fn();
    render(<ToolResourcePicker resources={resources} selectedId={null} onSelect={onSelect} />);
    expect(screen.getByText("file:///data/catalog.csv")).toBeTruthy();
    expect(screen.getByText("10,000 SKUs with prices")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search resources" }), { target: { value: "warranty" } });
    expect(screen.queryByText("Product catalog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select Store policies" }));
    expect(onSelect).toHaveBeenCalledWith("policies");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search resources" }), { target: { value: "invoices" } });
    expect(screen.getByText("No matching resources.")).toBeTruthy();
  });

  it("marks the selected resource in its button name and blocks selecting it again", () => {
    const onSelect = vi.fn();
    render(<ToolResourcePicker resources={resources} selectedId="catalog" onSelect={onSelect} />);
    const selected = screen.getByRole("button", { name: "Selected Product catalog" }) as HTMLButtonElement;
    expect(isDisabled(selected)).toBe(true);
    fireEvent.click(selected);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows an empty state without resources", () => {
    render(<ToolResourcePicker resources={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("No resources available.")).toBeTruthy();
  });
});

describe("ToolResultCompare", () => {
  const left = { label: "Run 1", text: "3 drills in stock\nAisle 4" };
  const right = { label: "Run 2", text: "5 drills in stock\nAisle 4" };

  it("diffs the two results under their labels by default", () => {
    render(<ToolResultCompare left={left} right={right} />);
    expect(combobox("Result view").value).toBe("diff");
    expect(screen.getByText("Changes from Run 1 to Run 2: 1 line added, 1 line removed")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Diff lines" }).textContent).toContain("5 drills in stock");
  });

  it("switches to the raw results side by side, each under its label", () => {
    render(<ToolResultCompare left={left} right={right} />);
    fireEvent.change(combobox("Result view"), { target: { value: "raw" } });
    expect(screen.queryByRole("region", { name: "Diff lines" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Run 1" }).nextElementSibling?.textContent).toBe(left.text);
    expect(screen.getByRole("heading", { name: "Run 2" }).nextElementSibling?.textContent).toBe(right.text);
  });
});

describe("ToolResultExportMenu", () => {
  const formats = [
    { id: "csv", label: "CSV" },
    { id: "json", label: "JSON" },
    { id: "pdf", label: "PDF report", disabled: true },
  ];

  it("exports the chosen format by id", async () => {
    const onExport = vi.fn();
    render(<ToolResultExportMenu formats={formats} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Export formats" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "JSON" }));
    expect(onExport).toHaveBeenCalledWith("json");
  });

  it("does not export a disabled format", async () => {
    const onExport = vi.fn();
    render(<ToolResultExportMenu formats={formats} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Export formats" }));
    const pdf = await screen.findByRole("menuitem", { name: "PDF report" });
    expect(pdf.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(pdf);
    expect(onExport).not.toHaveBeenCalled();
  });

  it("shows an empty state without formats", () => {
    render(<ToolResultExportMenu formats={[]} onExport={vi.fn()} />);
    expect(screen.getByText("No export formats available.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
