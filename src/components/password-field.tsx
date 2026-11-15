// packages/ai-ui/src/components/password-field.tsx
"use client";

import { Input } from "@base-ui/react/input";
import { CheckIcon, CircleIcon, CopyIcon, EyeIcon, EyeOffIcon, WandSparklesIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import { useControllableState } from "../hooks/use-controllable-state.js";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard.js";
import { focusRing, iconButton, input } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { defaultPasswordRules, generatePassword, type GeneratePasswordOptions, type PasswordRule, scorePassword } from "../lib/password.js";

export interface PasswordFieldProps extends Omit<Input.Props, "type" | "value" | "defaultValue" | "onValueChange" | "className" | "render"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shows the strength meter and rule checklist; use when setting a new password. */
  showStrength?: boolean;
  rules?: PasswordRule[];
  /** Adds a button that fills in a generated password and reveals it. */
  generate?: boolean | GeneratePasswordOptions;
  className?: string;
}

const segmentTone = (score: number) => (score <= 2 ? "bg-destructive" : score === 3 ? "bg-warning" : "bg-success");

/**
 * Password input with show and hide, a Caps Lock warning, and for new
 * passwords a five-segment strength meter, the rules still unmet, warnings
 * for common passwords, repeats and sequences, and a generator that uses the
 * platform CSPRNG. Autocomplete defaults to new-password when the meter is on.
 */
export function PasswordField({ value, defaultValue = "", onValueChange, showStrength = false, rules = defaultPasswordRules, generate = false, autoComplete, className, disabled, ...props }: PasswordFieldProps) {
  const [password, setPassword] = useControllableState<string>({ value, defaultValue, onChange: onValueChange });
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const result = scorePassword(password, rules);

  const checkCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="relative">
        <Input
          {...props}
          disabled={disabled}
          type={visible ? "text" : "password"}
          value={password}
          onValueChange={(next: string) => setPassword(next)}
          onKeyDown={checkCaps}
          onKeyUp={checkCaps}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete ?? (showStrength ? "new-password" : "current-password")}
          spellCheck={false}
          autoCapitalize="off"
          className={cn(input, focusRing, "focus-visible:ring-offset-0")}
          style={{ paddingRight: `calc(${1 + (generate ? 1 : 0) + (generate && password ? 1 : 0)} * 2rem + 0.25rem)` }}
        />
        <div className="absolute inset-y-0 right-0.5 flex items-center">
          {generate && password && (
            <button type="button" disabled={disabled} aria-label={copied ? "Copied" : "Copy password"} onClick={() => void copy(password)} className={cn(iconButton, "size-8", focusRing)}>
              {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            </button>
          )}
          {generate && (
            <button
              type="button"
              disabled={disabled}
              aria-label="Generate password"
              onClick={() => {
                setPassword(generatePassword(typeof generate === "object" ? generate : {}));
                setVisible(true);
              }}
              className={cn(iconButton, "size-8", focusRing)}
            >
              <WandSparklesIcon aria-hidden="true" />
            </button>
          )}
          <button type="button" disabled={disabled} aria-label="Show password" aria-pressed={visible} onClick={() => setVisible(!visible)} className={cn(iconButton, "size-8", focusRing)}>
            {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </button>
        </div>
      </div>
      <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-foreground empty:hidden">
        {capsLock && (
          <>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
            Caps Lock is on.
          </>
        )}
      </p>
      {showStrength && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={5} aria-valuenow={result.score} aria-valuetext={result.label || "No password"} className="flex flex-1 gap-1">
              {[1, 2, 3, 4, 5].map((segment) => (
                <span key={segment} className={cn("h-1.5 flex-1 rounded-full", segment <= result.score ? segmentTone(result.score) : "bg-muted")} />
              ))}
            </div>
            <span aria-hidden="true" className="w-20 text-right text-xs font-medium text-foreground">
              {result.label}
            </span>
          </div>
          <ul aria-label="Password requirements" className="grid gap-1 text-xs sm:grid-cols-2">
            {rules.map((rule) => {
              const met = result.passed.includes(rule.id);
              return (
                <li key={rule.id} className={cn("flex items-center gap-1.5", met ? "text-foreground" : "text-muted-foreground")}>
                  {met ? <CheckIcon aria-hidden="true" className="size-3.5 text-success" /> : <CircleIcon aria-hidden="true" className="size-3.5" />}
                  {rule.label}
                  <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
                </li>
              );
            })}
          </ul>
          {result.warnings.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs font-medium text-foreground">
              {result.warnings.map((warning) => (
                <li key={warning} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
