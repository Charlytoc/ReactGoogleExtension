export type TBackgroundType = "gradient" | "solid" | "none" | "image";

export type TNote = {
  id: string;
  title?: string;
  content?: string;
  color?: string;
  backgroundType?: TBackgroundType;
  color2?: string;
  tags?: string[];
  font?: string;
  archived?: boolean;
  createdAt?: string;
  imageURL?: string;
  opacity?: number;
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

export type TFormatterInput = {
  id: string;
  /**
   * Human-friendly label for the input (e.g. "A", "Price", "User name").
   */
  label: string;
  /**
   * When true, the last value entered for this input in the Run section
   * will be remembered and pre-filled next time.
   */
  rememberLastValue?: boolean;
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
   * Optional helper text to explain what this formatter does.
   */
  description?: string;
  /**
   * List of inputs that will be provided to the formatter.
   */
  inputs: TFormatterInput[];
  /**
   * Prompt/instructions used to guide the AI on how to format
   * the final string based on the inputs.
   */
  prompt: string;
  createdAt: string;
  updatedAt?: string;
  /**
   * Optional category to organize formatters, similar to snapties.
   */
  category?: string;
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
