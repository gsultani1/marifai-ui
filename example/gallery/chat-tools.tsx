// packages/ai-ui/example/gallery/chat-tools.tsx
import { useState } from "react";

import {
  Button,
  ChatAttachmentReview,
  ChatAudiencePicker,
  ChatDraftSwitcher,
  ChatRedactionReview,
  ChatTurnQueue,
  CitationNavigator,
  ContextItemOrderEditor,
  ConversationBookmarks,
  ConversationForkTree,
  ConversationSummaryEditor,
  MessageDeliveryStatus,
  MessageFeedbackForm,
  MessageSearchPanel,
  ReplyQuote,
  SlashCommandPicker,
  type ChatDeliveryState,
  type ChatDraft,
  type ChatReviewAttachment,
  type ConversationBookmark,
  type ConversationFork,
  type MessageFeedback,
  type MessageSearchHit,
  type OrderedContextItem,
  type QueuedChatTurn,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const AUDIENCES = [
  { id: "me", title: "Just me", visibility: "Only you can see this conversation." },
  { id: "store", title: "Main Street store team", visibility: "Visible to the 12 people on the Main Street store team." },
  { id: "all", title: "All locations", visibility: "Visible to managers at all four locations." },
  { id: "public", title: "Public link", visibility: "Anyone with the link can read it.", unavailableReason: "Turned off by your admin" },
];

const REDACTIONS = [
  { id: "phone", label: "Customer phone number", before: "Call Dana at 555-0142 when the cedar stain arrives.", after: "Call Dana at [phone] when the cedar stain arrives." },
  { id: "card", label: "Card number", before: "She paid the deposit with card 4111 1111 1111 1111.", after: "She paid the deposit with card [card]." },
];

const CITATIONS = [
  { id: "returns", title: "Store returns policy", excerpt: "Unopened items can be returned within 90 days with a receipt." },
  { id: "coverage", title: "Deck stain coverage chart", excerpt: "One gallon covers about 250 square feet on smooth wood, 150 on rough-sawn." },
  { id: "delivery", title: "Supplier delivery schedule", excerpt: "Stain and sealant orders placed by Wednesday arrive the following Monday." },
  { id: "safety", title: "Product safety sheet", excerpt: "Use in a ventilated area and keep away from open flame." },
];

const FORKS: ConversationFork[] = [
  {
    id: "main",
    label: "Deck refinishing plan",
    children: [
      { id: "budget", label: "Budget options", origin: "From message 6", children: [{ id: "used", label: "Rental sander instead", origin: "From message 9" }] },
      { id: "metric", label: "Metric measurements", origin: "From message 3" },
    ],
  },
];

const MESSAGES: MessageSearchHit[] = [
  { id: "s1", conversation: "Spring restock", excerpt: "Order 40 bags of black mulch for the garden center.", author: "Dana Webb" },
  { id: "s2", conversation: "Spring restock", excerpt: "The mulch delivery moved to Tuesday morning." },
  { id: "s3", conversation: "Deck stain quote", excerpt: "Three gallons of cedar stain come to $96 before tax.", author: "Assistant" },
  { id: "s4", conversation: "Contractor accounts", excerpt: "Net 30 terms apply to accounts opened before March.", author: "Luis Ortega" },
];

const COMMANDS = [
  { id: "restock", name: "restock", description: "Draft a restock order", parameters: ["<sku>", "<quantity>"] },
  { id: "summarize", name: "summarize", description: "Summarize this conversation" },
  { id: "price", name: "price", description: "Look up the shelf price", parameters: ["<sku>"] },
];

export function ChatToolsGallery() {
  const [attachments, setAttachments] = useState<ChatReviewAttachment[]>([
    { id: "inventory", name: "Q3 inventory.csv", status: "ready", included: true, detail: "48 KB" },
    { id: "shelf", name: "Aisle 7 shelf photo.jpg", status: "uploading", included: false, detail: "40%" },
    { id: "contract", name: "Supplier contract.pdf", status: "failed", included: false, detail: "File is over the 20 MB limit" },
  ]);
  const [audience, setAudience] = useState<string | null>("store");
  const [drafts, setDrafts] = useState<ChatDraft[]>([
    { id: "d1", title: "Restock email", preview: "Ask the supplier to move the deck stain delivery to Monday.", updatedAt: "2 min ago" },
    { id: "d2", title: "Return policy answer", preview: "Opened paint can be returned within 30 days with a receipt.", updatedAt: "Yesterday" },
  ]);
  const [openedDraft, setOpenedDraft] = useState<string | null>(null);
  const [appliedRedactions, setAppliedRedactions] = useState<string | null>(null);
  const [turns, setTurns] = useState<QueuedChatTurn[]>([
    { id: "t1", text: "Check stock for 2x4 studs at both locations." },
    { id: "t2", text: "Draft a reply to the contractor about the late delivery." },
    { id: "t3", text: "Summarize today's returns." },
  ]);
  const [editingTurn, setEditingTurn] = useState<QueuedChatTurn | null>(null);
  const [citation, setCitation] = useState<string | null>("coverage");
  const [openedSource, setOpenedSource] = useState<string | null>(null);
  const [context, setContext] = useState<OrderedContextItem[]>([
    { id: "policy", title: "Store returns policy", tokens: 1200 },
    { id: "chat", title: "Earlier chat with Dana", tokens: 860 },
    { id: "sheet", title: "Inventory spreadsheet" },
  ]);
  const [bookmarks, setBookmarks] = useState<ConversationBookmark[]>([
    { id: "b1", messageId: "m42", title: "Deck stain quote", excerpt: "Three gallons of cedar stain, $96 before tax." },
    { id: "b2", messageId: "m57", title: "Delivery window", excerpt: "Orders placed by Wednesday arrive Monday." },
  ]);
  const [jumpedTo, setJumpedTo] = useState<string | null>(null);
  const [fork, setFork] = useState<string | null>("main");
  const [summary, setSummary] = useState("Dana wants three gallons of cedar deck stain held for pickup on Friday and asked about a rental sander.");
  const [delivery, setDelivery] = useState<{ status: ChatDeliveryState; retrying: boolean }>({ status: "failed", retrying: false });
  const [feedback, setFeedback] = useState<MessageFeedback | null>(null);
  const [query, setQuery] = useState("mulch");
  const [quoting, setQuoting] = useState(true);
  const [composer, setComposer] = useState("");

  const needle = query.trim().toLowerCase();
  const hits = needle ? MESSAGES.filter((hit) => [hit.conversation, hit.excerpt, hit.author].some((value) => value?.toLowerCase().includes(needle))) : [];
  const forkLabel = (id: string | null, branches: readonly ConversationFork[] = FORKS): string | undefined => {
    for (const branch of branches) {
      if (branch.id === id) return branch.label;
      const found = forkLabel(id, branch.children);
      if (found) return found;
    }
    return undefined;
  };

  function retryDelivery() {
    setDelivery({ status: "failed", retrying: true });
    window.setTimeout(() => setDelivery({ status: "sending", retrying: false }), 600);
    window.setTimeout(() => setDelivery({ status: "sent", retrying: false }), 1400);
  }

  return (
    <GallerySection id="gallery-chat-tools" title="Chat review and message tools">
      <Demo title="Before sending" className="grid w-full items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        <ChatAttachmentReview
          attachments={attachments}
          onIncludeChange={(id, included) => setAttachments((current) => current.map((item) => (item.id === id ? { ...item, included } : item)))}
          onRemove={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
        />
        <ChatAudiencePicker audiences={AUDIENCES} value={audience} onChange={setAudience} />
        <div className="space-y-2">
          <ChatRedactionReview
            suggestions={REDACTIONS}
            initialAcceptedIds={["card"]}
            onSubmit={async (ids) => {
              await new Promise((resolve) => setTimeout(resolve, 400));
              setAppliedRedactions(ids.length ? `Redacted ${ids.length} of ${REDACTIONS.length} items before sharing.` : "Shared without redactions.");
            }}
          />
          <p role="status" className="text-sm text-muted-foreground">{appliedRedactions}</p>
        </div>
      </Demo>

      <Demo title="Composing" className="grid w-full items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <ChatDraftSwitcher
            drafts={drafts}
            onOpen={(id) => setOpenedDraft(drafts.find((draft) => draft.id === id)?.title ?? null)}
            onDiscard={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
          />
          {openedDraft && <p className="text-sm text-muted-foreground">Editing draft: {openedDraft}</p>}
        </div>
        <div className="space-y-2">
          <SlashCommandPicker commands={COMMANDS} onSelect={(_id, command) => setComposer((current) => (current ? current + " " : "") + command + " ")} />
          <label className="block space-y-1 text-sm">
            <span className="block font-medium">Composer text</span>
            <textarea value={composer} onChange={(event) => setComposer(event.currentTarget.value)} rows={2}
              className="block w-full rounded-md border border-input bg-background p-2 text-sm text-foreground" />
          </label>
        </div>
        <div className="space-y-2">
          {quoting ? (
            <ReplyQuote messageId="m12" author="Dana Webb" quote={"Can you hold two gallons of cedar stain?\nI can pick them up Friday."}
              onOpen={(id) => setJumpedTo(id)} onClear={() => setQuoting(false)} />
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setQuoting(true)}>Quote Dana's question again</Button>
          )}
          <ChatTurnQueue
            turns={turns}
            onMoveNext={(id) => setTurns((current) => [...current.filter((turn) => turn.id === id), ...current.filter((turn) => turn.id !== id)])}
            onEdit={(id) => setEditingTurn(turns.find((turn) => turn.id === id) ?? null)}
            onRemove={(id) => setTurns((current) => current.filter((turn) => turn.id !== id))}
          />
          {editingTurn && (
            <form className="space-y-2" aria-label="Edit queued turn" onSubmit={(event) => {
              event.preventDefault();
              setTurns((current) => current.map((turn) => (turn.id === editingTurn.id ? editingTurn : turn)));
              setEditingTurn(null);
            }}>
              <label className="block space-y-1 text-sm">
                <span className="block font-medium">Queued turn text</span>
                <textarea value={editingTurn.text} rows={2} onChange={(event) => setEditingTurn({ ...editingTurn, text: event.currentTarget.value })}
                  className="block w-full rounded-md border border-input bg-background p-2 text-sm text-foreground" />
              </label>
              <Button type="submit" size="sm">Save queued turn</Button>
            </form>
          )}
        </div>
      </Demo>

      <Demo title="Sources and context" className="grid w-full items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <CitationNavigator citations={CITATIONS} activeId={citation} onChange={setCitation}
            onOpen={(id) => setOpenedSource(CITATIONS.find((item) => item.id === id)?.title ?? null)} />
          {openedSource && <p className="text-sm text-muted-foreground">Opened source: {openedSource}</p>}
        </div>
        <ContextItemOrderEditor items={context} onReorder={(ids) => setContext((current) => ids.flatMap((id) => current.filter((item) => item.id === id)))} />
        <ConversationSummaryEditor initialSummary={summary} sourceRange="Summarizes messages 1–24 of the Deck stain quote chat" onSubmit={async (next) => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          setSummary(next);
        }} />
      </Demo>

      <Demo title="Finding and revisiting messages" className="grid w-full items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
        <MessageSearchPanel results={hits} query={query} onQueryChange={setQuery} onOpen={(id) => setJumpedTo(id)} />
        <div className="space-y-2">
          <ConversationBookmarks bookmarks={bookmarks} onOpen={(messageId) => setJumpedTo(messageId)}
            onRemove={(id) => setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id))} />
          {jumpedTo && <p className="text-sm text-muted-foreground">Scrolled to message {jumpedTo}</p>}
        </div>
        <div className="space-y-2">
          <ConversationForkTree branches={FORKS} activeId={fork} onSelect={setFork} />
          <p className="text-sm text-muted-foreground">Showing fork: {forkLabel(fork) ?? "none"}</p>
        </div>
      </Demo>

      <Demo title="After sending" className="grid w-full items-start gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-card-foreground">
          <p className="text-sm">Hold two gallons of cedar stain for Dana until Friday.</p>
          <MessageDeliveryStatus status={delivery.status} retrying={delivery.retrying}
            {...(delivery.status === "failed" ? { detail: "The connection dropped" } : {})} onRetry={retryDelivery} />
          <p className="text-sm">Is the rental sander available this weekend?</p>
          <MessageDeliveryStatus status="sending" />
          <p className="text-sm">Thanks, see you Friday.</p>
          <MessageDeliveryStatus status="queued" detail="Sends when you are back online" />
        </div>
        <div className="space-y-2">
          <MessageFeedbackForm messageId="m42" onSubmit={async (_id, next) => {
            await new Promise((resolve) => setTimeout(resolve, 400));
            setFeedback(next);
          }} />
          {feedback && <p className="text-sm text-muted-foreground">Last rating: {feedback.rating === "positive" ? "Helpful" : "Unhelpful"}{feedback.comment && ` · ${feedback.comment}`}</p>}
        </div>
      </Demo>
    </GallerySection>
  );
}
