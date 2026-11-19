// packages/ai-ui/src/experimental/run-artifact-manifest.tsx
"use client";

import { ControlAction, ControlPanel, ItemHeading, ItemList } from "../lib/component-controls.js";

export interface ManifestArtifact { id: string; title: string; kind: string; size?: string; version?: string; unavailableReason?: string }

export interface RunArtifactManifestProps {
  artifacts: readonly ManifestArtifact[];
  onOpen?: (id: string) => void;
  className?: string;
}

export function RunArtifactManifest({ artifacts, onOpen, className }: RunArtifactManifestProps) {
  return <ControlPanel slot="run-artifact-manifest" title="Run artifacts" className={className}>
    <ItemList items={artifacts} empty="No run artifacts." render={(item) => <ItemHeading title={item.title}
      detail={[item.kind,item.size,item.version,item.unavailableReason].filter(Boolean).join(" · ")}>
      <ControlAction label="Open artifact" item={item.title} disabled={Boolean(item.unavailableReason)} onClick={onOpen && (() => onOpen(item.id))} />
    </ItemHeading>} />
  </ControlPanel>;
}
