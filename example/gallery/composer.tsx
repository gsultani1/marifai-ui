// packages/ai-ui/example/gallery/composer.tsx
import { FileCodeIcon, GlobeIcon, TerminalIcon, UserIcon, WrenchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  CameraCapture,
  type ComposerTool,
  ComposerOptions,
  ContextChips,
  type ContextItem,
  FileDropzone,
  filePath,
  type MentionItem,
  PromptInput,
  PromptInputAttachButton,
  PromptInputCounter,
  PromptInputEnhance,
  PromptInputFooter,
  PromptInputMentions,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputVoice,
  ReadAloud,
  type RejectedFile,
  ScreenshotButton,
  Suggestion,
  SuggestionRail,
  TemplateGallery,
  UrlContextButton,
  usePromptInput,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const FILES: MentionItem[] = ["src/app.tsx", "src/routes/orders.tsx", "src/lib/pricing.ts", "server/inventory.py", "README.md"].map((path) => ({ id: path, label: path, group: "Files", icon: <FileCodeIcon aria-hidden="true" /> }));
const PEOPLE: MentionItem[] = ["Ana Ruiz", "Luis Ortega", "Dana Webb"].map((name) => ({ id: name, label: name, group: "People", icon: <UserIcon aria-hidden="true" /> }));
const COMMANDS: MentionItem[] = [
  { id: "summarize", label: "summarize", description: "Summarize the thread", icon: <TerminalIcon aria-hidden="true" />, insertText: "/summarize " },
  { id: "fix", label: "fix", description: "Fix the selected code", icon: <WrenchIcon aria-hidden="true" />, insertText: "/fix " },
  { id: "search", label: "search", description: "Search the web", icon: <GlobeIcon aria-hidden="true" />, insertText: "/search " },
];

const SUGGESTIONS = ["Which items are low on stock?", "Draft the weekly staff schedule", "Summarize yesterday's sales", "Write a reorder email to Orgill", "Compare this month's margins to last month", "List open special orders"];

const TEMPLATES = [
  { id: "reorder", title: "Reorder email", description: "Ask a supplier for a restock.", prompt: "Write a short, polite email to {{supplier}} asking to restock {{items}} by {{date}}.", category: "Purchasing" },
  { id: "policy", title: "Explain a policy", description: "Plain-language summary for staff.", prompt: "Explain our {{policy}} policy to a new employee in five bullet points.", category: "Team" },
  { id: "sales", title: "Weekly sales summary", description: "Totals, top sellers and notes.", prompt: "Summarize this week's sales with totals, top five sellers and anything unusual.", category: "Reports" },
];

const match = (items: MentionItem[], query: string) => items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

interface Sent {
  id: number;
  text: string;
  context: ContextItem[];
}

/** Hands PromptInput's setter to code outside the composer, such as the template gallery below it. */
function ComposerBridge({ onReady }: { onReady: (setValue: (value: string) => void) => void }) {
  const { setValue } = usePromptInput();
  useEffect(() => {
    onReady(setValue);
  }, [onReady, setValue]);
  return null;
}

function ComposerSuggestions() {
  const { setValue, textareaRef } = usePromptInput();
  return (
    <SuggestionRail source="Suggested from your store's recent activity" className="px-3 pt-3">
      {SUGGESTIONS.map((text) => (
        <Suggestion
          key={text}
          suggestion={text}
          onSelect={(value) => {
            setValue(value);
            textareaRef.current?.focus();
          }}
        />
      ))}
    </SuggestionRail>
  );
}

export function ComposerGallery() {
  const [context, setContext] = useState<ContextItem[]>([{ id: "sel", label: "pricing.ts", kind: "selection", detail: "L12–30" }]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [effort, setEffort] = useState("medium");
  const [reasoning, setReasoning] = useState(false);
  const [tools, setTools] = useState<ComposerTool[]>([
    { id: "web", label: "Web search", description: "Look up current prices and news.", enabled: true },
    { id: "inventory", label: "Inventory", description: "Read stock levels and orders.", enabled: true },
    { id: "email", label: "Email drafts", description: "Create drafts, never send.", enabled: false },
  ]);
  const [imported, setImported] = useState<{ files: string[]; rejected: RejectedFile[] } | null>(null);
  const setComposer = useRef<(value: string) => void>(() => undefined);

  const addContext = (item: ContextItem) => setContext((current) => (current.some((existing) => existing.id === item.id) ? current : [...current, item]));

  return (
    <GallerySection id="gallery-composer" title="Composer">
      <Demo title="Prompt composer with mentions, context and tools" className="flex w-full max-w-3xl flex-col gap-3">
        {sent.length > 0 && (
          <ol aria-label="Sent messages" className="flex flex-col gap-2">
            {sent.map((message) => (
              <li key={message.id} className="flex flex-col gap-1.5 self-end rounded-xl bg-muted px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <ReadAloud text={message.text} />
                </div>
                <ContextChips label="Context sent with this message" items={message.context} />
              </li>
            ))}
          </ol>
        )}
        <PromptInput
          draftKey="ai-ui-gallery:composer"
          maxLength={2000}
          onAttach={(files) => files.forEach((file) => addContext({ id: `file-${file.name}`, label: file.name, kind: file.type.startsWith("image/") ? "image" : "document" }))}
          onSubmit={(text) => {
            setSent((current) => [...current, { id: current.length + 1, text, context }]);
            setContext([]);
          }}
        >
          <ComposerBridge
            onReady={(setter) => {
              setComposer.current = setter;
            }}
          />
          <ComposerSuggestions />
          {context.length > 0 && <ContextChips items={context} onRemove={(id) => setContext((current) => current.filter((item) => item.id !== id))} className="px-3 pt-3" />}
          <PromptInputTextarea placeholder="Ask anything. Type @ for files and people, / for commands." />
          <PromptInputMentions
            sources={{ "@": (query) => [...match(FILES, query), ...match(PEOPLE, query)], "/": (query) => match(COMMANDS, query) }}
            onSelect={(item, trigger) => trigger === "@" && item.group === "Files" && addContext({ id: item.id, label: item.label.split("/").pop() ?? item.label, kind: "file", title: item.label })}
          />
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputAttachButton />
              <UrlContextButton onAdd={(url) => addContext({ id: url, label: new URL(url).hostname, kind: "url", title: url })} />
              <ScreenshotButton onCapture={(file) => addContext({ id: file.name, label: "Screenshot", kind: "image", title: file.name })} />
              <CameraCapture onCapture={(file) => addContext({ id: file.name, label: "Photo", kind: "image", title: file.name })} />
              <PromptInputVoice />
              <PromptInputEnhance
                onEnhance={async (text) => {
                  await new Promise((resolve) => setTimeout(resolve, 300));
                  return `${text.replace(/[.?!]*$/, "")}. Be specific, use our store's data, and list next steps.`;
                }}
              />
              <ComposerOptions effort={effort} onEffortChange={setEffort} reasoning={reasoning} onReasoningChange={setReasoning} tools={tools} onToolsChange={setTools} />
            </PromptInputTools>
            <div className="flex items-center gap-2">
              <PromptInputCounter />
              <PromptInputSubmit />
            </div>
          </PromptInputFooter>
        </PromptInput>
        <p className="text-xs text-muted-foreground">Your draft is saved on this device until you send it.</p>
      </Demo>
      <Demo title="Prompt templates" className="w-full">
        <TemplateGallery templates={TEMPLATES} onUse={(prompt) => setComposer.current(prompt)} className="w-full" />
      </Demo>
      <Demo title="Folder and file import" className="flex w-full max-w-2xl flex-col gap-2">
        <FileDropzone allowFolders skipBinary maxFiles={200} maxFileSize={1024 * 1024} description="Code and text only; images, archives and node_modules are skipped." onFiles={(files, rejected) => setImported({ files: files.map(filePath), rejected })} />
        {imported && (
          <div className="text-sm">
            <p aria-live="polite">
              Imported {imported.files.length} {imported.files.length === 1 ? "file" : "files"}
              {imported.rejected.length ? `, skipped ${imported.rejected.length}` : ""}.
            </p>
            <ul aria-label="Imported files" className="mt-1 max-h-32 overflow-y-auto font-mono text-xs text-muted-foreground">
              {imported.files.map((path) => (
                <li key={path}>{path}</li>
              ))}
              {imported.rejected.map((file) => (
                <li key={`rejected-${file.name}`}>
                  {file.name}: {file.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Demo>
    </GallerySection>
  );
}
