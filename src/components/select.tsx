// packages/ai-ui/src/components/select.tsx
"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";
import { Fragment, type ReactNode, useMemo } from "react";

import { focusRing, popupSurface } from "../lib/classes.js";
import { cn } from "../lib/cn.js";
import { usePortalContainer } from "../lib/portal.js";

/** Trigger heights shared by Select, Combobox and MultiSelect. */
export const fieldSizes = {
  sm: "min-h-8 text-sm",
  md: "min-h-9 text-sm",
  lg: "min-h-10 text-base",
} as const;

export type FieldSize = keyof typeof fieldSizes;

/** Listbox option row shared by Select and Combobox popups. */
export const optionItem =
  "relative flex cursor-default items-start gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm text-foreground outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:text-muted-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

/** Popup list surface shared by Select and Combobox. */
export const optionPopup = cn(popupSurface, "max-h-[min(var(--available-height),20rem)] min-w-[var(--anchor-width)] overflow-y-auto p-1 outline-none");

export interface OptionContentProps {
  icon?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  /** Wraps the label, such as in Base UI Select.ItemText. */
  labelWrapper?: (label: ReactNode) => ReactNode;
}

/** Content of one option row: icon, label and description. */
export function OptionContent({ icon, label, description, labelWrapper }: OptionContentProps) {
  return (
    <>
      {icon && <span className="mt-0.5 flex text-muted-foreground">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        {labelWrapper ? labelWrapper(label) : <span className="truncate">{label}</span>}
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </span>
    </>
  );
}

export type SelectRootProps<Value, Multiple extends boolean | undefined = false> = BaseSelect.Root.Props<Value, Multiple>;

/** Base UI Select.Root: holds the value, open state and form integration for the composable parts. */
export function SelectRoot<Value, Multiple extends boolean | undefined = false>(props: SelectRootProps<Value, Multiple>) {
  return <BaseSelect.Root<Value, Multiple> {...props} />;
}

export interface SelectTriggerProps extends Omit<BaseSelect.Trigger.Props, "className"> {
  size?: FieldSize;
  className?: string;
}

/** Field-styled button that opens the list; Arrow keys, Enter and Space open it and typing jumps to a match. */
export function SelectTrigger({ size = "md", className, children, ...props }: SelectTriggerProps) {
  return (
    <BaseSelect.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-foreground transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50 data-[invalid]:border-destructive data-[popup-open]:ring-2 data-[popup-open]:ring-ring [&_svg]:size-4 [&_svg]:shrink-0",
        fieldSizes[size],
        focusRing,
        "focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="flex text-muted-foreground">
        <ChevronsUpDownIcon aria-hidden="true" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export interface SelectValueProps extends Omit<BaseSelect.Value.Props, "className"> {
  className?: string;
}

/** The selected option's label in the trigger, or the placeholder in muted text. */
export function SelectValue({ className, ...props }: SelectValueProps) {
  return <BaseSelect.Value data-slot="select-value" className={cn("flex min-w-0 flex-1 items-center gap-2 truncate data-[placeholder]:text-muted-foreground", className)} {...props} />;
}

export interface SelectContentProps extends Omit<BaseSelect.Popup.Props, "className"> {
  /** Positions the selected item over the trigger, as native macOS menus do. */
  alignItemWithTrigger?: boolean;
  side?: BaseSelect.Positioner.Props["side"];
  align?: BaseSelect.Positioner.Props["align"];
  sideOffset?: number;
  className?: string;
}

/** Portaled popup with the option list and scroll arrows for long lists. */
export function SelectContent({ alignItemWithTrigger = false, side = "bottom", align = "start", sideOffset = 4, className, children, ...props }: SelectContentProps) {
  const container = usePortalContainer();
  return (
    <BaseSelect.Portal container={container}>
      <BaseSelect.Positioner alignItemWithTrigger={alignItemWithTrigger} side={side} align={align} sideOffset={sideOffset} className="z-50">
        <BaseSelect.Popup data-slot="select-content" className={cn(optionPopup, className)} {...props}>
          <BaseSelect.ScrollUpArrow className="flex h-5 w-full items-center justify-center text-muted-foreground [&_svg]:size-3.5">
            <ChevronUpIcon aria-hidden="true" />
          </BaseSelect.ScrollUpArrow>
          <BaseSelect.List>{children}</BaseSelect.List>
          <BaseSelect.ScrollDownArrow className="flex h-5 w-full items-center justify-center text-muted-foreground [&_svg]:size-3.5">
            <ChevronDownIcon aria-hidden="true" />
          </BaseSelect.ScrollDownArrow>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export interface SelectItemProps extends Omit<BaseSelect.Item.Props, "className" | "children"> {
  children: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** One option with a check mark when selected, an optional icon and a second line of description. */
export function SelectItem({ children, icon, description, className, ...props }: SelectItemProps) {
  return (
    <BaseSelect.Item data-slot="select-item" className={cn(optionItem, className)} {...props}>
      <OptionContent icon={icon} label={children} description={description} labelWrapper={(label) => <BaseSelect.ItemText className="truncate">{label}</BaseSelect.ItemText>} />
      <BaseSelect.ItemIndicator className="absolute top-2 right-2 flex">
        <CheckIcon aria-hidden="true" />
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  );
}

export interface SelectGroupProps extends Omit<BaseSelect.Group.Props, "className"> {
  className?: string;
}

export function SelectGroup({ className, ...props }: SelectGroupProps) {
  return <BaseSelect.Group data-slot="select-group" className={cn("py-0.5", className)} {...props} />;
}

export interface SelectGroupLabelProps extends Omit<BaseSelect.GroupLabel.Props, "className"> {
  className?: string;
}

export function SelectGroupLabel({ className, ...props }: SelectGroupLabelProps) {
  return <BaseSelect.GroupLabel data-slot="select-group-label" className={cn("px-2 py-1 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export interface SelectSeparatorProps extends Omit<BaseSelect.Separator.Props, "className"> {
  className?: string;
}

export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return <BaseSelect.Separator data-slot="select-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export interface SelectOption<T extends string = string> {
  value: T;
  /** Plain text: shown in the trigger and matched by typeahead. */
  label: string;
  icon?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface SelectOptionGroup<T extends string = string> {
  label: string;
  options: SelectOption<T>[];
}

export interface SelectProps<T extends string = string> {
  options: Array<SelectOption<T> | SelectOptionGroup<T>>;
  value?: T | null;
  defaultValue?: T | null;
  onValueChange?: (value: T | null) => void;
  placeholder?: ReactNode;
  size?: FieldSize;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Accessible name when there is no visible label or surrounding FormField. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  contentClassName?: string;
}

function isGroup<T extends string>(entry: SelectOption<T> | SelectOptionGroup<T>): entry is SelectOptionGroup<T> {
  return "options" in entry;
}

/**
 * Data-driven select: flat or grouped options with icons, descriptions and
 * disabled entries, a placeholder and three sizes. Base UI Select supplies the
 * listbox semantics, typeahead and keyboard support; inside a FormField the
 * field label names the trigger.
 */
export function Select<T extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  size = "md",
  disabled,
  readOnly,
  required,
  name,
  id,
  open,
  defaultOpen,
  onOpenChange,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  className,
  contentClassName,
}: SelectProps<T>) {
  const items = useMemo(
    () =>
      options
        .flatMap((entry) => (isGroup(entry) ? entry.options : [entry]))
        .map((option) => ({
          value: option.value,
          label: option.icon ? (
            <>
              <span className="flex text-muted-foreground">{option.icon}</span>
              <span className="truncate">{option.label}</span>
            </>
          ) : (
            option.label
          ),
        })),
    [options],
  );
  const renderOption = (option: SelectOption<T>) => (
    <SelectItem key={option.value} value={option.value} label={option.label} icon={option.icon} description={option.description} disabled={option.disabled}>
      {option.label}
    </SelectItem>
  );
  return (
    <SelectRoot<T | null>
      items={items}
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      onValueChange={(next) => onValueChange?.(next)}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      name={name}
      id={id}
      {...(open !== undefined ? { open } : {})}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
    >
      <SelectTrigger size={size} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-describedby={ariaDescribedBy} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((entry, index) =>
          isGroup(entry) ? (
            <Fragment key={`group-${entry.label}`}>
              {index > 0 && <SelectSeparator />}
              <SelectGroup>
                <SelectGroupLabel>{entry.label}</SelectGroupLabel>
                {entry.options.map(renderOption)}
              </SelectGroup>
            </Fragment>
          ) : (
            renderOption(entry)
          ),
        )}
      </SelectContent>
    </SelectRoot>
  );
}
