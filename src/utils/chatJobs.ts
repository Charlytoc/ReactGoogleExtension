import { IMAGE_JOB_STALE_MS } from "./imageJobs";

export const AI_CHAT_JOBS_KEY = "aiChatJobs";
export const LAST_MAIN_CONVERSATION_ID_KEY = "lastMainConversationId";

export type TChatJobStatus = "pending" | "error";

export type TChatJob = {
  conversationId: string;
  tabId?: number;
  pageUrl?: string;
  status: TChatJobStatus;
  error?: string;
  createdAt: string;
};

export type TChatJobMap = Record<string, TChatJob>;

export type TGenerateChatTurnMessage = {
  action: "generateChatTurn";
  conversationId: string;
  tabId?: number;
  pageUrl?: string;
};

export const isChatJobStale = (job: {
  status: TChatJobStatus;
  createdAt: string;
}): boolean => {
  return (
    job.status === "pending" &&
    Date.now() - Date.parse(job.createdAt) > IMAGE_JOB_STALE_MS
  );
};

export const getChatJobs = async (): Promise<TChatJobMap> => {
  const result = await chrome.storage.local.get(AI_CHAT_JOBS_KEY);
  return (result[AI_CHAT_JOBS_KEY] as TChatJobMap) ?? {};
};

export const saveChatJob = async (job: TChatJob): Promise<void> => {
  const jobs = await getChatJobs();
  jobs[job.conversationId] = job;
  await chrome.storage.local.set({ [AI_CHAT_JOBS_KEY]: jobs });
};

export const deleteChatJob = async (conversationId: string): Promise<void> => {
  const jobs = await getChatJobs();
  if (!(conversationId in jobs)) return;
  delete jobs[conversationId];
  await chrome.storage.local.set({ [AI_CHAT_JOBS_KEY]: jobs });
};

export const getLastMainConversationId = async (): Promise<string | undefined> => {
  const result = await chrome.storage.local.get(LAST_MAIN_CONVERSATION_ID_KEY);
  const id = result[LAST_MAIN_CONVERSATION_ID_KEY];
  return typeof id === "string" ? id : undefined;
};

export const setLastMainConversationId = async (
  conversationId: string
): Promise<void> => {
  await chrome.storage.local.set({
    [LAST_MAIN_CONVERSATION_ID_KEY]: conversationId,
  });
};

export const enqueueChatJob = async (params: {
  conversationId: string;
  tabId?: number;
  pageUrl?: string;
}): Promise<void> => {
  await saveChatJob({
    conversationId: params.conversationId,
    tabId: params.tabId,
    pageUrl: params.pageUrl,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  await setLastMainConversationId(params.conversationId);

  const message: TGenerateChatTurnMessage = {
    action: "generateChatTurn",
    conversationId: params.conversationId,
    tabId: params.tabId,
    pageUrl: params.pageUrl,
  };
  await chrome.runtime.sendMessage(message);
};
