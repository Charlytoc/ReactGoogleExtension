/**
 * Shared contract for background AI image generation jobs.
 *
 * A job is keyed by the attachment id that the note markdown already
 * references (`![alt](attachment:<id>)`). Lifecycle:
 *  - popup writes a `pending` job and messages the background worker
 *  - background generates the image, saves the attachment under that id,
 *    then deletes the job (attachment presence === success)
 *  - on failure the job is kept with status "error"
 *
 * Imported by both the popup UI and background.ts — keep this module free
 * of the OpenAI SDK and DOM/React dependencies.
 */

export const AI_IMAGE_JOBS_KEY = "aiImageJobs";

/** Pending jobs older than this are considered dead (service worker was killed mid-flight). */
export const IMAGE_JOB_STALE_MS = 3 * 60 * 1000;

export type TImageJobStatus = "pending" | "error";

export type TImageJob = {
  attachmentId: string;
  noteId?: string;
  /** Raw user/model intent. The background worker expands it into the final
   * image prompt (using `context`) before calling the image model. */
  prompt: string;
  /** Surrounding note/block text used to inform the prompt generation step. */
  context?: string;
  altText: string;
  size: string;
  status: TImageJobStatus;
  error?: string;
  createdAt: string;
};

export type TImageJobMap = Record<string, TImageJob>;

export type TGenerateNoteImageMessage = {
  action: "generateNoteImage";
  attachmentId: string;
  noteId?: string;
  prompt: string;
  context?: string;
  altText: string;
  size: string;
};

export const isImageJobStale = (job: {
  status: TImageJobStatus;
  createdAt: string;
}): boolean => {
  return (
    job.status === "pending" &&
    Date.now() - Date.parse(job.createdAt) > IMAGE_JOB_STALE_MS
  );
};

export const getImageJobs = async (): Promise<TImageJobMap> => {
  const result = await chrome.storage.local.get(AI_IMAGE_JOBS_KEY);
  return (result[AI_IMAGE_JOBS_KEY] as TImageJobMap) ?? {};
};

export const saveImageJob = async (job: TImageJob): Promise<void> => {
  const jobs = await getImageJobs();
  jobs[job.attachmentId] = job;
  await chrome.storage.local.set({ [AI_IMAGE_JOBS_KEY]: jobs });
};

export const deleteImageJob = async (attachmentId: string): Promise<void> => {
  const jobs = await getImageJobs();
  if (!(attachmentId in jobs)) return;
  delete jobs[attachmentId];
  await chrome.storage.local.set({ [AI_IMAGE_JOBS_KEY]: jobs });
};

// ─── Note cover jobs ─────────────────────────────────────────────────────────
// Same lifecycle as image jobs, but keyed by note id. The background worker
// runs the full cover pipeline (theme JSON -> image -> merge into the stored
// note) and deletes the job on success.

export const AI_COVER_JOBS_KEY = "aiCoverJobs";

export type TCoverJob = {
  noteId: string;
  hint: string;
  status: TImageJobStatus;
  error?: string;
  createdAt: string;
};

export type TCoverJobMap = Record<string, TCoverJob>;

export type TGenerateNoteCoverMessage = {
  action: "generateNoteCover";
  noteId: string;
  hint: string;
  /** Existing tag labels across the app, so the model reuses exact strings. */
  tagCatalog: string[];
};

export const getCoverJobs = async (): Promise<TCoverJobMap> => {
  const result = await chrome.storage.local.get(AI_COVER_JOBS_KEY);
  return (result[AI_COVER_JOBS_KEY] as TCoverJobMap) ?? {};
};

export const saveCoverJob = async (job: TCoverJob): Promise<void> => {
  const jobs = await getCoverJobs();
  jobs[job.noteId] = job;
  await chrome.storage.local.set({ [AI_COVER_JOBS_KEY]: jobs });
};

export const deleteCoverJob = async (noteId: string): Promise<void> => {
  const jobs = await getCoverJobs();
  if (!(noteId in jobs)) return;
  delete jobs[noteId];
  await chrome.storage.local.set({ [AI_COVER_JOBS_KEY]: jobs });
};

export const enqueueNoteCoverJob = async (params: {
  noteId: string;
  hint: string;
  tagCatalog: string[];
}): Promise<void> => {
  await saveCoverJob({
    noteId: params.noteId,
    hint: params.hint,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  const message: TGenerateNoteCoverMessage = {
    action: "generateNoteCover",
    ...params,
  };
  await chrome.runtime.sendMessage(message);
};

/**
 * Writes the pending job first (so any open renderer immediately shows the
 * placeholder), then wakes the background worker to run the generation.
 */
export const enqueueNoteImageJob = async (params: {
  attachmentId: string;
  noteId?: string;
  prompt: string;
  context?: string;
  altText: string;
  size: string;
}): Promise<void> => {
  await saveImageJob({
    ...params,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  const message: TGenerateNoteImageMessage = {
    action: "generateNoteImage",
    ...params,
  };
  await chrome.runtime.sendMessage(message);
};
