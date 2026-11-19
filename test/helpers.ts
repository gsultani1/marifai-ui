// packages/ai-ui/test/helpers.ts

/**
 * True when a control is disabled, either natively or through `aria-disabled`.
 * Buttons that must keep keyboard focus while unavailable (`focusableWhenDisabled`)
 * report it through `aria-disabled` instead of the native attribute.
 */
export function isDisabled(element: Element): boolean {
  return (element as HTMLButtonElement).disabled === true || element.getAttribute("aria-disabled") === "true";
}
