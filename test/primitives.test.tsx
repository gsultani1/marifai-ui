// packages/ai-ui/test/primitives.test.tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../src/components/alert-dialog.js";
import { AspectRatio } from "../src/components/aspect-ratio.js";
import { Avatar, AvatarGroup } from "../src/components/avatar.js";
import { Badge } from "../src/components/badge.js";
import { Button, buttonClasses, ButtonGroup } from "../src/components/button.js";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../src/components/card.js";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "../src/components/context-menu.js";
import { CopyButton } from "../src/components/copy-button.js";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../src/components/dialog.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../src/components/dropdown-menu.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../src/components/hover-card.js";
import { Kbd, KbdGroup, shortcutKeys } from "../src/components/kbd.js";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarShortcut, MenubarTrigger } from "../src/components/menubar.js";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerClass } from "../src/components/navigation-menu.js";
import { Popover, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "../src/components/popover.js";
import { ScrollArea } from "../src/components/scroll-area.js";
import { Separator } from "../src/components/separator.js";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../src/components/sheet.js";
import { Spinner } from "../src/components/spinner.js";
import { Tooltip, TooltipProvider } from "../src/components/tooltip.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockApplePlatform() {
  vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
}

describe("Button", () => {
  it("renders a typed button with variant and size data and merges classes", () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" size="lg" className="w-full" onClick={onClick}>
        Save order
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save order" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.dataset.variant).toBe("secondary");
    expect(button.dataset.size).toBe("lg");
    expect(button.className).toContain("bg-secondary");
    expect(button.className).toContain("w-full");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stays focusable but busy and ignores clicks while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Place order
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Place order" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.querySelector('[data-slot="button-spinner"]')).toBeTruthy();
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("swaps an icon button's icon for the spinner and keeps its label", () => {
    render(
      <Button size="icon" aria-label="Refresh stock" loading>
        <svg data-testid="icon" />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Refresh stock" })).toBeTruthy();
    expect(screen.queryByTestId("icon")).toBeNull();
  });

  it("uses the native disabled attribute when disabled and not loading", () => {
    render(<Button disabled>Checkout</Button>);
    expect(screen.getByRole("button", { name: "Checkout" }).hasAttribute("disabled")).toBe(true);
  });

  it("renders through the render prop", () => {
    render(
      <Button render={<div />} nativeButton={false} variant="outline">
        Custom element
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Custom element" });
    expect(button.tagName).toBe("DIV");
    expect(button.getAttribute("tabindex")).toBe("0");
  });

  it("builds classes for links and other tags", () => {
    expect(buttonClasses()).toContain("bg-primary");
    expect(buttonClasses({ variant: "ghost", size: "sm" })).toContain("h-7");
    const link = buttonClasses({ variant: "link", size: "lg" });
    expect(link).toContain("underline-offset-4");
    expect(link).not.toContain("h-10");
    expect(buttonClasses({ variant: "outline", className: "ml-2" })).toContain("ml-2");
  });

  it("groups buttons with an orientation", () => {
    render(
      <ButtonGroup aria-label="Text alignment" orientation="vertical">
        <Button variant="outline">Left</Button>
        <Button variant="outline">Right</Button>
      </ButtonGroup>,
    );
    const group = screen.getByRole("group", { name: "Text alignment" });
    expect(group.dataset.orientation).toBe("vertical");
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });
});

describe("Badge", () => {
  it("renders solid and tone variants with an optional dot", () => {
    const { container } = render(
      <>
        <Badge>New</Badge>
        <Badge variant="success" dot>
          In stock
        </Badge>
        <Badge variant="destructive">Recalled</Badge>
      </>,
    );
    const [solid, tone, destructive] = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="badge"]'));
    expect(solid?.className).toContain("bg-primary");
    expect(tone?.dataset.variant).toBe("success");
    expect(tone?.className).toContain("text-foreground");
    expect(tone?.querySelector('[data-slot="badge-dot"]')?.className).toContain("bg-success");
    expect(destructive?.className).toContain("bg-destructive");
    expect(solid?.querySelector('[data-slot="badge-dot"]')).toBeNull();
  });

  it("offers a labeled remove button", () => {
    const onRemove = vi.fn();
    render(
      <Badge variant="outline" onRemove={onRemove} removeLabel="Remove Plumbing filter">
        Plumbing
      </Badge>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Plumbing filter" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("defaults the remove label", () => {
    render(<Badge onRemove={() => undefined}>Garden</Badge>);
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });
});

describe("Card", () => {
  it("composes header, action, content and footer with a chosen heading level", () => {
    render(
      <Card aria-label="Weekly sales">
        <CardHeader>
          <CardTitle as="h2">Weekly sales</CardTitle>
          <CardDescription>Monday to Sunday</CardDescription>
          <CardAction>
            <Button variant="ghost">View</Button>
          </CardAction>
        </CardHeader>
        <CardContent>$12,480</CardContent>
        <CardFooter>Updated 5 minutes ago</CardFooter>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Weekly sales" }).dataset.slot).toBe("card-title");
    expect(screen.getByText("Monday to Sunday").tagName).toBe("P");
    expect(screen.getByText("$12,480").dataset.slot).toBe("card-content");
    expect(screen.getByRole("button", { name: "View" }).parentElement?.dataset.slot).toBe("card-action");
  });

  it("uses h3 by default", () => {
    render(<CardTitle>Reorder list</CardTitle>);
    expect(screen.getByRole("heading", { level: 3, name: "Reorder list" })).toBeTruthy();
  });
});

describe("Avatar", () => {
  it("falls back to initials and announces the name with the status", () => {
    render(<Avatar name="Dana Whitten" src="https://example.com/dana.png" status="online" size="lg" />);
    const avatar = screen.getByRole("img", { name: "Dana Whitten, Online" });
    expect(avatar.dataset.size).toBe("lg");
    expect(avatar.textContent).toContain("DW");
    expect(avatar.querySelector('[data-slot="avatar-status"]')?.getAttribute("data-status")).toBe("online");
  });

  it("uses a custom status label, a fallback icon for a blank name and hides decorative avatars", () => {
    const { container } = render(
      <>
        <Avatar name="Marco Ruiz" status="busy" statusLabel="With a customer" />
        <Avatar name="   " />
        <Avatar name="Lee Park" decorative />
      </>,
    );
    expect(screen.getByRole("img", { name: "Marco Ruiz, With a customer" })).toBeTruthy();
    const blank = container.querySelectorAll('[data-slot="avatar"]')[1];
    expect(blank?.querySelector("svg")).toBeTruthy();
    const decorative = container.querySelectorAll('[data-slot="avatar"]')[2];
    expect(decorative?.getAttribute("aria-hidden")).toBe("true");
    expect(decorative?.getAttribute("role")).toBeNull();
  });

  it("collapses a group past max into a +N that names everyone hidden", () => {
    render(
      <AvatarGroup max={2} size="sm" label="Assigned to">
        <Avatar name="Dana Whitten" />
        <Avatar name="Marco Ruiz" />
        <Avatar name="Lee Park" />
        <Avatar name="Ana Lopez" />
      </AvatarGroup>,
    );
    const group = screen.getByRole("group", { name: "Assigned to" });
    expect(within(group).getAllByRole("img")).toHaveLength(3);
    const overflow = within(group).getByRole("img", { name: "2 more: Lee Park, Ana Lopez" });
    expect(overflow.textContent).toBe("+2");
    expect(within(group).getByRole("img", { name: "Dana Whitten" }).dataset.size).toBe("sm");
  });

  it("shows everyone without max and clamps max to at least one", () => {
    const { rerender } = render(
      <AvatarGroup>
        <Avatar name="Dana Whitten" />
        <Avatar name="Marco Ruiz" />
      </AvatarGroup>,
    );
    expect(screen.queryByText(/^\+/)).toBeNull();
    rerender(
      <AvatarGroup max={0}>
        <Avatar name="Dana Whitten" />
        <Avatar name="Marco Ruiz" />
      </AvatarGroup>,
    );
    expect(screen.getByRole("img", { name: "1 more: Marco Ruiz" })).toBeTruthy();
  });
});

describe("Kbd", () => {
  it("splits shortcuts into keys per platform", () => {
    expect(shortcutKeys("Mod+K")).toEqual([[{ label: "Ctrl", spoken: "Control" }, { label: "K", spoken: "K" }]]);
    expect(shortcutKeys("Mod+Shift+K", true)).toEqual([
      [
        { label: "⌘", spoken: "Command" },
        { label: "⇧", spoken: "Shift" },
        { label: "K", spoken: "K" },
      ],
    ]);
    expect(shortcutKeys("Alt+Up", true)).toEqual([[{ label: "⌥", spoken: "Option" }, { label: "↑", spoken: "Up Arrow" }]]);
    expect(shortcutKeys("g i").map((step) => step.map((key) => key.label))).toEqual([["G"], ["I"]]);
    expect(shortcutKeys("Ctrl+plus")).toEqual([[{ label: "Ctrl", spoken: "Control" }, { label: "+", spoken: "Plus" }]]);
    expect(shortcutKeys("Esc")).toEqual([[{ label: "Esc", spoken: "Escape" }]]);
    expect(shortcutKeys("space")).toEqual([[{ label: "Space", spoken: "Space" }]]);
    expect(shortcutKeys("")).toEqual([]);
  });

  it("renders separate key caps with a spoken equivalent", () => {
    const { container } = render(<KbdGroup keys="Mod+K" />);
    const caps = Array.from(container.querySelectorAll('[aria-hidden="true"] kbd')).map((cap) => cap.textContent);
    expect(caps).toEqual(["Ctrl", "K"]);
    expect(screen.getByText("Control K").className).toContain("sr-only");
  });

  it("shows the Apple symbol after mount and Ctrl during server rendering", () => {
    mockApplePlatform();
    expect(renderToString(<KbdGroup keys="Mod+K" />)).toContain("Ctrl");
    const { container } = render(<KbdGroup keys="Mod+K" />);
    expect(container.textContent).toContain("⌘");
    expect(screen.getByText("Command K")).toBeTruthy();
  });

  it("joins sequences with then and accepts Kbd children", () => {
    const { container, rerender } = render(<KbdGroup keys="g i" />);
    expect(screen.getByText("G, then I")).toBeTruthy();
    expect(container.textContent).toContain("then");
    rerender(
      <KbdGroup>
        <Kbd>Shift</Kbd>
        <Kbd>Tab</Kbd>
      </KbdGroup>,
    );
    expect(container.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2);
  });
});

describe("Spinner, Separator and AspectRatio", () => {
  it("announces a spinner with a hidden or visible label", () => {
    const { rerender } = render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Loading");
    expect(screen.getByText("Loading").className).toContain("sr-only");
    expect(status.querySelector("svg")?.getAttribute("class")).toContain("motion-reduce:animate-pulse");
    rerender(<Spinner label="Syncing inventory" showLabel size="lg" />);
    expect(screen.getByText("Syncing inventory").className).not.toContain("sr-only");
  });

  it("renders horizontal, vertical and labeled separators", () => {
    render(
      <>
        <Separator />
        <Separator orientation="vertical" />
        <Separator label="or" />
      </>,
    );
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(3);
    expect(separators[1]?.getAttribute("aria-orientation")).toBe("vertical");
    expect(screen.getByRole("separator", { name: "or" })).toBe(separators[2]);
  });

  it("keeps the ratio and falls back to square for invalid input", () => {
    const { container, rerender } = render(<AspectRatio ratio={16 / 9} />);
    const box = container.querySelector<HTMLElement>('[data-slot="aspect-ratio"]')!;
    expect(Number(box.style.aspectRatio)).toBeCloseTo(16 / 9);
    rerender(<AspectRatio ratio={-2} />);
    expect(box.style.aspectRatio).toBe("1");
    rerender(<AspectRatio ratio={Number.NaN} />);
    expect(box.style.aspectRatio).toBe("1");
  });
});

describe("CopyButton", () => {
  it("copies, swaps to a check and announces Copied, then resets", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...window.navigator, clipboard: { writeText } });
    const onCopy = vi.fn();
    render(<CopyButton value={() => "SKU HM-1601"} onCopy={onCopy} resetAfterMs={40} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    const button = await screen.findByRole("button", { name: "Copied" });
    expect(writeText).toHaveBeenCalledWith("SKU HM-1601");
    expect(onCopy).toHaveBeenCalledWith("SKU HM-1601");
    expect(button.dataset.status).toBe("copied");
    expect(button.querySelector('[aria-live="polite"]')?.textContent).toBe("Copied");
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy" }).dataset.status).toBe("idle"));
  });

  it("reports a refused write", async () => {
    const error = new Error("denied");
    vi.stubGlobal("navigator", { ...window.navigator, clipboard: { writeText: vi.fn().mockRejectedValue(error) } });
    const onCopy = vi.fn();
    const onCopyError = vi.fn();
    render(<CopyButton value="Order 1042" showLabel label="Copy order number" onCopy={onCopy} onCopyError={onCopyError} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy order number" }));
    const button = await screen.findByRole("button", { name: "Copy failed" });
    expect(button.textContent).toContain("Copy failed");
    expect(onCopyError).toHaveBeenCalledWith(error);
    expect(onCopy).not.toHaveBeenCalled();
  });
});

describe("Dialog", () => {
  it("opens from a trigger with a title, description and scrolling body, and closes with the X", async () => {
    render(
      <Dialog>
        <DialogTrigger render={<Button />}>New product</DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add product</DialogTitle>
            <DialogDescription>It appears in the catalog right away.</DialogDescription>
          </DialogHeader>
          <DialogBody label="Product details">
            <label>
              Name <input />
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "New product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    expect(dialog.dataset.size).toBe("lg");
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("It appears in the catalog right away.").id);
    expect(within(dialog).getByRole("region", { name: "Product details" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("is controllable and closes with Escape", async () => {
    const onOpenChange = vi.fn();
    function Controlled() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog
          open={open}
          onOpenChange={(next) => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <DialogContent showCloseButton={false}>
            <DialogTitle>Delivery window</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    render(<Controlled />);
    const dialog = await screen.findByRole("dialog", { name: "Delivery window" });
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("AlertDialog", () => {
  it("focuses Cancel first, runs the action and closes", async () => {
    const onDelete = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>Delete supplier</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Orgill?</AlertDialogTitle>
            <AlertDialogDescription>Open purchase orders stay on file.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete supplier" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Orgill?" });
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" })));
    const action = within(dialog).getByRole("button", { name: "Delete" });
    expect(action.className).toContain("text-destructive");
    fireEvent.click(action);
    expect(onDelete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("closes from Cancel without running the action", async () => {
    const onAction = vi.fn();
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent size="sm">
          <AlertDialogTitle>Void sale?</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep sale</AlertDialogCancel>
            <AlertDialogAction onClick={onAction}>Void</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Keep sale" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("Sheet and Drawer", () => {
  it("slides a sheet in from the chosen side", async () => {
    render(
      <Sheet>
        <SheetTrigger render={<Button variant="outline" />}>Filters</SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Filter products</SheetTitle>
            <SheetDescription>Narrow the catalog.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = await screen.findByRole("dialog", { name: "Filter products" });
    expect(sheet.dataset.side).toBe("left");
    expect(sheet.dataset.slot).toBe("sheet-content");
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens a bottom drawer and closes it from the footer", async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer onOpenChange={onOpenChange}>
        <DrawerTrigger render={<Button />}>Scan item</DrawerTrigger>
        <DrawerContent showCloseButton={false}>
          <DrawerHeader>
            <DrawerTitle>Scanned item</DrawerTitle>
            <DrawerDescription>Claw hammer, 16 oz</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>Done</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan item" }));
    const drawer = await screen.findByRole("dialog", { name: "Scanned item" });
    expect(drawer.dataset.slot).toBe("drawer-content");
    expect(drawer.querySelector('[data-slot="drawer-handle"]')).toBeTruthy();
    expect(within(drawer).queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.click(within(drawer).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
  });
});

describe("Popover, Tooltip and HoverCard", () => {
  it("opens a titled popover with an arrow and closes from inside", async () => {
    render(
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>Stock details</PopoverTrigger>
        <PopoverContent arrow side="top" align="start">
          <PopoverTitle>Aisle 3, bin 14</PopoverTitle>
          <PopoverDescription>24 on hand, 6 on order.</PopoverDescription>
          <PopoverClose render={<Button size="sm" />}>Done</PopoverClose>
        </PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Stock details" });
    fireEvent.click(trigger);
    const popup = await screen.findByRole("dialog", { name: "Aisle 3, bin 14" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.querySelector('[data-slot="popover-arrow"]')).toBeTruthy();
    fireEvent.click(within(popup).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renders tooltip content for its trigger and respects open state", () => {
    const { rerender } = render(
      <TooltipProvider delay={0}>
        <Tooltip content="Print receipt" open>
          <Button size="icon" aria-label="Print receipt">
            <svg />
          </Button>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Print receipt" })).toBeTruthy();
    expect(document.querySelector('[data-slot="tooltip"]')?.textContent).toBe("Print receipt");
    rerender(
      <TooltipProvider delay={0}>
        <Tooltip content="Print receipt" open={false}>
          <Button size="icon" aria-label="Print receipt">
            <svg />
          </Button>
        </Tooltip>
      </TooltipProvider>,
    );
    return waitFor(() => expect(document.querySelector('[data-slot="tooltip"]')).toBeNull());
  });

  it("opens a tooltip on hover and reports open changes", async () => {
    const onOpenChange = vi.fn();
    render(
      <Tooltip content="Scan a barcode" delay={0} onOpenChange={onOpenChange}>
        <Button>Scan</Button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Scan" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseMove(trigger);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true));
    expect(await screen.findByText("Scan a barcode")).toBeTruthy();
  });

  it("shows a hover card for a link", async () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger href="https://example.com/suppliers/orgill">Orgill</HoverCardTrigger>
        <HoverCardContent arrow>
          <p>Ships Tuesdays and Fridays</p>
        </HoverCardContent>
      </HoverCard>,
    );
    expect(screen.getByRole("link", { name: "Orgill" }).getAttribute("href")).toBe("https://example.com/suppliers/orgill");
    expect(await screen.findByText("Ships Tuesdays and Fridays")).toBeTruthy();
    expect(document.querySelector('[data-slot="hover-card-arrow"]')).toBeTruthy();
  });
});

describe("DropdownMenu", () => {
  function OrderMenu({ onArchive, onDelete, onSort }: { onArchive: () => void; onDelete: () => void; onSort: (value: string) => void }) {
    const [showTax, setShowTax] = useState(true);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>Order actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Order 1042</DropdownMenuLabel>
            <DropdownMenuItem onClick={onArchive}>
              Archive
              <DropdownMenuShortcut keys="Mod+E" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuCheckboxItem checked={showTax} onCheckedChange={setShowTax}>
            Show tax
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup defaultValue="date" onValueChange={(value) => onSort(String(value))}>
            <DropdownMenuLabel inset>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="total">Total</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>CSV</DropdownMenuItem>
              <DropdownMenuItem>PDF</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it("runs an item, labels groups and formats shortcuts", async () => {
    const onArchive = vi.fn();
    render(<OrderMenu onArchive={onArchive} onDelete={() => undefined} onSort={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Order actions" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("group", { name: "Order 1042" })).toBeTruthy();
    expect(within(menu).getByRole("group", { name: "Sort by" })).toBeTruthy();
    expect(within(menu).getByText("Ctrl+E").tagName).toBe("KBD");
    expect(within(menu).getByRole("separator")).toBeTruthy();
    const destructive = within(menu).getByRole("menuitem", { name: "Delete" });
    expect(destructive.dataset.variant).toBe("destructive");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /^Archive/ }));
    expect(onArchive).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("toggles checkbox items in place and picks radio items", async () => {
    const onSort = vi.fn();
    render(<OrderMenu onArchive={() => undefined} onDelete={() => undefined} onSort={onSort} />);
    fireEvent.click(screen.getByRole("button", { name: "Order actions" }));
    const checkbox = await screen.findByRole("menuitemcheckbox", { name: "Show tax" });
    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(checkbox);
    expect(screen.getByRole("menuitemcheckbox", { name: "Show tax" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("menuitemradio", { name: "Date" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Total" }));
    expect(onSort).toHaveBeenCalledWith("total");
  });

  it("opens a submenu from the keyboard", async () => {
    render(<OrderMenu onArchive={() => undefined} onDelete={() => undefined} onSort={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Order actions" }));
    const subTrigger = await screen.findByRole("menuitem", { name: "Export" });
    expect(subTrigger.getAttribute("aria-haspopup")).toBe("menu");
    act(() => subTrigger.focus());
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });
    expect(await screen.findByRole("menuitem", { name: "CSV" })).toBeTruthy();
    expect(screen.getAllByRole("menu")).toHaveLength(2);
  });

  it("shows plain shortcut text and the Apple form of a key shortcut", () => {
    mockApplePlatform();
    render(
      <>
        <DropdownMenuShortcut>F2</DropdownMenuShortcut>
        <DropdownMenuShortcut keys="Mod+Shift+S" />
      </>,
    );
    expect(screen.getByText("F2")).toBeTruthy();
    expect(screen.getByText("⌘⇧S")).toBeTruthy();
  });
});

describe("ContextMenu", () => {
  it("opens at the pointer on right click and runs an item", async () => {
    const onPaste = vi.fn();
    render(
      <ContextMenu>
        <ContextMenuTrigger>Receiving dock</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onPaste}>Paste delivery</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">Clear dock</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText("Receiving dock"), { clientX: 40, clientY: 40 });
    const item = await screen.findByRole("menuitem", { name: "Paste delivery" });
    expect(item.dataset.slot).toBe("context-menu-item");
    expect(screen.getByRole("menu").dataset.slot).toBe("context-menu-content");
    fireEvent.click(item);
    expect(onPaste).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});

describe("Menubar", () => {
  it("is a labeled menubar whose menus open and move with arrow keys", async () => {
    const onNew = vi.fn();
    render(
      <Menubar aria-label="Editor">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onNew}>
              New price sheet <MenubarShortcut keys="Mod+N" />
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Undo</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );
    const bar = screen.getByRole("menubar", { name: "Editor" });
    const file = within(bar).getByRole("menuitem", { name: "File" });
    const edit = within(bar).getByRole("menuitem", { name: "Edit" });
    act(() => file.focus());
    fireEvent.keyDown(file, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(edit));
    fireEvent.click(file);
    fireEvent.click(await screen.findByRole("menuitem", { name: /^New price sheet/ }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe("NavigationMenu", () => {
  it("renders links through renderLink, marks the active page and opens panels", async () => {
    const renderLink = vi.fn(({ href, children, ...props }: { href: string; children: ReactNode; className?: string }) => (
      <a href={`/app${href}`} data-router="true" {...props}>
        {children}
      </a>
    ));
    render(
      <NavigationMenu aria-label="Store" renderLink={renderLink}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Departments</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/departments/plumbing">
                Plumbing
                <p>Pipe, fittings and fixtures</p>
              </NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="/deals" active className={navigationMenuTriggerClass}>
              Weekly deals
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );
    expect(screen.getByRole("navigation", { name: "Store" })).toBeTruthy();
    const deals = screen.getByRole("link", { name: "Weekly deals" });
    expect(deals.getAttribute("aria-current")).toBe("page");
    expect(deals.getAttribute("href")).toBe("/app/deals");
    expect(deals.dataset.router).toBe("true");
    expect(renderLink).toHaveBeenCalledWith(expect.objectContaining({ href: "/deals" }));
    const trigger = screen.getByRole("button", { name: "Departments" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("true"));
    const plumbing = await screen.findByRole("link", { name: /^Plumbing/ });
    expect(plumbing.getAttribute("href")).toBe("/app/departments/plumbing");
    expect(plumbing.getAttribute("aria-current")).toBeNull();
  });
});

describe("edge cases", () => {
  it("renders a menu label outside a group as a plain row", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Register</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Register 2</DropdownMenuLabel>
          <DropdownMenuItem>Open drawer</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("group")).toBeNull();
    expect(within(menu).getByText("Register 2").dataset.slot).toBe("dropdown-menu-label");
  });

  it("counts hidden children that have no name", () => {
    render(
      <AvatarGroup max={1}>
        <Avatar name="Dana Whitten" />
        <span>Guest</span>
      </AvatarGroup>,
    );
    expect(screen.getByRole("img", { name: "1 more" }).textContent).toBe("+1");
  });

  it("closes a popover with Escape and returns focus to the trigger", async () => {
    render(
      <Popover>
        <PopoverTrigger>Delivery notes</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Delivery notes</PopoverTitle>
          <button type="button">Edit notes</button>
        </PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Delivery notes" });
    fireEvent.click(trigger);
    const popup = await screen.findByRole("dialog", { name: "Delivery notes" });
    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps a disabled tooltip closed", () => {
    render(
      <Tooltip content="Unavailable offline" disabled defaultOpen>
        <Button>Sync</Button>
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Sync" })).toBeTruthy();
    expect(document.querySelector('[data-slot="tooltip"]')).toBeNull();
  });

  it("fills the screen with a full-size dialog and accepts backdrop classes", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent size="full" backdropClassName="backdrop-blur-sm" closeLabel="Close price list">
          <DialogTitle>Price list</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Price list" });
    expect(dialog.className).toContain("w-[calc(100vw-2rem)]");
    expect(document.querySelector('[data-slot="dialog-backdrop"]')?.className).toContain("backdrop-blur-sm");
    expect(within(dialog).getByRole("button", { name: "Close price list" })).toBeTruthy();
  });

  it("defaults a sheet to the right edge", async () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Cart</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect((await screen.findByRole("dialog", { name: "Cart" })).dataset.side).toBe("right");
  });
});

describe("ScrollArea", () => {
  it("names the scrolling region when labeled", () => {
    const { rerender, container } = render(
      <ScrollArea label="Order history" className="h-40">
        <p>Order 1042 shipped</p>
      </ScrollArea>,
    );
    const region = screen.getByRole("region", { name: "Order history" });
    expect(region.dataset.slot).toBe("scroll-area-viewport");
    expect(region.textContent).toBe("Order 1042 shipped");
    rerender(
      <ScrollArea orientation="horizontal">
        <p>Order 1042 shipped</p>
      </ScrollArea>,
    );
    expect(screen.queryByRole("region")).toBeNull();
    expect(container.querySelector('[data-slot="scroll-area"]')?.className).toContain("overflow-hidden");
  });
});
