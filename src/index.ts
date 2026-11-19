// src/index.ts
export { type FollowUpPerson, type AssistantFollowUpDraft, type AssistantFollowUpComposerProps, AssistantFollowUpComposer } from "./components/assistant-follow-up-composer.js";
export { type ToolBatchDecision, type ToolBatchCall, type ReviewedToolBatchCall, type ToolCallBatchReviewProps, ToolCallBatchReview } from "./components/tool-call-batch-review.js";
export { type InboxTask, type TaskInboxProps, TaskInbox } from "./components/task-inbox.js";
export { type AgentSteeringInputProps, AgentSteeringInput } from "./components/agent-steering-input.js";
export { type BrowserTab, type BrowserTabStripProps, BrowserTabStrip } from "./components/browser-tab-strip.js";
export {
  type AgendaItem,
  type AgentHandoff,
  AgentHandoffQueue,
  type AgentHandoffQueueProps,
  AssistantAgenda,
  type AssistantAgendaProps,
  AutomationRunControls,
  type AutomationRunControlsProps,
  type BrowserPage,
  BrowserPageQueue,
  type BrowserPageQueueProps,
  type ChatContextItem,
  ChatContextTray,
  type ChatContextTrayProps,
  type IdeProblem,
  IdeProblemsPanel,
  type IdeProblemsPanelProps,
  type PromptVariant,
  PromptVariantPicker,
  type PromptVariantPickerProps,
  TaskTriageBoard,
  type TaskTriageBoardProps,
  type TriageTask,
} from "./components/workflow-tools.js";
export {
  Accordion,
  AccordionContent,
  type AccordionContentProps,
  AccordionItem,
  type AccordionItemProps,
  type AccordionProps,
  AccordionTrigger,
  type AccordionTriggerProps,
} from "./components/accordion.js";
export {
  ActionApproval,
  type ActionApprovalProps,
  type ActionRisk,
  type ApprovalState,
} from "./components/action-approval.js";
export { ActionList, type ActionListProps, type ActionStep, type ActionStepStatus } from "./components/action-list.js";
export {
  ActionContextMenu,
  type ActionContextMenuProps,
  ActionMenu,
  type ActionMenuProps,
  type MenuEntry,
} from "./components/action-menu.js";
export {
  ActionResultCard,
  type ActionResultCardProps,
  type ActionResultKind,
} from "./components/action-result-card.js";
export {
  type ActivityEvent,
  type ActivityKind,
  ActivityTrace,
  type ActivityTraceProps,
} from "./components/activity-trace.js";
export { AgentError, type AgentErrorProps } from "./components/agent-error.js";
export {
  type AgentEdge,
  AgentGraph,
  type AgentGraphProps,
  type AgentNode,
  type AgentRunStatus,
  AgentRunView,
  type AgentRunViewProps,
} from "./components/agent-graph.js";
export {
  type AgentKind,
  type AgentOption,
  type AgentParticipant,
  AgentPicker,
  type AgentPickerProps,
  type AgentSelection,
} from "./components/agent-picker.js";
export {
  AlertDialog,
  AlertDialogAction,
  type AlertDialogActionProps,
  AlertDialogCancel,
  type AlertDialogCancelProps,
  AlertDialogContent,
  type AlertDialogContentProps,
  AlertDialogDescription,
  type AlertDialogDescriptionProps,
  AlertDialogFooter,
  type AlertDialogFooterProps,
  AlertDialogHeader,
  type AlertDialogHeaderProps,
  type AlertDialogProps,
  AlertDialogTitle,
  type AlertDialogTitleProps,
  AlertDialogTrigger,
  type AlertDialogTriggerProps,
} from "./components/alert-dialog.js";
export { AnsiText, type AnsiTextProps } from "./components/ansi-text.js";
export {
  AppShell,
  type AppShellProps,
  isNavItemCurrent,
  type NavItem,
  type NavSection,
} from "./components/app-shell.js";
export { ApprovalQueue, type ApprovalQueueProps, type ApprovalRequest } from "./components/approval-queue.js";
export { ArtifactCard, type ArtifactCardProps, type ArtifactCardStatus } from "./components/artifact-card.js";
export { ArtifactPreview, type ArtifactPreviewProps } from "./components/artifact-preview.js";
export { ArtifactThumbnail, type ArtifactThumbnailProps } from "./components/artifact-thumbnail.js";
export {
  artifactDocument,
  artifactExtension,
  type ArtifactKind,
  artifactKindInfo,
  type ArtifactVersion,
  type ArtifactView,
  ArtifactViewer,
  type ArtifactViewerProps,
  createMermaidPreview,
} from "./components/artifact-viewer.js";
export {
  Artifact,
  ArtifactAction,
  type ArtifactActionProps,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactHeader,
  type ArtifactMode,
  ArtifactModeToggle,
  type ArtifactProps,
  ArtifactTitle,
  useArtifact,
} from "./components/artifact.js";
export { AspectRatio, type AspectRatioProps } from "./components/aspect-ratio.js";
export { type AssistantMode, AssistantPanel, type AssistantPanelProps } from "./components/assistant-panel.js";
export { Attachment, type AttachmentProps, Attachments } from "./components/attachment.js";
export {
  Avatar,
  AvatarGroup,
  type AvatarGroupProps,
  type AvatarProps,
  type AvatarSize,
  type AvatarStatus,
} from "./components/avatar.js";
export { Badge, type BadgeProps, type BadgeVariant } from "./components/badge.js";
export { Banner, type BannerProps } from "./components/banner.js";
export { BarcodeScanner, type BarcodeScannerProps, RETAIL_BARCODE_FORMATS } from "./components/barcode-scanner.js";
export { type BatchGroup, type BatchItem, BatchReview, type BatchReviewProps } from "./components/batch-review.js";
export { BinaryFilePlaceholder, type BinaryFilePlaceholderProps } from "./components/binary-file-placeholder.js";
export {
  BlogCard,
  type BlogCardProps,
  BlogGrid,
  type BlogGridProps,
  type BlogPost,
  formatPostDate,
} from "./components/blog-card.js";
export { BranchNavigator, type BranchNavigatorProps } from "./components/branch-navigator.js";
export {
  type BreadcrumbItem,
  Breadcrumbs,
  type BreadcrumbsProps,
  defaultRenderLink,
  type LinkRenderProps,
  type RenderLink,
} from "./components/breadcrumbs.js";
export { BudgetBar, type BudgetBarProps } from "./components/budget-bar.js";
export { BudgetNotice, type BudgetNoticeProps, budgetNoticeTone } from "./components/budget-notice.js";
export {
  Button,
  buttonClasses,
  type ButtonClassOptions,
  ButtonGroup,
  type ButtonGroupProps,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./components/button.js";
export {
  buildHeatmapMatrix,
  CalendarHeatmap,
  type CalendarHeatmapProps,
  heatmapColor,
  type HeatmapDay,
  heatmapLevel,
  type HeatmapMatrix,
  type HeatmapMonthLabel,
  type HeatmapValue,
} from "./components/calendar-heatmap.js";
export { CalendarMonth, type CalendarMonthProps, type DateRangeValue } from "./components/calendar-month.js";
export { type Candidate, CandidatePicker, type CandidatePickerProps } from "./components/candidate-picker.js";
export {
  Canvas,
  CanvasMain,
  type CanvasMode,
  CanvasPanel,
  type CanvasProps,
  CanvasResizeHandle,
  useCanvas,
} from "./components/canvas.js";
export {
  CameraCapture,
  type CameraCaptureProps,
  captureScreen,
  ScreenshotButton,
  type ScreenshotButtonProps,
} from "./components/capture-controls.js";
export {
  Card,
  CardAction,
  type CardActionProps,
  CardContent,
  type CardContentProps,
  CardDescription,
  type CardDescriptionProps,
  CardFooter,
  type CardFooterProps,
  CardHeader,
  type CardHeaderProps,
  type CardProps,
  CardTitle,
  type CardTitleProps,
} from "./components/card.js";
export {
  Carousel,
  type CarouselItem,
  type CarouselProps,
  CarouselSlide,
  type CarouselSlideProps,
  type CarouselSlidesPerView,
  resolveSlidesPerView,
} from "./components/carousel.js";
export {
  CashCount,
  type CashCountProps,
  type CashCounts,
  cashCountTotal,
  type Denomination,
  US_DENOMINATIONS,
} from "./components/cash-count.js";
export { ChangeReview, type ChangeReviewProps } from "./components/change-review.js";
export { Chart, type ChartProps, type ChartSeries } from "./components/chart.js";
export { ChatAlert, type ChatAlertProps, type ChatAlertSource } from "./components/chat-alert.js";
export {
  type ChatFolder,
  ChatHistory,
  type ChatHistoryItem,
  type ChatHistoryProps,
} from "./components/chat-history.js";
export {
  Checkbox,
  CheckboxGroup,
  type CheckboxGroupOption,
  type CheckboxGroupProps,
  type CheckboxProps,
} from "./components/checkbox.js";
export {
  CircularProgress,
  type CircularProgressProps,
  type CircularProgressTone,
} from "./components/circular-progress.js";
export {
  type Claim,
  claimCoverage,
  ClaimLedger,
  type ClaimLedgerProps,
  type ClaimStatus,
} from "./components/claim-ledger.js";
export {
  type ClarifyingAnswer,
  type ClarifyingAnswers,
  type ClarifyingOption,
  type ClarifyingQuestion,
  ClarifyingQuestions,
  type ClarifyingQuestionsProps,
} from "./components/clarifying-questions.js";
export {
  CodeBlock,
  CodeBlockCopyButton,
  type CodeBlockCopyButtonProps,
  type CodeBlockProps,
  codeHighlighter,
} from "./components/code-block.js";
export {
  CodeEditor,
  type CodeEditorHandle,
  type CodeEditorProps,
  preloadCodeEditor,
} from "./components/code-editor.js";
export {
  Collapsible,
  CollapsibleContent,
  type CollapsibleContentProps,
  type CollapsibleProps,
  CollapsibleTrigger,
  type CollapsibleTriggerProps,
} from "./components/collapsible.js";
export {
  ColorPicker,
  ColorPickerPanel,
  type ColorPickerPanelProps,
  type ColorPickerProps,
} from "./components/color-picker.js";
export {
  Combobox,
  type ComboboxFilter,
  type ComboboxOption,
  type ComboboxProps,
  MultiSelect,
  type MultiSelectProps,
} from "./components/combobox.js";
export {
  type Command,
  type CommandMode,
  CommandPalette,
  type CommandPaletteProps,
} from "./components/command-palette.js";
export { ComposerOptions, type ComposerOptionsProps, type ComposerTool } from "./components/composer-options.js";
export { ConfirmDialog, type ConfirmDialogProps } from "./components/confirm-dialog.js";
export { type ConnectionState, ConnectionStatus, type ConnectionStatusProps } from "./components/connection-status.js";
export { ConsentCard, type ConsentCardProps, type ConsentScope } from "./components/consent-card.js";
export {
  characterCount,
  type ContactErrors,
  type ContactField,
  ContactForm,
  type ContactFormProps,
  type ContactTopic,
  type ContactValues,
  isValidEmail,
  validateContact,
  type ValidateContactOptions,
} from "./components/contact-form.js";
export {
  ContextChips,
  type ContextChipsProps,
  type ContextItem,
  type ContextKind,
  inspectedElementToContext,
  SelectedElementChip,
  type SelectedElementChipProps,
} from "./components/context-chips.js";
export {
  ContextMenu,
  ContextMenuCheckboxItem,
  type ContextMenuCheckboxItemProps,
  ContextMenuContent,
  type ContextMenuContentProps,
  ContextMenuGroup,
  type ContextMenuGroupProps,
  ContextMenuItem,
  type ContextMenuItemProps,
  ContextMenuLabel,
  type ContextMenuLabelProps,
  type ContextMenuProps,
  ContextMenuRadioGroup,
  type ContextMenuRadioGroupProps,
  ContextMenuRadioItem,
  type ContextMenuRadioItemProps,
  ContextMenuSeparator,
  type ContextMenuSeparatorProps,
  ContextMenuShortcut,
  type ContextMenuShortcutProps,
  ContextMenuSub,
  ContextMenuSubContent,
  type ContextMenuSubContentProps,
  type ContextMenuSubProps,
  ContextMenuSubTrigger,
  type ContextMenuSubTriggerProps,
  ContextMenuTrigger,
  type ContextMenuTriggerProps,
} from "./components/context-menu.js";
export {
  contextLevel,
  type ContextLevel,
  ContextMeter,
  type ContextMeterProps,
  type ContextSegment,
  ContextSnapshot,
  type ContextSnapshotItem,
  type ContextSnapshotProps,
  type ContextSnapshotSection,
} from "./components/context-meter.js";
export { ConversationMarker, type ConversationMarkerProps } from "./components/conversation-marker.js";
export { ConversationTransfer, type ConversationTransferProps } from "./components/conversation-transfer.js";
export {
  Conversation,
  ConversationContent,
  type ConversationContentProps,
  ConversationEmptyState,
  type ConversationEmptyStateProps,
  type ConversationProps,
  ConversationScrollButton,
  useConversation,
} from "./components/conversation.js";
export { CopyButton, type CopyButtonProps } from "./components/copy-button.js";
export { CostApproval, type CostApprovalProps, type CostApprovalState } from "./components/cost-approval.js";
export {
  Countdown,
  type CountdownProps,
  type DurationParts,
  type DurationUnit,
  splitDuration,
  Timer,
  type TimerProps,
} from "./components/countdown.js";
export {
  applyColumnMapping,
  autoMapColumns,
  type ColumnField,
  type ColumnMapping,
  CsvColumnMapper,
  type CsvColumnMapperProps,
  normalizeHeader,
} from "./components/csv-column-mapper.js";
export {
  type ColumnProfile,
  CsvExplorer,
  type CsvExplorerProps,
  parseNumericCell,
  profileColumns,
} from "./components/csv-explorer.js";
export { CtaSection, type CtaSectionProps } from "./components/cta-section.js";
export { DataTable, type DataTableColumn, type DataTableProps, type DataTableSort } from "./components/data-table.js";
export {
  ColumnProfileCard,
  type ColumnProfileCardProps,
  type DatabaseColumn,
  type DatabaseRow,
  type DatabaseRowsRequest,
  type DatabaseTable,
  DatabaseViewer,
  type DatabaseViewerProps,
} from "./components/database-viewer.js";
export {
  DatePicker,
  type DatePickerProps,
  DateRangePicker,
  type DateRangePickerProps,
  type DateRangePreset,
  defaultDatePresets,
} from "./components/date-picker.js";
export {
  DELIVERY_STATES,
  type DeliveryState,
  DeliveryStatus,
  type DeliveryStatusProps,
} from "./components/delivery-status.js";
export {
  advanceDeployment,
  type DeploymentState,
  DeploymentStatus,
  type DeploymentStatusProps,
  type DeploymentStep,
} from "./components/deployment-status.js";
export {
  type DescriptionItem,
  DescriptionList,
  type DescriptionListLayout,
  type DescriptionListProps,
} from "./components/description-list.js";
export { DESIGN_SIZES } from "./components/design-editor-panels.js";
export { DesignEditor, type DesignEditorProps, type DesignTool } from "./components/design-editor.js";
export { DesignPageSvg, type DesignPageSvgProps, safeColor } from "./components/design-page-svg.js";
export {
  Dialog,
  DialogBody,
  type DialogBodyProps,
  DialogClose,
  type DialogCloseProps,
  DialogContent,
  type DialogContentProps,
  DialogDescription,
  type DialogDescriptionProps,
  DialogFooter,
  type DialogFooterProps,
  DialogHeader,
  type DialogHeaderProps,
  type DialogProps,
  type DialogSize,
  DialogTitle,
  type DialogTitleProps,
  DialogTrigger,
  type DialogTriggerProps,
} from "./components/dialog.js";
export { DiffReview, type DiffReviewProps, DiffSummary, type DiffSummaryProps } from "./components/diff-review.js";
export { DiffView, type DiffViewProps } from "./components/diff-view.js";
export { type DocPage, DocsViewer, type DocsViewerProps } from "./components/docs-viewer.js";
export {
  DocumentEditor,
  type DocumentEditorHandle,
  type DocumentEditorLayout,
  type DocumentEditorProps,
  preloadDocumentEditor,
} from "./components/document-editor.js";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  type DropdownMenuCheckboxItemProps,
  DropdownMenuContent,
  type DropdownMenuContentProps,
  DropdownMenuGroup,
  type DropdownMenuGroupProps,
  DropdownMenuItem,
  type DropdownMenuItemProps,
  DropdownMenuLabel,
  type DropdownMenuLabelProps,
  type DropdownMenuProps,
  DropdownMenuRadioGroup,
  type DropdownMenuRadioGroupProps,
  DropdownMenuRadioItem,
  type DropdownMenuRadioItemProps,
  DropdownMenuSeparator,
  type DropdownMenuSeparatorProps,
  DropdownMenuShortcut,
  type DropdownMenuShortcutProps,
  DropdownMenuSub,
  DropdownMenuSubContent,
  type DropdownMenuSubContentProps,
  type DropdownMenuSubProps,
  DropdownMenuSubTrigger,
  type DropdownMenuSubTriggerProps,
  DropdownMenuTrigger,
  type DropdownMenuTriggerProps,
  type MenuAlign,
  type MenuSide,
} from "./components/dropdown-menu.js";
export {
  EmojiPicker,
  EmojiPickerPanel,
  type EmojiPickerPanelProps,
  type EmojiPickerProps,
} from "./components/emoji-picker.js";
export { type CalendarView, EventCalendar, type EventCalendarProps } from "./components/event-calendar.js";
export { EventLog, type EventLogProps, type LogEvent } from "./components/event-log.js";
export {
  CitedText,
  type CitedTextProps,
  type Evidence,
  evidenceElementId,
  EvidencePanel,
  type EvidencePanelProps,
} from "./components/evidence-panel.js";
export { ExecutionOutputView, type ExecutionOutputViewProps } from "./components/execution-output.js";
export {
  estimateRemaining,
  ExportProgress,
  type ExportProgressProps,
  type ExportStatus,
} from "./components/export-progress.js";
export { Faq, type FaqItem, faqJsonLd, type FaqProps, filterFaqItems } from "./components/faq.js";
export { FeatureGrid, type FeatureGridProps, type FeatureItem } from "./components/feature-grid.js";
export {
  FeedbackDialog,
  type FeedbackDialogProps,
  type FeedbackSubmission,
  NEGATIVE_FEEDBACK_CATEGORIES,
  POSITIVE_FEEDBACK_CATEGORIES,
} from "./components/feedback-dialog.js";
export { Fieldset, FieldsetLegend, type FieldsetLegendProps, type FieldsetProps } from "./components/fieldset.js";
export { FileBreadcrumb, type FileBreadcrumbProps } from "./components/file-breadcrumb.js";
export { type FileChange, FileChanges, type FileChangesProps, sumLineChanges } from "./components/file-changes.js";
export { FileDropzone, type FileDropzoneProps } from "./components/file-dropzone.js";
export { FileSearch, type FileSearchProps } from "./components/file-search.js";
export { FILE_STATUS, fileIcon, FileStatusBadge, FileTree, type FileTreeProps } from "./components/file-tree.js";
export { detectFileKind, type FileKind, FileViewer, type FileViewerProps } from "./components/file-viewer.js";
export { type FilterChipOption, FilterChips, type FilterChipsProps } from "./components/filter-chips.js";
export { FormField, type FormFieldProps, TextInput, type TextInputProps } from "./components/form-field.js";
export {
  FormWizard,
  type FormWizardProps,
  Stepper,
  type StepperProps,
  type StepperStep,
  type StepState,
  type WizardStep,
} from "./components/form-wizard.js";
export { Hero, type HeroBackground, type HeroProps } from "./components/hero.js";
export {
  HoverCard,
  HoverCardContent,
  type HoverCardContentProps,
  type HoverCardProps,
  HoverCardTrigger,
  type HoverCardTriggerProps,
} from "./components/hover-card.js";
export { BLOCK_SLASH_ITEMS } from "./components/html-editor-blocks.js";
export { pagePrintCss } from "./components/html-editor-document.js";
export { type HtmlAiAction, type HtmlAiHandler, type HtmlAiRequest } from "./components/html-editor-extension.js";
export {
  HtmlEditor,
  type HtmlEditorHandle,
  type HtmlEditorProps,
  preloadHtmlEditor,
} from "./components/html-editor.js";
export {
  type CompareImage,
  ImageCompare,
  type ImageCompareMode,
  type ImageCompareProps,
} from "./components/image-compare.js";
export { type CropArea, cropAreaFor, ImageCropper, type ImageCropperProps } from "./components/image-cropper.js";
export {
  type GalleryImage,
  ImageGallery,
  type ImageGalleryProps,
  Lightbox,
  type LightboxProps,
} from "./components/image-gallery.js";
export { InfiniteScroll, type InfiniteScrollProps } from "./components/infinite-scroll.js";
export {
  DEFAULT_INLINE_ACTIONS,
  InlineEdit,
  type InlineEditAction,
  type InlineEditProps,
  type InlineEditRequest,
} from "./components/inline-edit.js";
export { countWords, InputCounter, type InputCounterProps } from "./components/input-counter.js";
export {
  InputGroup,
  InputGroupAddon,
  type InputGroupAddonProps,
  InputGroupButton,
  type InputGroupButtonProps,
  InputGroupInput,
  type InputGroupInputProps,
  type InputGroupProps,
} from "./components/input-group.js";
export {
  AnalyzeButton,
  type AnalyzeButtonProps,
  type AnalyzeResult,
  type InsightAction,
  InsightCard,
  type InsightCardProps,
  type InsightMetric,
  type InsightSeverity,
} from "./components/insight-card.js";
export { InstallPrompt, type InstallPromptProps } from "./components/install-prompt.js";
export {
  buildSandboxedDocument,
  createReactPreview,
  InteractivePreview,
  type InteractivePreviewProps,
  openSandboxedWindow,
  type PreviewSandboxToken,
  type PreviewViewport,
  type ReactPreview,
  type ReactPreviewOptions,
  readPreviewError,
} from "./components/interactive-preview.js";
export { type Job, JobList, type JobListProps, type JobStatus } from "./components/job-list.js";
export { jsonPath, JsonViewer, type JsonViewerProps } from "./components/json-viewer.js";
export {
  KanbanBoard,
  type KanbanBoardProps,
  type KanbanCard,
  type KanbanColumn,
  rankAt,
} from "./components/kanban-board.js";
export { Kbd, KbdGroup, type KbdGroupProps, type KbdProps, type ShortcutKey, shortcutKeys } from "./components/kbd.js";
export {
  collectionHealth,
  type IngestionStatus,
  KnowledgeBase,
  type KnowledgeBaseProps,
  type KnowledgeCollection,
  type KnowledgeDocument,
} from "./components/knowledge-base.js";
export { Label, type LabelProps } from "./components/label.js";
export { type FileLock, LockManager, type LockManagerProps } from "./components/lock-manager.js";
export { type LogConnection, LogViewer, type LogViewerProps } from "./components/log-viewer.js";
export { LogoCloud, type LogoCloudProps, type LogoItem } from "./components/logo-cloud.js";
export { Marquee, type MarqueeProps } from "./components/marquee.js";
export {
  computeMasonryLayout,
  Masonry,
  masonryColumnCount,
  type MasonryLayout,
  type MasonryPlacement,
  type MasonryProps,
} from "./components/masonry.js";
export {
  type McpServer,
  McpServerList,
  type McpServerListProps,
  type McpServerStatus,
  type McpTool,
  type McpToolParameter,
} from "./components/mcp-server-list.js";
export { formatMediaTime, MediaPlayer, type MediaPlayerProps, type MediaTrack } from "./components/media-player.js";
export {
  MemoryConflict,
  type MemoryConflictEntry,
  type MemoryConflictProps,
  type MemoryItem,
  MemoryManager,
  type MemoryManagerProps,
  type MemoryResolution,
  type MemoryStatus,
} from "./components/memory-manager.js";
export {
  Menubar,
  MenubarCheckboxItem,
  type MenubarCheckboxItemProps,
  MenubarContent,
  type MenubarContentProps,
  MenubarGroup,
  type MenubarGroupProps,
  MenubarItem,
  type MenubarItemProps,
  MenubarLabel,
  type MenubarLabelProps,
  MenubarMenu,
  type MenubarMenuProps,
  type MenubarProps,
  MenubarRadioGroup,
  type MenubarRadioGroupProps,
  MenubarRadioItem,
  type MenubarRadioItemProps,
  MenubarSeparator,
  type MenubarSeparatorProps,
  MenubarShortcut,
  type MenubarShortcutProps,
  MenubarSub,
  MenubarSubContent,
  type MenubarSubContentProps,
  type MenubarSubProps,
  MenubarSubTrigger,
  type MenubarSubTriggerProps,
  MenubarTrigger,
  type MenubarTriggerProps,
} from "./components/menubar.js";
export { MessageContent, type MessageContentProps } from "./components/message-content.js";
export { MessageEditor, type MessageEditorProps } from "./components/message-editor.js";
export {
  MessageReactions,
  type MessageReactionsProps,
  type Reaction,
  toggleReaction,
} from "./components/message-reactions.js";
export {
  Message,
  MessageAction,
  type MessageActionProps,
  MessageActions,
  MessageAvatar,
  type MessageAvatarProps,
  MessageBody,
  MessageBranchAction,
  MessageBubble,
  MessageCopyAction,
  type MessageCopyActionProps,
  MessageEditAction,
  MessageFeedbackActions,
  type MessageFeedbackActionsProps,
  type MessageFeedbackValue,
  type MessageProps,
  MessageRegenerateAction,
  type MessageRole,
} from "./components/message.js";
export { getMeterTone, Meter, type MeterProps, type MeterThresholds, type MeterTone } from "./components/meter.js";
export { type LocalModelStatus, ModelCard, type ModelCardProps } from "./components/model-card.js";
export {
  bestByMetric,
  type ComparisonCandidate,
  type ComparisonMetrics,
  ModelComparison,
  type ModelComparisonProps,
} from "./components/model-comparison.js";
export {
  changedRoles,
  ModelConfigList,
  type ModelConfigListProps,
  type ModelRole,
} from "./components/model-config-list.js";
export {
  clampModelParameters,
  isLowOutputBudget,
  type ModelParameterField,
  ModelParameters,
  type ModelParametersProps,
  type ModelParameterValues,
  type ReasoningEffort,
} from "./components/model-parameters.js";
export { ModelPicker, type ModelPickerProps } from "./components/model-picker.js";
export { type ModelOption, ModelSelector, type ModelSelectorProps } from "./components/model-selector.js";
export {
  NavigationMenu,
  NavigationMenuContent,
  type NavigationMenuContentProps,
  NavigationMenuIndicator,
  type NavigationMenuIndicatorProps,
  NavigationMenuItem,
  type NavigationMenuItemProps,
  NavigationMenuLink,
  type NavigationMenuLinkProps,
  NavigationMenuList,
  type NavigationMenuListProps,
  type NavigationMenuProps,
  NavigationMenuTrigger,
  navigationMenuTriggerClass,
  type NavigationMenuTriggerProps,
  NavigationMenuViewport,
  type NavigationMenuViewportProps,
} from "./components/navigation-menu.js";
export {
  NewsletterSignup,
  type NewsletterSignupProps,
  type NewsletterSubscription,
} from "./components/newsletter-signup.js";
export {
  appendExecutionOutput,
  createNotebookCell,
  type KernelStatus,
  Notebook,
  type NotebookProps,
} from "./components/notebook.js";
export {
  type AppNotification,
  badgeCount,
  NotificationCenter,
  type NotificationCenterProps,
} from "./components/notification-center.js";
export {
  currencyFractionDigits,
  CurrencyInput,
  type CurrencyInputProps,
  NumberInput,
  type NumberInputProps,
} from "./components/number-input.js";
export { OfflineQueuePanel, type OfflineQueuePanelProps } from "./components/offline-queue-panel.js";
export {
  type ChecklistTask,
  OnboardingChecklist,
  type OnboardingChecklistProps,
} from "./components/onboarding-checklist.js";
export { OTPInput, type OTPInputProps } from "./components/otp-input.js";
export { Outbox, type OutboxItem, type OutboxProps } from "./components/outbox.js";
export { PageBuilder, type PageBuilderProps } from "./components/page-builder.js";
export { Pagination, type PaginationEntry, type PaginationProps, paginationRange } from "./components/pagination.js";
export { PasswordField, type PasswordFieldProps } from "./components/password-field.js";
export { PatchHunkView, type PatchHunkViewProps } from "./components/patch-hunk.js";
export { PdfViewer, type PdfViewerProps } from "./components/pdf-viewer.js";
export {
  countGrantChanges,
  type Permission,
  type PermissionGrants,
  PermissionMatrix,
  type PermissionMatrixProps,
  type Role,
} from "./components/permission-matrix.js";
export {
  PlanCard,
  type PlanCardProps,
  type PlanSection,
  type PlanStep,
  splitPackageSpecifier,
} from "./components/plan-card.js";
export {
  Popover,
  type PopoverAlign,
  PopoverClose,
  type PopoverCloseProps,
  PopoverContent,
  type PopoverContentProps,
  PopoverDescription,
  type PopoverDescriptionProps,
  type PopoverProps,
  type PopoverSide,
  PopoverTitle,
  type PopoverTitleProps,
  PopoverTrigger,
  type PopoverTriggerProps,
} from "./components/popover.js";
export { PresenceAvatars, type PresenceAvatarsProps, type PresenceUser } from "./components/presence-avatars.js";
export { PreviewErrorBanner, type PreviewErrorBannerProps } from "./components/preview-error-banner.js";
export {
  type BillingPeriod,
  type ComparisonRow,
  PlanComparison,
  type PlanComparisonProps,
  type PlanFeature,
  type PricingPlan,
  PricingTable,
  type PricingTableProps,
  yearlySavings,
  type YearlySavings,
} from "./components/pricing-table.js";
export {
  dedupeProgress,
  type ProgressNote,
  ProgressSteps,
  type ProgressStepsProps,
} from "./components/progress-steps.js";
export { type BarSize, type BarTone, Progress, type ProgressProps } from "./components/progress.js";
export { PromptInputEnhance, type PromptInputEnhanceProps } from "./components/prompt-enhance.js";
export {
  findMention,
  type MentionItem,
  type MentionSource,
  PromptInputMentions,
  type PromptInputMentionsProps,
} from "./components/prompt-input-mentions.js";
export {
  type ChatStatus,
  PromptInput,
  PromptInputAttachButton,
  type PromptInputAttachButtonProps,
  PromptInputButton,
  type PromptInputButtonProps,
  PromptInputCounter,
  PromptInputFooter,
  type PromptInputProps,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputTextareaProps,
  PromptInputTools,
  type SubmitOnEnter,
  usePromptInput,
} from "./components/prompt-input.js";
export {
  fillPrompt,
  PromptLibrary,
  type PromptLibraryProps,
  promptVariables,
  type SavedPrompt,
} from "./components/prompt-library.js";
export {
  HealthBadge,
  type HealthBadgeProps,
  ProviderHealth,
  type ProviderHealthProps,
  type ProviderStatus,
} from "./components/provider-health.js";
export {
  ApiKeyField,
  type ApiKeyFieldProps,
  normalizeBaseUrl,
  type ProviderConfig,
  ProviderSettings,
  type ProviderSettingsProps,
} from "./components/provider-settings.js";
export { PullToRefresh, type PullToRefreshProps } from "./components/pull-to-refresh.js";
export { QRCode, type QRCodeProps } from "./components/qr-code.js";
export { QueryReview, type QueryReviewProps } from "./components/query-review.js";
export {
  RadioCard,
  type RadioCardProps,
  RadioGroup,
  RadioGroupItem,
  type RadioGroupItemProps,
  type RadioGroupProps,
  type RadioOption,
} from "./components/radio-group.js";
export { Rating, type RatingProps } from "./components/rating.js";
export {
  Reasoning,
  ReasoningContent,
  type ReasoningContentProps,
  type ReasoningProps,
  ReasoningTrigger,
  type ReasoningTriggerProps,
} from "./components/reasoning.js";
export { RegionCapture, type RegionCaptureProps } from "./components/region-capture.js";
export {
  initialPanelSizes,
  type ResizablePanel,
  ResizablePanels,
  type ResizablePanelsProps,
  resizePanels,
} from "./components/resizable-panels.js";
export {
  RetrievalInspector,
  type RetrievalInspectorProps,
  type RetrievalTrace,
  type RetrievedItem,
} from "./components/retrieval-inspector.js";
export {
  formatAnchor,
  type ReviewAnchor,
  type ReviewComment,
  ReviewComments,
  type ReviewCommentsProps,
  type ReviewFilter,
  type ReviewThread,
  sortThreads,
} from "./components/review-comments.js";
export {
  preloadRichTextEditor,
  type RichTextComment,
  type RichTextDocument,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "./components/rich-text-editor.js";
export { type FundingSource, RunBudgetControl, type RunBudgetControlProps } from "./components/run-budget-control.js";
export { type RunCheckpoint, RunCheckpoints, type RunCheckpointsProps } from "./components/run-checkpoints.js";
export { RunReplay, type RunReplayEvent, type RunReplayProps } from "./components/run-replay.js";
export { type Runner, RunPanel, type RunPanelProps, type RunStatus } from "./components/run-panel.js";
export { type RunDetails, type RunPhase, RunStatusBar, type RunStatusBarProps } from "./components/run-status-bar.js";
export {
  RunTimeline,
  type RunTimelineProps,
  type TimelineFile,
  type TimelinePhase,
  type TimelineStage,
} from "./components/run-timeline.js";
export {
  type RuntimeOption,
  RuntimeSelector,
  type RuntimeSelectorProps,
  type RuntimeStatus,
} from "./components/runtime-selector.js";
export { type SaveState, SaveStatus, type SaveStatusProps } from "./components/save-status.js";
export { ScrollArea, type ScrollAreaProps } from "./components/scroll-area.js";
export { SearchInput, type SearchInputProps } from "./components/search-input.js";
export {
  PassagePreview,
  type PassagePreviewProps,
  QueryExpansion,
  type QueryExpansionProps,
  type QueryExpansionTerm,
  queryTerms,
  type SearchPassage,
  type SearchResult,
  SearchResultCard,
  type SearchResultCardProps,
  SearchScope,
  type SearchScopeProps,
  type SearchScopeValue,
} from "./components/search-results.js";
export { maskSecretHint, SecretField, type SecretFieldProps, type SecretSource } from "./components/secret-field.js";
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from "./components/segmented-control.js";
export {
  Select,
  SelectContent,
  type SelectContentProps,
  SelectGroup,
  SelectGroupLabel,
  type SelectGroupLabelProps,
  type SelectGroupProps,
  SelectItem,
  type SelectItemProps,
  type SelectOption,
  type SelectOptionGroup,
  type SelectProps,
  SelectRoot,
  type SelectRootProps,
  SelectSeparator,
  type SelectSeparatorProps,
  SelectTrigger,
  type SelectTriggerProps,
  SelectValue,
  type SelectValueProps,
} from "./components/select.js";
export { Separator, type SeparatorProps } from "./components/separator.js";
export { SessionTimeoutWarning, type SessionTimeoutWarningProps } from "./components/session-timeout-warning.js";
export { ShareButton, type ShareButtonProps } from "./components/share-button.js";
export {
  Drawer,
  DrawerClose,
  type DrawerCloseProps,
  DrawerContent,
  type DrawerContentProps,
  DrawerDescription,
  type DrawerDescriptionProps,
  DrawerFooter,
  type DrawerFooterProps,
  DrawerHeader,
  type DrawerHeaderProps,
  type DrawerProps,
  DrawerTitle,
  type DrawerTitleProps,
  DrawerTrigger,
  type DrawerTriggerProps,
  Sheet,
  SheetBody,
  type SheetBodyProps,
  SheetClose,
  type SheetCloseProps,
  SheetContent,
  type SheetContentProps,
  SheetDescription,
  type SheetDescriptionProps,
  SheetFooter,
  type SheetFooterProps,
  SheetHeader,
  type SheetHeaderProps,
  type SheetProps,
  type SheetSide,
  SheetTitle,
  type SheetTitleProps,
  SheetTrigger,
  type SheetTriggerProps,
} from "./components/sheet.js";
export {
  Shimmer,
  type ShimmerProps,
  ThinkingIndicator,
  type ThinkingIndicatorProps,
  TypingDots,
} from "./components/shimmer.js";
export { ShortcutHelp, type ShortcutHelpProps, ShortcutKeys } from "./components/shortcut-help.js";
export {
  SignaturePad,
  type SignaturePadProps,
  type SignaturePoint,
  signatureToPng,
  type SignatureValue,
  strokeToPath,
} from "./components/signature-pad.js";
export {
  type FooterLink,
  type FooterLinkColumn,
  type FooterSocialLink,
  SiteFooter,
  type SiteFooterProps,
} from "./components/site-footer.js";
export {
  SiteHeader,
  type SiteHeaderProps,
  type SiteNavEntry,
  type SiteNavGroup,
  type SiteNavLink,
} from "./components/site-header.js";
export {
  childHeadingLevel,
  type HeadingLevel,
  type SiteAction,
  SiteActionButton,
  type SiteActionButtonProps,
  type SiteActionVariant,
  SiteSection,
  type SiteSectionHeadingProps,
  type SiteSectionProps,
  SubmitStatusMessage,
  type SubmitStatusMessageProps,
} from "./components/site-section.js";
export { type Slide, SlideDeck, type SlideDeckProps, slidesFromMarkdown } from "./components/slide-deck.js";
export { Slider, type SliderMark, type SliderProps } from "./components/slider.js";
export { moveItem, type SortableItemState, SortableList, type SortableListProps } from "./components/sortable-list.js";
export {
  InlineCitation,
  type InlineCitationProps,
  Source,
  type SourceItem,
  type SourceProps,
  Sources,
  SourcesContent,
  SourcesTrigger,
  type SourcesTriggerProps,
} from "./components/sources.js";
export {
  PromptInputVoice,
  ReadAloud,
  type ReadAloudProps,
  VoiceInput,
  type VoiceInputProps,
} from "./components/speech-controls.js";
export { Spinner, type SpinnerProps, type SpinnerSize } from "./components/spinner.js";
export { sheetNameProblem } from "./components/spreadsheet-parts.js";
export {
  createSpreadsheetSheet,
  formatCellValue,
  Spreadsheet,
  type SpreadsheetProps,
} from "./components/spreadsheet.js";
export {
  computeTrend,
  Gauge,
  type GaugeProps,
  Sparkline,
  type SparklineProps,
  StatTile,
  type StatTileProps,
  type TrendDirection,
  TrendIndicator,
  type TrendIndicatorProps,
} from "./components/stat-tile.js";
export { formatStatValue, type StatItem, StatsBand, type StatsBandProps } from "./components/stats-band.js";
export {
  StatusPill,
  type StatusPillProps,
  type SyncState,
  SyncStatus,
  type SyncStatusProps,
} from "./components/status-pill.js";
export { StreamStatus, type StreamStatusProps } from "./components/stream-status.js";
export { SubAgentSession, type SubAgentSessionProps, type SubAgentState } from "./components/sub-agent-session.js";
export {
  SentimentBadge,
  type SentimentBadgeProps,
  sentimentLabel,
  type SuggestedValue,
  SuggestionCard,
  type SuggestionCardProps,
} from "./components/suggestion-card.js";
export { SuggestionRail, type SuggestionRailProps } from "./components/suggestion-rail.js";
export { Suggestion, type SuggestionProps, Suggestions } from "./components/suggestion.js";
export {
  DeferredSurface,
  type DeferredSurfaceProps,
  Skeleton,
  type SkeletonProps,
  type SurfaceKind,
  SurfaceState,
  type SurfaceStateProps,
} from "./components/surface-state.js";
export { Switch, type SwitchProps } from "./components/switch.js";
export {
  cycleSortDirection,
  Table,
  TableBody,
  type TableBodyProps,
  TableCaption,
  type TableCaptionProps,
  TableCell,
  type TableCellProps,
  TableFooter,
  type TableFooterProps,
  TableHead,
  TableHeader,
  type TableHeaderProps,
  type TableHeadProps,
  type TableProps,
  TableRow,
  type TableRowProps,
  type TableSortDirection,
} from "./components/table.js";
export {
  Tabs,
  TabsContent,
  type TabsContentProps,
  TabsList,
  type TabsListProps,
  type TabsProps,
  TabsTrigger,
  type TabsTriggerProps,
  type TabsVariant,
} from "./components/tabs.js";
export { TagInput, type TagInputProps } from "./components/tag-input.js";
export { type AgentTask, TaskList, type TaskListProps, type TaskQuestion } from "./components/task-list.js";
export { TeamGrid, type TeamGridProps, type TeamMember, type TeamMemberLink } from "./components/team-grid.js";
export {
  fillTemplate,
  type PromptTemplate,
  TemplateGallery,
  type TemplateGalleryProps,
  templateVariables,
} from "./components/template-gallery.js";
export {
  describeSession,
  type TerminalSession,
  type TerminalSessionStatus,
  TerminalTabs,
  type TerminalTabsProps,
} from "./components/terminal-tabs.js";
export { preloadTerminal, Terminal, type TerminalHandle, type TerminalProps } from "./components/terminal.js";
export { type Testimonial, Testimonials, type TestimonialsProps } from "./components/testimonials.js";
export { Textarea, type TextareaProps } from "./components/textarea.js";
export { ThemeToggle, type ThemeToggleProps } from "./components/theme-toggle.js";
export {
  DateSeparator,
  type DateSeparatorProps,
  EarlierMessages,
  type EarlierMessagesProps,
  NewMessagesDivider,
  UnreadJump,
  type UnreadJumpProps,
} from "./components/thread-markers.js";
export {
  ThreadReplies,
  type ThreadRepliesProps,
  ThreadReplyBox,
  type ThreadReplyBoxProps,
} from "./components/thread-replies.js";
export {
  formatTime,
  type FormatTimeOptions,
  parseTime,
  type TimeParts,
  TimePicker,
  type TimePickerProps,
} from "./components/time-picker.js";
export { Timeline, type TimelineItem, type TimelineProps } from "./components/timeline.js";
export {
  bindToastManager,
  createToastManager,
  type ToastApi,
  Toaster,
  type ToasterProps,
  type ToastOptions,
  type UndoToastOptions,
  useToast,
} from "./components/toaster.js";
export {
  Toggle,
  ToggleGroup,
  type ToggleGroupItem,
  type ToggleGroupProps,
  type ToggleProps,
  type ToggleSize,
  type ToggleVariant,
} from "./components/toggle.js";
export {
  filterAuditEntries,
  type ToolAuditEntry,
  ToolAuditLog,
  type ToolAuditLogProps,
  type ToolAuditStatus,
} from "./components/tool-audit-log.js";
export {
  ToolCall,
  ToolCallApproval,
  type ToolCallApprovalProps,
  ToolCallContent,
  ToolCallInput,
  type ToolCallInputProps,
  type ToolCallProps,
  ToolCallResult,
  type ToolCallResultProps,
  type ToolCallStatus,
  ToolCallStatusBadge,
  type ToolCallStatusBadgeProps,
  ToolCallTrigger,
  type ToolCallTriggerProps,
} from "./components/tool-call.js";
export {
  describeTool,
  groupTrace,
  shortenPath,
  ToolTrace,
  type ToolTraceProps,
  type ToolVerb,
  type TraceItem,
  type TraceToolStatus,
} from "./components/tool-trace.js";
export { Tooltip, type TooltipProps, TooltipProvider, type TooltipProviderProps } from "./components/tooltip.js";
export { Tour, type TourProps, type TourStep } from "./components/tour.js";
export {
  resolveTrackedChanges,
  TrackedChanges,
  type TrackedChangesProps,
  type TrackedSegment,
  trackedSegments,
} from "./components/tracked-changes.js";
export { type TransferItem, TransferList, type TransferListProps } from "./components/transfer-list.js";
export {
  computeTreeCheckState,
  flattenVisibleTree,
  type FlatTreeNode,
  type LoadedTreeChildren,
  toggleTreeChecked,
  type TreeCheckState,
  type TreeNode,
  TreeView,
  type TreeViewLabelState,
  type TreeViewProps,
} from "./components/tree-view.js";
export { TruncationNotice, type TruncationNoticeProps } from "./components/truncation-notice.js";
export { formatTypingNames, TypingIndicator, type TypingIndicatorProps } from "./components/typing-indicator.js";
export { UpdatePrompt, type UpdatePromptProps } from "./components/update-prompt.js";
export { UploadQueue, type UploadQueueProps } from "./components/upload-queue.js";
export { UrlContextButton, type UrlContextButtonProps } from "./components/url-context-button.js";
export {
  UsageDashboard,
  type UsageDashboardProps,
  type UsageRun,
  type UsageRunStatus,
  usageRunsToCsv,
} from "./components/usage-dashboard.js";
export {
  mostConstrainedLimit,
  type UsageLimit,
  UsageLimitBanner,
  type UsageLimitBannerProps,
  UsageLimitCard,
  type UsageLimitCardProps,
  usageLimitTone,
} from "./components/usage-limits.js";
export {
  formatUsageReceipt,
  type UsageDetails,
  UsageReceipt,
  type UsageReceiptProps,
} from "./components/usage-receipt.js";
export { type VersionEntry, VersionHistory, type VersionHistoryProps } from "./components/version-history.js";
export {
  computeVirtualRange,
  VirtualList,
  type VirtualListHandle,
  type VirtualListItemState,
  type VirtualListProps,
  type VirtualRange,
  type VirtualRangeOptions,
} from "./components/virtual-list.js";
export {
  DEVICE_PRESETS,
  type DevicePreset,
  type PreviewServer,
  resolvePreviewAddress,
  RESPONSIVE_DEVICE,
  WebPreview,
  type WebPreviewProps,
} from "./components/web-preview.js";
export {
  Whiteboard,
  type WhiteboardConnector,
  type WhiteboardElement,
  type WhiteboardProps,
  type WhiteboardShape,
  type WhiteboardShapeType,
  type WhiteboardTool,
} from "./components/whiteboard.js";
export { Workbench, type WorkbenchProps } from "./components/workbench.js";
export { VibeBuilderCanvas, type VibeBuilderCanvasProps } from "./components/vibe-builder-canvas.js";
export {
  type VibeBuilderApplyRequest, VibeBuilderChangeReview, type VibeBuilderChangeReviewProps,
  type VibeBuilderFileChange, type VibeBuilderProposal,
} from "./components/vibe-builder-change-review.js";
export { VibeBuilderCodePanel, type VibeBuilderCodePanelProps, type VibeBuilderSourceFile } from "./components/vibe-builder-code-panel.js";
export {
  VibeBuilderComposer, type VibeBuilderComposerProps, type VibeBuilderPromptRequest, type VibeBuilderPromptScope,
  type VibeBuilderSelectedBlock,
} from "./components/vibe-builder-composer.js";
export { VibeBuilderLayers, type VibeBuilderLayersProps } from "./components/vibe-builder-layers.js";
export { VibeBuilderPreview, type VibeBuilderPreviewProps, type VibeBuilderPreviewSource } from "./components/vibe-builder-preview.js";
export { type VibeBuilderView, VibeBuilderWorkbench, type VibeBuilderWorkbenchProps } from "./components/vibe-builder-workbench.js";
export { VibeCodingEditor, type VibeCodingEditorProps } from "./components/vibe-coding-editor.js";
export {
  neighbourAfterClose,
  orderTabs,
  type WorkspaceTab,
  WorkspaceTabs,
  type WorkspaceTabsProps,
} from "./components/workspace-tabs.js";
export { useAutoFix, type UseAutoFixOptions, type UseAutoFixResult } from "./hooks/use-auto-fix.js";
export { useAutosizeTextarea, type UseAutosizeTextareaOptions } from "./hooks/use-autosize-textarea.js";
export { useBarcodeScanner, type UseBarcodeScannerOptions } from "./hooks/use-barcode-scanner.js";
export { useControllableState, type UseControllableStateOptions } from "./hooks/use-controllable-state.js";
export {
  type CopyStatus,
  useCopyToClipboard,
  type UseCopyToClipboardOptions,
  type UseCopyToClipboardResult,
} from "./hooks/use-copy-to-clipboard.js";
export { useDialogMode } from "./hooks/use-dialog-mode.js";
export { readDraft, useStoredDraft, writeDraft } from "./hooks/use-draft-store.js";
export { type ElementSize, useElementSize } from "./hooks/use-element-size.js";
export { type FormDraftState, sanitizeDraft, useFormDraft, type UseFormDraftOptions } from "./hooks/use-form-draft.js";
export { useFullscreen, type UseFullscreenResult } from "./hooks/use-fullscreen.js";
export {
  captureInstallPrompt,
  type InstallPlatform,
  type InstallPromptState,
  isIosDevice,
  useInstallPrompt,
} from "./hooks/use-install-prompt.js";
export { type LogBufferState, useLogBuffer } from "./hooks/use-log-buffer.js";
export { type HeightChange, useMeasuredHeights } from "./hooks/use-measured-heights.js";
export { type MessageWindow, type MessageWindowOptions, useMessageWindow } from "./hooks/use-message-window.js";
export { useNotificationPolling, type UseNotificationPollingOptions } from "./hooks/use-notification-polling.js";
export { useNow } from "./hooks/use-now.js";
export { useObjectUrl } from "./hooks/use-object-url.js";
export { type OfflineQueueApi, useOfflineQueue } from "./hooks/use-offline-queue.js";
export { useOnlineStatus } from "./hooks/use-online-status.js";
export { usePrefersReducedMotion } from "./hooks/use-prefers-reduced-motion.js";
export { type ServiceWorkerUpdateState, useServiceWorkerUpdate } from "./hooks/use-service-worker-update.js";
export {
  type RegisteredShortcut,
  type Shortcut,
  useApplePlatform,
  useRegisteredShortcuts,
  useShortcuts,
} from "./hooks/use-shortcuts.js";
export {
  type DictationApi,
  type DictationState,
  type SpeechApi,
  type SpeechState,
  speechText,
  useDictation,
  type UseDictationOptions,
  useSpeechSynthesis,
} from "./hooks/use-speech.js";
export {
  useStickToBottom,
  type UseStickToBottomOptions,
  type UseStickToBottomResult,
} from "./hooks/use-stick-to-bottom.js";
export { useStreamBuffer, type UseStreamBufferOptions, type UseStreamBufferResult } from "./hooks/use-stream-buffer.js";
export { type SubmitStatus, type SubmitStatusApi, useSubmitStatus } from "./hooks/use-submit-status.js";
export {
  type ThemePreference,
  themeScript,
  type ThemeState,
  useTheme,
  type UseThemeOptions,
} from "./hooks/use-theme.js";
export {
  type TypingSignal,
  type TypingSignalOptions,
  type TypingUsers,
  useTypingIndicator,
  useTypingUsers,
} from "./hooks/use-typing.js";
export { type UploadQueueApi, useUploadQueue } from "./hooks/use-upload-queue.js";
export {
  readinessDelay,
  type UrlReadiness,
  useUrlReadiness,
  type UseUrlReadinessOptions,
  type UseUrlReadinessResult,
} from "./hooks/use-url-readiness.js";
export { ansiColor, type AnsiSegment, type AnsiStyle, applyCarriageReturns, parseAnsi, stripAnsi } from "./lib/ansi.js";
export {
  type ArtifactAttributes,
  type ArtifactSegment,
  createTagStreamParser,
  decodeEntities,
  extractQuickActions,
  parseArtifactSegments,
  parseAttributes,
  type QuickAction,
  stripFence,
  type TagStreamHandlers,
  type TagStreamParser,
} from "./lib/artifact-stream.js";
export { cameraErrorMessage, captureVideoFrame, isUserCancel, openCamera, stopStream } from "./lib/camera.js";
export { type CitationRewrite, rewriteCitations, splitCitationNumbers } from "./lib/citations.js";
export { type Tone } from "./lib/classes.js";
export { type AgentErrorKind, type ClassifiedError, classifyError } from "./lib/classify-error.js";
export { cn } from "./lib/cn.js";
export {
  contrastRatio,
  formatRgb,
  hslToRgb,
  type Hsva,
  hsvToRgb,
  parseColor,
  relativeLuminance,
  type Rgba,
  rgbToHsv,
  toHex,
} from "./lib/color.js";
export { cellText, type ColumnProfileData, profileColumn, type ProfiledType, topValues } from "./lib/column-profile.js";
export {
  type DatedItem,
  type DateGroup,
  exportConversation,
  formatDayLabel,
  type GroupableMessage,
  groupByRecency,
  groupMessages,
  type ImportLimits,
  type ImportResult,
  type MessageGroup,
  messagesToMarkdown,
  parseConversationImport,
  type Transcript,
  TRANSCRIPT_FORMAT,
  type TranscriptMessage,
  type TranscriptRole,
} from "./lib/conversation.js";
export { parseDelimited } from "./lib/csv.js";
export {
  addDays,
  addMinutes,
  addMonths,
  type CalendarEvent,
  describeRecurrence,
  differenceInDays,
  type EventOccurrence,
  expandEvents,
  isSameDay,
  layoutDay,
  monthGrid,
  occursOn,
  parseIsoDate,
  parseRecurrence,
  type PositionedOccurrence,
  rankBetween,
  type Recurrence,
  snapMinutes,
  startOfDay,
  startOfWeek,
  toIsoDate,
  type Weekday,
  weekdayNames,
} from "./lib/dates.js";
export {
  alignElements,
  type Alignment,
  type Arrange,
  arrangeElements,
  type Box,
  type Design,
  type DesignElement,
  type DesignElementKind,
  type DesignPage,
  distributeElements,
  elementAt,
  elementBounds,
  type Guide,
  type Handle,
  hitTest,
  resizeElement,
  rotationFor,
  scaleElements,
  snapBox,
  wrapText,
} from "./lib/design/geometry.js";
export { type DocHeading, extractHeadings, slugify } from "./lib/docs.js";
export { downloadBlob, downloadText, safeFileName } from "./lib/download.js";
export {
  type Emoji,
  emojiCategories,
  type EmojiCategory,
  findEmoji,
  searchEmoji,
  SKIN_TONES,
  type SkinTone,
  stripSkinTone,
  withSkinTone,
} from "./lib/emoji.js";
export {
  type ExecutionOutput,
  type IpynbResult,
  type NotebookCell,
  type NotebookCellStatus,
  type NotebookCellType,
  notebookFromIpynb,
  type NotebookMetadata,
  notebookToIpynb,
} from "./lib/execution.js";
export {
  defaultIgnore,
  type FileFilterOptions,
  filePath,
  filesFromDataTransfer,
  filterFiles,
  isProbablyBinary,
} from "./lib/file-import.js";
export {
  buildSearchPattern,
  type FileSearchGroup,
  type FileSearchMatch,
  type FileSearchOptions,
  type FileSearchResult,
  type SearchableFile,
  searchFileContents,
} from "./lib/file-search.js";
export {
  ancestorPaths,
  baseName,
  buildFileTree,
  createIgnoreMatcher,
  type FileChangeStatus,
  type FileTreeEntry,
  type FileTreeNode,
  findNode,
  normalizePath,
  parentPath,
  validateFileName,
  type VisibleNode,
  visibleNodes,
} from "./lib/file-tree.js";
export { inferFillSeries } from "./lib/fill-series.js";
export {
  displayHost,
  formatAmount,
  formatBytes,
  formatCompactNumber,
  formatDuration,
  formatRelativeTime,
  initials,
} from "./lib/format.js";
export {
  cellAddress,
  type CellValue,
  columnIndex,
  columnName,
  createWorkbookEvaluator,
  dateToSerial,
  displayCellValue,
  formatNumber,
  FORMULA_FUNCTIONS,
  formulaError,
  type FormulaError,
  type FormulaErrorCode,
  isFormulaError,
  matchesCriteria,
  parseCellAddress,
  parseLiteral,
  quoteSheetName,
  type ReferencePosition,
  type ReferenceTransform,
  renameSheetInFormula,
  serialToDate,
  type SheetSource,
  shiftFormulaReferences,
  transformFormulaReferences,
  type WorkbookEvaluator,
} from "./lib/formula.js";
export { fuzzyFilter, fuzzyMatch, type FuzzyMatch, highlightRanges, highlightTerms } from "./lib/fuzzy.js";
export { type GraphEdgeRef, type GraphNodeRef, type GraphPosition, layoutLayers } from "./lib/graph-layout.js";
export { htmlToText } from "./lib/html-text.js";
export { createJavaScriptKernel, type NotebookKernel } from "./lib/js-kernel.js";
export {
  detectLogLevel,
  type LogAppendOptions,
  LogBuffer,
  type LogLevel,
  type LogLine,
  type LogSnapshot,
  type LogStream,
} from "./lib/log-buffer.js";
export { repairMarkdown, splitMarkdownBlocks } from "./lib/markdown.js";
export {
  estimateCost,
  formatModelPrice,
  formatTokenCount,
  groupModelsByProvider,
  HEALTH_LABELS,
  type HealthState,
  type ModelCapability,
  type ModelInfo,
  modelMatches,
} from "./lib/models.js";
export {
  indexedDbQueueStorage,
  localStorageQueueStorage,
  type OfflineQueueOptions,
  type OfflineQueueSnapshot,
  type OfflineQueueStorage,
  OfflineQueueStore,
  type QueuedAction,
  type QueuedActionStatus,
} from "./lib/offline-queue.js";
export {
  type BlockPatch,
  blocksIn,
  BUILDER_BLOCK_LABELS,
  type BuilderAlign,
  type BuilderBlock,
  builderBlockLabel,
  type BuilderBlockPatch,
  type BuilderBlockType,
  type BuilderColumn,
  type BuilderDocument,
  type BuilderDocumentPatch,
  type BuilderHtmlOptions,
  type BuilderLocation,
  type BuilderMode,
  type BuilderRenderContext,
  type BuilderSettings,
  type BuilderTarget,
  builderToHtml,
  type ButtonBlock,
  canContain,
  cloneBuilderBlock,
  type ColumnsBlock,
  columnsOwning,
  createBuilderBlock,
  createBuilderDocument,
  defaultBuilderSettings,
  type DividerBlock,
  duplicateBuilderBlock,
  findBuilderBlock,
  type HeadingBlock,
  type ImageBlock,
  inlineTextHtml,
  insertBuilderBlock,
  isLeafBlock,
  type LeafBlock,
  moveBuilderBlock,
  normalizeBuilderDocument,
  nudgeBuilderBlock,
  patchBuilderDocument,
  removeBuilderBlock,
  renderLeafHtml,
  ROOT_CONTAINER,
  rootIndexOf,
  type SectionBlock,
  setColumnCount,
  SOCIAL_LABELS,
  type SocialBlock,
  type SocialLink,
  type SocialNetwork,
  type SpacerBlock,
  type TextBlock,
  updateBuilderBlock,
  type VideoBlock,
} from "./lib/page-builder.js";
export {
  defaultPasswordRules,
  generatePassword,
  type GeneratePasswordOptions,
  type PasswordRule,
  type PasswordScore,
  scorePassword,
} from "./lib/password.js";
export {
  applyHunkSelection,
  diffHunks,
  hunkStats,
  parseUnifiedDiff,
  type PatchFile,
  type PatchHunk,
} from "./lib/patch.js";
export {
  createProjectPreview,
  createPythonPreview,
  createSvgPreview,
  DEFAULT_PREVIEW_IMPORTS,
  type PreviewDocument,
  type ProjectPreviewOptions,
  type PythonPreviewOptions,
  scriptDataUrl,
  type SvgPreviewOptions,
} from "./lib/preview-documents.js";
export {
  describeInspectedElement,
  type InspectedElement,
  inspectedElementName,
  type InspectorMessage,
  PREVIEW_INSPECTOR_SCRIPT,
  readInspectorMessage,
} from "./lib/preview-inspector.js";
export {
  encodeQR,
  QR_ALPHANUMERIC_CHARSET,
  type QRCodeMatrix,
  type QREncodeOptions,
  type QRErrorCorrectionLevel,
  type QRMode,
  type QRSvgOptions,
  qrSvgPath,
  qrToSvgString,
} from "./lib/qr-code.js";
export {
  captureElementRegion,
  type CaptureOptions,
  type CaptureRegion,
  captureViewportRegion,
  regionFromPoints,
  regionToFrameRect,
} from "./lib/region-capture.js";
export {
  buildAiRequest,
  collectAiText,
  DEFAULT_HTML_AI_ACTIONS,
  HTML_AI_CONTEXT_LENGTH,
  type HtmlAiInsertMode,
  type HtmlAiInsertOptions,
  type HtmlAiRange,
  insertAiText,
} from "./lib/rich-text/html-ai.js";
export {
  currentTurnInto,
  deleteBlock,
  duplicateBlock,
  filterSlashItems,
  insertBlocks,
  moveBlock,
  moveBlockTo,
  moveCurrentBlock,
  topLevelBlock,
  turnInto,
  type TurnIntoKind,
} from "./lib/rich-text/html-blocks.js";
export { insertFigure } from "./lib/rich-text/html-commands.js";
export { fillPageTemplate, type PageTemplateValues } from "./lib/rich-text/html-document.js";
export {
  addColumn,
  CALLOUT_TONE_LABELS,
  calloutAround,
  CELL_COLORS,
  type CellColor,
  columnsAround,
  currentCellBackground,
  EMBEDDABLE_IMAGE_TYPES,
  embeddedImageProblem,
  evenTableColumns,
  FIGURE_MIN_WIDTH,
  FIGURE_SIZE_PRESETS,
  type FigurePatch,
  type FigureSizePreset,
  insertColumns,
  MAX_EMBEDDED_IMAGE_BYTES,
  removeColumn,
  resizeTableColumn,
  setCalloutTone,
  setCellBackground,
  setFigureAlign,
  setFigureWidth,
  setLayoutColumnCount,
  TABLE_COLUMN_MIN_WIDTH,
  unwrapCallout,
  unwrapColumns,
  updateFigure,
  wrapInCallout,
} from "./lib/rich-text/html-media.js";
export {
  DEFAULT_HTML_COLORS,
  DEFAULT_HTML_FONT_SIZES,
  DEFAULT_HTML_FONTS,
  type HtmlFontOption,
} from "./lib/rich-text/html-options.js";
export {
  acceptAllChanges,
  acceptChange,
  acceptChanges,
  type ChangeAction,
  type ChangeKind,
  type DocRange,
  listChanges,
  rejectAllChanges,
  rejectChange,
  rejectChanges,
  resolveChanges,
  trackChangesKey,
  type TrackedChange,
} from "./lib/rich-text/html-review.js";
export {
  CALLOUT_TONES,
  type CalloutTone,
  cleanPastedHtml,
  type CleanPastedHtmlOptions,
  docToHtml,
  embedFromUrl,
  type EmbedSource,
  FIGURE_ALIGNS,
  type FigureAlign,
  formatHtml,
  headingSlug,
  HTML_CONTENT_CSS,
  htmlSchema,
  htmlToDoc,
  isOfficeHtml,
  safeCssColor,
  safeFontFamily,
  safeFontSize,
  sanitizeHtml,
  tocHeadings,
} from "./lib/rich-text/html.js";
export { docToMarkdown, markdownToDoc } from "./lib/rich-text/markdown.js";
export { richTextSchema } from "./lib/rich-text/schema.js";
export { safeImageSrc, safeLinkHref, safeUrl } from "./lib/safe-url.js";
export { findSecretRanges, looksBinary, maskSecrets } from "./lib/secrets.js";
export { type ShareContent, shareFallbackText, shareOrCopy, type ShareOutcome } from "./lib/share.js";
export {
  type CellFormat,
  type CellRange,
  clearRange,
  deleteAxis,
  detectDelimiter,
  fillRange,
  formatRange,
  inRange,
  insertAxis,
  normalizeRange,
  type NumberFormat,
  rangeAddress,
  readBlock,
  renameSheet,
  rowsToCells,
  setCells,
  sheetExtent,
  sheetToRows,
  sortRange,
  type SpreadsheetSheet,
  toDelimited,
  writeBlock,
} from "./lib/sheet-ops.js";
export {
  formatShortcut,
  isApplePlatform,
  isEditableTarget,
  matchesStep,
  parseShortcut,
  type ShortcutStep,
} from "./lib/shortcuts.js";
export { isReadOnlySql, splitSqlStatements, stripSqlLiterals } from "./lib/sql.js";
export { aggregateStatus, type StepStatus, StepStatusIcon, stepStatusLabel } from "./lib/step-status.js";
export { TerminalBuffer, type TerminalViewControls } from "./lib/terminal-buffer.js";
export { countText } from "./lib/text-stats.js";
export {
  fileMatchesAccept,
  type RejectedFile,
  type UploadContext,
  type UploadFn,
  type UploadItem,
  type UploadQueueOptions,
  type UploadQueueSnapshot,
  UploadQueueStore,
  type UploadStatus,
} from "./lib/upload-queue.js";

export { PageBuilderInspector, type PageBuilderInspectorProps } from "./components/page-builder-inspector.js";
export { type PageBuilderChange, type PageBuilderHistoryControls } from "./components/page-builder.js";
export { type BuilderBreakpoint, type BuilderBlockStyle, type BuilderDesignToken, type BuilderBlockDefinition, type BuilderValue, type CustomBlock, createCustomBuilderBlock, resolveBuilderBlockStyle, builderResponsiveCss, builderBlockClass } from "./lib/page-builder.js";
export { type VibeBuilderSession, type VibeBuilderHistoryEntry, type VibeBuilderHistoryState, type VibeBuilderSaveState, restoreVibeBuilderSession, describeVibeBuilderChanges, changedVibeBuilderBlockIds } from "./lib/vibe-builder-session.js";
