import { ChromeStorageManager } from "../managers/Storage";
import { TConversation, TMessage } from "../types";
import { generateRandomId } from "./lib";

export const CONVERSATIONS_STORAGE_KEY = "conversations";

export const isMainConversation = (conversation: TConversation): boolean =>
  !conversation.noteId;

export const isNoteConversation = (conversation: TConversation): boolean =>
  Boolean(conversation.noteId);

export const withUpdatedSystemPrompt = (
  systemPrompt: string,
  messages: TMessage[]
): TMessage[] => {
  const nonSystem = messages.filter((message) => message.role !== "system");
  return [{ role: "system", content: systemPrompt }, ...nonSystem];
};

export async function loadAllConversations(): Promise<TConversation[]> {
  const stored = await ChromeStorageManager.get(CONVERSATIONS_STORAGE_KEY);
  return Array.isArray(stored) ? (stored as TConversation[]) : [];
}

export async function saveAllConversations(
  conversations: TConversation[]
): Promise<void> {
  await ChromeStorageManager.add(CONVERSATIONS_STORAGE_KEY, conversations);
}

export function getMainConversations(
  conversations: TConversation[]
): TConversation[] {
  return conversations.filter(isMainConversation);
}

export function getNoteConversation(
  conversations: TConversation[],
  noteId: string
): TConversation | undefined {
  return conversations.find((conversation) => conversation.noteId === noteId);
}

export function createMainConversation(): TConversation {
  return {
    id: generateRandomId("conversation"),
    messages: [],
    title: "",
    date: new Date().toISOString(),
  };
}

export function createNoteConversation(
  noteId: string,
  title = ""
): TConversation {
  return {
    id: generateRandomId("conversation"),
    noteId,
    messages: [],
    title,
    date: new Date().toISOString(),
  };
}

export function upsertConversation(
  conversations: TConversation[],
  updated: TConversation
): TConversation[] {
  const index = conversations.findIndex(
    (conversation) => conversation.id === updated.id
  );
  if (index === -1) {
    return [...conversations, updated];
  }
  return conversations.map((conversation) =>
    conversation.id === updated.id ? updated : conversation
  );
}

export function replaceNoteConversation(
  conversations: TConversation[],
  noteId: string,
  updated: TConversation
): TConversation[] {
  const withoutNote = conversations.filter(
    (conversation) => conversation.noteId !== noteId
  );
  return upsertConversation(withoutNote, { ...updated, noteId });
}

export function removeConversationsForNote(
  conversations: TConversation[],
  noteId: string
): TConversation[] {
  return conversations.filter((conversation) => conversation.noteId !== noteId);
}

export async function clearNoteConversation(noteId: string): Promise<void> {
  const all = await loadAllConversations();
  await saveAllConversations(removeConversationsForNote(all, noteId));
}

export async function saveMainConversation(
  conversation: TConversation,
  messages: TMessage[]
): Promise<TConversation[]> {
  const all = await loadAllConversations();
  const noteConversations = all.filter(isNoteConversation);
  const mainConversations = getMainConversations(all);
  const updated: TConversation = {
    ...conversation,
    messages,
    date: new Date().toISOString(),
  };
  const nextMain = upsertConversation(mainConversations, updated);
  const next = [...noteConversations, ...nextMain];
  await saveAllConversations(next);
  return nextMain;
}

export async function saveNoteConversation(
  noteId: string,
  messages: TMessage[],
  options?: { conversationId?: string; title?: string }
): Promise<TConversation> {
  const all = await loadAllConversations();
  const existing = getNoteConversation(all, noteId);
  const updated: TConversation = {
    id: options?.conversationId ?? existing?.id ?? generateRandomId("conversation"),
    noteId,
    title: options?.title ?? existing?.title ?? "",
    date: new Date().toISOString(),
    messages,
  };
  const next = replaceNoteConversation(all, noteId, updated);
  await saveAllConversations(next);
  return updated;
}

export async function deleteConversationsByIds(
  ids: Set<string> | string[]
): Promise<TConversation[]> {
  const idSet = ids instanceof Set ? ids : new Set(ids);
  const all = await loadAllConversations();
  const next = all.filter((conversation) => !idSet.has(conversation.id));
  await saveAllConversations(next);
  return getMainConversations(next);
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const all = await loadAllConversations();
  const next = all.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, title, date: new Date().toISOString() }
      : conversation
  );
  await saveAllConversations(next);
}
