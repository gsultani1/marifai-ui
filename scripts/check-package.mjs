// scripts/check-package.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";

const root = process.cwd();
const staging = resolve(root, ".package-check");
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, "Run this check with npm run check:package");
const own = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const checks = [];
const pass = (label) => {
  checks.push(label);
  console.log(`ok - ${label}`);
};
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const CONSUMER = `import { renderToStaticMarkup } from "react-dom/server";
import {
  Artifact, ArtifactContent, ArtifactHeader, ArtifactModeToggle, ArtifactPreview, ArtifactTitle,
  Attachment, Attachments, BranchNavigator, Canvas, CanvasMain, CanvasPanel, CanvasResizeHandle, Chart,
  CodeBlock, CodeEditor, Conversation, ConversationContent, ConversationScrollButton, DataTable, DiffView,
  DocumentEditor, FileViewer, HtmlEditor, InlineCitation, InteractivePreview, Message, MessageActions, MessageBody,
  MessageContent, MessageCopyAction, MessageFeedbackActions, ModelSelector, PageBuilder, PromptInput, PromptInputFooter,
  PromptInputSubmit, PromptInputTextarea, Reasoning, ReasoningContent, ReasoningTrigger, Source, Sources,
  SourcesContent, SourcesTrigger, Suggestion, Suggestions, ToolCall, ToolCallApproval, ToolCallContent,
  ToolCallInput, ToolCallResult, ToolCallTrigger, Whiteboard, createReactPreview, type PreviewSandboxToken,
  DEFAULT_HTML_AI_ACTIONS, HTML_CONTENT_CSS, acceptAllChanges, pagePrintCss, type HtmlAiHandler, type RichTextComment,
} from "@sultanico/ai-ui";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarGroup, Badge, Button, ButtonGroup, CalendarHeatmap, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Carousel, Checkbox, Combobox, ContactForm, Countdown, DescriptionList, Dialog, DialogContent, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  Faq, Hero, KbdGroup, Marquee, Masonry, Meter, MultiSelect, NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, PricingTable, Progress, QRCode, RadioGroup, ScrollArea, Select, SiteFooter, SiteHeader, Slider, SortableList, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, TimePicker, Tooltip, TransferList, TreeView, VirtualList,
} from "@sultanico/ai-ui";
import { Message as DirectMessage } from "@sultanico/ai-ui/components/message";
import { useStickToBottom } from "@sultanico/ai-ui/hooks/use-stick-to-bottom";

const noop = () => undefined;
const sandbox: PreviewSandboxToken[] = ["allow-forms"];
void useStickToBottom;
const reportComments: RichTextComment[] = [{ id: "c-grills", body: "Room for both racks?", author: "Dana Ortiz" }];
const rewrite: HtmlAiHandler = async (request, signal) => (signal.aborted ? "" : request.text.toUpperCase());
const printCss: string = HTML_CONTENT_CSS + pagePrintCss({ pageSize: "a4", header: "Whitten Hardware · {title}", title: "store-reset-report" });
const publish: (html: string) => string = acceptAllChanges;
void printCss;
void publish;

const view = (
  <>
    <Conversation>
      <ConversationContent>
        <Message from="user"><MessageBody><MessageContent>{"**Installed** from the tarball"}</MessageContent></MessageBody></Message>
        <DirectMessage from="assistant">
          <MessageBody>
            <Reasoning duration={2}><ReasoningTrigger /><ReasoningContent>{"Thinking"}</ReasoningContent></Reasoning>
            <ToolCall name="lookup" status="awaiting-approval">
              <ToolCallTrigger />
              <ToolCallContent>
                <ToolCallApproval onApprove={async () => undefined} onDeny={noop} />
                <ToolCallInput input={{ id: 1 }} />
                <ToolCallResult result={{ ok: true }} />
              </ToolCallContent>
            </ToolCall>
            <CodeBlock code="const x = 1;" language="ts" />
            <p>Claim<InlineCitation index={1} source={{ url: "https://example.com", title: "Example" }} /></p>
            <Sources><SourcesTrigger count={1} /><SourcesContent><Source href="https://example.com" title="Example" /></SourcesContent></Sources>
            <BranchNavigator index={0} count={2} onIndexChange={noop} />
            <MessageActions><MessageCopyAction text="copy" /><MessageFeedbackActions value={null} onValueChange={noop} /></MessageActions>
          </MessageBody>
        </DirectMessage>
        <Suggestions><Suggestion suggestion="Next step" onSelect={noop} /></Suggestions>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <PromptInput onSubmit={async () => undefined}>
      <Attachments><Attachment name="notes.md" onRemove={noop} /></Attachments>
      <PromptInputTextarea />
      <PromptInputFooter>
        <ModelSelector models={[{ id: "core", name: "Core" }]} defaultValue="core" />
        <PromptInputSubmit />
      </PromptInputFooter>
    </PromptInput>
    <Canvas open>
      <CanvasMain>Chat</CanvasMain>
      <CanvasResizeHandle />
      <CanvasPanel>
        <Artifact>
          <ArtifactHeader><ArtifactTitle>Report</ArtifactTitle><ArtifactModeToggle /></ArtifactHeader>
          <ArtifactContent><ArtifactPreview kind="markdown" content="# Report" /></ArtifactContent>
        </Artifact>
      </CanvasPanel>
    </Canvas>
    <CodeEditor defaultValue="const editor = true;" language="ts" />
    <DocumentEditor defaultValue="# Document" />
    <DiffView oldValue={"a\\n"} newValue={"b\\n"} />
    <DataTable columns={[{ key: "name", header: "Name" }]} rows={[{ name: "typed" }]} caption="Rows" />
    <Chart type="bar" data={[{ month: "Jan", sales: 3 }]} categoryKey="month" series={[{ key: "sales", label: "Sales" }]} />
    <FileViewer src="/files/report.csv" />
    <InteractivePreview title="Preview" html="<p>Preview</p>" sandbox={sandbox} />
    <InteractivePreview title="React" {...createReactPreview("export default () => null;")} />
    <Whiteboard defaultElements={[{ id: "a", type: "rectangle", x: 0, y: 0, width: 80, height: 40 }]} />
    <HtmlEditor defaultValue={"<p>Server <b>rendered</b> copy</p><script>bad()</script>"} />
    <HtmlEditor
      defaultValue={'<h1>Store reset report</h1><p>Move <span data-comment-id="c-grills">grills</span> to aisle 4.</p>'}
      title="store-reset-report"
      layout="page"
      pageSize="a4"
      defaultHeader="Whitten Hardware · {title}"
      comments={reportComments}
      onCommentsChange={noop}
      author="Dana Ortiz"
      review
      defaultTrackChanges
      onAiRequest={rewrite}
      aiActions={DEFAULT_HTML_AI_ACTIONS}
      aria-label="Store reset report"
    />
    <PageBuilder defaultValue={{ title: "Sale", preheader: "", settings: { width: 600, background: "#f4f4f5", contentBackground: "#ffffff", fontFamily: "Arial, sans-serif", textColor: "#1f2937", linkColor: "#1d4ed8", padding: 24 }, blocks: [{ id: "h", type: "heading", text: "Spring sale", level: 1, align: "center" }] }} label="Sale email" />
  </>
);
const items = [{ id: "a", name: "Claw hammer" }, { id: "b", name: "Hand saw" }];
const general = (
  <>
    <Button onClick={noop}>Save order</Button>
    <ButtonGroup aria-label="Report range"><Button variant="outline">Day</Button><Button variant="outline">Week</Button></ButtonGroup>
    <Badge variant="warning" dot>Low stock</Badge>
    <Card><CardHeader><CardTitle>Weekly sales</CardTitle><CardDescription>All registers</CardDescription></CardHeader><CardContent>$12,480</CardContent></Card>
    <AvatarGroup max={2} label="Assigned to"><Avatar name="Dana Ortiz" /><Avatar name="Sam Lee" /><Avatar name="Pat Kim" /></AvatarGroup>
    <KbdGroup keys="Mod+K" />
    <Tooltip content="Print receipt"><Button size="icon" aria-label="Print receipt">P</Button></Tooltip>
    <Dialog><DialogTrigger>Add product</DialogTrigger><DialogContent><DialogTitle>Add product</DialogTitle></DialogContent></Dialog>
    <DropdownMenu><DropdownMenuTrigger>Order actions</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Open</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <NavigationMenu aria-label="Store sections"><NavigationMenuList><NavigationMenuItem><NavigationMenuLink href="/deals">Weekly deals</NavigationMenuLink></NavigationMenuItem></NavigationMenuList></NavigationMenu>
    <ScrollArea label="Recent orders">Orders</ScrollArea>
    <Switch label="Low stock alerts" />
    <Checkbox label="Print a copy" />
    <RadioGroup label="Delivery method" options={[{ value: "pickup", label: "In-store pickup" }]} defaultValue="pickup" />
    <Select options={[{ value: "tools", label: "Tools" }]} placeholder="Choose a category" />
    <Combobox options={[{ value: "lake", label: "Lakeside Lumber" }]} />
    <MultiSelect options={[{ value: "paint", label: "Paint" }]} />
    <Slider label="Price range" defaultValue={[20, 80]} max={200} />
    <Progress label="Uploading" value={40} />
    <Meter label="Deck screws" value={12} max={200} low={25} high={150} optimum={200} />
    <Tabs defaultValue="a"><TabsList aria-label="Store"><TabsTrigger value="a">Overview</TabsTrigger></TabsList><TabsContent value="a">Panel</TabsContent></Tabs>
    <Accordion><AccordionItem value="r"><AccordionTrigger>Returns</AccordionTrigger><AccordionContent>Within 30 days</AccordionContent></AccordionItem></Accordion>
    <Table label="Inventory"><TableHeader><TableRow><TableHead>Item</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Claw hammer</TableCell></TableRow></TableBody></Table>
    <TimePicker defaultValue="07:30" aria-label="Opens at" />
    <Carousel label="Drill photos" items={[{ id: "front", label: "Front", content: "Front view" }]} />
    <TreeView label="Categories" nodes={[{ id: "tools", label: "Tools", children: [{ id: "drills", label: "Drills" }] }]} />
    <DescriptionList items={[{ term: "Phone", details: "(555) 010-4477" }]} />
    <Countdown target={new Date("2027-01-01T00:00:00Z")} label="Sale ends in" />
    <VirtualList items={items} label="SKUs" height={200} itemHeight={40} renderItem={(item) => item.name} />
    <Masonry items={items} getKey={(item) => item.id} renderItem={(item) => item.name} />
    <Marquee label="Supplier logos">Orgill</Marquee>
    <QRCode value="https://example.com/store" />
    <TransferList items={items.map((item) => ({ id: item.id, label: item.name }))} />
    <SortableList label="Pick list" items={items} onReorder={noop} getKey={(item) => item.id} getLabel={(item) => item.name} renderItem={(item) => item.name} />
    <CalendarHeatmap label="Daily sales" values={[]} start={new Date("2026-01-01")} end={new Date("2026-03-01")} />
    <SiteHeader brand="Riverside Hardware" brandHref="/" nav={[{ label: "Home", href: "/" }]} currentPath="/" />
    <Hero title="Everything for the job" description="Tools, paint and advice." primaryAction={{ label: "Order for pickup", href: "/shop" }} />
    <PricingTable plans={[{ id: "pro", name: "Pro", monthlyPrice: 29, yearlyPrice: 290, features: ["10% off tools"], cta: { label: "Start Pro", href: "/join" } }]} />
    <Faq items={[{ id: "hours", question: "What are your hours?", answer: "7 am to 7 pm daily." }]} structuredData />
    <ContactForm onSubmit={async () => undefined} />
    <SiteFooter brand="Riverside Hardware" columns={[{ title: "Shop", links: [{ label: "Tools", href: "/tools" }] }]} copyrightHolder="Riverside Hardware Co." />
  </>
);

// @ts-expect-error message authors are limited to user, assistant and system
const invalidRole = <Message from="tool" />;
// @ts-expect-error previews never accept allow-same-origin
const unsafePreview = <InteractivePreview title="Unsafe" sandbox={["allow-same-origin"]} />;
// @ts-expect-error tool statuses are a closed set
const invalidStatus = <ToolCall name="x" status="done" />;
void invalidRole;
void unsafePreview;
void invalidStatus;

console.log(renderToStaticMarkup(view) + renderToStaticMarkup(general));
`;

const OWNED = `import { Message, MessageBody, MessageContent } from "./owned-ui/index.js";

export const owned = (
  <Message from="user">
    <MessageBody>
      <MessageContent>{"Owned source"}</MessageContent>
    </MessageBody>
  </Message>
);
`;

await mkdir(staging, { recursive: true });
const consumer = await mkdtemp(resolve(staging, "consumer-"));
try {
  const [pack] = JSON.parse(run(process.execPath, [npmCli, "pack", "--ignore-scripts", "--json", "--pack-destination", staging], root));
  const paths = new Set(pack.files.map((file) => file.path));
  for (const expected of [
    "LICENSE",
    "README.md",
    "package.json",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/components/message.js",
    "dist/components/code-editor-view.js",
    "src/index.ts",
    "src/styles/preset.css",
  ]) {
    assert.ok(paths.has(expected), `tarball is missing ${expected}`);
  }
  const stray = [...paths].filter((path) => /^(test|example|scripts|node_modules|\.)/.test(path));
  assert.deepEqual(stray, [], "tarball contains development files");
  pass(`tarball holds dist, source, preset, README and LICENSE (${pack.files.length} files)`);

  const tarball = resolve(staging, pack.filename);
  await writeFile(
    resolve(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@sultanico/ai-ui": `file:${tarball}`,
        react: own.devDependencies.react,
        "react-dom": own.devDependencies["react-dom"],
        tailwindcss: own.devDependencies.tailwindcss,
      },
      devDependencies: {
        "@tailwindcss/cli": own.devDependencies["@tailwindcss/cli"],
        "@types/react": own.devDependencies["@types/react"],
        "@types/react-dom": own.devDependencies["@types/react-dom"],
        typescript: own.devDependencies.typescript,
      },
    }),
  );
  run(process.execPath, [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"], consumer);
  pass("fresh install from the tarball");

  await writeFile(resolve(consumer, "consumer.tsx"), CONSUMER);
  await cp(resolve(consumer, "node_modules/@sultanico/ai-ui/src"), resolve(consumer, "owned-ui"), { recursive: true });
  await writeFile(resolve(consumer, "owned-consumer.tsx"), OWNED);
  await writeFile(
    resolve(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true,
        outDir: "out",
      },
      include: ["consumer.tsx", "owned-consumer.tsx"],
    }),
  );
  run(process.execPath, [resolve(consumer, "node_modules/typescript/bin/tsc")], consumer);
  pass("public API, subpath exports and copied source typecheck in a strict consumer");
  pass("negative type checks reject an unknown author, allow-same-origin and an unknown tool status");

  const markup = run(process.execPath, [resolve(consumer, "out/consumer.js")], consumer);
  for (const needle of [">Installed</strong>", 'aria-label="Send message"', 'role="separator"', "Content-Security-Policy", "Server rendered copy", "Store reset report", 'aria-label="Heading: Spring sale"', 'data-slot="button"', ">Weekly sales<", 'data-slot="qr-code"', 'data-slot="site-header"', 'data-slot="calendar-heatmap"', 'data-slot="pricing-table"', 'data-slot="time-picker"', 'data-slot="tree-view"', "application/ld+json"]) {
    assert.ok(markup.includes(needle), `server markup is missing ${needle}`);
  }
  assert.ok(!markup.includes("bad()"), "server markup kept a script from HtmlEditor content");
  pass("all components render on the server without browser globals");

  const directive = await readFile(resolve(consumer, "node_modules/@sultanico/ai-ui/dist/components/message.js"), "utf8");
  assert.ok(directive.replace(/^(?:\/\/[^\n]*\n)*/, "").startsWith('"use client"'), "client directive was not kept");
  pass("client component directives are kept in dist");

  await writeFile(resolve(consumer, "style.css"), '@import "tailwindcss";\n@import "@sultanico/ai-ui/preset.css";\n');
  run(process.execPath, [resolve(consumer, "node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", "style.css", "-o", "out/style.css"], consumer);
  const css = await readFile(resolve(consumer, "out/style.css"), "utf8");
  for (const needle of [".bg-code-background", ".text-code-keyword", "--chart-1", ".dark"]) {
    assert.ok(css.includes(needle), `installed preset did not generate ${needle}`);
  }
  pass("installed Tailwind v4 preset finds the package classes and ships both themes");

  const consumerRequire = createRequire(resolve(consumer, "package.json"));
  assert.equal(consumerRequire.resolve("@sultanico/ai-ui/styles.css"), consumerRequire.resolve("@sultanico/ai-ui/preset.css"));
  pass("the earlier styles.css export still resolves, to the preset");

  const evidence = {
    artifact: pack.filename,
    size: pack.size,
    unpackedSize: pack.unpackedSize,
    files: pack.files.length,
    sha256: createHash("sha256").update(await readFile(tarball)).digest("hex"),
    checks,
  };
  await writeFile(resolve(staging, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  assert.ok(consumer.startsWith(staging + sep));
  await rm(consumer, { recursive: true, force: true });
}
