// packages/ai-ui/src/components/truncation-notice.tsx
"use client";

import { ArrowRightIcon, LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";

import { button, buttonVariants, focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Banner, type BannerProps } from "./banner.js";

export type TruncationNoticeProps = Omit<BannerProps, "tone" | "title" | "actions" | "children"> &
  (
    | {
        /** Older messages were left out of the model's context. */
        variant: "omitted";
        omittedCount: number;
        /** E.g. "The full history is still saved." */
        detail?: ReactNode;
      }
    | {
        /** The reply stopped before the work finished. */
        variant: "incomplete";
        segments?: number;
        onContinue: () => void;
        /** Changes are still being applied; Continue waits until they finish. */
        pending?: boolean;
      }
  );

/** Explains that history was trimmed or that a long reply stopped early, with Continue for the latter. */
export function TruncationNotice(props: TruncationNoticeProps) {
  if (props.variant === "omitted") {
    const { variant: _variant, omittedCount, detail = "The full history is still saved.", ...rest } = props;
    return (
      <Banner tone="neutral" {...rest}>
        {omittedCount.toLocaleString()} earlier message{omittedCount === 1 ? " was" : "s were"} left out to fit the context window. {detail}
      </Banner>
    );
  }
  const { variant: _variant, segments, onContinue, pending = false, ...rest } = props;
  return (
    <Banner
      tone="warning"
      title={segments !== undefined ? `Stopped after ${segments} segment${segments === 1 ? "" : "s"}` : "The reply stopped early"}
      actions={
        <button
          type="button"
          aria-disabled={pending || undefined}
          onClick={() => {
            if (!pending) onContinue();
          }}
          className={cn(button, buttonVariants.outline, "h-7 px-2.5", focusRing)}
        >
          {pending ? <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" /> : <ArrowRightIcon aria-hidden="true" />}
          {pending ? "Applying changes" : "Continue"}
        </button>
      }
      {...rest}
    >
      The work is not finished yet. Continue picks up where it stopped.
    </Banner>
  );
}
