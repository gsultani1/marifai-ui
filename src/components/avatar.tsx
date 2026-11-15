// packages/ai-ui/src/components/avatar.tsx
"use client";

import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { UserIcon } from "lucide-react";
import { Children, type ComponentProps, createContext, isValidElement, type ReactNode, use } from "react";

import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";
import type { WithClassName } from "../lib/types.js";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "away" | "busy" | "offline";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "size-6 text-[0.625rem] [&_svg]:size-3",
  sm: "size-8 text-xs [&_svg]:size-4",
  md: "size-10 text-sm [&_svg]:size-5",
  lg: "size-12 text-base [&_svg]:size-6",
  xl: "size-16 text-lg [&_svg]:size-8",
};

const STATUS_SIZE: Record<AvatarSize, string> = {
  xs: "size-2",
  sm: "size-2.5",
  md: "size-3",
  lg: "size-3.5",
  xl: "size-4",
};

const STATUS_COLORS: Record<AvatarStatus, string> = {
  online: "bg-success",
  away: "bg-warning",
  busy: "bg-destructive",
  offline: "bg-muted-foreground",
};

const STATUS_LABELS: Record<AvatarStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

const OVERLAP: Record<AvatarSize, string> = {
  xs: "-space-x-1",
  sm: "-space-x-1.5",
  md: "-space-x-2",
  lg: "-space-x-2.5",
  xl: "-space-x-3",
};

const AvatarGroupContext = createContext<{ size: AvatarSize } | null>(null);

export interface AvatarProps extends WithClassName<Omit<BaseAvatar.Root.Props, "children">> {
  /** Person or team name: the accessible name and the source of the initials fallback. */
  name: string;
  src?: string | undefined;
  /** Replaces the initials, for example an icon for a shared mailbox. */
  fallback?: ReactNode;
  /** Defaults to "md", or to the size of the surrounding AvatarGroup. */
  size?: AvatarSize;
  shape?: "circle" | "square";
  status?: AvatarStatus;
  /** Spoken status; defaults to "Online", "Away", "Busy" or "Offline". */
  statusLabel?: string;
  /** Hides the avatar from assistive technology when the name is already written next to it. */
  decorative?: boolean;
}

/**
 * Picture of a person on Base UI Avatar: the image when it loads, otherwise
 * initials from `name` (or `fallback`), with an optional status dot. The name
 * and status are announced as one image label.
 */
export function Avatar({ name, src, fallback, size: sizeProp, shape = "circle", status, statusLabel, decorative = false, className, ...props }: AvatarProps) {
  const group = use(AvatarGroupContext);
  const size = sizeProp ?? group?.size ?? "md";
  const spokenStatus = status ? (statusLabel ?? STATUS_LABELS[status]) : undefined;
  const label = spokenStatus ? `${name}, ${spokenStatus}` : name;
  const letters = initials(name);
  return (
    <BaseAvatar.Root
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : label}
      data-slot="avatar"
      data-size={size}
      className={cn("relative inline-flex shrink-0 align-middle select-none", SIZE_CLASSES[size], className)}
      {...props}
    >
      <span
        className={cn(
          "flex size-full items-center justify-center overflow-hidden bg-muted font-medium text-muted-foreground",
          shape === "circle" ? "rounded-full" : "rounded-md",
          group && "ring-2 ring-background",
        )}
      >
        {src && <BaseAvatar.Image src={src} alt="" className="size-full object-cover" />}
        <BaseAvatar.Fallback aria-hidden="true" className="flex size-full items-center justify-center">
          {fallback ?? (letters || <UserIcon aria-hidden="true" />)}
        </BaseAvatar.Fallback>
      </span>
      {status && (
        <span
          aria-hidden="true"
          data-slot="avatar-status"
          data-status={status}
          className={cn("absolute right-0 bottom-0 block rounded-full ring-2 ring-background", STATUS_SIZE[size], STATUS_COLORS[status])}
        />
      )}
    </BaseAvatar.Root>
  );
}

export interface AvatarGroupProps extends ComponentProps<"div"> {
  /** Avatars shown before the rest collapse into "+N", which names everyone hidden. */
  max?: number;
  /** Size for every avatar in the group. */
  size?: AvatarSize;
  /** Accessible name for the group, such as "Assigned to". */
  label?: string;
}

/**
 * Overlapping row of Avatar children. Past `max`, the rest collapse into a
 * "+N" chip whose label lists the hidden names, so nobody is lost to screen
 * reader users.
 */
export function AvatarGroup({ max, size = "md", label, className, children, ...props }: AvatarGroupProps) {
  const items = Children.toArray(children).filter(isValidElement);
  const limit = max === undefined ? items.length : Math.max(1, Math.floor(max));
  const shown = items.slice(0, limit);
  const hidden = items.slice(limit);
  const hiddenNames = hidden.flatMap((item) => {
    const name = (item.props as Partial<AvatarProps>).name;
    return typeof name === "string" && name ? [name] : [];
  });
  const overflowLabel = hiddenNames.length > 0 ? `${hidden.length} more: ${hiddenNames.join(", ")}` : `${hidden.length} more`;
  return (
    <AvatarGroupContext value={{ size }}>
      <div role="group" aria-label={label} data-slot="avatar-group" className={cn("flex items-center", OVERLAP[size], className)} {...props}>
        {shown}
        {hidden.length > 0 && (
          <span
            role="img"
            aria-label={overflowLabel}
            title={hiddenNames.join(", ")}
            data-slot="avatar-group-overflow"
            className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground ring-2 ring-background select-none", SIZE_CLASSES[size])}
          >
            +{hidden.length}
          </span>
        )}
      </div>
    </AvatarGroupContext>
  );
}
