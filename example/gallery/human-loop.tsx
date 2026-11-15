// packages/ai-ui/example/gallery/human-loop.tsx
import { useState } from "react";

import {
  ActionApproval,
  AgentError,
  type ApprovalRequest,
  ApprovalQueue,
  BatchReview,
  BudgetBar,
  ChatAlert,
  type ClarifyingAnswers,
  ClarifyingQuestions,
  CodeBlock,
  ConsentCard,
  CostApproval,
  JobList,
  QueryReview,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const LOADED_AT = Date.now();

const REQUESTS: ApprovalRequest[] = [
  {
    id: "r1",
    title: "Send the weekly summary email",
    description: "Sends one email to 14 recipients on the team list.",
    risk: "medium",
    scopes: ["gmail.send"],
    source: "Inbox agent",
    requestedAt: LOADED_AT - 120_000,
    preview: <p className="text-sm">Subject: Weekly summary · Revenue up 4%, two open incidents, hiring update.</p>,
  },
  { id: "r2", title: "Create a Linear issue", description: "Files a bug for the failed checkout test.", risk: "low", scopes: ["linear.issues:write"], source: "QA agent" },
  { id: "r3", title: "Archive 40 stale branches", state: "approved", digest: "9f2c1e7a44b0d311" },
];

export function HumanLoopGallery() {
  const [requests, setRequests] = useState(REQUESTS);
  const [answers, setAnswers] = useState<ClarifyingAnswers | null>(null);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [applied, setApplied] = useState<string[] | null>(null);

  const decide = (id: string, state: "approved" | "denied") => setRequests((current) => current.map((request) => (request.id === id ? { ...request, state } : request)));

  return (
    <GallerySection id="gallery-human" title="Approvals, questions and errors">
      <Demo title="Action approval" className="grid w-full gap-3 md:grid-cols-2">
        <ActionApproval
          title="Delete the staging database"
          description="Drops every table in staging. Production is not affected."
          risk="high"
          scopes={["db.staging:admin"]}
          digest="c0ffee42deadbeef9876"
          preview={<CodeBlock code="DROP SCHEMA staging CASCADE;" language="sql" />}
          onApprove={() => undefined}
          onDeny={() => undefined}
          denyRequiresReason
        />
        <ApprovalQueue requests={requests} onApprove={(id) => decide(id, "approved")} onDeny={(id) => decide(id, "denied")} />
      </Demo>
      <Demo title="Cost approval and budget" className="grid w-full gap-3 md:grid-cols-2">
        <CostApproval
          title="Fine-tune the support classifier"
          outcome="A model that routes tickets to the right queue, with an evaluation report."
          included={["3 training epochs on 12,000 tickets", "Held-out evaluation and confusion matrix", "Model card"]}
          price={18.4}
          maxCost={25}
          balance={60}
          etaMs={42 * 60_000}
          hardware="1× A100 80 GB"
          script={"from trainer import run\nrun(epochs=3, data='tickets.jsonl')"}
          onApprove={() => undefined}
          onDecline={() => undefined}
        />
        <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
          <BudgetBar label="Monthly budget" budget={200} used={142} held={18.4} />
          <BudgetBar label="Team credits" budget={5000} used={4700} unit="credits" />
        </div>
      </Demo>
      <Demo title="Jobs" className="w-full">
        <JobList
          className="w-full"
          onCancel={() => undefined}
          onRetry={() => undefined}
          onReconcile={() => undefined}
          jobs={[
            { id: "j1", title: "Transcribe board meeting", status: "running", startedAt: LOADED_AT - 95_000, progress: 0.62, logs: ["Loaded audio (48 min)", "Chunk 18 of 29"] },
            { id: "j2", title: "Export Q3 invoices", status: "succeeded", startedAt: LOADED_AT - 600_000, finishedAt: LOADED_AT - 540_000, cost: 0.42, result: <p>412 invoices · invoices-q3.csv</p> },
            { id: "j3", title: "Sync inventory to storefront", status: "unknown", startedAt: LOADED_AT - 1_800_000 },
            { id: "j4", title: "Resize product photos", status: "failed", error: "Out of memory on image 812 of 1,240" },
          ]}
        />
      </Demo>
      <Demo title="Clarifying questions" className="flex w-full flex-col gap-2">
        {answers ? (
          <p className="text-sm">
            Answers sent: <code className="font-mono text-xs">{JSON.stringify(answers)}</code>{" "}
            <button type="button" onClick={() => setAnswers(null)} className="underline">
              Ask again
            </button>
          </p>
        ) : (
          <ClarifyingQuestions
            onSubmit={setAnswers}
            onDismiss={() => setAnswers({})}
            questions={[
              {
                id: "audience",
                question: "Who is the dashboard for?",
                options: [
                  { value: "exec", label: "Executives", description: "Headline numbers, weekly trend" },
                  { value: "ops", label: "Store managers", description: "Daily sales, stock alerts" },
                ],
                allowCustom: true,
                required: true,
              },
              { id: "sources", question: "Which data should it use?", options: [{ value: "pos", label: "Point of sale" }, { value: "inventory", label: "Inventory" }, { value: "payroll", label: "Payroll" }], multiple: true },
              { id: "notes", question: "Anything else I should know?" },
            ]}
          />
        )}
      </Demo>
      <Demo title="Errors" className="grid w-full gap-3 md:grid-cols-2">
        <AgentError error={{ status: 429, message: "Rate limit reached for requests", retryAfterMs: 20_000 }} occurredAt={LOADED_AT} onRetry={() => undefined} onSwitchModel={() => undefined} />
        <AgentError error={{ status: 401, message: "Invalid API key provided" }} onOpenSettings={() => undefined} onRestorePrompt={() => undefined} diagnostics={{ model: "core-large" }} />
        <AgentError error={new Error("This model's maximum context length is 128000 tokens")} onRetryWithoutAttachments={() => undefined} onSwitchModel={() => undefined} />
        <AgentError error={{ status: 502, message: "Bad gateway" }} applied={3} onRetry={() => undefined} />
        <ChatAlert
          source="preview"
          description="The preview threw while rendering."
          content={"TypeError: Cannot read properties of undefined (reading 'map')\n    at ProductList (src/ProductList.tsx:14:22)"}
          onAskToFix={() => undefined}
          onDismiss={() => undefined}
          className="md:col-span-2"
        />
      </Demo>
      <Demo title="Query review" className="grid w-full gap-3 md:grid-cols-2">
        <QueryReview
          description="Top five customers by revenue this quarter"
          sql={"SELECT customer, SUM(total) AS revenue\nFROM orders\nWHERE placed_at >= date_trunc('quarter', now())\nGROUP BY customer\nORDER BY revenue DESC\nLIMIT 5;"}
          onRun={() => setQueryResult("5 rows · Acme Supply leads with $48,210")}
          result={queryResult && <p className="text-sm">{queryResult}</p>}
        />
        <QueryReview description="Mark overdue invoices as sent to collections" sql="UPDATE invoices SET status = 'collections' WHERE due_at < now() - interval '90 days';" allowWrites onRun={() => undefined} onDismiss={() => undefined} />
      </Demo>
      <Demo title="Batch review and consent" className="grid w-full gap-3 md:grid-cols-2">
        {applied ? (
          <p className="text-sm">
            Applied {applied.length} shifts.{" "}
            <button type="button" onClick={() => setApplied(null)} className="underline">
              Review again
            </button>
          </p>
        ) : (
          <BatchReview
            title="Proposed schedule for next week"
            description="Built from availability and forecast foot traffic."
            noun={["shift", "shifts"]}
            onApply={setApplied}
            onCancel={() => undefined}
            notes="Saturday 4 to 8 PM is still one person short."
            groups={[
              { id: "mon", label: "Monday", items: [{ id: "m1", title: "Ana · 8 AM to 4 PM", description: "Register", cost: 128 }, { id: "m2", title: "Ben · 12 to 8 PM", description: "Floor", cost: 120, conflict: "Ben has approved leave" }] },
              { id: "sat", label: "Saturday", items: [{ id: "s1", title: "Cara · 9 AM to 5 PM", description: "Register", cost: 136 }, { id: "s2", title: "Dev · 10 AM to 6 PM", description: "Paint desk", cost: 132 }] },
            ]}
          />
        )}
        <ConsentCard
          clientName="Ledger Sync"
          verified
          account="owner@example.com"
          redirectUri="https://app.ledgersync.example/oauth/callback"
          scopes={[
            { id: "invoices:read", label: "Read invoices", description: "View invoices and payment status" },
            { id: "invoices:write", label: "Create and edit invoices", sensitive: true },
          ]}
          onApprove={() => undefined}
          onCancel={() => undefined}
        />
      </Demo>
    </GallerySection>
  );
}
