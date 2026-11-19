// packages/ai-ui/src/components/model-fallback-order.tsx
"use client";

import { ControlPanel } from "../lib/component-controls.js";
import { OrderedList } from "../lib/collection-controls.js";
export interface FallbackModel { id: string; name: string; provider?: string }

export interface ModelFallbackOrderProps {
  models: readonly FallbackModel[];
  onReorder: (orderedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelFallbackOrder({ models, onReorder, disabled, className }: ModelFallbackOrderProps) {
  return <ControlPanel slot="model-fallback-order" title="Model fallback order" className={className}>
    {models.length ? <>
      <p className="text-sm text-muted-foreground">Models are tried in order, from top to bottom.</p>
      <OrderedList items={models} label="Fallback models" itemLabel={(item) => item.name} onReorder={onReorder}
        disabled={disabled} render={(item) => item.provider ? item.name + " · " + item.provider : item.name} />
    </> : <p className="text-sm text-muted-foreground">No fallback models.</p>}
  </ControlPanel>;
}
