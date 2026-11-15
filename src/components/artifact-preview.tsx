// packages/ai-ui/src/components/artifact-preview.tsx
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/cn.js";
import { CodeBlock } from "./code-block.js";
import { InteractivePreview, type InteractivePreviewProps } from "./interactive-preview.js";
import { MessageContent } from "./message-content.js";

type PreviewBase = Omit<ComponentProps<"div">, "children" | "content">;

export type ArtifactPreviewProps =
  | (PreviewBase & { kind: "markdown"; content: string; streaming?: boolean; allowImages?: boolean })
  | (PreviewBase & { kind: "code"; content: string; language?: string | undefined; showLineNumbers?: boolean })
  | (PreviewBase & {
      kind: "html";
      content: string;
      title?: string;
      allowScripts?: boolean;
      allowedOrigins?: InteractivePreviewProps["allowedOrigins"];
      onRuntimeError?: InteractivePreviewProps["onRuntimeError"];
    })
  | (PreviewBase & { kind: "custom"; children: ReactNode });

/** Renders artifact content by kind: markdown, highlighted code, sandboxed HTML or any custom node. */
export function ArtifactPreview(props: ArtifactPreviewProps) {
  let child: ReactNode;
  let rest: PreviewBase;
  switch (props.kind) {
    case "markdown": {
      const { kind, content, streaming, allowImages, ...other } = props;
      rest = other;
      child = (
        <MessageContent streaming={streaming} allowImages={allowImages} className="mx-auto max-w-3xl px-6 py-8">
          {content}
        </MessageContent>
      );
      break;
    }
    case "code": {
      const { kind, content, language, showLineNumbers = true, ...other } = props;
      rest = other;
      child = (
        <CodeBlock
          code={content}
          language={language}
          showLineNumbers={showLineNumbers}
          className="min-h-full rounded-none border-0"
        />
      );
      break;
    }
    case "html": {
      const { kind, content, title = "Artifact preview", allowScripts, allowedOrigins, onRuntimeError, ...other } = props;
      rest = other;
      child = (
        <InteractivePreview
          title={title}
          html={content}
          allowScripts={allowScripts}
          allowedOrigins={allowedOrigins}
          onRuntimeError={onRuntimeError}
        />
      );
      break;
    }
    case "custom": {
      const { kind, children, ...other } = props;
      rest = other;
      child = children;
      break;
    }
  }
  const { className, ...divProps } = rest;

  return (
    <div
      data-slot="artifact-preview"
      data-kind={props.kind}
      className={cn("h-full min-h-0 overflow-auto", props.kind === "html" && "overflow-hidden", className)}
      {...divProps}
    >
      {child}
    </div>
  );
}
