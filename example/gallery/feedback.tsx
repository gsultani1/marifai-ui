// packages/ai-ui/example/gallery/feedback.tsx
import { useState } from "react";

import {
  Banner,
  ConfirmDialog,
  ConnectionStatus,
  ConversationMarker,
  InputCounter,
  PresenceAvatars,
  SaveStatus,
  Shimmer,
  Skeleton,
  StatusPill,
  SurfaceState,
  SyncStatus,
  ThinkingIndicator,
  TypingDots,
  useStreamBuffer,
  useToast,
} from "../../src/index.js";
import { button, buttonVariants, card, focusRing } from "../../src/lib/classes.js";
import { cn } from "../../src/lib/cn.js";
import { Demo, GallerySection } from "./section.js";

const outline = cn(button, buttonVariants.outline, focusRing);
const LOADED_AT = Date.now();

function ToastDemo() {
  const { toast, undoable } = useToast();
  const [deleted, setDeleted] = useState(0);
  return (
    <>
      <button type="button" className={outline} onClick={() => toast({ title: "Draft saved", tone: "success" })}>
        Success toast
      </button>
      <button
        type="button"
        className={outline}
        onClick={() =>
          toast({
            title: "Generation failed",
            description: "The provider rate limit was reached.",
            tone: "danger",
            action: { label: "Retry", onClick: () => toast({ title: "Retrying" }) },
          })
        }
      >
        Error toast
      </button>
      <button type="button" className={outline} onClick={() => undoable({ title: "Chat deleted", onCommit: () => setDeleted((count) => count + 1) })}>
        Delete with undo
      </button>
      <output aria-label="Deleted chats" className="self-center text-xs text-muted-foreground">
        {deleted} deleted
      </output>
    </>
  );
}

function StreamBufferDemo() {
  const [text, setText] = useState("");
  const [flushes, setFlushes] = useState(0);
  const { push, flush, reset } = useStreamBuffer<string>({
    onFlush: (chunks) => {
      setFlushes((count) => count + 1);
      setText((current) => current + chunks.join(""));
    },
  });
  const run = () => {
    reset();
    setText("");
    setFlushes(0);
    const words = "Tokens arrive faster than the screen refreshes, so they are applied once per frame. ".repeat(3).split(/(?<= )/);
    words.forEach((word, index) => push(word, index));
    flush();
  };
  return (
    <div className={cn(card, "flex w-full max-w-xl flex-col gap-2 p-3")}>
      <button type="button" className={cn(outline, "self-start")} onClick={run}>
        Stream {"60"} chunks
      </button>
      <p className="text-sm">{text || "Nothing streamed yet."}</p>
      <output aria-label="Renders" className="text-xs text-muted-foreground">
        {flushes} render{flushes === 1 ? "" : "s"}
      </output>
    </div>
  );
}

export function FeedbackGallery() {
  const [draft, setDraft] = useState("Summarize the attached quarterly report in three bullet points.");
  return (
    <GallerySection id="gallery-feedback" title="Feedback and status">
      <Demo title="Banners" className="flex flex-col gap-2">
        <Banner tone="info" title="Preview runs in a sandbox" actions={<a className={outline} href="#workbench">Open workbench</a>}>
          Network access is limited to the CDNs the preview needs.
        </Banner>
        <Banner tone="success">Deployed to production.</Banner>
        <Banner tone="warning" dismissKey="gallery-truncated" title="Long conversation">
          The 40 oldest messages are summarized to fit the context window.
        </Banner>
        <Banner tone="danger" title="Generation stopped" onDismiss={() => undefined}>
          The connection dropped before the reply finished.
        </Banner>
      </Demo>
      <Demo title="Toasts">
        <ToastDemo />
      </Demo>
      <Demo title="Confirm dialog">
        <ConfirmDialog
          trigger={<button type="button" className={cn(button, buttonVariants.destructive, focusRing)}>Delete project</button>}
          title="Delete this project?"
          description="Files, chats and deployments are removed. This cannot be undone."
          confirmLabel="Delete project"
          tone="destructive"
          onConfirm={() => new Promise((resolve) => setTimeout(resolve, 600))}
        />
      </Demo>
      <Demo title="Surface states" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(["loading", "empty", "no-results", "error", "offline", "permission"] as const).map((kind) => (
          <div key={kind} className={card}>
            <SurfaceState kind={kind} onRetry={() => undefined} />
          </div>
        ))}
        <div className={cn(card, "p-3 sm:col-span-2 lg:col-span-3")}>
          <SurfaceState kind="error" onRetry={() => undefined}>
            <ul className="list-disc pl-5 text-sm">
              <li>Q3 revenue summary</li>
              <li>Supplier price changes</li>
            </ul>
          </SurfaceState>
        </div>
        <div className={cn(card, "p-3")}>
          <Skeleton lines={4} />
        </div>
      </Demo>
      <Demo title="Status">
        <StatusPill tone="success" pulse live>
          Generating
        </StatusPill>
        <StatusPill tone="info">Editing app.tsx</StatusPill>
        <StatusPill tone="danger">Needs attention</StatusPill>
        <SyncStatus state="synced" lastSyncedAt={LOADED_AT - 5 * 60_000} onSync={() => undefined} />
        <SyncStatus state="offline" pending={3} stuck={1} onSync={() => undefined} />
        <ConnectionStatus state="reconnecting" retryAt={LOADED_AT + 30_000} attempt={2} detail="Your reply resumes where it stopped." onRetry={() => undefined} />
        <ConnectionStatus state="failed" onRetry={() => undefined} />
      </Demo>
      <Demo title="Activity">
        <ThinkingIndicator />
        <Shimmer>Building the dashboard…</Shimmer>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <TypingDots /> Ada is typing
        </span>
      </Demo>
      <Demo title="Save status and presence">
        <SaveStatus state="saved" lastSavedAt={LOADED_AT - 90_000} />
        <SaveStatus state="saving" />
        <SaveStatus state="conflict" actions={<button type="button" className={cn("text-xs font-medium underline", focusRing)}>Take over</button>} />
        <SaveStatus state="error" actions={<button type="button" className={cn("text-xs font-medium underline", focusRing)}>Retry</button>} />
        <PresenceAvatars
          users={[
            { id: "1", name: "Ada Lovelace", activity: "editing" },
            { id: "2", name: "Grace Hopper", activity: "viewing" },
            { id: "3", name: "Research agent", activity: "reading sources" },
            { id: "4", name: "Alan Turing" },
          ]}
        />
      </Demo>
      <Demo title="Markers and counters" className="flex w-full max-w-xl flex-col gap-3">
        <ConversationMarker>Switched to Marifai Deep</ConversationMarker>
        <label className="flex flex-col gap-1 text-sm">
          Prompt
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className={cn("min-h-20 rounded-md border border-input bg-background p-2", focusRing)}
          />
        </label>
        <InputCounter value={draft} max={80} className="self-end" />
      </Demo>
      <Demo title="Stream buffer">
        <StreamBufferDemo />
      </Demo>
    </GallerySection>
  );
}
