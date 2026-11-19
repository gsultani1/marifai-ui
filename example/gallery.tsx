// packages/ai-ui/example/gallery.tsx
import { useEffect, useRef, useState } from "react";

import { AgentOpsGallery } from "./gallery/agent-ops.js";
import { AgentRunGallery } from "./gallery/agent-run.js";
import { AssistantGallery } from "./gallery/assistant.js";
import { AutomationGallery } from "./gallery/automation.js";
import { BrowserPanelsGallery } from "./gallery/browser-panels.js";
import { ChatToolsGallery } from "./gallery/chat-tools.js";
import { ComposerGallery } from "./gallery/composer.js";
import { ControlsGallery } from "./gallery/controls.js";
import { ConversationGallery } from "./gallery/conversation.js";
import { DevToolsGallery } from "./gallery/dev-tools.js";
import { DisplayGallery } from "./gallery/display.js";
import { ExecutionGallery } from "./gallery/execution.js";
import { FeedbackGallery } from "./gallery/feedback.js";
import { FormsGallery } from "./gallery/forms.js";
import { HumanLoopGallery } from "./gallery/human-loop.js";
import { KnowledgeGallery } from "./gallery/knowledge.js";
import { MediaGallery } from "./gallery/media.js";
import { OfficeGallery } from "./gallery/office.js";
import { PreviewGallery } from "./gallery/preview.js";
import { PrimitivesGallery } from "./gallery/primitives.js";
import { PublishingGallery } from "./gallery/publishing.js";
import { SchedulingGallery } from "./gallery/scheduling.js";
import { SettingsGallery } from "./gallery/settings.js";
import { ShellGallery } from "./gallery/shell.js";
import { SiteGallery } from "./gallery/site.js";
import { TasksGallery } from "./gallery/tasks.js";
import { ToolsModelsGallery } from "./gallery/tools-models.js";
import { VIBE_CODING_SECTION, VibeCodingGallery } from "./gallery/vibe-coding.js";
import { WorkflowToolsGallery } from "./gallery/workflow-tools.js";
import { WorkspaceGallery } from "./gallery/workspace.js";

const SECTIONS = [
  { id: "gallery-workflow-tools", title: "Browser, IDE and assistant tools" },
  { id: "gallery-primitives", title: "Buttons, overlays and menus" },
  { id: "gallery-controls", title: "Form controls and layout" },
  { id: "gallery-display", title: "Data display and collections" },
  { id: "gallery-site", title: "Site sections" },
  { id: "gallery-feedback", title: "Feedback and status" },
  { id: "gallery-agent", title: "Agent runs and progress" },
  { id: "gallery-human", title: "Approvals, questions and errors" },
  { id: "gallery-office", title: "Spreadsheet, documents and canvas" },
  { id: "gallery-publishing", title: "HTML editor, pages and email" },
  { id: "gallery-media", title: "Artifacts, slides and media" },
  { id: "gallery-scheduling", title: "Calendar, date pickers and boards" },
  { id: "gallery-forms", title: "Inputs and forms" },
  { id: "gallery-shell", title: "App shell, navigation, PWA and operations" },
  { id: "gallery-composer", title: "Composer" },
  { id: "gallery-conversation", title: "Conversations and collaboration" },
  { id: "gallery-workspace", title: "Workspace and IDE" },
  { id: "gallery-execution", title: "Terminals, logs, runs and notebooks" },
  { id: "gallery-preview", title: "Previews, review and artifacts" },
  { id: "gallery-settings", title: "Models, usage and settings" },
  { id: "gallery-knowledge", title: "Knowledge, evidence, insights and agents" },
  { id: "gallery-agent-ops", title: "Agent operations and traces" },
  { id: "gallery-tools-models", title: "Tools, models and prompts" },
  { id: "gallery-chat-tools", title: "Chat review and message tools" },
  { id: "gallery-assistant", title: "Assistant planning and meetings" },
  { id: "gallery-tasks", title: "Task management" },
  { id: "gallery-automation", title: "Automations" },
  { id: "gallery-browser-panels", title: "Browser panels" },
  { id: "gallery-dev-tools", title: "Debugger, git and editor panels" },
];

export function GalleryDemo() {
  const [focused, setFocused] = useState(() => window.location.hash === "#" + VIBE_CODING_SECTION);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateSection() {
      setFocused(window.location.hash === "#" + VIBE_CODING_SECTION);
    }
    window.addEventListener("hashchange", updateSection);
    return () => window.removeEventListener("hashchange", updateSection);
  }, []);

  useEffect(() => {
    if (focused && viewport.current) viewport.current.scrollTop = 0;
  }, [focused]);

  return (
    <div ref={viewport} className="h-full overflow-y-auto">
      {focused && <nav aria-label="Gallery navigation" className="mx-auto flex max-w-[105rem] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 sm:px-5">
        <a href="#gallery" className="text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">Back to all components</a>
        <span aria-hidden="true" className="text-xs text-muted-foreground">/</span>
        <h1 className="text-xs font-medium">Vibe coding editor</h1>
      </nav>}
      {!focused && <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-6">
        <nav aria-label="Gallery sections" className="flex flex-wrap gap-2 text-sm">
          <a href={"#" + VIBE_CODING_SECTION}
            className="rounded-md border border-border px-2.5 py-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Vibe coding editor
          </a>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-md border border-border px-2.5 py-1 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {section.title}
            </button>
          ))}
        </nav>
      </div>}
      <div className="mx-auto max-w-[105rem] px-3 pb-4 sm:px-5">
        <VibeCodingGallery />
      </div>
      {!focused && <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-6">
        <WorkflowToolsGallery />
        <PrimitivesGallery />
        <ControlsGallery />
        <DisplayGallery />
        <SiteGallery />
        <FeedbackGallery />
        <AgentRunGallery />
        <HumanLoopGallery />
        <OfficeGallery />
        <PublishingGallery />
        <MediaGallery />
        <SchedulingGallery />
        <FormsGallery />
        <ShellGallery />
        <ComposerGallery />
        <ConversationGallery />
        <WorkspaceGallery />
        <ExecutionGallery />
        <PreviewGallery />
        <SettingsGallery />
        <KnowledgeGallery />
        <AgentOpsGallery />
        <ToolsModelsGallery />
        <ChatToolsGallery />
        <AssistantGallery />
        <TasksGallery />
        <AutomationGallery />
        <BrowserPanelsGallery />
        <DevToolsGallery />
      </div>}
    </div>
  );
}
