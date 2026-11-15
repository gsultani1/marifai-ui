// packages/ai-ui/src/components/vibe-builder-change-review.tsx
"use client";

import { useState } from "react";

import { AsyncForm, ControlAction, ControlPanel, ItemList } from "../lib/component-controls.js";
import type { BuilderDocument } from "../lib/page-builder.js";
import { DiffView } from "./diff-view.js";
import { VibeBuilderPreview } from "./vibe-builder-preview.js";

export type VibeBuilderFileChange =
  | { id: string; path: string; kind: "added"; after: string }
  | { id: string; path: string; kind: "modified"; before: string; after: string }
  | { id: string; path: string; kind: "deleted"; before: string };

export interface VibeBuilderProposal {
  /** Unique ID for an immutable proposal. Use a new ID when its contents change. */
  id: string;
  baseRevision: string;
  summary: string;
  files: readonly VibeBuilderFileChange[];
  /** Complete proposed design, when the change also updates the visual document. */
  document?: BuilderDocument;
  /** Design at baseRevision, for comparing against the proposal even after a later edit. */
  baseDocument?: BuilderDocument;
}

export interface VibeBuilderApplyRequest {
  proposalId: string;
  expectedRevision: string;
}

export interface VibeBuilderChangeReviewProps {
  proposal: VibeBuilderProposal;
  revision: string;
  /** Resource origins permitted in the static design previews. */
  allowedOrigins?: readonly string[] | undefined;
  /** The host verifies the expected revision and applies the proposal atomically. */
  onApply: (request: VibeBuilderApplyRequest) => void | Promise<void>;
  onDiscard?: ((id: string) => void) | undefined;
  className?: string;
}

export function VibeBuilderChangeReview(props: VibeBuilderChangeReviewProps) {
  return <ProposalReview key={props.proposal.id} {...props} />;
}

function ProposalReview({ proposal, revision, allowedOrigins, onApply, onDiscard, className }: VibeBuilderChangeReviewProps) {
  const current = proposal.baseRevision === revision;
  const hasChanges = Boolean(proposal.document || proposal.files.length);
  const [inspectingSource, setInspectingSource] = useState(!proposal.document);

  return (
    <ControlPanel slot="vibe-builder-change-review" title="Proposed changes" className={className}>
      <p className="break-words text-sm">{proposal.summary}</p>
      {!current && <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
        The project changed after this proposal. Send a new request to apply changes.
      </p>}
      {!hasChanges && <p className="text-sm text-muted-foreground">There are no changes to apply.</p>}
      <AsyncForm label="Apply proposal" submitLabel="Apply changes" disabled={!current || !hasChanges}
        onSubmit={() => onApply({ proposalId: proposal.id, expectedRevision: proposal.baseRevision })}>
        <ControlAction label="Discard proposal" onClick={onDiscard && (() => onDiscard(proposal.id))} />
      </AsyncForm>
      {proposal.document && proposal.files.length > 0 && (
        <div className="border-t border-border pt-3">
          <ControlAction label={inspectingSource ? "Show visual comparison" : "Inspect source changes"}
            onClick={() => setInspectingSource(!inspectingSource)} />
        </div>
      )}
      {inspectingSource && proposal.files.length > 0 && <ItemList items={proposal.files} empty="" render={(file) => (
        <details open={proposal.files.length === 1 ? true : undefined}>
          <summary className="cursor-pointer break-all text-sm">{file.path} · {file.kind}</summary>
          <DiffView oldValue={"before" in file ? file.before : ""} newValue={"after" in file ? file.after : ""} className="mt-2" />
        </details>
      )} />}
      {!inspectingSource && proposal.document && (
        <div className={proposal.baseDocument ? "@container" : undefined}>
          <div className={proposal.baseDocument ? "grid min-w-0 gap-3 @min-[36rem]:grid-cols-2" : undefined}>
            {proposal.baseDocument && <div className="min-w-0 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Before</h4>
              <VibeBuilderPreview title="Design before changes" source={{ kind: "design", document: proposal.baseDocument }}
                allowedOrigins={allowedOrigins} showToolbar={false} />
            </div>}
            <div className="min-w-0 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Proposed design</h4>
              <VibeBuilderPreview title="Proposed design preview" source={{ kind: "design", document: proposal.document }}
                allowedOrigins={allowedOrigins} showToolbar={false} />
            </div>
          </div>
        </div>
      )}
    </ControlPanel>
  );
}
