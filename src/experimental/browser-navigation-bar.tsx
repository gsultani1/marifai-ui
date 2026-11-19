// packages/ai-ui/src/experimental/browser-navigation-bar.tsx
"use client";

import { ArrowLeftIcon, ArrowRightIcon, ArrowUpRightIcon, RefreshCwIcon, XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { focusRing } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { Button } from "../components/button.js";

export interface BrowserNavigationBarProps extends Pick<ComponentProps<"form">, "className" | "id"> {
  address: string;
  onAddressChange: (address: string) => void;
  /** The host interprets and validates the submitted address. */
  onNavigate: (address: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onReload?: () => void;
  onStop?: () => void;
  loading?: boolean;
  addressLabel?: string;
}

export function BrowserNavigationBar({
  address, onAddressChange, onNavigate, onBack, onForward, onReload, onStop,
  loading = false, addressLabel = "Browser address", className, id,
}: BrowserNavigationBarProps) {
  return (
    <form
      id={id}
      role="search"
      aria-label={addressLabel}
      data-slot="browser-navigation-bar"
      className={cn("flex min-w-0 flex-wrap items-center gap-1.5 text-sm", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const destination = address.trim();
        if (destination) onNavigate(destination);
      }}
    >
      <div className="flex shrink-0 gap-0.5">
        <Button type="button" size="icon" variant="ghost" aria-label="Go back" disabled={!onBack} onClick={onBack}>
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Go forward" disabled={!onForward} onClick={onForward}>
          <ArrowRightIcon aria-hidden="true" />
        </Button>
        <Button
          type="button" size="icon" variant="ghost" aria-label={loading ? "Stop loading" : "Reload page"}
          disabled={loading ? !onStop : !onReload} onClick={loading ? onStop : onReload}
        >
          {loading ? <XIcon aria-hidden="true" /> : <RefreshCwIcon aria-hidden="true" />}
        </Button>
      </div>
      <input
        aria-label={addressLabel}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={address}
        onChange={(event) => onAddressChange(event.currentTarget.value)}
        className={cn("h-8 min-w-24 flex-1 rounded-md border border-input bg-background px-2", focusRing)}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!address.trim()}>
        <ArrowUpRightIcon aria-hidden="true" /> Go
      </Button>
    </form>
  );
}
