# @sultanico/ai-ui

Source-owned React 19 components for AI chat and agent interfaces (messages, streaming markdown, tool calls with approval, reasoning, citations, artifacts, a split-view canvas, editors, diffs, tables, charts, file previews, sandboxed UI previews and a whiteboard) and a general-purpose UI kit: buttons, dialogs, sheets, menus, form controls, tabs, tables, carousels, trees, virtual lists, QR codes, office editors, scheduling and website sections. Styling is Tailwind CSS v4 utilities over CSS variables, interactive primitives come from Base UI, and every component is plain TypeScript you can read, copy and change.

[Component documentation and previews](https://ui.marifai.com/) · [npm package](https://www.npmjs.com/package/@sultanico/ai-ui)

## Install

In a React 19 app configured with Tailwind CSS 4:

```sh
npm install @sultanico/ai-ui
```

You can also install from an npm tarball or a local checkout of the package.

As source, shadcn style: copy `src/` into your app (for example `src/components/ai-ui/`) and install the runtime dependencies listed under `dependencies` in `package.json`. All internal imports are relative, so the folder works wherever it lands. Import the preset from its new location. The package also exposes `@sultanico/ai-ui/components/<name>` and `@sultanico/ai-ui/hooks/<name>` for single-component imports, and `@sultanico/ai-ui/source` for bundlers that compile TypeScript from dependencies.

## Tailwind setup

```css
/* app.css */
@import "tailwindcss";
@import "@sultanico/ai-ui/preset.css";
```

The preset registers the package sources with `@source`, maps the theme tokens into Tailwind (`bg-background`, `text-muted-foreground`, `text-code-keyword`, `bg-chart-1` and so on) and ships light and dark defaults. The defaults live in `@layer base`, so any unlayered `:root` or `.dark` block in your app wins, including an existing shadcn/ui theme, which uses the same token names. Dark mode follows a `.dark` class or `data-theme="dark"` on any ancestor. `@sultanico/ai-ui/styles.css` is kept as an alias of the preset for apps that imported the earlier stylesheet.

Tokens: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent` (each with a `-foreground` pair), `--destructive`, `--success`, `--warning`, `--border`, `--input`, `--ring`, the syntax colors `--code-background`, `--code-foreground`, `--code-comment`, `--code-keyword`, `--code-string`, `--code-number`, `--code-function`, `--code-type`, `--code-property`, `--code-variable`, `--code-tag`, `--code-meta`, `--code-punctuation`, `--code-inserted`, `--code-deleted`, and the categorical chart slots `--chart-1` to `--chart-8`. The chart slots are a colorblind-validated order; keep the order if you change the hues.

## Chat

```tsx
import {
  Conversation, ConversationContent, ConversationScrollButton, useConversation,
  Message, MessageAvatar, MessageBody, MessageBubble, MessageContent,
  MessageActions, MessageCopyAction, MessageRegenerateAction, MessageFeedbackActions, BranchNavigator,
  PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputTools, PromptInputAttachButton, PromptInputSubmit,
  Attachments, Attachment, ModelSelector,
} from "@sultanico/ai-ui";

export function Chat(props: ChatProps) {
  return (
    <Conversation className="h-dvh">
      <Thread {...props} />
    </Conversation>
  );
}

function Thread({ messages, status, send, stop, files, addFiles, removeFile, model, setModel }: ChatProps) {
  const { scrollToBottom } = useConversation();
  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ConversationContent aria-busy={status === "streaming"} contentClassName="mx-auto w-full max-w-3xl">
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageAvatar name={message.role === "user" ? "You" : "Assistant"} />
              <MessageBody>
                {message.role === "user" ? (
                  <MessageBubble>{message.text}</MessageBubble>
                ) : (
                  <MessageContent streaming={message.streaming}>{message.text}</MessageContent>
                )}
                <div className="flex items-center gap-1">
                  <BranchNavigator index={message.branch} count={message.branches} onIndexChange={message.showBranch} />
                  <MessageActions>
                    <MessageCopyAction text={message.text} />
                    <MessageRegenerateAction onClick={() => message.regenerate()} />
                    <MessageFeedbackActions value={message.feedback} onValueChange={message.rate} />
                  </MessageActions>
                </div>
              </MessageBody>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </div>

      <PromptInput
        className="mx-auto mb-4 max-w-3xl"
        status={status}
        onSubmit={async (text) => {
          scrollToBottom("instant");
          await send(text);
        }}
        onStop={stop}
        onAttach={addFiles}
        allowEmpty={files.length > 0}
      >
        <Attachments className="px-3 pt-3">
          {files.map((file) => <Attachment key={file.name} name={file.name} file={file} onRemove={() => removeFile(file)} />)}
        </Attachments>
        <PromptInputTextarea placeholder="Ask anything" />
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputAttachButton />
            <ModelSelector models={[{ id: "core", name: "Marifai Core", provider: "Marifai" }]} value={model} onValueChange={setModel} />
          </PromptInputTools>
          <PromptInputSubmit />
        </PromptInputFooter>
      </PromptInput>
    </>
  );
}
```

`Conversation` follows streaming output and stops following the moment the user scrolls up (wheel, touch, keyboard including Shift+Space, or scrollbar); the scroll button brings it back, and rendering the prompt inside `Conversation` lets `scrollToBottom` bring a newly sent message into view. Pass `initialFollow={false}` to keep a restored scroll position. `MessageContent` memoizes completed markdown blocks and, while `streaming` is true, closes half-written emphasis, code spans and links in the trailing paragraph so partial tokens never flash as raw syntax. Markdown images render as `[Image: alt]` unless you pass `allowImages`, because a remote image URL in model output can track the reader or carry conversation data out in its query string; links to other sites open in a new tab and say so to screen readers, and wide tables scroll in a focusable region. `Source`, `InlineCitation` and `Attachment` link only http(s) URLs without embedded credentials (`safeUrl` is exported for your own links). Fenced code renders through `CodeBlock` (highlight.js common grammars, copy button). Register extra grammars once at startup:

```ts
import powershell from "highlight.js/lib/languages/powershell";
import { codeHighlighter } from "@sultanico/ai-ui";

codeHighlighter.register({ powershell });
```

`PromptInput` submits on Enter, keeps Shift+Enter and IME composition for editing, and accepts pasted and dropped files through `onAttach`. In uncontrolled mode it clears after `onSubmit` returns or its promise resolves; while that promise is pending a second submit is ignored, and a throw or rejection keeps the draft and shows "Unable to send. Your draft has been kept." (`errorMessage`, `onSubmitError`). `status` takes the same values as the Vercel AI SDK `useChat` hook. Copy actions report a failed clipboard write as "Copy failed" and through `onCopyError`.

## Tools, reasoning and sources

```tsx
<ToolCall name="write_spreadsheet" status={part.status}>
  <ToolCallTrigger />
  <ToolCallContent>
    <ToolCallApproval onApprove={approve} onDeny={deny}>Writes 6 rows to Q3 Sales.</ToolCallApproval>
    <ToolCallInput input={part.input} />
    <ToolCallResult result={part.output} error={part.errorText} />
  </ToolCallContent>
</ToolCall>

<Reasoning streaming={part.streaming}>
  <ReasoningTrigger />
  <ReasoningContent>{part.text}</ReasoningContent>
</Reasoning>

<p>Margins held at 38%<InlineCitation index={1} source={{ url, title }} />.</p>
<Sources>
  <SourcesTrigger count={sources.length} />
  <SourcesContent>
    {sources.map((source, i) => <Source key={source.url} href={source.url} title={source.title} index={i + 1} />)}
  </SourcesContent>
</Sources>
```

Tool statuses are `pending`, `running`, `awaiting-approval`, `completed`, `error` and `denied`; AI SDK tool part states map one to one (see the type's doc comment). A tool call awaiting approval opens itself, and `ToolCallApproval` renders only in that state. `onApprove` and `onDeny` may return promises: both buttons stay inert until the promise settles, a rejection shows a retryable error, and focus returns to the tool call when the controls go away. Tool input and results render BigInt values and cycles instead of throwing. `Reasoning` opens while streaming, measures the thinking time, and closes shortly after unless the user toggled it.

## Artifacts and canvas

```tsx
<Canvas open={artifact !== null} mode={mode} onModeChange={setMode}>
  <CanvasMain>{chat}</CanvasMain>
  <CanvasResizeHandle />
  <CanvasPanel>
    <Artifact onOpenChange={() => setArtifact(null)}>
      <ArtifactHeader>
        <ArtifactTitle>{artifact.title}</ArtifactTitle>
        <ArtifactActions>
          <ArtifactModeToggle />
          <ArtifactClose />
        </ArtifactActions>
      </ArtifactHeader>
      <ArtifactContent>
        <ArtifactPreview kind="markdown" content={artifact.body} streaming={artifact.streaming} />
      </ArtifactContent>
    </Artifact>
  </CanvasPanel>
</Canvas>
```

`Canvas` is a resizable split view (drag or arrow keys on the separator; below the md breakpoint the panel overlays the chat). `Canvas` takes `mode="split" | "fullscreen"` and `Artifact` takes `mode="panel" | "fullscreen"`. Full screen turns the same native `<dialog>` element modal, so editors, iframes and scroll positions keep their state; Escape returns to the inline mode. `ArtifactPreview` renders `kind` `markdown`, `code`, `html` (sandboxed) or `custom` children.

## Editors

```tsx
<CodeEditor value={code} onValueChange={setCode} language="tsx" className="h-96" />
<DocumentEditor value={markdown} onValueChange={setMarkdown} defaultLayout="split" className="h-[70vh]" />
```

Both are CodeMirror 6 and lazy: the main bundle holds only a small wrapper, and CodeMirror plus the language grammar download on first render (a read-only rendering of the value shows meanwhile). If the chunk fails to load, the text stays visible read-only with a "Retry editor" button and `onLoadError` fires. Call `preloadCodeEditor()` or `preloadDocumentEditor()` on hover to fetch early, and pass a `ref` for a handle with `focus()`, `getView()` and, on `DocumentEditor`, `wrapSelection()`. `CodeEditor` supports every language in `@codemirror/language-data` by name, alias or file extension; Tab indents, and Escape then Tab moves focus out. `DocumentEditor` edits markdown with a formatting toolbar (Mod-B, Mod-I, Mod-K) and an Edit, Split or Preview layout rendered by `MessageContent`.

## Diffs, data, charts and files

```tsx
<DiffView oldValue={before} newValue={after} mode="split" contextLines={3} />

<DataTable columns={[{ key: "name", header: "Name", editable: true }, { key: "qty", header: "Qty", type: "number", editable: true }]}
  rows={rows} onRowsChange={setRows} />

<Chart type="bar" title="Monthly sales" data={sales} categoryKey="month"
  series={[{ key: "tools", label: "Tools" }, { key: "garden", label: "Garden" }]} />

<FileViewer file={upload} className="h-96" />
```

`DiffView` highlights changed words inside modified lines, collapses long unchanged runs, marks a missing final newline, and refuses inputs above `maxLength` (200,000 characters) or diffs that exceed a one-second budget. `DataTable` sorts by header and takes optional `searchable` and `pageSize`; with `onRowsChange` it becomes an ARIA grid with arrow-key navigation and Enter or F2 to edit, keeps the editor open with a message for an invalid number, and when `onRowsChange` returns a promise blocks new edits until it settles and reports a rejection. `Chart` draws bar, line and pie (donut) charts as plain SVG with a legend, a hover and keyboard tooltip, and a table view toggle; above 2,000 points it opens as a paged table. `FileViewer` previews images, PDF, audio, video, CSV and TSV (as a searchable, paged table), JSON, markdown and source files, with a download fallback. It reads at most `maxBytes` (10 MB) of text and shows a blob as a PDF only when its bytes carry the PDF signature, so an HTML file named `.pdf` never renders in your origin.

## Interactive previews and whiteboard

```tsx
<InteractivePreview title="Generated page" html={generatedHtml} allowScripts onRuntimeError={report} />
<InteractivePreview title="Generated component" {...createReactPreview(componentSource, { tailwind: true })} />

<Whiteboard elements={elements} onElementsChange={setElements} className="h-[480px]" />
```

`InteractivePreview` runs content in an iframe sandboxed without `allow-same-origin`, so generated code cannot touch the host page, and forwards uncaught errors to `onRuntimeError`. An `html` document also gets a Content Security Policy injected ahead of its own markup that blocks every network request, image and font outside `allowedOrigins`, so generated pages cannot phone home. Scripts are off by default, so generated HTML renders inert until you pass `allowScripts`; the preview builders return `allowScripts: true` for documents that need it, so spreading their result opts in. `script` adds a precompiled module after the document that loads as a UTF-8 data URL, so raw strings such as `"</script>"` reach the code unchanged. `buildSandboxedDocument` and `openSandboxedWindow` follow the same default. `sandbox` takes extra tokens as a typed list that cannot include `allow-same-origin` or top navigation. `createReactPreview` compiles a default-exported JSX or TSX component inside the frame with Babel standalone and an import map (React from esm.sh) and returns `{ html, allowedOrigins, allowScripts }` for exactly those CDNs; every URL is overridable. `Whiteboard` keeps rectangles, ellipses, text and connectors as plain data: drag to pan, Ctrl or Cmd + wheel to zoom, V H R O T C for tools, arrows to nudge, Alt + arrows to resize, Enter to edit text, Delete to remove. With the connector tool, drag between shapes or click (or press Enter on) the source and then the target.

## Buttons, overlays and menus

```tsx
<Button onClick={save}>Save order</Button>
<Button variant="outline" size="sm" loading={syncing} onClick={sync}>Sync inventory</Button>
<ButtonGroup aria-label="Report range"><Button variant="outline">Day</Button><Button variant="outline">Week</Button></ButtonGroup>
<CopyButton value={sku} label={`Copy SKU ${sku}`} />
<a href="/orders" className={buttonClasses({ variant: "outline" })}>All orders</a>

<Badge variant="warning" dot>Low stock</Badge>
<Card><CardHeader><CardTitle as="h2">Weekly sales</CardTitle><CardDescription>All registers</CardDescription><CardAction><Button variant="ghost">View</Button></CardAction></CardHeader><CardContent>$12,480</CardContent></Card>
<AvatarGroup max={3} label="Assigned to">{staff.map((person) => <Avatar key={person.id} name={person.name} src={person.photo} status={person.status} />)}</AvatarGroup>
<KbdGroup keys="Mod+K" />
<Spinner label="Syncing inventory" showLabel />
<Separator label="or" />

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger render={<Button />}>Add product</DialogTrigger>
  <DialogContent size="lg">
    <DialogHeader><DialogTitle>Add product</DialogTitle><DialogDescription>It reaches the registers right away.</DialogDescription></DialogHeader>
    <DialogBody label="Product details">{fields}</DialogBody>
    <DialogFooter><DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button type="submit">Save</Button></DialogFooter>
  </DialogContent>
</Dialog>
<Sheet><SheetTrigger render={<Button variant="outline" />}>Filters</SheetTrigger><SheetContent side="right"><SheetHeader><SheetTitle>Filter products</SheetTitle></SheetHeader><SheetBody label="Filters">{filters}</SheetBody></SheetContent></Sheet>
<Popover><PopoverTrigger render={<Button variant="outline" />}>Stock details</PopoverTrigger><PopoverContent arrow side="top"><PopoverTitle>Aisle 3, bin 14</PopoverTitle><PopoverDescription>24 on hand.</PopoverDescription></PopoverContent></Popover>
<Tooltip content="Print receipt"><Button size="icon" aria-label="Print receipt"><PrinterIcon /></Button></Tooltip>

<DropdownMenu>
  <DropdownMenuTrigger render={<Button variant="outline" />}>Order actions</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={open}>Open<DropdownMenuShortcut keys="Mod+O" /></DropdownMenuItem>
    <DropdownMenuCheckboxItem checked={showTax} onCheckedChange={setShowTax}>Show tax</DropdownMenuCheckboxItem>
    <DropdownMenuSub><DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem>CSV</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
    <DropdownMenuItem variant="destructive" onClick={remove}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
<NavigationMenu aria-label="Store sections" renderLink={({ href, ...props }) => <Link to={href} {...props} />} indicator>{items}</NavigationMenu>
<ScrollArea label="Recent orders" className="h-56">{orders}</ScrollArea>
```

`Button` builds on Base UI Button with default, secondary, outline, ghost, destructive and link variants and sm, md, lg and square icon sizes (icon buttons need an `aria-label`). `loading` shows a spinner, sets aria-busy and aria-disabled and ignores clicks while the button keeps focus, `render` swaps the element (`<DialogTrigger render={<Button />}>`), and `buttonClasses` gives links the same look, since Base UI Button is for button semantics only. `ButtonGroup` joins buttons into one control with shared borders, horizontal or vertical. `CopyButton` copies a string, or a function read at click time, swaps to a check mark and announces "Copied" through a polite live region; a refused write shows an alert icon, announces "Copy failed" and calls `onCopyError`.

`Badge` has default, secondary, outline and destructive styles plus the shared tones (neutral, info, success, warning and danger), keeps text at full contrast with color carried by the tint and an optional `dot`, and `onRemove` adds a separately labelled remove button for filter chips. `Card` composes `CardHeader`, `CardTitle` (an h3 by default, any level with `as`), `CardDescription`, `CardAction` (pinned top right), `CardContent` and `CardFooter`, which stays at the bottom of a stretched card. `Avatar` builds on Base UI Avatar: it shows the image once it loads and otherwise initials from `name`, in five sizes, round or square, with an optional status dot; name and status are announced together ("Dana Whitten, Online") and `decorative` hides avatars whose name is written beside them. `AvatarGroup` overlaps its children and collapses anything past `max` into a "+N" chip whose label names everyone hidden. `KbdGroup` prints a shortcut such as "Mod+Shift+K" or the sequence "G I" as key caps with the same parser as `useShortcuts`; Mod becomes ⌘ after mount on Apple platforms, stays Ctrl during server rendering, and a screen-reader-only copy reads "Command Shift K" (`shortcutKeys` returns both forms, and `Kbd` is a single key). `Spinner` has a status role and a label that is hidden unless `showLabel` is set, and pulses instead of spinning under reduced motion. `Separator` is horizontal or vertical with an optional centered label that also names it, and `AspectRatio` keeps a width-to-height ratio.

`Dialog` builds on Base UI Dialog: focus is trapped inside, Escape and an outside press close it, focus returns to the trigger and the title and description label it. `DialogContent` portals into the nearest portal container in sm, md, lg, xl and full sizes with a relabelable X button, `DialogBody` scrolls when the dialog reaches the screen height and joins the tab order only while it overflows, and the footer stacks with the primary action on top on phones. `AlertDialog` is the composable counterpart of `ConfirmDialog` on Base UI Alert Dialog (role alertdialog, no outside dismissal): focus starts on the first button, so `AlertDialogCancel` goes first, and `AlertDialogAction` runs `onClick` and closes. `Sheet` slides in from any side with the same focus handling, a scrolling `SheetBody`, a pinned footer and safe-area padding on bottom sheets. `Drawer` is a bottom sheet on Base UI Drawer that dismisses with a swipe down, Escape or the backdrop and supports `snapPoints`. `Popover` is named by `PopoverTitle`, positioned with `side`, `align` and `sideOffset`, flips to stay on screen, can draw an arrow, and returns focus to its trigger. `Tooltip` wraps one trigger with `content`, `side` and `delay`, opens on hover and keyboard focus, closes with Escape, and stays open while the pointer moves onto it; `TooltipProvider` shares delays so the next tooltip opens instantly, and icon triggers keep their `aria-label` because tooltips are visual only. `HoverCard` builds on Base UI Preview Card to preview a link on hover or focus.

`DropdownMenu` is the composable counterpart of `ActionMenu` on Base UI Menu: arrow keys, Home, End and typeahead move, Escape returns focus, submenus open with Arrow Right or hover and close with Arrow Left, items can be destructive or inset, checkbox items are menuitemcheckbox, radio groups are menuitemradio with `value` and `onValueChange`, a label inside a group names it, and `DropdownMenuShortcut` prints `keys` per platform. `ContextMenu` opens at the pointer on right click, on a long press, and with the context-menu key or Shift+F10 on a focused element in the trigger. `Menubar` lays out File, Edit and View menus where arrow keys move between menus and into an open one. All three share the same item parts. `NavigationMenu` builds on Base UI Navigation Menu: triggers open rich panels in one shared animated viewport on hover or click, arrow keys move between items, Escape closes, `indicator` adds an arrow at the open trigger, and `NavigationMenuLink` renders through `renderLink` like `AppShell`, with `active` setting aria-current="page". Base UI keeps its own focus guards in the tab order while a navigation panel is open, which axe reports as aria-hidden-focus; the closed menu scans clean. `ScrollArea` builds on Base UI Scroll Area with thin scrollbars, joins the tab order only while content overflows so the keyboard can scroll it, and `label` makes it a named region.

## Form controls and layout

```tsx
<FormField label="Receipt footer"><Textarea value={text} onValueChange={setText} autosize minRows={2} maxRows={6} maxLength={160} showCount /></FormField>
<InputGroup><InputGroupAddon>$</InputGroupAddon><InputGroupInput /><InputGroupAddon align="end">USD</InputGroupAddon></InputGroup>
<Switch label="Low stock alerts" description="Email the manager." switchPosition="end" checked={on} onCheckedChange={setOn} />
<CheckboxGroup label="Departments to sync" selectAll value={ids} onValueChange={setIds} options={departments} />
<RadioGroup label="Delivery method" variant="card" value={method} onValueChange={setMethod} options={[{ value: "pickup", label: "In-store pickup", description: "Ready in 2 hours", aside: "Free" }]} />
<FormField label="Category"><Select options={categories} value={category} onValueChange={setCategory} placeholder="Choose a category" /></FormField>
<Combobox options={suppliers} value={id} onValueChange={setId} onCreate={(label) => addSupplier(label)} emptyMessage="No suppliers match" />
<MultiSelect options={departments} value={ids} onValueChange={setIds} max={4} />
<Slider label="Price range" value={range} onValueChange={setRange} max={500} step={5} formatValue={(v) => `$${v}`} />
<Progress label="Uploading catalog.csv" value={percent} valueText="4 of 10 files" />
<Meter label="Deck screws" value={12} max={200} low={25} high={150} optimum={200} statusText={{ danger: "Low stock" }} />
<ToggleGroup label="Text formatting" multiple value={marks} onValueChange={setMarks} items={[{ value: "bold", label: "Bold", icon: <BoldIcon />, iconOnly: true }]} />

<Tabs defaultValue="overview" variant="underline"><TabsList aria-label="Store"><TabsTrigger value="overview">Overview</TabsTrigger></TabsList><TabsContent value="overview" keepMounted="visited">{overview}</TabsContent></Tabs>
<Accordion defaultValue={["returns"]}><AccordionItem value="returns"><AccordionTrigger>What is the return policy?</AccordionTrigger><AccordionContent>Within 30 days.</AccordionContent></AccordionItem></Accordion>
<Table label="Inventory"><TableHeader><TableRow><TableHead align="end" sortDirection={dir} onSort={() => setDir(cycleSortDirection(dir))}>On hand</TableHead></TableRow></TableHeader><TableBody>{rows}</TableBody></Table>
<FormField label="Opens at"><TimePicker value={opens} onValueChange={setOpens} minuteStep={15} min="05:00" max="22:00" /></FormField>
<Fieldset legend="Notifications" description="Where alerts are sent." disabled={saving}>{fields}</Fieldset>
```

These controls compose with `FormField` (Base UI Field), so labels, descriptions, errors and validation wire up without ids. `Label` is a native label with a required marker hidden from screen readers (the control's `required` attribute does the announcing), an "(optional)" note and a readable disabled style; inside a Base UI Field pass it as `<Field.Label render={<Label />}>`. `Textarea` grows between `minRows` and `maxRows` with `autosize`, adds the existing `InputCounter` with `showCount`, and `softLimit` lets typing pass `maxLength` while marking the field invalid. `InputGroup` draws one border and focus ring around an `InputGroupInput` and its addons and `InputGroupButton` actions; text addons such as "$" or "ft" join the input's description so screen readers hear the unit, and clicking an addon focuses the input. `Switch` toggles with Space, links its label and description, and `switchPosition="end"` lays it out as a settings row. `Checkbox` shows checked, unchecked and indeterminate (aria-checked="mixed") states, and `CheckboxGroup` adds an optional "Select all" parent that goes mixed when some children are checked and skips disabled ones. `RadioGroup` has one tab stop with arrow keys moving focus and selection, typed by its value union; `RadioCard` makes the whole tile the radio, named by its label and described by its description and `aside` (a price or lead time).

`Select` is data-driven (flat or grouped options with icons, descriptions and disabled entries, a placeholder, three sizes) on Base UI Select with arrow keys, Enter, Space and typeahead, and its composable parts (`SelectRoot`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectGroupLabel`, `SelectSeparator`) style each Base UI part and add scroll arrows to long lists. `Combobox` is a typeahead single select on Base UI Combobox: typing filters with a locale-aware match, your `filter`, or the server when `filter` is null, with an empty message, a busy row while `loading`, a clear button and an optional "Create" entry. `MultiSelect` turns picks into chips with named remove buttons; Backspace in the empty input removes the last chip, Left Arrow reaches the chips, and `max` disables the remaining options with a message. `Slider` handles one value or a range with arrow, Page Up/Down, Home and End keys; `formatValue` drives the visible value and each thumb's aria-valuetext, range thumbs are named "Price, minimum" and "Price, maximum" from `label` or `aria-label`, and marks add labelled ticks. `Progress` is determinate or indeterminate (`value={null}` drops aria-valuenow and shows a still bar under reduced motion) with `valueText` and four tones. `Meter` picks success, warning or danger from `low`, `high` and `optimum` exactly as a native meter does (`getMeterTone`), and `statusText` puts a word beside the value so color is never the only cue. `Toggle` exposes aria-pressed, and `ToggleGroup` allows one or `multiple` pressed items with one tab stop and a required group `label`; icon-only items use their text label as name and tooltip.

`Tabs` builds on Base UI Tabs with a pill or underline variant, an animated indicator that is instant under reduced motion, arrow keys, Home and End, and horizontal or vertical layout; `TabsContent` mounts only while active by default, `keepMounted` keeps it mounted, and `keepMounted="visited"` mounts on first open so input and scroll survive switching. `Accordion` opens one item or several with `multiple`, with each trigger a button with aria-expanded inside a heading (`headingLevel`). `Collapsible` shows and hides one section with an animated height. The `Table` parts are plain semantic table pieces for hand-built tables (`DataTable` stays the data-driven grid): with `label` the scroll wrapper becomes a named focusable region, `TableHead` with `onSort` renders a sort button and sets aria-sort (`cycleSortDirection` steps none, ascending, descending), and `TableRow` takes `selected`. `TimePicker` behaves like a native time input with spin-button segments for hour, minute and AM/PM: typed digits advance, Up and Down step (minutes by `minuteStep`), A or P sets the period, values are "HH:mm", `min` and `max` clamp (a max before min allows an overnight range), and a hidden input lets `FormField` label, validate and submit it; `parseTime` reads "14:30", "2:30 PM" or "2 p.m." and `formatTime` writes either form. `Fieldset` names a group with its legend, links a description, and `disabled` reaches every control inside.

## Data display and collections

```tsx
<Carousel label="Drill photos" items={photos} picker="thumbnails" loop slidesPerView={{ 0: 1, 768: 2 }} autoplay={6000} />
<TreeView nodes={categories} label="Store categories" selectionMode="multiple" checkboxes loadChildren={fetchChildren} />
<DescriptionList layout="grid" columns={3} items={[{ term: "Phone", details: "(555) 010-4477", copyValue: "(555) 010-4477" }]} />
<Countdown target={saleEnds} label="Spring sale ends in" onComplete={endSale} />
<Timer label="Paint shaker timer" mode="countdown" duration={90_000} />
<VirtualList ref={listRef} items={skus} label="SKU catalog" mode="listbox" height={264} itemHeight={44} onSelect={pick} renderItem={(sku) => sku.name} />
<InfiniteScroll onLoadMore={loadPage} hasMore={hasMore} loadMoreLabel="Load more orders">{rows}</InfiniteScroll>
<Masonry items={ideas} getKey={(idea) => idea.id} minColumnWidth={200} renderItem={(idea) => <IdeaCard idea={idea} />} />
<Marquee label="Supplier logos" speed={40}>{logos}</Marquee>
<QRCode value="https://example.com/store" ecLevel="M" downloadable />
<TransferList items={departments} value={assigned} onValueChange={setAssigned} targetLabel="Dana's departments" />
<SortableList label="Pick list" items={picks} onReorder={setPicks} getKey={(p) => p.id} getLabel={(p) => p.name} renderItem={(p) => p.name} />
<CircularProgress value={72} label="Cycle count progress" tone="success" size="lg" />
<CalendarHeatmap values={dailySales} start={start} end={today} label="Daily sales" unit={["sale", "sales"]} />
```

`Carousel` shows slides from `items` or `CarouselSlide` children: previous and next buttons, dot or thumbnail pickers, a pointer swipe, and Arrow Left, Arrow Right, Home and End while focus is inside all change the slide, `loop` wraps, and `slidesPerView` takes a number or a width-to-count map (`resolveSlidesPerView`). The section has aria-roledescription="carousel", each slide is a group labelled like "Front view, 1 of 5", slides out of view are aria-hidden and inert, and a polite live region names the slide whenever it is not rotating. Autoplay pauses on hover and focus, has a visible pause button, and never starts by itself under reduced motion (`usePrefersReducedMotion`). `TreeView` follows the WAI-ARIA tree pattern with one tab stop: Up and Down move, Right expands or enters, Left collapses or returns to the parent, Home and End jump, `*` expands siblings, typing jumps to a label, Enter calls `onAction`, and Space selects or checks. Selection is none, single or multiple (Shift extends, Ctrl+A selects all visible), optional tri-state checkboxes cascade, and a node marked `hasChildren` loads through `loadChildren` with a loading row and a Retry row on failure; `flattenVisibleTree`, `computeTreeCheckState` and `toggleTreeChecked` are exported. `DescriptionList` renders a semantic `dl` in stacked, inline or grid layouts, and items with a `copyValue` get a copy button named after the term.

`Countdown` counts to a target date as compact text or segmented boxes (`largestUnit` folds days into hours), hides the ticking digits from screen readers and announces the time left at most once a minute, renders a stable value on the server from `serverNow`, and fires `onComplete` once. `Timer` is a stopwatch or a countdown from `duration` with one Start, Pause and Resume button that keeps focus plus Reset, and announces each state change; `splitDuration` is exported. `VirtualList` renders only the rows in view plus `overscan`, with a fixed `itemHeight` or an `estimateHeight` refined by measuring rows (`useMeasuredHeights`) and scroll anchoring; every row carries aria-setsize and aria-posinset, listbox mode is one tab stop with aria-activedescendant and Page Up/Down, Home and End, and `ref.scrollToIndex` scrolls to any row (`computeVirtualRange` is exported). `InfiniteScroll` calls `onLoadMore` when a sentinel comes into view, blocks duplicate calls while the promise is pending, rechecks after short pages, shows an error with "Try again", keeps a visible "Load more" button for keyboard users and browsers without IntersectionObserver, and moves focus to the end message if the button had it. `Masonry` places each item in the currently shortest column by measured height, keeps DOM and tab order in source order, and renders one column on the server (`masonryColumnCount`, `computeMasonryLayout`). `Marquee` scrolls children in any direction, pauses on hover and focus, has a pause button, hides its duplicate track from assistive technology, and shows a static wrapped list under reduced motion.

`QRCode` draws a crisp SVG from the built-in encoder `encodeQR`, which needs no dependency: numeric, alphanumeric or UTF-8 byte mode (with the UTF-8 ECI for non-ASCII text), versions 1 to 40 picked automatically or from `minVersion`, error correction L, M, Q and H, all eight masks scored by the standard penalty rules, and BCH-protected format and version information. It keeps a quiet zone and black on white so it scans in either theme, has role="img" with an accessible name, can save SVG or PNG, and shows an inline alert for text that does not fit. Its tests decode every code back with an independent reader and check every Reed-Solomon block. `TransferList` is two labelled multi-select listboxes with filters and counts (click, Ctrl or Cmd click, Shift click, Shift+arrows, Space and Ctrl+A select; Enter or double click moves one) and four named move buttons, with moves announced. `SortableList` reorders by drag handle with mouse, pen or touch, or from the keyboard: Space or Enter picks up, arrows, Home and End move, Space or Enter drops, Escape restores, and every step is announced ("Moved Claw hammer to position 3 of 6"); `moveItem` is exported. `CircularProgress` is a determinate ring with the value in the center or an indeterminate spinner that stays still under reduced motion, on Base UI Progress. `CalendarHeatmap` is a GitHub-style daily grid with month labels, a five-step scale mixed from `--chart-1` and the background, and a legend; it is an ARIA grid with one tab stop where arrows move by day and week and each day has a label and tooltip such as "14 sales on Tuesday, March 3, 2026". `buildHeatmapMatrix` steps by calendar date, so daylight saving changes and year boundaries never skip or repeat a day.

## Site sections

```tsx
<SiteHeader brand={<Logo />} brandHref="/" nav={[{ label: "Home", href: "/" }, { label: "Services", items: [{ label: "Key cutting", href: "/services/keys" }] }]} currentPath={location.pathname} sticky skipLinkHref="#main" renderLink={({ href, ...props }) => <Link to={href} {...props} />} />
<Hero eyebrow="Family owned since 1979" title="Everything for the job" description="Tools, paint and advice." primaryAction={{ label: "Order for pickup", href: "/shop" }} media={<img src={storefront} alt="Our store on Main Street" />} layout="split" />
<FeatureGrid title="Services" columns={4} items={[{ icon: <KeyRoundIcon />, title: "Key cutting", description: "Copies in minutes.", href: "/services/keys" }]} />
<StatsBand title="By the numbers" items={[{ label: "Items in stock", value: 32000, suffix: "+" }]} />
<PricingTable title="Pro membership" plans={[{ id: "pro", name: "Pro", monthlyPrice: 29, yearlyPrice: 290, featured: true, features: ["10% off tools"], cta: (period) => ({ label: "Start Pro", href: `/join?billing=${period}` }) }]} />
<PlanComparison caption="Compare plans" plans={plans} rows={[{ label: "Tool discount", values: { homeowner: false, pro: "10%" } }]} />
<Testimonials title="What customers say" layout="featured" items={[{ quote: "They matched our trim from one chip.", name: "Marcus Bell", company: "Bell Painting", rating: 5 }]} />
<Faq title="Questions" items={[{ id: "hours", question: "What are your hours?", answer: "7 am to 7 pm daily." }]} searchable structuredData />
<LogoCloud title="Brands we carry" muted items={[{ name: "Northwind Tools", src: "/logos/northwind.svg" }]} />
<CtaSection title="Ready for your next project?" primaryAction={{ label: "Get directions", href: "/visit" }} />
<NewsletterSignup title="Weekly deals" consentLabel="Email me deals and store news" onSubscribe={(email) => api.subscribe(email)} />
<ContactForm topics={[{ value: "rental", label: "Tool rental" }]} messageMaxLength={1000} onSubmit={(values) => api.contact(values)} />
<BlogGrid title="From the workshop" posts={posts} />
<TeamGrid title="Meet the team" members={team} />
<SiteFooter brand={<Logo />} columns={[{ title: "Shop", links: [{ label: "Tools", href: "/tools" }] }]} social={social} copyrightHolder="Riverside Hardware Co." />
```

Every section takes semantic landmarks, a configurable heading level and links through `renderLink`, and lays out from 320px up. `SiteHeader` has brand, navigation and action slots; the most specific link matching `currentPath` gets aria-current="page", dropdown groups use Base UI Navigation Menu, `sticky` shows a border once the page scrolls, and below `collapseBelow` a menu button opens a full-height Base UI Dialog that traps focus, closes on Escape, on navigation or when the viewport grows, and returns focus. `skipLinkHref` renders a "Skip to content" link first, and `brandLabel` is only for brands with no visible text. `Hero` has an eyebrow, a title (an h1 by default), a description, two actions that stack full width on phones, a media slot, centered and split layouts and a muted, gradient or grid backdrop drawn from theme tokens. `FeatureGrid` lists services in 2 to 4 columns with "Learn more" links whose accessible names include the feature, and `SiteSection` is the shared wrapper (eyebrow, title naming the region, description, gutters). `StatsBand` renders headline numbers as a description list formatted with Intl (`formatStatValue`).

`PricingTable` formats monthly and yearly prices with Intl for any currency and locale; the billing toggle is a radio group showing the yearly saving ("Save 16%"), a featured plan gets a badge, excluded features read "Not included", each CTA can depend on the period and names its plan, and `yearlySavings` rounds the percent down so it never overstates. `PlanComparison` is a captioned matrix with row and column headers, real "Included" and "Not included" text and a pinned feature column on small screens. `Testimonials` marks quotes up as `figure`, `blockquote` and `figcaption` with initials avatars and an optional read-only `Rating`. `Faq` puts questions on Base UI Accordion with headings one level below the section, closed answers stay findable with find in page, `searchable` adds an accent-insensitive filter that announces the result count, and `structuredData` emits FAQPage JSON-LD that `faqJsonLd` escapes so it cannot close its script tag. `LogoCloud` requires a name per logo and its muted style uses grayscale rather than opacity, so text marks keep AA contrast. `CtaSection` is a banner or card call to action.

`NewsletterSignup` validates the address, links errors and moves focus to them, supports a required consent checkbox, and its async `onSubscribe` gets pending, success and error states announced politely with double submits ignored. `ContactForm` collects name, email, an optional phone, a topic on Base UI Select and a message with a characters-left count; fields validate on blur and submit with errors linked and focus moved to the first problem, a hidden honeypot drops bot submissions silently (calling `onSpam`), and the form resets after success. `validateContact`, `isValidEmail`, `useSubmitStatus` and `SubmitStatusMessage` are exported for custom forms. `BlogCard` stretches its title link over the whole card so the card is clickable while the link stays its only interactive element, and formats a plain "YYYY-MM-DD" date as the same day in every time zone (`formatPostDate`). `TeamGrid` shows people with photos or initials and named icon links. `SiteFooter` holds link columns in a named navigation landmark, social links named by `label`, a newsletter slot, legal links, a back-to-top link and a copyright year filled in after hydration so server and client markup match.

## Feedback and status

```tsx
<Toaster>{app}</Toaster>
const { toast, undoable } = useToast();
toast({ title: "Draft saved", tone: "success" });
undoable({ title: "Chat deleted", onCommit: () => deleteChat(id) });

<ConfirmDialog trigger={<button>Delete</button>} title="Delete this chat?" tone="destructive" onConfirm={remove} />
<Banner tone="warning" dismissKey="long-chat" title="Long conversation">Older messages are summarized.</Banner>
<SurfaceState kind="error" onRetry={reload}>{lastLoadedRows}</SurfaceState>
<DeferredSurface><LazyPanel /></DeferredSurface>
<ConnectionStatus state="reconnecting" retryAt={nextRetry} onRetry={reconnect} />
```

`Toaster` keeps one live region (errors announced assertively and kept 7s), pauses timers while the pointer or focus is inside, and lets F6 jump in and Escape dismiss. `undoable` commits only when the toast closes without Undo. `ConfirmDialog` starts focus on Cancel and stays open with an error if an async `onConfirm` rejects. `SurfaceState` covers loading, empty, no-results, error, offline and permission states and keeps stale content visible under a refresh error; `DeferredSurface` adds Suspense and a retrying error boundary around lazy panels. Smaller pieces: `StatusPill`, `SyncStatus`, `SaveStatus`, `ConnectionStatus`, `Shimmer`, `ThinkingIndicator`, `TypingDots`, `PresenceAvatars`, `ConversationMarker`, `InputCounter`, `Skeleton`, and the hooks `useStreamBuffer` (coalesces token chunks to one render per frame and drops replayed sequence numbers), `useOnlineStatus` and `useNow`.

## Agent runs and progress

```tsx
<RunStatusBar phase="generating" startedAt={run.startedAt} running={1} queued={2} applied={run.applied} onStop={stop} onRetry={retry} details={run.details} />
<ActionList title="Build counter app" steps={steps} closed={!streaming} onOpenFile={openFile} />
<RunTimeline stages={stages} onFileClick={openFile} />
<PlanCard title="Blueprint" summary={plan.markdown} steps={plan.steps} onStepsChange={setSteps} paused={paused} onPauseChange={setPaused} />
<ToolTrace items={traceItems} />
```

`RunStatusBar` shows the phase, elapsed time and counts, labels Stop by phase (Stop generation, Stop actions, Cancel queued) and offers Retry only when nothing was applied, so a retry cannot duplicate side effects; its details drawer copies a receipt. `ActionList` lists file writes, commands and app starts with six states and opens itself on the first step unless the user toggled it. `RunTimeline` nests stages, phases and touched files, opens only the active phase and pins a summary while scrolled away. `ToolTrace` renders calls in plain English ("Read 4 files", "Ran npm test") and groups only finished calls so counts never flicker. Also `ProgressSteps`, `ActivityTrace`, `TaskList` (retry and inline answers), `SubAgentSession`, `StreamStatus` (queue position, reconnecting, provisional), `TruncationNotice`, `ActionResultCard`, and the parsers `parseArtifactSegments`, `createTagStreamParser` (tags split across chunks, nesting) and `extractQuickActions`.

## Approvals, questions and errors

```tsx
<ActionApproval title="Send email" risk="high" scopes={["gmail.send"]} digest={action.digest} preview={<EmailPreview />} onApprove={approve} onDeny={deny} />
<ApprovalQueue requests={requests} onApprove={approve} onDeny={deny} denyRequiresReason />
<CostApproval title="Fine-tune" price={18.4} maxCost={25} balance={60} etaMs={42 * 60_000} onApprove={run} onDecline={decline} onTopUp={topUp} />
<AgentError error={error} applied={run.applied} onRetry={retry} onSwitchModel={pickModel} onOpenSettings={openSettings} />
<QueryReview sql={generated} onRun={runQuery} result={<DataTable rows={rows} />} />
```

`ActionApproval` binds an approval to the shown digest, requires "I reviewed this action" for high-risk work, clears that review when the action changes, and on a lost confirmation offers to resend the same decision. `ApprovalQueue` presents pending requests one at a time with history in a second tab. `CostApproval` shows price, cap, time, hardware and the balance after the run, and blocks approval when the balance cannot cover the cap. `AgentError` runs errors through `classifyError` (auth, rate limit, quota, context, network, server, aborted) to pick the remedy, counts down `Retry-After`, offers Retry only when the error is retryable and nothing was applied, and copies diagnostics. `QueryReview` uses `isReadOnlySql`, which ignores strings and comments and rejects CTE writes, `SELECT INTO` and `FOR UPDATE`, to block writes unless `allowWrites` is set and confirmed; it is a UI guard, so the server must still run reads read-only. Also `BudgetBar` (used, held, left), `JobList` (progress, logs, cancel, retry, "Check status" for lost outcomes), `ClarifyingQuestions` (one question at a time, radio or checkbox, custom answers, skip), `ChatAlert` ("Ask AI to fix"), `BatchReview` (grouped include toggles, conflicts start excluded, cost, "Apply N") and `ConsentCard` (client, scopes, redirect host, unsafe redirects blocked).

## Spreadsheet

```tsx
<Spreadsheet defaultSheets={[{ id: "s1", name: "Inventory", frozenRows: 1, cells: { A1: "Item", B1: "Qty", B2: "42", C2: "=B2*18.97" } }]} onSheetsChange={save} />

const book = createWorkbookEvaluator(sheets);
book.value(0, 1, 2); // 796.74
shiftFormulaReferences("=A1+$B$1", 1, 0); // "=A2+$B$1"
```

`Spreadsheet` is a workbook editor with no grid dependency. The formula engine (`createWorkbookEvaluator`) evaluates lazily with caching, follows A1, `$A$1`, ranges (`A1:B3`, `A:A`, `1:1`) and other sheets (`'Q1 Sales'!B2`), reports `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#N/A`, `#NUM!` and `#CYCLE!` instead of throwing, evaluates `IF`/`IFERROR`/`IFS` lazily, and ships about 80 functions (math, statistics, `SUMIF`/`COUNTIF`/`AVERAGEIF` with wildcards, text, dates, `VLOOKUP`, `HLOOKUP`, `XLOOKUP`, `INDEX`/`MATCH`). The grid is a virtualized ARIA grid with one tab stop: arrows, Ctrl+Arrow to the edge of data, Home/End, Page Up/Down, Tab, Enter or F2 to edit, typing to replace, Delete, Ctrl+Z/Y, Ctrl+B/I, Ctrl+D/R to fill, Ctrl+A, Shift/Ctrl+Space for rows and columns, and Alt+Shift+Arrow to resize. It supports Shift and Ctrl multi-range selection, a fill handle that continues series (`inferFillSeries`: numbers, ISO dates, "Item-007", day and month names), clipboard copy and paste as TSV and HTML with formula references shifted on paste, a formula bar with function suggestions, clicking cells to insert references while typing a formula, column resize and double-click autofit, freeze panes, sort, per-column value filters, bold, italic, alignment and number formats, insert and delete rows and columns with references rewritten across sheets (ranges shrink instead of breaking), sheet tabs with rename, duplicate and delete, undo history, a selection summary (sum, average, count, min, max), and CSV import and export; export prefixes formula-like text so opening the file elsewhere cannot run it.

## Document editor

```tsx
<RichTextEditor defaultValue={markdown} onValueChange={save} comments={comments} onCommentsChange={setComments} author="Ana" title="Spring plan" />

markdownToDoc("# Plan\n\n- [ ] Call supplier"); // ProseMirror document
docToMarkdown(doc); // GitHub-flavored markdown
```

`RichTextEditor` is a word-processor style editor on ProseMirror, code-split so it loads on first use (`preloadRichTextEditor` warms it). Content goes in and out as GitHub-flavored markdown through `markdownToDoc` and `docToMarkdown`, which reuse the package's remark parser and round-trip headings, lists, to-do lists, tables, code, quotes, rules, images and marks; underline, highlight and sub/superscript use inline HTML tags. The toolbar covers undo, block type, bold, italic, underline, strike, code, highlight, links, lists with indent, alignment, tables (insert, rows, columns, header row, merge, split), images, dividers and clear formatting, all with shortcuts. Markdown shortcuts work as you type (`#`, `>`, `-`, `1.`, `[ ]`, ```` ``` ````, `---`, `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `==highlight==`), "/" opens a filtered block menu, Ctrl+F opens find and replace (match case, whole word, regex with groups, preserve case), and pasted markdown becomes formatted content. Comments anchor to text as marks, move with edits, and show in a side panel with replies, resolve and delete. The footer counts words and characters by grapheme. Export covers Markdown, HTML, Word (.doc), copy as Markdown, and print to PDF. Links and images go through URL allowlists whether typed, pasted as HTML or parsed from markdown, raw HTML in markdown stays visible text, and a `value` prop keeps the editor controlled without echoing changes back.

## HTML editor

```tsx
<HtmlEditor defaultValue={html} onValueChange={save} onImageUpload={uploadToStorage} title="exterior-paint" />

<HtmlEditor
  defaultValue={report}
  onValueChange={save}
  title="store-reset-report"
  defaultLayout="page"
  defaultHeader="Whitten Hardware · {title}"
  comments={comments}
  onCommentsChange={setComments}
  author="Dana Ortiz"
  review
  onAiRequest={onAiRequest}
/>

sanitizeHtml('<p onclick="x()">Hi<script>bad()</script></p>'); // "<p>Hi</p>"
cleanPastedHtml(wordClipboardHtml); // Word lists become <ul>/<ol>, Office styling dropped
embedFromUrl("https://youtu.be/dQw4w9WgXcQ?t=90"); // { kind: "iframe", provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90" }
```

`HtmlEditor` is a WYSIWYG editor for content that is stored and published as HTML: CMS pages, product descriptions and email bodies. It shares its ProseMirror core, find and replace, tables and dialogs with `RichTextEditor`, loads on first use (`preloadHtmlEditor`), and shows the document as plain text on the server and while loading. The toolbar adds a font menu and a size menu (`fonts` and `fontSizes`, with web- and email-safe defaults), text and highlight colors through `ColorPickerPanel` (`colors` sets the swatches), superscript and subscript, justified text, paragraph indents (Ctrl+] and Ctrl+[, which nest list items instead when in a list), alignment shortcuts (Ctrl+Shift+L, E, R, J), images by URL with alt text and width or by upload (`onImageUpload` also handles pasted and dropped image files), YouTube, Vimeo and Loom embeds or https video files, an HTML source view on CodeMirror, and export to HTML, Word, the clipboard and print. Embeds show as a stand-in while editing, so nothing third-party loads while you write.

Everything that enters the editor, whether as `value`, pasted HTML or edited source, is parsed in an inert document and rebuilt through `htmlSchema`, so `onValueChange` only ever receives allowlisted tags and attributes. Links and images pass URL allowlists, colors are normalized, font names and sizes are checked before they reach a style attribute, and iframes are kept only for the three video players, rebuilt with a fixed `sandbox` and YouTube's privacy-enhanced domain. Pasting from Word or Google Docs (`cleanPastedHtml`) rebuilds Word's list paragraphs as real nested lists, removes Office metadata, spacer paragraphs and `mso-` properties, and keeps structure, bold, italic, links, lists and tables while dropping fonts, sizes and colors; `pasteStyles` keeps them minus the Office defaults. Content copied within the editor keeps its styles. By default the editing area is a white page in both themes (`surface="page"`), because chosen colors cannot read well on both a light and a dark background; the preset's `[data-theme="light"]` scope makes that work inside a dark app.

`HtmlEditor` also edits like a block editor. Typing / at the start of a line or after a space opens a filtered menu of blocks from every built-in feature. Selecting text shows a toolbar for bold, italic, underline, strikethrough, inline code, links, comments, AI and the block type; Alt+F10 moves into it and Escape returns to the text. Hovering a block shows a plus button that adds a block below and a handle that drags the block or opens its menu, which turns it into another kind, duplicates, moves or deletes it. Ctrl+/ opens that menu from the keyboard and Alt+Shift+Up or Down moves the current block. `slashMenu`, `bubbleToolbar` and `blockHandles` turn each part off, and `compact` turns off all of the editing features in this section.

Images are figures with an editable caption. Clicking one shows a toolbar that floats it left or right, centers it or makes it full width, picks Small, Medium, Large or Original, edits the alt text (required unless the image is marked decorative), replaces it or deletes it; the edge handles resize it, as do Alt+Left and Alt+Right. Without `onImageUpload`, pasted and dropped PNG, JPEG, GIF, WebP and AVIF files up to 2 MB are embedded as data URLs and larger files are refused with a message. The slash menu adds callouts (info, success, warning, danger, note, with a tone menu on the icon) and two- or three-column layouts that stack on narrow screens. Table columns resize by dragging a border or from the Column width menu, and the Cell color menu shades the selected cells. The commands behind these (`wrapInCallout`, `insertColumns`, `setCellBackground`, `setFigureAlign` and more) are exported for your own toolbars.

Page layout (`layout="page"` or the Page layout button) shows the document as Letter or A4 paper (`pageSize`) with one inch margins, scaled to fit narrow panels. Pages break before the first block that would run past the bottom margin and at every page break, each page shows `header` and `footer` with {page}, {pages}, {title} and {date} filled in, and the status bar shows the page holding the cursor. The Header and footer button, or a double-click on a header, edits both. Ctrl+Enter adds a page break, the "Table of contents" block lists the headings and jumps to each one, and Ctrl+Alt+F adds a numbered footnote edited in a popover. Export and print keep the same paper, margins, header and footer (`pagePrintCss`). Only top-level blocks are paginated, so a list or table that would cross a page moves whole to the next one. Published HTML keeps figures, callouts, columns, footnotes and the table of contents as semantic markup, and `HTML_CONTENT_CSS` styles them on your site.

Passing `comments` turns on anchored comments: select text and choose Comment, or press Ctrl+Alt+M. Threads appear in the review panel in document order with replies, resolve, reopen and delete, and every change comes back through `onCommentsChange`. `review` adds a Track changes switch (`trackChanges` controls it); while it is on, typing, deleting, pasting and cutting become suggestions by `author` that the panel or the selection toolbar accepts or rejects one at a time or all at once. Block-level edits such as headings, lists and inserted blocks apply normally. In editors narrower than 640px the panel collapses to a button and opens over the document. `acceptAllChanges` and `rejectAllChanges` resolve every change in stored HTML, for example before publishing.

Passing `onAiRequest` adds AI writing: a toolbar button, Ask AI on selected text and Ctrl+J open a menu where people type a request or pick a preset (improve, fix spelling, shorten, lengthen, change the tone, continue writing or summarize). The handler receives the selected text, its HTML, the text around it and the instruction, and either streams the reply as an async iterable or returns a promise of the whole text; it should stop when the signal aborts. The reply appears in a preview below the text, where people replace the selection (or insert at the cursor), insert below, try again or discard, and with `review` add it as a tracked change. Replies are always inserted as plain text. `aiActions` replaces the presets.

```tsx
const onAiRequest: HtmlAiHandler = async function* (request, signal) {
  const response = await fetch("https://example.com/api/ai/edit", { method: "POST", body: JSON.stringify(request), signal });
  if (!response.body) return;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield value;
  }
};

<HtmlEditor onAiRequest={onAiRequest} aiActions={[...DEFAULT_HTML_AI_ACTIONS, { id: "sku", label: "Add a SKU line", group: "Write", instruction: "Add one line listing the SKU. Reply with the new text only." }]} />
const published = acceptAllChanges(html);
```

## Page and email builder

```tsx
<PageBuilder defaultValue={design} onValueChange={saveDesign} mode="email" onImageUpload={uploadToStorage} label="Spring sale email" />

builderToHtml(design, { target: "email" }); // tables, inline styles, preheader, Outlook guards
builderToHtml(design, { target: "web" }); // responsive page with flex columns and video players
normalizeBuilderDocument(JSON.parse(stored)); // validated design
```

`PageBuilder` builds emails (`mode="email"`) and web pages (`mode="page"`) from blocks: headings, rich text, images, buttons, dividers, spacers, social links and video, plus two- or three-column rows and full-width sections with their own background. Add a block by clicking it in the palette (it goes after the selected block, into a selected section, or into an empty column of a selected row) or by dragging it to a spot on the canvas, where a line shows where it will land. Blocks drag to reorder and between columns, or from the keyboard: arrow keys move between blocks, Alt+Up and Alt+Down reorder, Alt+Left and Alt+Right move a block to the neighbouring column, Ctrl+D duplicates, Delete removes, Escape selects the parent, and Ctrl+Z and Ctrl+Shift+Z undo and redo. Typing in one field counts as a single undo step. The settings panel edits the selected block (text blocks use a compact `HtmlEditor`, buttons warn when the label falls under 4.5:1 contrast, image and social links validate their URLs) or, with nothing selected, the subject, preview text, width, padding, font and colors. Desktop and Mobile switch the canvas width, and columns stack on narrow screens. Preview shows the real export in a frame sandboxed without scripts. Export copies or downloads the HTML, and downloads or opens the design as JSON.

The canvas and the export share one renderer (`renderLeafHtml`), so what you see is what is sent. Every value is escaped or checked when rendered: text goes through `sanitizeHtml`, links and images through the URL allowlists, colors and fonts through the style checks, and numbers are clamped. Stored or imported designs pass through `normalizeBuilderDocument`, which drops unknown blocks and invalid nesting. Email output uses presentation tables with inline styles (`inlineTextHtml` writes spacing, list indents and link colors onto text elements, because many clients drop `<style>`), bulletproof buttons, image width attributes for Outlook, a hidden preheader, MSO width guards and a media query that stacks columns. Video becomes a linked YouTube thumbnail or a "Watch" link, since email cannot play it. Web output is a page with flex columns that stack under the content width and sandboxed players from `embedFromUrl`. The design model and operations (`insertBuilderBlock`, `moveBuilderBlock`, `duplicateBuilderBlock`, `nudgeBuilderBlock`, `setColumnCount` and the rest) are exported for building designs in code, such as from a template or an AI draft.

## Design canvas

```tsx
<DesignEditor defaultDesign={{ width: 1080, height: 1080, pages: [{ id: "p1", name: "", background: "#fff7ed", elements: [] }] }} onDesignChange={save} title="spring-sale" />
<DesignEditor design={design} readOnly /> {/* page-by-page viewer */}
```

`DesignEditor` is a Canva-style layout tool for posts, flyers and slides that renders to SVG with no canvas library. Designs hold pages of rectangles (with corner radius), ellipses, triangles, diamonds, stars, lines, arrows, wrapped text and images. Drag to draw (Shift for squares and 45° lines) or click for a default size; select by click, Shift-click or marquee; move with smart guides that snap to the page and to other elements' edges and centers (Alt skips snapping); resize from eight handles with the opposite corner fixed even when rotated (Shift or images keep the ratio); rotate from the top handle (Shift snaps to 15°); edit text in place with a double-click or Enter. The layers list selects without a pointer and hides or locks elements, the pages rail adds, duplicates and deletes pages, and the properties panel edits position, size, rotation, fill, stroke, opacity, corner radius, text and image alt text, aligns to the page or the selection, distributes three or more, and changes the design size with content scaled to fit. Keyboard: V/H/R/O/L/A/T/I tools, arrows to nudge (Shift for 10), Delete, Ctrl+D, Ctrl+C/X/V, Ctrl+A, Ctrl+]/[ to arrange, Ctrl+Z/Y, Ctrl+=/−/0 for zoom, Space-drag or the hand tool to pan, Ctrl+wheel to zoom at the pointer. Images can be dropped or chosen and are downscaled to 1600 px; export covers PNG (1× and 2×), SVG and the JSON design. Colors and image URLs are allowlisted, so imported designs cannot inject references into exports. The geometry helpers (`snapBox`, `resizeElement`, `alignElements`, `distributeElements`, `arrangeElements`, `scaleElements`, `elementBounds`, `wrapText`) are exported for server-side layout.

## Artifact viewer, slides and media

```tsx
<ArtifactViewer title="Landing page" kind="react" versions={versions} onRestoreVersion={restore} streaming={isStreaming} onFix={(errors) => send(`Fix: ${errors.join("\n")}`)} />
<ArtifactThumbnail title="Landing page" kind="html" content={html} onClick={open} />
<SlideDeck slides={slidesFromMarkdown(markdown)} />
<ImageGallery images={photos} />
```

`ArtifactViewer` is a Claude-style artifact panel. It renders web pages, React components (`createReactPreview`), Mermaid diagrams (`createMermaidPreview`, strict security level), SVG (as an image, so its scripts never run), markdown, code, CSV (`CsvExplorer`), JSON (`JsonViewer`) and images. It switches between preview and code, keeps runnable kinds in code view with "Building…" while streaming, steps through versions with "Restore this version", reloads, copies, downloads with the right extension (`artifactExtension`), goes full screen, and opens previews in a new tab inside a sandboxed frame with an opaque origin (`openSandboxedWindow`), never as a same-origin blob page. Runtime errors from the frame's error bridge are de-duplicated, capped and offered to `onFix`. `ArtifactThumbnail` renders a live scaled preview that loads only near the viewport. `JsonViewer` is a keyboard-navigable tree with filtering, expand and collapse all, copy path and chunked large arrays; `CsvExplorer` detects the delimiter (quoted fields included), finds numeric columns (`$1,200`, `(15)`, `12%`), and adds column profiles. `SlideDeck` has a thumbnail rail, keyboard navigation, speaker notes and a full-screen present mode, and `slidesFromMarkdown` splits on `---` with `Note:` lines as notes. Media: `ImageGallery` with a `Lightbox` (wrap-around arrows, swipe, zoom to actual size, Escape), `ImageCropper` (drag, keys, wheel or slider to zoom, round or rectangular output as a Blob), `MediaPlayer` for audio and video (seek, volume, speed, captions, full screen, J/K/L/M/F keys), and `PdfViewer` on the browser's built-in viewer. Every media and image URL goes through the allowlists.

## Calendar, date pickers and boards

```tsx
<EventCalendar events={events} defaultView="week" onEventChange={(event, { start, end }) => save(event.id, start, end)} onCreate={openNewEvent} />
<DatePicker label="Delivery date" value={date} onValueChange={setDate} min={today} />
<DateRangePicker label="Report period" value={range} onValueChange={setRange} />
<KanbanBoard columns={columns} cards={cards} onCardMove={(id, columnId, rank) => update(id, { columnId, rank })} onCardAdd={addCard} />
<Timeline items={activity} groupByDay />

expandEvents(events, from, to); // occurrences, recurring events included
describeRecurrence(parseRecurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10")!); // "Every 2 weeks on Mon and Wed, 10 times"
```

`EventCalendar` has month, week, day and agenda views with no calendar dependency. Week and day views lay overlapping events side by side (`layoutDay`), show all-day events in their own row and mark the current time. Events move by dragging (snapped to `snapTo` minutes) and resize from the bottom edge, and the keyboard does the same: Alt+Up/Down moves by the snap step, Alt+Left/Right by a day, Alt+Shift+Up/Down resizes, and each move is announced. Clicking an empty slot calls `onCreate` with a one-hour slot (double-click a day in month view). Recurring and read-only events refuse to move and say so. Month view caps events per day with "+N more", and agenda view lists the next `agendaDays` days. Recurrence takes an RRULE subset (`FREQ` daily, weekly, monthly or yearly, `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`); `expandEvents` turns it into occurrences for a window and skips months without the start day instead of rolling over. `DatePicker` and `DateRangePicker` open a `CalendarMonth` grid in a popover with focus inside it: arrows move by day and week, Page Up/Down by month, Shift+Page Up/Down by year, Home/End to the week edges, and focus returns to the trigger on close. Both honor `min`, `max` and `isDateDisabled`. The range picker takes a start then an end (picks in the wrong order swap), previews the range on hover, shows one or two months, and offers presets (`defaultDatePresets`) that it recognizes again from the dates. `KanbanBoard` moves cards by pointer drag (the card stays dimmed in place, a line shows where it lands, Escape cancels), by Alt+arrows, or from each card's Move menu. Focus follows the moved card, every move is announced with its position, and work-in-progress limits and overdue cards are flagged for screen readers too. Order uses fractional ranks (`rankBetween`, `rankAt`), so a move updates one card. `Timeline` lists activity with tone dots, badges such as "manual", and optional day headings.

## Inputs and forms

```tsx
<FormField label="Store name" validationMode="onBlur" validate={(value) => (String(value).length < 3 ? "Use at least 3 characters." : null)}>
  <TextInput name="storeName" required />
</FormField>
<FormField label="Labels"><TagInput value={tags} onValueChange={setTags} suggestions={known} maxTags={6} /></FormField>
<FormField label="Unit price"><CurrencyInput value={cents} onValueChange={setCents} currency="USD" /></FormField>
<FormField label="Verification code"><OTPInput length={6} groups={[3, 3]} onValueComplete={verify} /></FormField>
<FormField label="New password"><PasswordField showStrength generate /></FormField>
<FormWizard steps={steps} onSubmit={save} />

const { draft, clear } = useFormDraft({ key: "draft:store", value: form });
const uploads = useUploadQueue({ upload: (file, { signal, onProgress }) => send(file, signal, onProgress), persistKey: "uploads" });
<UploadQueue {...uploads} onAddFiles={uploads.add} onPause={uploads.pause} onResume={uploads.resume} onRetry={uploads.retry} onRemove={uploads.remove} onReattach={uploads.reattach} />
```

`FormField` wraps Base UI Field, so the label, description, invalid state and errors (from `validate`, native constraints or a server `error` prop) reach any control inside without wiring ids; with `validationMode="onBlur"` a message clears as soon as the value is fixed. The controls build on Base UI where it has a primitive: `TagInput` on Combobox (Enter, comma or Tab adds, pasted lists split, Backspace removes the last tag, Left Arrow reaches the chips, filtered suggestions, case-insensitive duplicates, `validate`, `transform` and `maxTags` with a counter), `NumberInput` on NumberField (locale parsing and formatting, clamping, Shift and Alt steps, select on focus), `CurrencyInput` storing integer minor units with the currency's own decimals (`currencyFractionDigits`), and `OTPInput` on OTPField (SMS autofill, paste, groups, masking, `onValueComplete`). `PasswordField` adds show and hide, a Caps Lock warning, a five-segment `meter`, the unmet rules, warnings for common passwords (leetspeak and trailing digits included), repeats and sequences (`scorePassword`), and a generator on `crypto.getRandomValues` with rejection sampling (`generatePassword`). `Rating` uses native radios (arrow keys, a second click clears, read-only fractions), `SegmentedControl` is a radio group that becomes cards when options have descriptions, `FilterChips` is a toggle group with counts and Clear, and `SearchInput` debounces `onSearch`, clears on Escape, focuses from a page shortcut such as "/" (never while typing elsewhere) and announces the result count. `ColorPicker` (or the inline `ColorPickerPanel`) has a saturation and brightness area that works with arrow keys, hue and opacity sliders, hex and RGB entry, document swatches, the last 14 colors and the EyeDropper where the browser has it; `parseColor`, `toHex`, `rgbToHsv`, `hsvToRgb` and `contrastRatio` are exported. `FormWizard` validates each step (sync or async) before moving on, keeps earlier steps mounted so their inputs keep values, lets the `Stepper` jump back or to visited steps, re-validates everything on submit and returns to the first step with problems, and moves focus to each step's heading. `useFormDraft` saves after typing pauses and when the page hides, never stores password, secret, card or file fields, writes nothing until the form changes, and offers the earlier draft back for seven days. `SignaturePad` draws smoothed SVG strokes with undo and clear, offers a typed signature for keyboard and screen reader users, and exports SVG (`signatureToPng` rasterizes it). `CsvColumnMapper` guesses columns from headers and aliases (`autoMapColumns`), shows sample values, blocks import until required fields are mapped and no column is used twice, and previews the rows as they will import. `UploadQueueStore` (with `useUploadQueue` and `UploadQueue`) runs uploads with a concurrency limit, pause that aborts the request, resume, retry and removal, rejects empty, oversized and unaccepted files with reasons, takes folders, and after a reload lists unfinished uploads as needing the file until the same file is attached again.

## App shell, navigation, PWA and operations

```tsx
<AppShell nav={sections} currentPath={location.pathname} renderLink={({ href, ...props }) => <Link to={href} {...props} />} brand="Whitten Hardware" header={<ThemeToggle />}>
  <Breadcrumbs items={trail} />
  <StatTile label="Sales today" value="$4,210" current={4210} previous={3900} sparkline={week} href="/reports/sales" />
</AppShell>
<ResizablePanels storageKey="layout" panels={[{ id: "files", defaultSize: 25, collapsible: true, children: files }, { id: "editor", children: editor }]} />
<ShortcutHelp />   {/* "?" lists everything registered with useShortcuts */}
<UpdatePrompt needRefresh={needRefresh} onRefresh={update} blocked={hasUnsavedChanges} />
<SessionTimeoutWarning expiresAt={session.expiresAt} onExtend={renew} onSignOut={signOut} />

useShortcuts([{ id: "inbox", keys: "g i", description: "Go to inbox", handler: () => navigate("/inbox") }]);
const outbox = useOfflineQueue({ storage: indexedDbQueueStorage(`outbox:${userId}`), send: (action) => api.post(action.type, action.payload) });
useBarcodeScanner({ onScan: addToCart, enabled: onRegisterScreen });
```

`AppShell` renders a sidebar that collapses to an icon rail with tooltips, the same navigation in a drawer on narrow screens, and a bottom tab bar on phones that respects the safe area; hubs stay current on their child routes (`isNavItemCurrent` picks the most specific match), badges cap at 99+, a skip link jumps to the content, and `renderLink` hands every link to your router. `Breadcrumbs` collapses long trails behind "Show full path". `Pagination` shows numbered pages with ellipses (`paginationRange`), the item range and a page-size select, and its compact form now drives DataTable's pager. `ResizablePanels` has keyboard separators (arrows, Shift for 10%, Home and End, Enter to collapse), Escape to cancel a drag, double-click to reset and optional persistence. `useShortcuts` registers page-wide shortcuts and two-key sequences that skip text fields unless they opt in; `ShortcutHelp` lists them grouped and `formatShortcut` renders ⌘ or Ctrl per platform. `useTheme` and `ThemeToggle` store light, dark or system, follow the system live and sync across tabs, and `themeScript` applies the theme before first paint. `OnboardingChecklist` checks items off from real state with a one-day dismissal; `Tour` dims the page around each target and anchors a step popover to it. For installable apps, `InstallPrompt` uses the browser's install offer (`captureInstallPrompt` catches it early) or shows Add to Home Screen steps on iPhone and iPad, hidden once installed or for 30 days after a dismissal; `UpdatePrompt` (with `useServiceWorkerUpdate` or vite-plugin-pwa) never dismisses itself and stays blocked while there is unsaved work; `SessionTimeoutWarning` counts down in an alert dialog with "Stay signed in" focused and announces each remaining minute; `PullToRefresh` works from the top with resistance; and `OfflineQueueStore` (`useOfflineQueue`, `OfflineQueuePanel`) keeps writes in IndexedDB or localStorage, sends them in order when online with backoff, parks them after five failures and never drops one without an explicit discard. Dashboards get `StatTile`, `TrendIndicator` (both zero is "No change", a rise from zero is +100%, `reverseColors` for costs, the direction spoken in words), `Sparkline` and `Gauge` with warning and danger thresholds. Operations get `PermissionMatrix` (roles by permissions grouped into collapsible categories with category-wide grants, search, a sticky first column, locked roles and changes counted against a baseline), `BarcodeScanner` (BarcodeDetector with the rear camera, plain-language camera errors and typed entry), `useBarcodeScanner` for keyboard-mode scanners (fast keystrokes ending in Enter or Tab, repeats ignored, leaked characters removed from text inputs, never active in textareas or editors), and `CashCount` (bills, rolled and loose coin, blanks as zero, invalid entries flagged, all math in cents, and over or short beyond a threshold flagged before submitting).

## Composer

```tsx
<PromptInput onSubmit={send} onAttach={attach} draftKey={`draft:${chatId}`} maxLength={8000}>
  <ContextChips items={context} onRemove={removeContext} />
  <PromptInputTextarea />
  <PromptInputMentions sources={{ "@": searchFilesAndPeople, "/": searchCommands }} onSelect={addContext} />
  <PromptInputFooter>
    <PromptInputTools>
      <PromptInputAttachButton />
      <UrlContextButton onAdd={addPage} />
      <ScreenshotButton onCapture={attachFile} />
      <CameraCapture onCapture={attachFile} />
      <PromptInputVoice />
      <PromptInputEnhance onEnhance={improvePrompt} />
      <ComposerOptions effort={effort} onEffortChange={setEffort} tools={tools} onToolsChange={setTools} />
    </PromptInputTools>
    <PromptInputCounter />
    <PromptInputSubmit />
  </PromptInputFooter>
</PromptInput>
```

`PromptInput` now keeps unsent text per `draftKey` in localStorage (saved after a pause, on blur and when the page hides, restored on return, removed after sending), blocks sending past `maxLength` with `PromptInputCounter` showing the count, and follows `submitOnEnter`: on touch screens without a keyboard Enter adds a line, and Ctrl or Cmd+Enter always sends. `PromptInputMentions` opens a grouped list when "@", "/" or any trigger you give a source for starts a word at the caret; focus stays in the textarea (aria-activedescendant), arrows wrap, Home and End jump, Enter or Tab inserts, Escape closes, and async sources drop stale results. `ContextChips` shows attached files, line ranges, links and selections, moves focus to the next chip on removal, and freezes on sent messages. `PromptInputVoice` and `VoiceInput` dictate through the Web Speech API with interim text and plain-language errors for blocked microphones; `ReadAloud` reads markdown without code or link targets (`speechText`). `ScreenshotButton` (`captureScreen`) treats a cancelled picker as no screenshot, and `CameraCapture` previews, switches cameras, reviews with Retake and turns the camera off as soon as it can. `PromptInputEnhance` rewrites the draft with Undo until the user edits it, `UrlContextButton` accepts http(s) pages (adding https:// when missing) and reports fetch failures in place, `SuggestionRail` scrolls a row of suggestions with arrow keys and a source note, `TemplateGallery` searches templates and asks for `{{variables}}` with a live preview (`templateVariables`, `fillTemplate`), and `ComposerOptions` sets effort, extended reasoning and tools in one popover. `FileDropzone` walks dropped folders keeping relative paths (`filePath`), skips version-control, dependency and build folders, can leave out binary files (`isProbablyBinary`), and caps count and size with reasons; UploadQueue now uses it. Effort and mode pickers use `SegmentedControl`, whose card layout covers mode toggles with descriptions.

## Conversations and collaboration

```tsx
<ChatHistory conversations={chats} folders={folders} activeId={chatId} onSelect={open} onNew={newChat} onRename={rename} onPin={pin} onArchive={archive} onMove={move} onDelete={remove} hasMore={hasMore} onLoadMore={loadMore} />
<ConversationTransfer transcript={{ title, messages }} onImport={(transcript) => createChat(transcript)} />

const { visible, hiddenCount, showEarlier } = useMessageWindow(messages, { initial: 50, scrollRef });
<EarlierMessages hiddenCount={hiddenCount} onShow={showEarlier} />
{groupMessages(visible).map((group) => (
  <Fragment key={group.messages[0].id}>
    {group.day && <DateSeparator date={group.messages[0].createdAt} />}
    {group.messages.map((message) => <ChatMessage key={message.id} {...message} />)}
  </Fragment>
))}
<MessageReactions reactions={message.reactions} onToggle={(emoji) => react(message.id, emoji)} />
<ThreadReplies count={thread.count} participants={thread.people} lastReplyAt={thread.lastAt} onReply={reply}>{replies}</ThreadReplies>
<DeliveryStatus state="delivered" at={message.deliveredAt} />
<UnreadJump count={unread} onJump={scrollToFirstUnread} onDismiss={markRead} />
<TypingIndicator names={typing.names} />
<Outbox items={queued} onEdit={editQueued} onCancel={cancelQueued} onRetry={retry} />
<FeedbackDialog open={open} rating="down" onOpenChange={setOpen} onSubmit={sendFeedback} />
<AssistantPanel contextLabel="Q3 forecast.xlsx · B2:F40" mode={mode} onModeChange={setMode}>{conversationAndComposer}</AssistantPanel>
```

`ChatHistory` groups chats into Pinned, Today, Yesterday, Previous 7 and 30 days and then by month (`groupByRecency`), searches titles and previews locally or hands the query to your server, switches between active and archived chats, filters by folder, renames inline with F2, deletes with Delete after a confirmation, moves through chats with the arrow keys, Home and End, has a menu per chat (rename, pin, duplicate, export, move to folder, archive, delete), a select mode for bulk archive, export and delete, and load more. `messagesToMarkdown` writes a readable transcript, `exportConversation` writes versioned JSON, and `parseConversationImport` reads it back (or a bare `{ role, content }` array) with caps on file size, message count and message length, known roles and string content only; `ConversationTransfer` wraps both with download, copy and a preview before anything is imported. `useMessageWindow` renders the newest messages of a long thread and reveals earlier ones in steps without moving the message the user was reading; `EarlierMessages`, `DateSeparator` (`formatDayLabel`), `NewMessagesDivider` and `groupMessages` (runs by sender, split by pauses and days) structure the thread. `MessageReactions` toggles your own reaction (`toggleReaction`) and adds new ones from `EmojiPicker`, a searchable, curated emoji set with category tabs, recently used emoji, skin tones remembered per device and a single tab stop with arrow-key movement through the grid. `ThreadReplies` collapses a thread to its participants, reply count, unread count and last activity, and expands to the replies and a reply box. `DeliveryStatus` covers queued, sending, sent, accepted, delivered, read, working, retrying, delayed, failed, bounced and recipient unavailable, with stale receipts marked and Retry on failures; `Outbox` lists messages waiting to go out with failures first, editing and cancelling for queued messages and retry for failed ones. `MessageEditor` edits a sent message inline (Enter saves, Escape cancels, Save stays off until the text changes, errors keep it open). `TypingIndicator` names who is typing ("Ana, Ben and 3 others") in a live region that stays mounted; `useTypingIndicator` sends start, periodic refresh and stop after three quiet seconds, and `useTypingUsers` expires remote typists who stop signalling. `FeedbackDialog` follows thumbs up or down with reasons, details, a suggested correction for poor answers and an explicit choice to share the conversation. `AssistantPanel` puts an assistant beside your own screens: a launcher and a hotkey (Ctrl or Cmd+J) open a non-modal panel that focuses its composer, shows what it is looking at with a way to clear it, switches between Ask and Edit, floats in the corner or docks to the side, and returns focus on Escape.

## Workspace and IDE

```tsx
<Workbench
  storageKey="ide"
  header={<FileChanges changes={changes} onOpen={openFile} onViewDiff={showDiff} onDiscard={discard} />}
  sidebar={<FileTree files={files} ignore={["node_modules/", "dist/"]} selectedPath={active} onSelect={openFile} onCreate={create} onRename={rename} onDelete={remove} onDropFiles={upload} />}
  editor={
    <WorkspaceTabs tabs={tabs} activeId={active} onActiveChange={setActive} onClose={closeTabs} onReorder={setOrder} onPinChange={pin} recentlyClosed={closed} onReopen={reopen}>
      <FileBreadcrumb path={active} files={files} onNavigate={openFile} />
      <CodeEditor ref={setEditor} value={text} onValueChange={setText} onSave={save} streaming={agentIsWriting} maskSecrets={active.endsWith(".env")} />
    </WorkspaceTabs>
  }
  panel={<DatabaseViewer tables={tables} loadRows={loadRows} />}
/>
<FileSearch onSearch={searchOnServer} onOpen={(path, line, column) => openAt(path, line, column)} />
<LockManager files={paths} locks={locks} onLockChange={setLock} />
<CommandPalette commands={commands} modes={[{ prefix: ":", label: "Go to line", commands: goToLine }]} />
<DocsViewer pages={docs} />
```

`FileTree` is a full ARIA tree: arrows, Home and End, Right and Left to open, enter and leave folders, typing to jump by name, `*` to expand siblings, Enter to open, F2 to rename in place (the extension stays unselected), Delete to remove after a confirmation, a context menu (new file, new folder, rename, copy path, delete), inline creation with name validation (`validateFileName`), drag and drop from the desktop into any folder (folders keep their structure), gitignore-style hiding (`createIgnoreMatcher`, with `**`, anchors and `!` re-includes), and badges for change status (a colored dot plus a letter, never color alone), unsaved edits, locks and changed-file counts on collapsed folders. `buildFileTree` and `visibleNodes` are exported for your own views. `FileBreadcrumb` turns each path segment into a menu of its siblings. `FileSearch` searches as you type (in the browser with `searchFileContents`, or on your server with an abort signal), with match case, whole word and regular expression toggles, invalid expressions explained, results grouped by file with highlighted matches, long lines trimmed around the match, a cap with a notice and one tab stop with arrow keys. `FileChanges` summarizes changed files with added and removed lines and opens, compares or discards them after a confirmation. `LockManager` lists locked files first with who locked them and locks anything from a searchable list. `WorkspaceTabs` keeps pinned tabs first, marks unsaved and preview tabs, closes with Delete, the close button or a middle click and moves focus to the neighbour (`neighbourAfterClose`), reorders with Alt+Shift+arrows, has a context menu (close others, close to the right, close saved, pin, copy path) and a recently closed list. `Workbench` lays out a resizable sidebar, editor and bottom panel with remembered sizes, toggles with Ctrl or Cmd+B and Ctrl+`, a header and a status bar. `CodeEditor` now saves on Ctrl or Cmd+S (`onSave`), jumps to a line and column (`ref.revealLine`), goes read-only with a notice while the assistant writes (`streaming`) and follows new text until you scroll up, hides API keys, tokens, passwords, credentials in URLs and private keys until revealed (`maskSecrets`, also `maskSecrets()` and `findSecretRanges()` for logs), and shows `BinaryFilePlaceholder` for binary content (`looksBinary`). `DocsViewer` shows generated docs with a page list, an "On this page" outline that tracks the section in view and moves focus to the heading you pick (`extractHeadings`, `slugify`), and a Generating badge while pages stream. `DatabaseViewer` browses tables with row counts, server paging and sorting, a keyboard grid (arrows, Home and End, Enter for cell detail), JSON formatting in the detail pane, `ColumnProfileCard` per column (`profileColumn`: type, empty values, distinct count, range, mean and the most common values) and the schema. `CommandPalette` opens with Ctrl or Cmd+K, ranks commands with `fuzzyMatch` (contiguous runs, word starts and camelCase humps first) and highlights the matched letters, shows recently used commands first, switches modes with prefixes such as ":" for go to line (static or async), skips disabled commands, shows shortcuts per platform and announces the result count. A separate ViewSwitcher is not included: `SegmentedControl` with icons covers code, preview and split toggles.

## Terminals, logs, runs and notebooks

```tsx
const terminal = useRef<TerminalHandle>(null);
<TerminalTabs sessions={sessions} activeId={active} onActiveChange={setActive} onNew={openShell} onClose={closeShell}>
  <Terminal ref={terminal} onData={(keys) => socket.send(keys)} onResize={({ cols, rows }) => socket.resize(cols, rows)} />
</TerminalTabs>
socket.onmessage = (event) => terminal.current?.write(event.data);

const log = useLogBuffer({ maxLines: 10_000 });
process.stdout.on("data", (chunk) => log.append(chunk, { stream: "stdout" }));
<LogViewer lines={log.lines} dropped={log.dropped} connection={state} onReconnect={reconnect} onCommand={run} historyKey="history" />

<RunPanel runners={runners} runner={runner} onRunnerChange={setRunner} onRun={run} onStop={stop} status={status} outputs={outputs} startedAt={startedAt} exitCode={code} />
<Notebook kernel={createJavaScriptKernel()} defaultCells={cells} language="javascript" />
<EventLog events={events} />
<RuntimeSelector runtimes={runtimes} value={runtime} onValueChange={setRuntime} />
```

`Terminal` wraps xterm.js, which loads on first render (`preloadTerminal` starts it early). Output written through the handle is batched once per animation frame and capped while xterm.js loads or the tab is hidden, with a plain-text fallback until then; the size follows the container, colors come from the theme tokens and follow light and dark, it is read-only unless you pass `onData`, and `screenReaderMode` turns on xterm's accessibility tree. The preset now includes xterm's CSS and `--ansi-*` color tokens tuned for 4.5:1 contrast in both themes. `TerminalTabs` shows several sessions with their run state ("running", "exited with code 1") read with the tab name, a new-terminal button and close on Delete or middle click; `WorkspaceTabs` gained the `actions` slot and per-tab `description` it uses. `LogViewer` renders ANSI colors (16, 256 and true color, `parseAnsi`), redraws carriage-return progress lines and honors erase-line sequences, marks stderr, warnings and errors, filters to errors or warnings, searches with highlights, shows timestamps on demand, follows new output until you scroll up and then offers "N new lines", wraps, copies, downloads, shows a connection banner with Reconnect, caps rendered rows, and has a command line with Up and Down history. `LogBuffer` and `useLogBuffer` turn streamed chunks into lines (lines split across chunks, one open line per stream, CRLF, redraws collapsed so progress bars don't grow, a line cap with a dropped count and level detection with `detectLogLevel`). `RunPanel` picks a runner, runs with the button or Ctrl or Cmd+Enter, stops, and shows status, elapsed time, exit code and outputs through `ExecutionOutputView`: stdout and stderr merged with colors, images with alt text, HTML in a sandboxed frame without scripts unless you allow them, JSON and errors with tracebacks. `Notebook` runs code and Markdown cells on any kernel that implements `execute` (with an abort signal and streamed outputs) and optionally `restart`: Shift+Enter runs and moves on (adding a cell at the end), Ctrl or Cmd+Enter runs in place, Alt+Enter runs and inserts below, runs queue in order with execution counts and queued and running states, Run all stops at the first failure and says where, Interrupt aborts, Restart clears counts, cells move, convert and delete with Undo, and notebooks export to and import from `.ipynb` (`notebookToIpynb`, `notebookFromIpynb`, nbformat 4 with caps). `createJavaScriptKernel` is a ready kernel that runs JavaScript in a Web Worker, off your page, with console output, the last expression displayed, `display()` and `html()` for rich output and variables that persist between cells. `EventLog` lists structured events with level filters and counts, search across messages, sources and details, and rows that expand to their details. `RuntimeSelector` picks where code runs, with versions, readiness, a recommended choice and unavailable runtimes disabled.

## Previews, review and artifacts

```tsx
<RegionCapture active={capturing} onActiveChange={setCapturing} onCapture={(image) => attach(image)} onError={(error) => showError(error.message)}>
  <WebPreview title="App" servers={[{ id: "vite", url: "http://localhost:5173" }]} waitForServer onInspect={(element) => addContext(inspectedElementToContext(element))} />
</RegionCapture>
<ArtifactViewer title="Landing page" kind="html" content={html} onFix={askAgentToFix} autoFix />
<ArtifactCard title="Landing page" kind="html" status={streaming ? "building" : "ready"} version={3} onClick={openPanel} />
<VersionHistory versions={versions} currentId={current} onRestore={restore} />

<DiffReview patch={gitDiff} onOpen={openFile} onRevert={revertFile} />
<ChangeReview oldValue={file} newValue={proposal} onApply={(text) => save(text)} />
<TrackedChanges original={draft} revised={suggestion} onResolve={setDraft} />
<InlineEdit selection={selectedText} onGenerate={({ instruction, selection, signal }) => streamEdit(instruction, selection, signal)} onReplace={replaceSelection} onInsert={insertBelow} onClose={close} />
<ReviewComments threads={threads} onReply={reply} onResolve={resolve} onJump={scrollToLine} />

<DeploymentStatus state={state} steps={steps} url={liveUrl} onDeploy={deploy} onRollback={rollback} />
<ExportProgress format="PDF" status={status} progress={progress} onDownload={download} />
<SecretField label="Anthropic API key" source={hasKey ? "saved" : "none"} hint={maskSecretHint(lastKey)} onSave={saveKey} />
<InteractivePreview title="Project" {...createProjectPreview(files)} />
<InteractivePreview title="Script" {...createPythonPreview(code)} />
```

Screen capture waits for the user's sharing decision. After permission, video playback, each frame wait, and image encoding have a 10-second limit per step. A timeout reaches `onError` and the component's status message; the built-in capture helper stops all sharing tracks and detaches the video on success or failure. A custom `capture` implementation owns its own cancellation and cleanup.

`WebPreview` is a browser-style frame around `InteractivePreview`: an address bar that only opens paths on the servers you list (`resolvePreviewAddress`), a port picker when there are several, device presets (`DEVICE_PRESETS`) with landscape and a phone or tablet frame, scale to fit, a responsive mode resized by dragging or from the keyboard (the width and height handles are separators with arrow, Shift, Home and End), reload, open in a new tab, fullscreen (`useFullscreen`, with a viewport fallback when the browser refuses) and, with `waitForServer`, `useUrlReadiness`, which sends no-cors HEAD requests with exponential backoff until the server answers. Passing `onInspect` adds an element picker: `html` previews get the inspector script (pages served to `src` previews can include `PREVIEW_INSPECTOR_SCRIPT`), hovering or focusing outlines an element, a click or Enter reports its tag, classes, text, selector, markup, size and page, Escape stops, and the host only accepts a pick while inspection is on (`readInspectorMessage` validates every field). `inspectedElementToContext` turns it into an `element` context chip (`SelectedElementChip`) and `describeInspectedElement` into prompt text. `RegionCapture` lets the user drag out an area over any content, or capture all of it from the keyboard, and screenshots it through screen capture of the current tab (`captureElementRegion`), the only way to include cross-origin preview frames; its overlay hides before the capture. `PreviewErrorBanner` shows runtime errors with full details on request, copy and Fix it, and `useAutoFix` requests a fix once per distinct set of errors after they settle, waits while work is running and stops after three attempts; `ArtifactViewer` uses both with `autoFix`. `ArtifactCard` is the inline card for an artifact in a message, with building and failed states. `VersionHistory` restores in two steps, with the confirmation in place and focus moved to it. `DiffReview` renders a unified diff (`parseUnifiedDiff`) as per-file cards with status, line counts, old and new line numbers, spoken change markers, large files collapsed and revert after a confirmation; `DiffSummary` is its header. `ChangeReview` accepts or rejects a proposed edit hunk by hunk and applies only the accepted ones (`diffHunks`, `applyHunkSelection`, which keeps line endings and the final newline). `TrackedChanges` shows prose suggestions as word-level insertions and deletions with accept and reject per change (`trackedSegments`, `resolveTrackedChanges`). `InlineEdit` runs preset or typed instructions on selected text, streams the result with Stop, then offers Replace, Insert below, Retry, Discard and the changes against the original. `ReviewComments` keeps threads anchored to lines with quotes, replies (Ctrl or Cmd+Enter), resolve and reopen, filters and a jump back to the anchor. `ImageCompare` compares two images with a keyboard slider, side by side or as a fade. `DeploymentStatus` shows steps with timing (`advanceDeployment` moves them forward), the live address with copy and open, and logs, cancel, retry, redeploy and rollback. `ExportProgress` shows a determinate or indeterminate bar with an estimate of the time left (`estimateRemaining`), then download or retry. `ShareButton` and `shareOrCopy` use the system share sheet and copy the link where there is none. `SecretField` never displays a saved key: it shows whether one is saved, comes from an environment variable or is missing, and validates, saves and removes new ones (`maskSecretHint`). `createProjectPreview` bundles a multi-file project into one preview document: stylesheets inlined, classic scripts loaded as data URLs so their source reaches the frame byte for byte, ES modules (TypeScript and JSX compiled in the frame) loaded from blob URLs with relative imports resolved, CSS and JSON imports, SVG references as data URLs and an import map for bare imports. `createSvgPreview` shows an SVG through an image so its scripts never run, and `createPythonPreview` runs Python with Pyodide, which needs the new `allowEval` option. `openSandboxedWindow` now lives with `InteractivePreview`.

## Models, usage and settings

```tsx
<ModelPicker models={models} value={modelId} onValueChange={setModelId} />
<ModelParameters model={model} value={params} onValueChange={setParams} defaults={defaultParams} />
<ModelConfigList roles={roles} models={models} onSave={saveRoles} onTest={(role, modelId) => ping(modelId)} />
<ProviderSettings providers={providers} onToggle={toggle} onBaseUrlChange={setBaseUrl} onSaveKey={saveKey} onTest={testConnection} />
<ProviderHealth providers={status} onVerify={verify} onVerifyAll={verifyAll} />
<ModelCard name="Llama 3.1 8B" quantization="Q4_K_M" sizeBytes={size} status={status} progress={progress} speed={speed} onPause={pause} onUse={use} />

<ContextMeter used={tokens} limit={model.contextWindow} segments={breakdown} />
<ContextSnapshot mode="pending" sections={nextRequest} onRemoveItem={exclude} />
<BudgetNotice estimatedTokens={estimate} estimatedCost={cost} spent={spentToday} budget={5} onReview={openSnapshot} />
<UsageReceipt details={usage} />
<UsageDashboard runs={runs} limit={25} reserved={held} perRunCap={cap} onPerRunCapChange={setCap} />
<UsageLimitBanner limit={mostConstrainedLimit(limits)} actionLabel="Upgrade" onAction={upgrade} />
<RunBudgetControl sources={sources} sourceId={source} onSourceChange={setSource} maxPerMessage={cap} onMaxPerMessageChange={setCap} />

<McpServerList servers={servers} onToggle={toggleServer} onCheck={reconnect} onRemove={removeServer} />
<ToolAuditLog entries={auditEntries} />
<PromptLibrary prompts={prompts} onUse={insertIntoComposer} onSave={savePrompt} onDelete={deletePrompt} />
<MemoryManager memories={memories} conflicts={conflicts} onApprove={approve} onReject={reject} onForget={forget} onResolveConflict={resolve} />
<AgentPicker agents={agents} value={selection} onValueChange={setSelection} participants={team} onParticipantsChange={setTeam} />
```

`ModelPicker` is a Base UI combobox grouped by provider, with fuzzy search over names, ids and providers (`modelMatches`), badges for context size, reasoning, vision, tools, price and local models, a health dot per model and a free-only filter; every option is read with its details. `HealthBadge` always says the state in words beside the dot (operational, degraded, down, not checked, checking), and `ProviderHealth` lists providers with latency, when they were last checked and Verify per provider or for all. `ProviderSettings` has an enable switch per provider, a validated base URL for local and OpenAI-compatible servers (`normalizeBaseUrl`), an `ApiKeyField` (a `SecretField` with a "Get a key" link and a prefix check) and a connection test that reports success or the error. `ModelCard` shows a local model's size, quantization and context and handles download with progress, speed and time left, pause, resume, cancel, use and delete. `ModelParameters` follows the model: reasoning effort only for reasoning models, temperature and top p locked where the model fixes them, token limits capped at the model's output and context windows and clamped when committed (`clampModelParameters`), a warning with a one-click raise when the output budget is too small for the effort (`isLowOutputBudget`) and Reset. `ModelConfigList` assigns a model per agent role, marks overrides, parameters, fallbacks and roles billed to the user's own key, tests each role, resets to the default and holds changes until Save or Discard (`changedRoles`). `ContextMeter` splits the context window by where the tokens go, with warning and critical thresholds (`contextLevel`) explained in words, and `ContextSnapshot` shows what the model saw or what the next message will send, expandable, copyable as JSON and with items you can leave out. `BudgetNotice` estimates the next message's tokens and cost above the composer and warns near or past the budget (`budgetNoticeTone`). `UsageReceipt` opens a one-line summary into the full receipt (requested versus actual model and why, fallbacks, cached and reasoning tokens, timing, reported or estimated cost) and copies it with the request id redacted (`formatUsageReceipt`). `UsageDashboard` combines stat tiles, the budget bar, a per-run cap and a filterable, sortable table of runs that marks estimated costs and exports CSV (`usageRunsToCsv`) or JSON. `UsageLimitCard` shows what is left of each plan limit with reset countdowns, and `UsageLimitBanner` appears under the composer only when a limit is near or reached. `RunBudgetControl` picks who pays (with balances, and unavailable sources explained) and caps one message's spend with presets, a custom amount and stop-or-ask at the cap. `McpServerList` shows MCP servers with status, transport, tools and their parameters, an enable switch, reconnect and removal with confirmation. `ToolAuditLog` records tool calls as succeeded, failed or denied with duration, actor, search, status filters and arguments in a JSON viewer. `PromptLibrary` saves prompts with tags and favorites and fills `{{variables}}` with a live preview before use (`promptVariables`, `fillPrompt`). `MemoryManager` reviews what the assistant remembers (approve, reject, edit, forget, confidence, source and expiry) and resolves `MemoryConflict`s by keeping one, both or a merged version. `AgentPicker` chooses a single model, a saved team or a template, and builds a custom team of models with roles. `PermissionMatrix` (above) covers tool permissions, and the shared `switchRoot`, `switchThumb`, `tabList` and `tabTrigger` classes are exported with the others.

## Knowledge, evidence, insights and agents

```tsx
<KnowledgeBase collections={collections} sourceIds={sources} onSourceIdsChange={setSources} onUpload={upload} onReindex={reindex} onRetry={retry} onRemoveDocument={remove} />
<SearchScope value={scope} onValueChange={setScope} />
<QueryExpansion query={query} terms={expansions} onToggle={toggleTerm} onSearchExact={searchExact} />
<SearchResultCard result={result} query={query} added={inContext} onAddedChange={setInContext} />

const { text, order } = rewriteCitations(answer, sources.map((source) => source.id));
<CitedText text={text} sourceTitles={order.map(titleOf)} idPrefix="answer" />
<EvidencePanel evidence={order.map(evidenceFor)} idPrefix="answer" coverage={0.8} limitations={limitations} />
<ClaimLedger claims={claims} onDecide={decide} />
<RetrievalInspector trace={trace} />
<ModelComparison prompt={prompt} candidates={answers} preferredId={preferred} onPrefer={setPreferred} />

<InsightCard title="Register 2 was short" severity="critical" summary={summary} details={why} onAcknowledge={acknowledge} onRefresh={rerun} />
<AnalyzeButton label="Refresh all" onAnalyze={async () => tally(await Promise.allSettled(jobs))} />
<SuggestionCard title="Suggested details" values={suggested} onApply={apply} onUndo={restore} />
<SentimentBadge score={review.sentiment} />
<CandidatePicker question="Which elbow did you mean?" candidates={matches} onSelect={confirm} onNone={skip} progress={{ matched, total }} />

<AgentRunView nodes={agents} edges={handoffs} status={status} startedAt={startedAt} budget={{ spent, limit }} onPause={pause} onResume={resume} onStop={stop} onContinueWithBudget={addBudget} />
useNotificationPolling((signal) => refreshNotifications(signal), { open });
<NotificationCenter notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead} hasMore={hasMore} onLoadMore={loadMore} open={open} onOpenChange={setOpen} />
```

`KnowledgeBase` lists document collections with their health (`collectionHealth`) and a "use as a source" checkbox, and for the open collection an upload area (`FileDropzone`), each document's indexing status with progress, chunk count, retry and removal after confirmation, re-index and new collections; `UploadQueue` (above) covers pausable uploads. `SearchScope` chooses your files, the web or both. `SearchResultCard` shows source, site, date, relevance and a snippet with the query highlighted (`queryTerms`, `highlightTerms`), adds or removes the result from the conversation, and opens `PassagePreview`, a dialog for reading each passage before citing it. `QueryExpansion` shows the terms AI added to a search, each switchable, and a way back to the exact query. `rewriteCitations` turns `[^id]`, `[cite:id]` and `【id】` markers into `[1]`, `[2]` in order of first use and drops unknown ones, `CitedText` renders those numbers as buttons that move focus to the matching source, and `EvidencePanel` numbers the sources with their quoted passages and locations, flags quotes that weren't found in their source, shows how much of the answer the sources cover and its limitations, and folds sources past the first few. `ClaimLedger` lists each claim as supported, contradicted or unverified with confidence and citations; reviewers accept or reject open claims and the coverage bar shows when the answer is settled (`claimCoverage`). `RetrievalInspector` shows how context was retrieved: strategies, latency, entities and each item's tier, score, confidence, age and contribution, with the raw response in a JSON viewer. `ModelComparison` places answers from several models side by side with quality, sources, latency, tokens and cost, marks the best value of each metric in words (`bestByMetric`), shows failures in place and records a preference. `InsightCard` presents an AI finding with its severity in words and color, numbers, expandable reasoning, actions, acknowledge and refresh, and `AnalyzeButton` runs an analysis and reports when it finished or how many parts failed. `SuggestionCard` shows suggested values beside the current ones with their reasoning, to apply, edit first or dismiss, with undo. `SentimentBadge` names sentiment in words with its score (`sentimentLabel`). `CandidatePicker` asks which of several matches the user meant, with images, SKUs, prices and why each matched, locks while saving and tracks progress through several items. `AgentGraph` lays agents out left to right with a small layered layout (`layoutLayers`, no graph library), labels the handoffs, reads each agent's connections with it and moves between agents with the arrow keys; `AgentRunView` adds run status, elapsed time, turns, steps and cost, the budget with continue-with-more once it runs out, pause, resume and stop, and the selected agent's details. `NotificationCenter` is a bell with the unread count (99+, said in words) that opens all or unread notifications, marks them read when opened, marks all read and loads more, and `useNotificationPolling` polls often while it is open, rarely while closed, never in a hidden tab and at once when the tab returns.

## Components

- Primitives: `Button`, `ButtonGroup`, `Badge`, `Card` (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`), `Avatar`, `AvatarGroup`, `Kbd`, `KbdGroup`, `Spinner`, `Separator`, `AspectRatio`, `CopyButton`, `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`, `TooltipProvider`, `HoverCard`, `DropdownMenu`, `ContextMenu`, `Menubar`, `NavigationMenu`, `ScrollArea`, plus `buttonClasses`, `shortcutKeys`, `navigationMenuTriggerClass`
- Form controls and layout: `Label`, `Textarea`, `InputGroup`, `Switch`, `Checkbox`, `CheckboxGroup`, `RadioGroup`, `RadioCard`, `Select` (+ composable parts), `Combobox`, `MultiSelect`, `Slider`, `Progress`, `Meter`, `Toggle`, `ToggleGroup`, `Tabs`, `Accordion`, `Collapsible`, `Table` (+ parts), `TimePicker`, `Fieldset`, plus `getMeterTone`, `cycleSortDirection`, `parseTime`, `formatTime`
- Data display: `Carousel`, `TreeView`, `DescriptionList`, `Countdown`, `Timer`, `VirtualList`, `InfiniteScroll`, `Masonry`, `Marquee`, `QRCode`, `TransferList`, `SortableList`, `CircularProgress`, `CalendarHeatmap`, plus `encodeQR`, `qrToSvgString`, `qrSvgPath`, `flattenVisibleTree`, `computeTreeCheckState`, `toggleTreeChecked`, `splitDuration`, `computeVirtualRange`, `computeMasonryLayout`, `masonryColumnCount`, `moveItem`, `buildHeatmapMatrix`, `heatmapLevel`, `heatmapColor`, `resolveSlidesPerView`, `usePrefersReducedMotion`, `useMeasuredHeights`
- Site sections: `SiteHeader`, `Hero`, `FeatureGrid`, `StatsBand`, `PricingTable`, `PlanComparison`, `Testimonials`, `Faq`, `LogoCloud`, `CtaSection`, `NewsletterSignup`, `ContactForm`, `BlogCard`, `BlogGrid`, `TeamGrid`, `SiteFooter`, `SiteSection`, `SiteActionButton`, `SubmitStatusMessage`, plus `yearlySavings`, `validateContact`, `isValidEmail`, `characterCount`, `faqJsonLd`, `filterFaqItems`, `formatPostDate`, `formatStatValue`, `childHeadingLevel`, `useSubmitStatus`
- Chat: `Conversation`, `Message` (+ `MessageAvatar`, `MessageBody`, `MessageBubble`), `MessageContent`, `CodeBlock`, `PromptInput`, `Suggestion`, `Attachment`, `MessageActions` presets, `ModelSelector`, `BranchNavigator`
- Agent output: `ToolCall` (+ `ToolCallApproval`), `Reasoning`, `Sources` and `InlineCitation`
- Workspace: `Artifact`, `ArtifactPreview`, `Canvas`, `DocumentEditor`, `CodeEditor`, `DiffView`
- Generative surfaces: `InteractivePreview`, `DataTable`, `Chart`, `FileViewer`, `Whiteboard`
- Artifacts and media: `ArtifactViewer`, `ArtifactThumbnail`, `JsonViewer`, `CsvExplorer`, `SlideDeck`, `ImageGallery`, `Lightbox`, `ImageCropper`, `MediaPlayer`, `PdfViewer`
- Office: `DesignEditor` (+ `DesignPageSvg` and geometry helpers), `RichTextEditor` (+ `markdownToDoc`, `docToMarkdown`, `richTextSchema`, `countText`), `HtmlEditor` (+ `htmlSchema`, `htmlToDoc`, `docToHtml`, `sanitizeHtml`, `cleanPastedHtml`, `formatHtml`, `embedFromUrl`, `htmlToText`, `HTML_CONTENT_CSS`, `pagePrintCss`, `fillPageTemplate`, block commands such as `turnInto` and `moveBlock`, media commands such as `wrapInCallout`, `insertColumns` and `setFigureAlign`, `acceptAllChanges`, `rejectAllChanges`, `listChanges`, `DEFAULT_HTML_AI_ACTIONS`, `buildAiRequest`, `insertAiText`), `PageBuilder` (+ `builderToHtml`, `normalizeBuilderDocument`, `createBuilderDocument`, `createBuilderBlock`, block operations, `renderLeafHtml`, `inlineTextHtml`), `Spreadsheet` (+ `createWorkbookEvaluator`, `shiftFormulaReferences`, `transformFormulaReferences`, `inferFillSeries`, `insertAxis`, `deleteAxis`, `sortRange`, `fillRange`, `detectDelimiter`, `toDelimited`), `ActionMenu`, `ActionContextMenu`
- Agent runs: `RunStatusBar`, `ActionList`, `RunTimeline`, `PlanCard`, `TaskList`, `ToolTrace`, `ActivityTrace`, `ProgressSteps`, `SubAgentSession`, `StreamStatus`, `TruncationNotice`, `ActionResultCard`, `StepStatusIcon`
- Scheduling: `EventCalendar`, `CalendarMonth`, `DatePicker`, `DateRangePicker` (+ `defaultDatePresets`), `KanbanBoard` (+ `rankAt`), `Timeline`, and date helpers (`expandEvents`, `layoutDay`, `parseRecurrence`, `describeRecurrence`, `monthGrid`, `rankBetween`, `addDays`, `addMonths`, `startOfWeek`, `toIsoDate`, `parseIsoDate`)
- Forms: `FormField`, `TextInput`, `TagInput`, `NumberInput`, `CurrencyInput`, `OTPInput`, `PasswordField`, `Rating`, `SegmentedControl`, `FilterChips`, `SearchInput`, `ColorPicker`, `ColorPickerPanel`, `Stepper`, `FormWizard`, `SignaturePad`, `CsvColumnMapper`, `UploadQueue`, plus `useFormDraft`, `useUploadQueue`, `UploadQueueStore`, `scorePassword`, `generatePassword`, `parseColor`, `toHex`, `contrastRatio`, `autoMapColumns`, `applyColumnMapping`
- Shell and operations: `AppShell`, `Breadcrumbs`, `Pagination`, `ResizablePanels`, `ShortcutHelp`, `ShortcutKeys`, `ThemeToggle`, `OnboardingChecklist`, `Tour`, `InstallPrompt`, `UpdatePrompt`, `SessionTimeoutWarning`, `PullToRefresh`, `OfflineQueuePanel`, `StatTile`, `TrendIndicator`, `Sparkline`, `Gauge`, `PermissionMatrix`, `BarcodeScanner`, `CashCount`, plus `useShortcuts`, `useTheme`, `themeScript`, `useInstallPrompt`, `useServiceWorkerUpdate`, `useOfflineQueue`, `OfflineQueueStore`, `indexedDbQueueStorage`, `useBarcodeScanner`, `paginationRange`, `computeTrend`, `cashCountTotal`
- Composer: `PromptInputMentions`, `PromptInputCounter`, `ContextChips`, `PromptInputVoice`, `VoiceInput`, `ReadAloud`, `ScreenshotButton`, `CameraCapture`, `PromptInputEnhance`, `UrlContextButton`, `SuggestionRail`, `TemplateGallery`, `ComposerOptions`, `FileDropzone`, plus `useDictation`, `useSpeechSynthesis`, `useStoredDraft`, `findMention`, `captureScreen`, `openCamera`, `filterFiles`, `filesFromDataTransfer`
- Knowledge, evidence, insights and agents: `KnowledgeBase`, `SearchScope`, `SearchResultCard`, `PassagePreview`, `QueryExpansion`, `EvidencePanel`, `CitedText`, `ClaimLedger`, `RetrievalInspector`, `ModelComparison`, `InsightCard`, `AnalyzeButton`, `SuggestionCard`, `SentimentBadge`, `CandidatePicker`, `AgentGraph`, `AgentRunView`, `NotificationCenter`, plus `rewriteCitations`, `splitCitationNumbers`, `claimCoverage`, `collectionHealth`, `queryTerms`, `highlightTerms`, `bestByMetric`, `sentimentLabel`, `layoutLayers`, `badgeCount`, `useNotificationPolling`, `displayHost`
- Models, usage and settings: `ModelPicker`, `HealthBadge`, `ProviderHealth`, `ProviderSettings`, `ApiKeyField`, `ModelCard`, `ModelParameters`, `ModelConfigList`, `ContextMeter`, `ContextSnapshot`, `BudgetNotice`, `UsageReceipt`, `UsageDashboard`, `UsageLimitCard`, `UsageLimitBanner`, `RunBudgetControl`, `McpServerList`, `ToolAuditLog`, `PromptLibrary`, `MemoryManager`, `MemoryConflict`, `AgentPicker`, plus `modelMatches`, `formatTokenCount`, `formatModelPrice`, `estimateCost`, `groupModelsByProvider`, `clampModelParameters`, `isLowOutputBudget`, `contextLevel`, `budgetNoticeTone`, `formatUsageReceipt`, `usageRunsToCsv`, `mostConstrainedLimit`, `filterAuditEntries`, `promptVariables`, `fillPrompt`, `normalizeBaseUrl`
- Previews and review: `WebPreview`, `RegionCapture`, `SelectedElementChip`, `PreviewErrorBanner`, `ArtifactCard`, `VersionHistory`, `DiffReview`, `DiffSummary`, `PatchHunkView`, `ChangeReview`, `TrackedChanges`, `InlineEdit`, `ReviewComments`, `ImageCompare`, `DeploymentStatus`, `ExportProgress`, `ShareButton`, `SecretField`, plus `useAutoFix`, `useUrlReadiness`, `useFullscreen`, `createProjectPreview`, `createSvgPreview`, `createPythonPreview`, `PREVIEW_INSPECTOR_SCRIPT`, `readInspectorMessage`, `inspectedElementToContext`, `describeInspectedElement`, `captureElementRegion`, `parseUnifiedDiff`, `diffHunks`, `applyHunkSelection`, `trackedSegments`, `advanceDeployment`, `shareOrCopy`, `maskSecretHint`, `openSandboxedWindow`
- Execution: `Terminal`, `TerminalTabs`, `LogViewer`, `AnsiText`, `RunPanel`, `ExecutionOutputView`, `Notebook`, `EventLog`, `RuntimeSelector`, plus `useLogBuffer`, `LogBuffer`, `TerminalBuffer`, `createJavaScriptKernel`, `parseAnsi`, `stripAnsi`, `applyCarriageReturns`, `detectLogLevel`, `notebookToIpynb`, `notebookFromIpynb`, `createNotebookCell`, `preloadTerminal`
- Workspace and IDE: `Workbench`, `FileTree`, `FileStatusBadge`, `FileBreadcrumb`, `FileSearch`, `FileChanges`, `LockManager`, `WorkspaceTabs`, `CommandPalette`, `DocsViewer`, `DatabaseViewer`, `ColumnProfileCard`, `BinaryFilePlaceholder`, plus `buildFileTree`, `visibleNodes`, `createIgnoreMatcher`, `validateFileName`, `searchFileContents`, `fuzzyMatch`, `fuzzyFilter`, `highlightRanges`, `maskSecrets`, `findSecretRanges`, `looksBinary`, `extractHeadings`, `profileColumn`, `neighbourAfterClose`
- Conversations: `ChatHistory`, `ConversationTransfer`, `EarlierMessages`, `DateSeparator`, `NewMessagesDivider`, `UnreadJump`, `MessageReactions`, `EmojiPicker`, `EmojiPickerPanel`, `ThreadReplies`, `ThreadReplyBox`, `MessageEditor`, `DeliveryStatus`, `Outbox`, `TypingIndicator`, `FeedbackDialog`, `AssistantPanel`, plus `useMessageWindow`, `useTypingIndicator`, `useTypingUsers`, `groupByRecency`, `groupMessages`, `formatDayLabel`, `messagesToMarkdown`, `exportConversation`, `parseConversationImport`, `toggleReaction`, `searchEmoji`, `withSkinTone`, `formatTypingNames`, `downloadText`, `downloadBlob`
- Human in the loop: `ActionApproval`, `ApprovalQueue`, `CostApproval`, `BudgetBar`, `JobList`, `ClarifyingQuestions`, `AgentError`, `ChatAlert`, `QueryReview`, `BatchReview`, `ConsentCard`
- Feedback: `Toaster`/`useToast`, `ConfirmDialog`, `Banner`, `SurfaceState`, `DeferredSurface`, `Skeleton`, `StatusPill`, `SyncStatus`, `SaveStatus`, `ConnectionStatus`, `Shimmer`, `ThinkingIndicator`, `TypingDots`, `PresenceAvatars`, `ConversationMarker`, `InputCounter`
- Hooks and helpers: `useStreamBuffer`, `useOnlineStatus`, `useNow`, `formatRelativeTime`, `formatDuration`, `formatCompactNumber`, `formatAmount`, `classifyError`, `isReadOnlySql`, `splitSqlStatements`, `useStickToBottom`, `useAutosizeTextarea`, `useCopyToClipboard`, `useControllableState`, `useDialogMode`, `useElementSize`, `useObjectUrl`, `createReactPreview`, `safeUrl`, `repairMarkdown`, `splitMarkdownBlocks`, `parseDelimited`, `formatBytes`, `cn`

Interactive parts use Base UI (Accordion, AlertDialog, Avatar, Button, Checkbox, CheckboxGroup, Collapsible, Combobox, ContextMenu, Dialog, Drawer, Field, Fieldset, Input, Menu, Menubar, Meter, NavigationMenu, NumberField, OTPField, Popover, PreviewCard, Progress, RadioGroup, ScrollArea, Select, Separator, Slider, Switch, Tabs, Toggle, ToggleGroup, Toolbar, Tooltip) or native elements with explicit ARIA, every icon-only control has an accessible name, and animations respect `prefers-reduced-motion`. Motion is not a dependency: collapsibles animate with Base UI's CSS variables and nothing else needed physics.

## Development

```sh
npm ci
npm run dev                                   # playground: chat and ?demo=workbench
npm run typecheck && npm run lint && npm test
npm run build && npm run check:css && npm run check:package
npm run test:browser                          # needs a Playwright Chromium
```

`check:css` compiles the preset with the Tailwind v4 CLI, with automatic source detection off, to prove the preset alone finds the component classes. `check:package` installs the packed tarball into a fresh project, typechecks the public API with negative type tests, renders every component on the server, compiles a copied `src/` and builds the installed preset. `test:browser` builds the playground and drives the chat page, the workbench and every gallery section in Chromium with the keyboard and pointer (streaming follow and release, clipboard, lazy editors, full-screen popups, sandbox isolation, the compiled React and project previews, terminals and notebooks, the element inspector and region capture, model and usage settings, knowledge and evidence, the agent graph and notifications, nested menus, dialogs, comboboxes, the virtual list, the carousel and the site header's mobile menu among them), with axe WCAG 2.1 AA scans in light, dark and mobile layouts; screenshots and reports land in `.browser-artifacts/`. Region capture is exercised with Chromium's `--auto-accept-this-tab-capture` switch.
