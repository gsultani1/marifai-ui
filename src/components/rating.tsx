// packages/ai-ui/src/components/rating.tsx
"use client";

import { StarIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { cn } from "../lib/cn.js";

export interface RatingProps {
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
  max?: number;
  label?: string;
  /** Displays the value, including fractions such as 4.5, without input. */
  readOnly?: boolean;
  /** Clicking the current rating again clears it. */
  clearable?: boolean;
  disabled?: boolean;
  name?: string;
  size?: "sm" | "md" | "lg";
  /** Replaces the star glyph. */
  icon?: ReactNode;
  className?: string;
}

const sizes = { sm: "size-4", md: "size-5", lg: "size-7" };

/**
 * Star rating built on native radio buttons, so arrow keys and screen
 * readers work as a radio group, with hover preview and optional clearing.
 * Read-only mode shows fractional values as a partially filled star row.
 */
export function Rating({ value, defaultValue = null, onValueChange, max = 5, label = "Rating", readOnly = false, clearable = true, disabled = false, name, size = "md", icon, className }: RatingProps) {
  const [rating, setRating] = useControllableState<number | null>({ value, defaultValue, onChange: onValueChange });
  const [hover, setHover] = useState<number | null>(null);
  const groupName = useId();
  const glyph = (filled: boolean) => (icon ? <span className={cn("flex", sizes[size], filled ? "text-warning" : "text-muted-foreground/40")}>{icon}</span> : <StarIcon aria-hidden="true" className={cn(sizes[size], filled ? "fill-warning text-warning" : "fill-transparent text-muted-foreground/60")} />);

  if (readOnly) {
    const current = rating ?? 0;
    return (
      <span role="img" aria-label={`${label}: ${Number(current.toFixed(1))} out of ${max}`} className={cn("relative inline-flex", className)}>
        <span className="flex">{Array.from({ length: max }, (_, index) => <span key={index}>{glyph(false)}</span>)}</span>
        <span aria-hidden="true" className="absolute inset-y-0 left-0 flex overflow-hidden" style={{ width: `${(Math.min(max, Math.max(0, current)) / max) * 100}%` }}>
          {Array.from({ length: max }, (_, index) => (
            <span key={index} className="shrink-0">
              {glyph(true)}
            </span>
          ))}
        </span>
      </span>
    );
  }

  const shown = hover ?? rating ?? 0;
  return (
    <fieldset disabled={disabled} className={cn("inline-flex min-w-0 flex-col gap-1 border-0 p-0", className)} onPointerLeave={() => setHover(null)}>
      <legend className="sr-only">{label}</legend>
      <div className="flex">
        {Array.from({ length: max }, (_, index) => {
          const star = index + 1;
          return (
            <label key={star} onPointerEnter={() => !disabled && setHover(star)} className={cn("cursor-pointer rounded-sm p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", disabled && "cursor-not-allowed opacity-50")}>
              <input
                type="radio"
                name={name ?? groupName}
                value={star}
                checked={rating === star}
                onChange={() => setRating(star)}
                onClick={() => {
                  if (clearable && rating === star) setRating(null);
                }}
                className="sr-only"
              />
              {glyph(star <= shown)}
              <span className="sr-only">
                {star} {star === 1 ? "star" : "stars"}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
