// packages/ai-ui/example/gallery/conversation.tsx
import { PencilIcon } from "lucide-react";
import { useRef, useState } from "react";

import {
  AssistantPanel,
  type AssistantMode,
  ChatHistory,
  type ChatHistoryItem,
  ConversationTransfer,
  DateSeparator,
  DELIVERY_STATES,
  type DeliveryState,
  DeliveryStatus,
  EarlierMessages,
  EmojiPicker,
  FeedbackDialog,
  type FeedbackSubmission,
  groupMessages,
  MessageActions,
  MessageEditor,
  MessageFeedbackActions,
  type MessageFeedbackValue,
  MessageReactions,
  NewMessagesDivider,
  Outbox,
  type OutboxItem,
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type Reaction,
  ThreadReplies,
  toggleReaction,
  type Transcript,
  TypingIndicator,
  UnreadJump,
  useMessageWindow,
  useTypingIndicator,
  useTypingUsers,
} from "../../src/index.js";
import { Demo, GallerySection } from "./section.js";

const LOADED_AT = Date.now();
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const CHATS: ChatHistoryItem[] = [
  { id: "c1", title: "Spring mulch promotion", updatedAt: LOADED_AT - 4 * MINUTE, pinned: true, folderId: "marketing" },
  { id: "c2", title: "Paint counter schedule", updatedAt: LOADED_AT - 35 * MINUTE, preview: "Who covers Saturday mornings?", unread: true, folderId: "staff" },
  { id: "c3", title: "Orgill backorder report", updatedAt: LOADED_AT - 3 * 60 * MINUTE, folderId: "purchasing" },
  { id: "c4", title: "Fastener aisle reset", updatedAt: LOADED_AT - DAY - MINUTE },
  { id: "c5", title: "Contractor pricing tiers", updatedAt: LOADED_AT - 3 * DAY, folderId: "purchasing" },
  { id: "c6", title: "Holiday hours notice", updatedAt: LOADED_AT - 12 * DAY, folderId: "marketing" },
  { id: "c7", title: "Old shrink audit", updatedAt: LOADED_AT - 40 * DAY, archived: true },
];

const FOLDERS = [
  { id: "marketing", name: "Marketing" },
  { id: "staff", name: "Staff" },
  { id: "purchasing", name: "Purchasing" },
];

const TRANSCRIPT: Transcript = {
  title: "Spring mulch promotion",
  messages: [
    { role: "user", content: "Draft a two-week mulch promotion for April.", createdAt: LOADED_AT - 6 * MINUTE },
    { role: "assistant", content: "Run 5 bags for $15 on brown and black mulch, April 1 to 14, with an end-cap display by the garden center door.", author: "Marifai", createdAt: LOADED_AT - 5 * MINUTE },
  ],
};

interface ThreadMessage {
  id: string;
  sender: string;
  createdAt: number;
  text: string;
  reactions: Reaction[];
}

const PEOPLE = ["Dana Webb", "Luis Ortega", "Marifai", "You"];
const LINES = [
  "Morning. Truck from Orgill is two pallets short.",
  "Which SKUs?",
  "Mostly the 3-inch deck screws and the 50 lb play sand.",
  "I can check the backorder report.",
  "Both are on backorder until Thursday. Want me to draft a note for the contractor accounts?",
  "Yes, keep it short.",
  "Draft is in the shared folder.",
  "Looks good. Sending it.",
  "Paint counter needs coverage Saturday 8 to noon.",
  "I can take it.",
  "Thanks Luis.",
  "Schedule updated and the team was notified.",
  "New end-cap is up by the garden door.",
  "Photo looks great.",
  "Mulch promo starts Monday. Signs are printed.",
  "I'll set the POS price tonight.",
  "Price change is staged for 6 AM Monday.",
  "Perfect.",
];

const THREAD: ThreadMessage[] = LINES.map((text, index) => ({
  id: `t${index}`,
  sender: PEOPLE[index % 4 === 3 ? 3 : index % 3]!,
  createdAt: LOADED_AT - (index < 8 ? DAY + (8 - index) * 7 * MINUTE : (LINES.length - index) * 4 * MINUTE),
  text,
  reactions: index === 7 ? [{ emoji: "👍", count: 2, users: ["Dana Webb", "Luis Ortega"] }] : index === 13 ? [{ emoji: "🎉", count: 1, reacted: true, users: ["You"] }] : [],
}));

function TeamThread() {
  const [messages, setMessages] = useState(THREAD);
  const [editing, setEditing] = useState<string | null>(null);
  const [unread, setUnread] = useState(2);
  const [replies, setReplies] = useState(["Thursday works for the contractor list.", "Added the two accounts that called yesterday."]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { visible, hiddenCount, showEarlier } = useMessageWindow(messages, { initial: 8, step: 6, scrollRef });
  const typing = useTypingUsers(4000);
  const groups = groupMessages(visible, { now: LOADED_AT });
  const firstUnread = messages[messages.length - unread]?.id;
  const lastOwn = [...messages].reverse().find((message) => message.sender === "You")?.id;

  return (
    <div className="relative flex w-full max-w-2xl flex-col rounded-lg border border-border">
      <div ref={scrollRef} tabIndex={0} role="region" aria-label="Team thread" className="flex h-[26rem] flex-col gap-3 overflow-y-auto p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <EarlierMessages hiddenCount={hiddenCount} step={6} onShow={showEarlier} />
        {groups.map((group) => (
          <div key={group.messages[0]!.id} className="flex flex-col gap-1.5">
            {group.day && <DateSeparator date={group.messages[0]!.createdAt} />}
            {group.messages[0]!.id === firstUnread && <NewMessagesDivider />}
            <p className="text-xs font-medium">{group.sender}</p>
            {group.messages.map((message) => (
              <div key={message.id} className="flex flex-col gap-1">
                {message.id !== group.messages[0]!.id && message.id === firstUnread && <NewMessagesDivider />}
                {editing === message.id ? (
                  <MessageEditor
                    defaultValue={message.text}
                    hint="Everyone sees that this message was edited."
                    onCancel={() => setEditing(null)}
                    onSave={(text) => {
                      setMessages((list) => list.map((item) => (item.id === message.id ? { ...item, text } : item)));
                      setEditing(null);
                    }}
                  />
                ) : (
                  <div className="group/line flex items-start gap-2">
                    <p className="flex-1 text-sm">{message.text}</p>
                    {message.sender === "You" && (
                      <button type="button" aria-label="Edit message" title="Edit message" onClick={() => setEditing(message.id)} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5">
                        <PencilIcon aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
                {(message.reactions.length > 0 || message.id === messages[messages.length - 1]!.id) && (
                  <MessageReactions reactions={message.reactions} onToggle={(emoji) => setMessages((list) => list.map((item) => (item.id === message.id ? { ...item, reactions: toggleReaction(item.reactions, emoji, "You") } : item)))} />
                )}
                {message.id === "t4" && (
                  <ThreadReplies
                    count={replies.length}
                    participants={[
                      { id: "dana", name: "Dana Webb" },
                      { id: "luis", name: "Luis Ortega" },
                    ]}
                    lastReplyAt={LOADED_AT - DAY + 20 * MINUTE}
                    onReply={(text) => setReplies((list) => [...list, text])}
                  >
                    {replies.map((reply, index) => (
                      <p key={index} className="text-sm">
                        {reply}
                      </p>
                    ))}
                  </ThreadReplies>
                )}
                {message.id === lastOwn && <DeliveryStatus state="read" at={LOADED_AT - 2 * MINUTE} className="self-end" />}
              </div>
            ))}
          </div>
        ))}
      </div>
      <UnreadJump
        count={unread}
        onJump={() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          setUnread(0);
        }}
        onDismiss={() => setUnread(0)}
        className="absolute inset-x-0 bottom-14"
      />
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <TypingIndicator names={typing.names} />
        <button
          type="button"
          onClick={() => {
            typing.setTyping("Dana Webb", true);
            setTimeout(() => typing.setTyping("Luis Ortega", true), 600);
          }}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Simulate typing
        </button>
      </div>
    </div>
  );
}

function OutboxDemo() {
  const [items, setItems] = useState<OutboxItem[]>([
    { id: "o1", text: "Order 60 bags of black mulch for Monday.", state: "queued", createdAt: LOADED_AT - MINUTE },
    { id: "o2", text: "Send the backorder note to contractor accounts.", state: "failed", error: "No connection", createdAt: LOADED_AT - 3 * MINUTE },
    { id: "o3", text: "Thanks, schedule looks right.", state: "delivered", createdAt: LOADED_AT - 9 * MINUTE },
  ]);
  const update = (id: string, patch: Partial<OutboxItem>) => setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  return (
    <Outbox
      className="w-full max-w-md"
      items={items}
      notice="Messages send in order once the assistant finishes its current task."
      onEdit={(id, text) => update(id, { text })}
      onCancel={(id) => setItems((list) => list.filter((item) => item.id !== id))}
      onRetry={(id) => {
        update(id, { state: "sending" });
        setTimeout(() => update(id, { state: "delivered", createdAt: Date.now() }), 1200);
      }}
    />
  );
}

function FeedbackDemo() {
  const [value, setValue] = useState<MessageFeedbackValue>(null);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<FeedbackSubmission | null>(null);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="max-w-sm rounded-lg bg-muted px-3 py-2">Deck screws restock Thursday; sand restocks Friday.</p>
      <MessageActions aria-label="Response actions" className="opacity-100">
        <MessageFeedbackActions
          value={value}
          onValueChange={(next) => {
            setValue(next);
            if (next) setOpen(true);
          }}
        />
      </MessageActions>
      <FeedbackDialog open={open} onOpenChange={setOpen} rating={value === "up" ? "up" : "down"} shareLabel="Include this conversation so the team can review it" onSubmit={(feedback) => setLast(feedback)} />
      <p role="status" className="text-xs text-muted-foreground">
        {last ? `Thanks. Sent ${last.rating === "up" ? "positive" : "negative"} feedback${last.categories.length ? `: ${last.categories.join(", ")}` : ""}.` : ""}
      </p>
    </div>
  );
}

function AssistantDemo() {
  const [mode, setMode] = useState<AssistantMode>("ask");
  const [context, setContext] = useState<string | null>("Q3 forecast.xlsx · B2:F40");
  const [log, setLog] = useState<string[]>([]);
  const typingSignal = useTypingIndicator({ onTypingChange: () => undefined });

  return (
    <AssistantPanel
      launcherClassName="static"
      contextLabel={context ?? undefined}
      onClearContext={() => setContext(null)}
      mode={mode}
      onModeChange={setMode}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-sm">
        {log.length === 0 ? <p className="text-muted-foreground">{mode === "ask" ? "Ask about the selected range." : "Describe a change to the selected range."}</p> : log.map((entry, index) => <p key={index} className={index % 2 ? "rounded-lg bg-muted px-3 py-2" : "self-end rounded-lg bg-primary px-3 py-2 text-primary-foreground"}>{entry}</p>)}
      </div>
      <div className="border-t border-border p-2">
        <PromptInput
          onSubmit={(text) => {
            typingSignal.stopTyping();
            setLog((list) => [...list, text, mode === "ask" ? "Q3 revenue is 8% above plan, led by lawn and garden." : "Done. Column F now shows the variance to plan."]);
          }}
        >
          <PromptInputTextarea aria-label={mode === "ask" ? "Ask the assistant" : "Describe an edit"} placeholder={mode === "ask" ? "Ask about this sheet" : "Describe an edit"} onInput={typingSignal.notifyTyping} />
          <PromptInputFooter>
            <span />
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </AssistantPanel>
  );
}

function EmojiDemo() {
  const [text, setText] = useState("Great work on the end-cap ");
  return (
    <div className="flex w-full max-w-md items-center gap-1 rounded-md border border-input bg-background pr-1">
      <label htmlFor="gallery-emoji-text" className="sr-only">
        Message
      </label>
      <input id="gallery-emoji-text" value={text} onChange={(event) => setText(event.target.value)} className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
      <EmojiPicker triggerLabel="Insert emoji" onSelect={(emoji) => setText((value) => value + emoji)} />
    </div>
  );
}

export function ConversationGallery() {
  const [chats, setChats] = useState(CHATS);
  const [active, setActive] = useState("c1");
  const [imported, setImported] = useState<string | null>(null);
  const patch = (ids: string[], change: Partial<ChatHistoryItem>) => setChats((list) => list.map((item) => (ids.includes(item.id) ? { ...item, ...change } : item)));

  return (
    <GallerySection id="gallery-conversation" title="Conversations and collaboration">
      <Demo title="Chat history and transfer" className="flex w-full flex-wrap items-start gap-4">
        <div className="flex h-[30rem] w-72 flex-col rounded-lg border border-border p-2">
          <ChatHistory
            conversations={chats}
            folders={FOLDERS}
            activeId={active}
            onSelect={(id) => {
              setActive(id);
              patch([id], { unread: false });
            }}
            onNew={() => {
              const id = `c${Date.now()}`;
              setChats((list) => [{ id, title: "New chat", updatedAt: Date.now() }, ...list]);
              setActive(id);
            }}
            onRename={(id, title) => patch([id], { title })}
            onPin={(id, pinned) => patch([id], { pinned })}
            onArchive={(ids, archived) => patch(ids, { archived })}
            onMove={(ids, folderId) => patch(ids, { folderId })}
            onDuplicate={(id) => {
              const source = chats.find((item) => item.id === id);
              if (source) setChats((list) => [{ ...source, id: `${id}-copy-${list.length}`, title: `${source.title} (copy)`, pinned: false, updatedAt: Date.now() }, ...list]);
            }}
            onExport={() => undefined}
            onDelete={(ids) => setChats((list) => list.filter((item) => !ids.includes(item.id)))}
            className="min-h-0 flex-1"
          />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <ConversationTransfer transcript={TRANSCRIPT} onImport={(transcript) => setImported(`${transcript.title} (${transcript.messages.length} messages)`)} />
          {imported && <p className="text-xs text-muted-foreground">Last import: {imported}</p>}
        </div>
      </Demo>
      <Demo title="Team thread with reactions, replies, edits and unread jump" className="w-full">
        <TeamThread />
      </Demo>
      <Demo title="Outbox and delivery receipts" className="flex w-full flex-wrap items-start gap-4">
        <OutboxDemo />
        <ul aria-label="Delivery states" className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {(Object.keys(DELIVERY_STATES) as DeliveryState[]).map((state) => (
            <li key={state}>
              <DeliveryStatus state={state} onRetry={() => undefined} />
            </li>
          ))}
        </ul>
      </Demo>
      <Demo title="Feedback, emoji and assistant panel" className="flex w-full flex-wrap items-start gap-6">
        <FeedbackDemo />
        <EmojiDemo />
        <AssistantDemo />
      </Demo>
    </GallerySection>
  );
}
