export type TNote = {
  id: string;
  title?: string;
  content?: string;
  color?: string;
  tags?: string[];
  archived?: boolean;
  createdAt?: string;
};

export type TMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  hidden?: boolean;
};

export type TTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

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
};

export type TConversation = {
  id: string;
  title: string;
  date: string;
  messages: TMessage[];
};

export type TSnaptie = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  category: string;
  isUrl: boolean;
  color: string;
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
