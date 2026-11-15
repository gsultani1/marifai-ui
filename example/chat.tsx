// packages/ai-ui/example/chat.tsx
import { GlobeIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Attachment,
  Attachments,
  BranchNavigator,
  type ChatStatus,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  InlineCitation,
  Message,
  MessageActions,
  MessageAvatar,
  MessageBody,
  MessageBranchAction,
  MessageBubble,
  MessageContent,
  MessageCopyAction,
  MessageEditAction,
  MessageFeedbackActions,
  type MessageFeedbackValue,
  MessageRegenerateAction,
  type ModelOption,
  ModelSelector,
  PromptInput,
  PromptInputAttachButton,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
  Suggestion,
  Suggestions,
  ToolCall,
  ToolCallApproval,
  ToolCallContent,
  ToolCallInput,
  ToolCallResult,
  type ToolCallStatus,
  ToolCallTrigger,
  useConversation,
} from "../src/index.js";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

const MODELS: ModelOption[] = [
  { id: "core", name: "Marifai Core", provider: "Marifai", description: "Balanced speed and quality" },
  { id: "deep", name: "Marifai Deep", provider: "Marifai", description: "Longer reasoning for hard problems" },
  { id: "local", name: "Local 8B", provider: "On device", description: "Runs without a network" },
];

const SOURCES = [
  {
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API",
    title: "Fetch API",
    description: "Interface for fetching resources, including across the network.",
  },
  {
    url: "https://www.rfc-editor.org/rfc/rfc9110",
    title: "RFC 9110: HTTP Semantics",
    description: "Methods, status codes and caching semantics of HTTP.",
  },
];

const ANSWER = `Retry only idempotent requests, back off exponentially and add jitter so clients do not retry in lockstep.

\`\`\`ts
export async function getJson<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url);
    if (response.ok) return (await response.json()) as T;
    if (attempt >= retries || response.status < 500) throw new Error(\`HTTP \${response.status}\`);
    await new Promise((done) => setTimeout(done, 2 ** attempt * 250 * Math.random()));
  }
}
\`\`\`

| Attempt | Base delay | With jitter |
| --: | --: | :-- |
| 1 | 250 ms | 0 to 250 ms |
| 2 | 500 ms | 0 to 500 ms |
| 3 | 1 s | 0 to 1 s |`;

const HISTORY: ChatMessage[] = [
  { id: "u1", role: "user", text: "How should I fetch JSON with retries in TypeScript?" },
  { id: "a1", role: "assistant", text: ANSWER },
  { id: "u2", role: "user", text: "Can the agent clear the stale cache entries too?" },
];

const STREAM = Array.from(
  { length: 14 },
  (_, index) =>
    `**Step ${index + 1}.** Check the cache key, compare its timestamp with the time to live, and evict entries older than the window. Log each eviction with the key and age so the next run can be audited.`,
).join("\n\n");

function useStreamingReply() {
  const [messages, setMessages] = useState<ChatMessage[]>(HISTORY);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const finish = () => {
    clearInterval(timer.current);
    setStatus("ready");
    setMessages((current) => current.map((message) => ({ ...message, streaming: false })));
  };

  const send = (text: string) => {
    const id = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: `${id}-user`, role: "user", text },
      { id, role: "assistant", text: "", streaming: true },
    ]);
    setStatus("streaming");
    let length = 0;
    timer.current = setInterval(() => {
      length = Math.min(STREAM.length, length + 8);
      setMessages((current) => current.map((message) => (message.id === id ? { ...message, text: STREAM.slice(0, length) } : message)));
      if (length >= STREAM.length) finish();
    }, 40);
  };

  return { messages, status, send, stop: finish };
}

export function ChatDemo() {
  return (
    <Conversation className="h-full">
      <ChatThread />
    </Conversation>
  );
}

function ChatThread() {
  const { messages, status, send: stream, stop } = useStreamingReply();
  const { scrollToBottom } = useConversation();
  const [model, setModel] = useState("core");
  const [files, setFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<MessageFeedbackValue>(null);
  const [branch, setBranch] = useState(1);
  const [cleanup, setCleanup] = useState<ToolCallStatus>("awaiting-approval");

  const send = (text: string) => {
    stream(text);
    scrollToBottom("instant");
  };

  const decide = (approved: boolean) =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        setCleanup(approved ? "completed" : "denied");
        resolve();
      }, 300);
    });

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ConversationContent aria-busy={status === "streaming"} contentClassName="mx-auto w-full max-w-3xl">
          {messages.map((message) =>
            message.role === "user" ? (
              <Message key={message.id} from="user">
                <MessageAvatar name="Ada Lovelace" />
                <MessageBody>
                  <MessageBubble>{message.text}</MessageBubble>
                  <MessageActions>
                    <MessageEditAction />
                    <MessageCopyAction text={message.text} />
                  </MessageActions>
                </MessageBody>
              </Message>
            ) : (
              <Message key={message.id} from="assistant">
                <MessageAvatar name="Assistant" fallback={<SparklesIcon aria-hidden="true" />} />
                <MessageBody>
                  {message.id === "a1" && (
                    <>
                      <Reasoning duration={3}>
                        <ReasoningTrigger />
                        <ReasoningContent>
                          {"The request is idempotent, so retries are safe. Back off exponentially and add **full jitter**."}
                        </ReasoningContent>
                      </Reasoning>
                      <ToolCall name="search_docs" status="completed">
                        <ToolCallTrigger />
                        <ToolCallContent>
                          <ToolCallInput input={{ query: "fetch retry backoff jitter", limit: 2 }} />
                          <ToolCallResult result={{ hits: 2, top: SOURCES[0]!.title }} />
                        </ToolCallContent>
                      </ToolCall>
                    </>
                  )}
                  <MessageContent streaming={message.streaming}>{message.text}</MessageContent>
                  {message.id === "a1" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Based on the Fetch specification
                        <InlineCitation index={1} source={SOURCES[0]!} /> and HTTP semantics
                        <InlineCitation index={2} source={SOURCES[1]!} />.
                      </p>
                      <Sources>
                        <SourcesTrigger count={SOURCES.length} />
                        <SourcesContent>
                          {SOURCES.map((source, index) => (
                            <Source key={source.url} href={source.url} title={source.title} description={source.description} index={index + 1} />
                          ))}
                        </SourcesContent>
                      </Sources>
                    </>
                  )}
                  {!message.streaming && (
                    <div className="flex items-center gap-1">
                      {message.id === "a1" && <BranchNavigator index={branch} count={2} onIndexChange={setBranch} />}
                      <MessageActions>
                        <MessageCopyAction text={message.text} />
                        <MessageRegenerateAction />
                        <MessageBranchAction />
                        <MessageFeedbackActions value={feedback} onValueChange={setFeedback} />
                      </MessageActions>
                    </div>
                  )}
                </MessageBody>
              </Message>
            ),
          )}
          {messages.length === HISTORY.length && (
            <Message from="assistant">
              <MessageAvatar name="Assistant" fallback={<SparklesIcon aria-hidden="true" />} />
              <MessageBody>
                <ToolCall name="clear_cache" status={cleanup}>
                  <ToolCallTrigger />
                  <ToolCallContent>
                    <ToolCallApproval onApprove={() => decide(true)} onDeny={() => decide(false)}>
                      Deletes 42 cache entries older than 24 hours.
                    </ToolCallApproval>
                    <ToolCallInput input={{ olderThanHours: 24, dryRun: false }} />
                    {cleanup === "completed" && <ToolCallResult result={{ deleted: 42 }} />}
                  </ToolCallContent>
                </ToolCall>
              </MessageBody>
            </Message>
          )}
          {status === "ready" && (
            <Suggestions aria-label="Suggested follow-ups">
              <Suggestion suggestion="Add a circuit breaker" onSelect={send} />
              <Suggestion suggestion="Write tests for the retry loop" onSelect={send} />
              <Suggestion suggestion="Explain cache headers" icon={<GlobeIcon aria-hidden="true" />} onSelect={send} />
            </Suggestions>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptInput
          status={status}
          onSubmit={send}
          onStop={stop}
          onAttach={(added) => setFiles((current) => [...current, ...added])}
          allowEmpty={files.length > 0}
        >
          <Attachments className="px-3 pt-3">
            {files.map((file) => (
              <Attachment
                key={`${file.name}-${file.lastModified}`}
                name={file.name}
                file={file}
                onRemove={() => setFiles((current) => current.filter((entry) => entry !== file))}
              />
            ))}
          </Attachments>
          <PromptInputTextarea placeholder="Ask anything" />
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputAttachButton />
              <PromptInputButton label="Search the web">
                <GlobeIcon aria-hidden="true" />
              </PromptInputButton>
              <ModelSelector models={MODELS} value={model} onValueChange={setModel} />
            </PromptInputTools>
            <PromptInputSubmit />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
