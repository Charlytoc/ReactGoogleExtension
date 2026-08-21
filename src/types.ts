export type TBackgroundType = "gradient" | "solid" | "none" | "image";

export type TAttachmentType = "image" | "file";

export type TAttachment = {
  id: string;
  type: TAttachmentType;
  name: string;
  dataUrl: string;
  mimeType?: string;
  sourceNoteId?: string;
  createdAt: string;
};

export type TNode = {
  type: "markdown",
  content: string;
}

export type TNote = {
  id: string;
  title?: string;
  content?: string;
  color?: string;
  nodes?: TNode[];
  backgroundType?: TBackgroundType;
  color2?: string;
  tags?: string[];
  font?: string;
  archived?: boolean;
  createdAt?: string;
  imageURL?: string;
  opacity?: number;
  coverImage?: string;
};

export type TMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  hidden?: boolean;
};

export type TTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "";

export type TTaskPriority = "low" | "medium" | "high";

export type TTask = {
  id: string;
  title: string;
  description?: string;
  status?: TTaskStatus;
  createdAt?: string;
  startDatetime?: string;
  dueDatetime?: string;
  reminderEvery?: number;
  motivationText?: string;
  estimatedTime?: number;
  estimatedTimeUnit?: string;
  lastReminderAt?: string;
  priority: TTaskPriority;
  tags?: string[];
};

export type TConversation = {
  id: string;
  title: string;
  date: string;
  messages: TMessage[];
  /** When set, this thread belongs to a note and is hidden from main Chat history. */
  noteId?: string;
};

export type TSnaptie = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  tags?: string[];
  isUrl: boolean;
  color: string;
  pinned?: boolean;
};

export type TFormatterInput = {
  id: string;
  /**
   * Variable name extracted from {{placeholders}} in the prompt.
   */
  label: string;
  /**
   * The last value used for this input (persisted together with the formatter).
   */
  lastValue?: string;
};

export type TFormatter = {
  id: string;
  /**
   * Name of the formatter.
   */
  title: string;
  /**
   * Last-value cache for {{variables}} in the prompt. Derived on save/run.
   */
  inputs: TFormatterInput[];
  /**
   * Prompt/instructions. Use {{variable}} to declare run inputs.
   */
  prompt: string;
  createdAt: string;
  updatedAt?: string;
  /**
   * Optional tags to organize formatters (shared vocabulary with notes, tasks, snapties).
   */
  tags?: string[];
  /**
   * Optional color used in the UI card.
   */
  color?: string;
};

export type TNotesConfig = {
  autoSaveNotes: boolean;
  useAiSuggestions: boolean; // You start to write and the AI generate N suggestions, based in a fixed parameter or imagination
  useAiMotivation: boolean; // You start to write and the AI suggests a motivation text
  reasoningEnabled: boolean; // You start to write and the AI suggests a motivation text
  useAiSummary: boolean; // You finish to write and the AI suggests a summary
};

export type TNoteHistory = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  color: string;
  tags: string[];
  archived: boolean;
};

export type TModel = {
  name: string;
  slug: string;
  hasReasoning: boolean;
};

export type TReasoningTag = "thinking" | "reasoning" | "thinking_process";

export type TAIConfig = {
  systemPrompt: string;
  model: TModel;
  notesAssistantModel?: TModel;
  formatterModel?: TModel;
  autoSaveConversations: boolean;
  setTitleAtMessage?: number;
  reasoningTag?: TReasoningTag;
};
