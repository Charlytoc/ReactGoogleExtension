export type TNote = {
  id?: string;
  title?: string;
  content?: string;
  color?: string;
  createdAt?: string;
};

export type TMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type TTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export type TTaskPriority = "low" | "medium" | "high";

export type TTask = {
  id: string;
  title: string;
  description?: string;
  status?: TTaskStatus;
  createdAt?: string;
  startDatetime: string;
  dueDatetime: string;
  reminderEvery?: number;
  reminderText?: string;
  estimatedTime?: number;
  priority: TTaskPriority;
};

export type TConversation = {
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
};
