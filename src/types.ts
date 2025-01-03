export type TNote = {
  id?: string;
  title?: string;
  content?: string;
};

export type TMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};
