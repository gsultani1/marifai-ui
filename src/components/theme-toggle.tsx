// packages/ai-ui/src/components/theme-toggle.tsx
"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useTheme, type UseThemeOptions } from "../hooks/use-theme.js";
import { SegmentedControl } from "./segmented-control.js";

export interface ThemeToggleProps extends UseThemeOptions {
  /** Shows text next to the icons. */
  showLabels?: boolean;
  label?: string;
  className?: string;
}

/** Light, dark and system choice as a segmented control, backed by `useTheme`. */
export function ThemeToggle({ showLabels = false, label = "Theme", className, ...options }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme(options);
  const option = (value: "light" | "dark" | "system", text: string, icon: ReactNode) => ({ value, icon, label: showLabels ? text : null, ...(showLabels ? {} : { "aria-label": text }) });
  return (
    <SegmentedControl
      label={label}
      size="sm"
      value={preference}
      onValueChange={setPreference}
      className={className}
      options={[option("light", "Light", <SunIcon aria-hidden="true" />), option("dark", "Dark", <MoonIcon aria-hidden="true" />), option("system", "System", <MonitorIcon aria-hidden="true" />)]}
    />
  );
}
