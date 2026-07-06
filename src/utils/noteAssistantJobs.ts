/**
 * Background note assistant turn jobs — one in-flight turn per note.
 *
 * Lifecycle:
 *  - UI writes user message to conversation, saves pending job, messages worker
 *  - worker runs full tool loop, saves assistant reply + note edits, deletes job
 *  - on failure job is kept with status "error"
 */

import { IMAGE_JOB_STALE_MS } from "./imageJobs";

export const AI_NOTE_ASSISTANT_JOBS_KEY = "aiNoteAssistantJobs";

export type TNoteAssistantJobStatus = "pending" | "error";

export type TNoteAssistantJob = {
  noteId: string;
  userMessage: string;
  status: TNoteAssistantJobStatus;
  error?: string;
  createdAt: string;
};

export type TNoteAssistantJobMap = Record<string, TNoteAssistantJob>;

export type TGenerateNoteAssistantTurnMessage = {
  action: "generateNoteAssistantTurn";
  noteId: string;
  userMessage: string;
};

export const isNoteAssistantJobStale = (job: {
  status: TNoteAssistantJobStatus;
  createdAt: string;
}): boolean => {
  return (
    job.status === "pending" &&
    Date.now() - Date.parse(job.createdAt) > IMAGE_JOB_STALE_MS
  );
};

export const getNoteAssistantJobs = async (): Promise<TNoteAssistantJobMap> => {
  const result = await chrome.storage.local.get(AI_NOTE_ASSISTANT_JOBS_KEY);
  return (result[AI_NOTE_ASSISTANT_JOBS_KEY] as TNoteAssistantJobMap) ?? {};
};

export const saveNoteAssistantJob = async (
  job: TNoteAssistantJob
): Promise<void> => {
  const jobs = await getNoteAssistantJobs();
  jobs[job.noteId] = job;
  await chrome.storage.local.set({ [AI_NOTE_ASSISTANT_JOBS_KEY]: jobs });
};

export const deleteNoteAssistantJob = async (noteId: string): Promise<void> => {
  const jobs = await getNoteAssistantJobs();
  if (!(noteId in jobs)) return;
  delete jobs[noteId];
  await chrome.storage.local.set({ [AI_NOTE_ASSISTANT_JOBS_KEY]: jobs });
};

export const enqueueNoteAssistantJob = async (params: {
  noteId: string;
  userMessage: string;
}): Promise<void> => {
  await saveNoteAssistantJob({
    noteId: params.noteId,
    userMessage: params.userMessage,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  const message: TGenerateNoteAssistantTurnMessage = {
    action: "generateNoteAssistantTurn",
    ...params,
  };
  await chrome.runtime.sendMessage(message);
};
