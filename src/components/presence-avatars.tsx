// packages/ai-ui/src/components/presence-avatars.tsx
import { Avatar } from "@base-ui/react/avatar";
import type { ComponentProps } from "react";

import { cn } from "../lib/cn.js";
import { initials } from "../lib/format.js";

export interface PresenceUser {
  id: string;
  name: string;
  avatarUrl?: string | undefined;
  /** Shown after the name in the accessible label, e.g. "editing" or "viewing". */
  activity?: string | undefined;
}

export interface PresenceAvatarsProps extends Omit<ComponentProps<"div">, "children"> {
  users: PresenceUser[];
  /** Avatars shown before collapsing the rest into "+N". */
  max?: number;
  /** Label for the group, e.g. "People in this document". */
  label?: string;
}

const avatarClass =
  "inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted text-[0.6875rem] font-medium text-muted-foreground select-none";

/** Stacked avatars of the people (or agents) currently in a document or thread. */
export function PresenceAvatars({ users, max = 3, label = "People here", className, ...props }: PresenceAvatarsProps) {
  if (users.length === 0) return null;
  const shown = users.slice(0, max);
  const hidden = users.slice(max);
  const describe = (user: PresenceUser) => (user.activity ? `${user.name}, ${user.activity}` : user.name);

  return (
    <div role="group" aria-label={label} data-slot="presence-avatars" className={cn("flex items-center -space-x-2", className)} {...props}>
      {shown.map((user) => (
        <Avatar.Root key={user.id} role="img" aria-label={describe(user)} title={describe(user)} className={avatarClass}>
          {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt="" className="size-full object-cover" />}
          <Avatar.Fallback aria-hidden="true">{initials(user.name)}</Avatar.Fallback>
        </Avatar.Root>
      ))}
      {hidden.length > 0 && (
        <span role="img" aria-label={`${hidden.length} more: ${hidden.map(describe).join(", ")}`} title={hidden.map(describe).join(", ")} className={avatarClass}>
          +{hidden.length}
        </span>
      )}
    </div>
  );
}
