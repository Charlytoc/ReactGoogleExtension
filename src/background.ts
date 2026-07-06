/**
 * Background service worker for the Automator Chrome extension.
 *
 * Handles: context menus, keyboard shortcuts, task alarms/notifications,
 * OpenAI Responses API calls (via fetch), and message passing between extension parts.
 *
 * NOTE: The functions `autoComplete`, `translateSelection`, and `checkGrammar`
 * are injected into web pages via chrome.scripting.executeScript(). They MUST
 * remain fully self-contained — no module-level references allowed inside them.
 */

import type { TAttachment, TNote, TTask } from "./types";
import { mergeNoteTags, migrateTask } from "./utils/tags";
import {
  clampAiNoteThemeJson,
  formatFontCatalogForPrompt,
} from "./utils/noteTheme";
import {
  COMMAND_PROMPT_STORAGE_KEY,
  type ExtensionCommandId,
  fillAutocompleteTemplate,
  resolvePrompt,
} from "./commandPrompts";
import { MODEL_CHAT_SMALL, MODEL_IMAGE_GENERATION } from "./utils/models";
import { createResponseWithFunctionsFetch } from "./utils/backgroundResponses";
import { createToolsMap } from "./utils/ai";
import { getNotesAssistantModelSlug } from "./utils/aiConfigStorage";
import {
  getNoteConversation,
  saveNoteConversation,
  withUpdatedSystemPrompt,
} from "./utils/conversationsStorage";
import {
  AI_NOTE_ASSISTANT_JOBS_KEY,
  deleteNoteAssistantJob,
  getNoteAssistantJobs,
  saveNoteAssistantJob,
  type TGenerateNoteAssistantTurnMessage,
} from "./utils/noteAssistantJobs";
import {
  buildNoteAssistantSystemPrompt,
  messagesToResponsesInput,
} from "./utils/noteAssistantPrompt";
import { createNoteAssistantTools } from "./utils/noteAssistantTools";
import {
  AI_COVER_JOBS_KEY,
  AI_IMAGE_JOBS_KEY,
  deleteCoverJob,
  deleteImageJob,
  getCoverJobs,
  getImageJobs,
  isImageJobStale,
  saveCoverJob,
  saveImageJob,
  type TGenerateNoteCoverMessage,
  type TGenerateNoteImageMessage,
} from "./utils/imageJobs";
import type { TMessage } from "./types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_completion_tokens?: number;
  response_format?: { type: string };
}

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

interface GenerateCompletionMessage extends CompletionRequest {
  action: "generateCompletion";
}

interface NotifyMessage {
  action: "notify";
  title: string;
  message: string;
  copyable?: boolean;
}

type ExtensionToolCompletionMessage =
  | {
      action: "extensionToolCompletion";
      command: "check-grammar";
      payload: { selectedText: string };
    }
  | {
      action: "extensionToolCompletion";
      command: "translate-selection";
      payload: { selectedText: string };
    }
  | {
      action: "extensionToolCompletion";
      command: "auto-complete";
      payload: {
        pageInnerText: string;
        activeOuterHTML: string;
        currentInputValue: string;
      };
    };

type ExtensionMessage =
  | GenerateCompletionMessage
  | NotifyMessage
  | ExtensionToolCompletionMessage
  | TGenerateNoteImageMessage
  | TGenerateNoteCoverMessage
  | TGenerateNoteAssistantTurnMessage;

// ─── Chrome Storage Manager ─────────────────────────────────────────────────

const ChromeStorageManager = {
  add: async (
    key: string,
    value: unknown,
    onSuccess?: () => void,
    onError?: (msg: string) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          const msg =
            chrome.runtime.lastError.message ||
            "Error adding value to storage";
          onError?.(msg);
          reject(msg);
        } else {
          onSuccess?.();
          resolve();
        }
      });
    });
  },

  get: async <T = unknown>(key: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(result[key] as T);
        }
      });
    });
  },

  delete: async (key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve();
        }
      });
    });
  },
};

// ─── OpenAI Responses API (raw fetch, no SDK) ───────────────────────────────

const extractResponsesOutputText = (body: ResponsesApiResponse): string => {
  if (body.output_text) {
    return body.output_text;
  }

  for (const item of body.output ?? []) {
    if (item.type !== "message" || !item.content) continue;
    for (const part of item.content) {
      if (part.type === "output_text" && part.text) {
        return part.text;
      }
    }
  }

  return "";
};

const createCompletion = async (
  request: CompletionRequest,
  callback?: (completion: ResponsesApiResponse) => void
): Promise<string> => {
  const apiKey = await ChromeStorageManager.get<string>("openaiApiKey");
  if (!apiKey) {
    throw new Error("No API key found");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      input: request.messages,
      max_output_tokens: request.max_completion_tokens || 500,
      store: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion: ResponsesApiResponse = await response.json();

  if (typeof callback === "function") {
    callback(completion);
  }

  return extractResponsesOutputText(completion);
};

// ─── AI Image Generation Jobs ───────────────────────────────────────────────

// Image generation is a single long fetch with no intermediate events, so the
// 30s idle timer could kill the worker mid-flight. Poking a trivial extension
// API on an interval resets the timer while jobs are running.
let activeImageJobCount = 0;
let imageKeepaliveTimer: ReturnType<typeof setInterval> | undefined;

const startImageJobKeepalive = (): void => {
  activeImageJobCount++;
  if (!imageKeepaliveTimer) {
    imageKeepaliveTimer = setInterval(() => {
      chrome.runtime.getPlatformInfo(() => {});
    }, 20_000);
  }
};

const stopImageJobKeepalive = (): void => {
  activeImageJobCount = Math.max(0, activeImageJobCount - 1);
  if (activeImageJobCount === 0 && imageKeepaliveTimer) {
    clearInterval(imageKeepaliveTimer);
    imageKeepaliveTimer = undefined;
  }
};

const generateImageBase64 = async (
  apiKey: string,
  prompt: string,
  size: string,
  outputCompression: number
): Promise<string> => {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_IMAGE_GENERATION,
      prompt,
      size,
      quality: "medium",
      output_format: "jpeg",
      output_compression: outputCompression,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const body: { data?: Array<{ b64_json?: string }> } = await response.json();
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image returned by the API");
  }
  return b64;
};

/**
 * Stage 1 of every image job: expand the raw intent into a final image
 * generation prompt, informed by the surrounding note/block context. Falls
 * back to the raw intent if the chat model fails, so a prompt-step outage
 * never blocks image generation.
 */
const generateImagePrompt = async (
  request: TGenerateNoteImageMessage
): Promise<string> => {
  const rawPrompt = request.prompt.trim();
  try {
    const refined = await createCompletion({
      model: MODEL_CHAT_SMALL,
      messages: [
        {
          role: "system",
          content: `You are an expert image prompt engineer.
Write a single, vivid, detailed image generation prompt based on the user's request.
Use the provided context (surrounding note or block text) to inform the subject, style, and mood when relevant — but the request always wins over the context.
Tailor the composition to the requested size/aspect ratio.
Respond with the final prompt only — no quotes, no preamble, no explanations.`,
        },
        {
          role: "user",
          content: `Request: ${rawPrompt}

Size/aspect ratio: ${request.size}

Context:
${(request.context || "none").slice(0, 6000)}`,
        },
      ],
      max_completion_tokens: 400,
    });
    return refined.trim() || rawPrompt;
  } catch (error) {
    console.warn("Image prompt generation failed, using raw prompt:", error);
    return rawPrompt;
  }
};

const runNoteImageJob = async (
  request: TGenerateNoteImageMessage
): Promise<void> => {
  startImageJobKeepalive();
  try {
    // Refresh the pending record: this run owns the job from now on, and the
    // new timestamp keeps the stale-job cleanup from flagging it.
    await saveImageJob({
      attachmentId: request.attachmentId,
      noteId: request.noteId,
      prompt: request.prompt,
      context: request.context,
      altText: request.altText,
      size: request.size,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    const apiKey = await ChromeStorageManager.get<string>("openaiApiKey");
    if (!apiKey) {
      throw new Error("No API key found");
    }

    const imagePrompt = await generateImagePrompt(request);
    const b64 = await generateImageBase64(apiKey, imagePrompt, request.size, 60);

    const attachment: TAttachment = {
      id: request.attachmentId,
      type: "image",
      name: `ai-image-${new Date().toISOString()}`,
      dataUrl: `data:image/jpeg;base64,${b64}`,
      mimeType: "image/jpeg",
      sourceNoteId: request.noteId,
      createdAt: new Date().toISOString(),
    };

    // Save the attachment before deleting the job so renderers never observe
    // "no attachment + no job" for an in-flight generation.
    const attachments =
      (await ChromeStorageManager.get<TAttachment[]>("attachments")) ?? [];
    await ChromeStorageManager.add("attachments", [...attachments, attachment]);
    await deleteImageJob(request.attachmentId);

    notify("Image ready", request.altText || "Generated image attached to note");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating note image:", error);
    await saveImageJob({
      attachmentId: request.attachmentId,
      noteId: request.noteId,
      prompt: request.prompt,
      context: request.context,
      altText: request.altText,
      size: request.size,
      status: "error",
      error: message,
      createdAt: new Date().toISOString(),
    });
    notify("Error", "Image generation failed: " + message);
  } finally {
    stopImageJobKeepalive();
  }
};

const runNoteAssistantJob = async (
  request: TGenerateNoteAssistantTurnMessage
): Promise<void> => {
  startImageJobKeepalive();
  try {
    await saveNoteAssistantJob({
      noteId: request.noteId,
      userMessage: request.userMessage,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    const apiKey = await ChromeStorageManager.get<string>("openaiApiKey");
    if (!apiKey) {
      throw new Error("No API key found");
    }

    const notes = (await ChromeStorageManager.get<TNote[]>("notes")) ?? [];
    const note = notes.find((item) => item.id === request.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const allConversations = await ChromeStorageManager.get<unknown>(
      "conversations"
    );
    const conversationList = Array.isArray(allConversations)
      ? allConversations
      : [];
    const existingConversation = getNoteConversation(
      conversationList as Parameters<typeof getNoteConversation>[0],
      request.noteId
    );

    const priorMessages: TMessage[] = existingConversation?.messages ?? [];
    const systemPrompt = buildNoteAssistantSystemPrompt(note);
    const inputMessages = withUpdatedSystemPrompt(systemPrompt, priorMessages);

    const tools = createNoteAssistantTools({
      noteId: request.noteId,
      enqueueImageJob: runNoteImageJob,
    });
    const functionMap = createToolsMap(tools);
    const model = await getNotesAssistantModelSlug();

    const assistantText = await createResponseWithFunctionsFetch({
      apiKey,
      model,
      input: messagesToResponsesInput(inputMessages),
      tools: tools.map((tool) => tool.schema),
      functionMap,
      maxOutputTokens: 16000,
    });

    const nextMessages: TMessage[] = [
      ...inputMessages,
      { role: "assistant", content: assistantText },
    ];

    await saveNoteConversation(request.noteId, nextMessages, {
      conversationId: existingConversation?.id,
      title: existingConversation?.title || note.title?.trim() || "Note chat",
    });

    await deleteNoteAssistantJob(request.noteId);
    notify(
      "Note assistant",
      note.title?.trim()
        ? `${note.title.trim()} — reply ready`
        : "Your note assistant reply is ready"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error running note assistant job:", error);
    await saveNoteAssistantJob({
      noteId: request.noteId,
      userMessage: request.userMessage,
      status: "error",
      error: message,
      createdAt: new Date().toISOString(),
    });
    notify("Note assistant", "Failed: " + message);
  } finally {
    stopImageJobKeepalive();
  }
};

/** Parses model JSON output, tolerating markdown code fences. */
const parseJsonResponse = (raw: string): unknown => {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
};

const runNoteCoverJob = async (
  request: TGenerateNoteCoverMessage
): Promise<void> => {
  startImageJobKeepalive();
  try {
    await saveCoverJob({
      noteId: request.noteId,
      hint: request.hint,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    const apiKey = await ChromeStorageManager.get<string>("openaiApiKey");
    if (!apiKey) {
      throw new Error("No API key found");
    }

    const notes = (await ChromeStorageManager.get<TNote[]>("notes")) ?? [];
    const note = notes.find((n) => n.id === request.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const themeSystem = `You are styling a personal note in a notes app.
Respond with a single JSON object only (no markdown code fences) with exactly these keys:
- "imagePrompt": string — vivid, detailed AI image generation prompt for a wide landscape cover (16:9 feel) matching the note.
- "backgroundType": "solid" or "gradient" only.
- "color": string — primary background as CSS hex #rrggbb.
- "color2": string — second color #rrggbb (for gradient use a complementary second stop; for solid it can match "color" or be a subtle variant).
- "font": string — MUST equal exactly one allowed value from the FONT_CATALOG below (copy the value string verbatim).
- "tags": string[] — tag labels for this note. Prefer exact strings from TAG_CATALOG when they fit; otherwise propose concise new tags. The app merges these with existing note tags.

Rules:
- Use only #rrggbb hex for color and color2 (no CSS variables, no rgb()).
- Keep tags short; avoid duplicates in the array.
- FONT_CATALOG (label -> use this exact "value"):
${formatFontCatalogForPrompt()}`;

    const userContent = `Title: ${note.title || "Untitled"}

Content (excerpt):
${(note.content || "").slice(0, 1000)}

User hint for styling/cover: ${request.hint.trim() || "none"}

Current note tags (JSON): ${JSON.stringify(note.tags ?? [])}

TAG_CATALOG — reuse exact strings when possible (JSON): ${JSON.stringify(
      request.tagCatalog.slice(0, 250)
    )}`;

    const rawJson = await createCompletion({
      model: MODEL_CHAT_SMALL,
      messages: [
        { role: "system", content: themeSystem },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: 600,
    });

    if (!rawJson) {
      throw new Error("Empty theme response");
    }

    let parsed: unknown;
    try {
      parsed = parseJsonResponse(rawJson);
    } catch {
      throw new Error("Invalid JSON from theme model");
    }

    const theme = clampAiNoteThemeJson(parsed, {
      fallbackFont: note.font,
      fallbackColor: note.color || "#1a1a1a",
      fallbackColor2: note.color2 || "#2a2a2a",
    });

    const imagePrompt =
      theme.imagePrompt ||
      note.title?.trim() ||
      "abstract wide landscape cover art";

    const b64 = await generateImageBase64(apiKey, imagePrompt, "1536x1024", 70);

    // Re-read and merge only the theme/cover fields: the user may have kept
    // editing the note content while the job was running.
    const currentNotes =
      (await ChromeStorageManager.get<TNote[]>("notes")) ?? [];
    const updatedNotes = currentNotes.map((n) => {
      if (n.id !== request.noteId) return n;
      return {
        ...n,
        coverImage: `data:image/jpeg;base64,${b64}`,
        backgroundType: theme.backgroundType,
        color: theme.color,
        color2: theme.color2,
        font: theme.font,
        tags: mergeNoteTags(n.tags, theme.tagsFromAi),
        imageURL: "",
      };
    });
    await ChromeStorageManager.add("notes", updatedNotes);
    await deleteCoverJob(request.noteId);

    notify("Cover ready", note.title || "Note cover and style updated");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error generating note cover:", error);
    await saveCoverJob({
      noteId: request.noteId,
      hint: request.hint,
      status: "error",
      error: message,
      createdAt: new Date().toISOString(),
    });
    notify("Error", "Cover generation failed: " + message);
  } finally {
    stopImageJobKeepalive();
  }
};

// On worker startup, any sufficiently old pending job is dead — the fetch it
// belonged to died with the previous worker instance. Old error records are
// pruned so the job maps don't grow forever.
const ERROR_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const cleanUpStaleJobs = async <
  T extends { status: "pending" | "error"; createdAt: string; error?: string }
>(
  storageKey: string,
  jobs: Record<string, T>
): Promise<void> => {
  let changed = false;
  for (const [key, job] of Object.entries(jobs)) {
    if (isImageJobStale(job)) {
      job.status = "error";
      job.error = "Generation was interrupted";
      changed = true;
    } else if (
      job.status === "error" &&
      Date.now() - Date.parse(job.createdAt) > ERROR_JOB_RETENTION_MS
    ) {
      delete jobs[key];
      changed = true;
    }
  }
  if (changed) {
    await ChromeStorageManager.add(storageKey, jobs);
  }
};

(async () => {
  try {
    await cleanUpStaleJobs(AI_IMAGE_JOBS_KEY, await getImageJobs());
    await cleanUpStaleJobs(AI_COVER_JOBS_KEY, await getCoverJobs());
    await cleanUpStaleJobs(
      AI_NOTE_ASSISTANT_JOBS_KEY,
      await getNoteAssistantJobs()
    );
  } catch (error) {
    console.error("Could not clean up stale image jobs:", error);
  }
})();

// ─── Utilities ──────────────────────────────────────────────────────────────

const createRandomId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

/** Text that can be copied when clicking a notification. */
const pendingCopies = new Map<string, string>();

const notify = (
  title: string,
  message: string,
  { copyable = false }: { copyable?: boolean } = {}
): void => {
  const id = createRandomId();
  chrome.notifications.create(id, {
    title,
    message: copyable ? message + "\n\n(Click to copy)" : message,
    iconUrl: "icons/icon.png",
    type: "basic",
  });
  if (copyable) {
    pendingCopies.set(id, message);
  }
};

// ─── Notification Click → Copy to Clipboard ─────────────────────────────────

chrome.notifications.onClicked.addListener(async (notificationId: string) => {
  const textToCopy = pendingCopies.get(notificationId);
  if (!textToCopy) return;

  pendingCopies.delete(notificationId);
  chrome.notifications.clear(notificationId);

  // Copy to clipboard via the active tab (service workers can't access clipboard)
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tab?.id) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text: string) => navigator.clipboard.writeText(text),
      args: [textToCopy],
      injectImmediately: true,
    });
  }

  notify("Copied!", "Translation copied to clipboard.");
});

// ─── Storage Helpers ────────────────────────────────────────────────────────

const updateTask = async (task: TTask): Promise<void> => {
  const raw = await ChromeStorageManager.get<TTask[]>("tasks");
  if (raw && Array.isArray(raw)) {
    const tasks = raw.map(migrateTask);
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = task;
      await ChromeStorageManager.add("tasks", tasks);
    }
  }
};

// ─── Alarm Listener (Task Reminders) ────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
  const notifyMessage = async (tasks: TTask[]) => {
    // End-of-task alarm
    if (alarm.name.includes("-endOfTask")) {
      const taskId = alarm.name.split("-endOfTask")[0];
      const task = tasks.find((t) => t.id === taskId);

      if (task) {
        chrome.notifications.create(createRandomId(), {
          title: String(task.title),
          message: "Task should be completed now!",
          iconUrl: "icons/icon.png",
          type: "basic",
        });

        chrome.alarms.clear(task.id);
        chrome.alarms.clear(task.id + "-endOfTask");
      }
      return;
    }

    // Regular reminder
    const task = tasks.find((t) => t.id === alarm.name);
    if (!task) return;

    const now = new Date();

    chrome.notifications.create(createRandomId(), {
      title: String(task.title),
      message: String(task.motivationText ?? task.description ?? ""),
      iconUrl: "icons/icon.png",
      type: "basic",
    });

    const updatedTask: TTask = {
      ...task,
      lastReminderAt: now.toISOString(),
    };
    await updateTask(updatedTask);
  };

  const rawTasks = await ChromeStorageManager.get<TTask[]>("tasks");
  await notifyMessage(
    Array.isArray(rawTasks) ? rawTasks.map(migrateTask) : []
  );
});

// ─── Context Menu Setup ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "auto-complete",
    title: "Auto Complete",
    contexts: ["all"],
  });
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate (EN↔ES)",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "check-grammar",
    title: "Fix Grammar",
    contexts: ["selection"],
  });
});

// ─── Injected Page Functions ────────────────────────────────────────────────
// IMPORTANT: These functions are injected into web pages via
// chrome.scripting.executeScript(). They MUST be fully self-contained
// and CANNOT reference any module-level variables or imports.
// Only browser globals (document, window, chrome) are available.

function autoComplete(): void {
  const activeElem = document.activeElement as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  const innerText = document.body.innerText;

  if (activeElem) {
    chrome.runtime.sendMessage(
      {
        action: "extensionToolCompletion",
        command: "auto-complete",
        payload: {
          pageInnerText: innerText,
          activeOuterHTML: activeElem.outerHTML,
          currentInputValue: activeElem.value ?? "",
        },
      },
      (fillWith: string | null) => {
        if (fillWith) {
          const newContent = fillWith.replace(/^"|"$/g, "");

          if (
            activeElem.isContentEditable ||
            /^(INPUT|TEXTAREA)$/.test(activeElem.tagName)
          ) {
            activeElem.value = newContent;
          } else {
            chrome.runtime.sendMessage({
              action: "notify",
              title: "Invalid Target",
              message: "The target element is not a text area or input.",
            });
          }
        }
      }
    );
  }
}

function translateSelection(): void {
  const activeElem = document.activeElement as HTMLElement | null;

  let selectedText = "";
  const isTextInput =
    activeElem &&
    (activeElem.tagName === "TEXTAREA" ||
      (activeElem.tagName === "INPUT" &&
        ["text", "search", "email", "url", "tel"].includes(
          (activeElem.getAttribute("type") || "text").toLowerCase()
        )));

  if (isTextInput) {
    const input = activeElem as HTMLInputElement | HTMLTextAreaElement;
    selectedText = input.value.substring(
      input.selectionStart ?? 0,
      input.selectionEnd ?? 0
    );
  } else if (window.getSelection) {
    selectedText = window.getSelection()?.toString() ?? "";
  }

  if (!selectedText.trim()) {
    chrome.runtime.sendMessage({
      action: "notify",
      title: "No Selection",
      message: "Please select some text to translate.",
    });
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: "extensionToolCompletion",
      command: "translate-selection",
      payload: { selectedText },
    },
    (translated: string | null) => {
      if (!translated) return;
      translated = translated.replace(/^"|"$/g, "");

      // Case 1: input/textarea
      if (isTextInput) {
        const input = activeElem as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const value = input.value;
        input.value = value.slice(0, start) + translated + value.slice(end);

        const pos = start + translated.length;
        input.setSelectionRange(pos, pos);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      // Case 2: contenteditable
      if (activeElem && activeElem.isContentEditable) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const node = document.createTextNode(translated);
        range.insertNode(node);

        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      // Not editable — notify user with the translation (clickable to copy)
      chrome.runtime.sendMessage({
        action: "notify",
        title: "Translation",
        message: translated,
        copyable: true,
      });
    }
  );
}

function checkGrammar(): void {
  const activeElem = document.activeElement as HTMLElement | null;

  let selectedText = "";
  const isTextInput =
    activeElem &&
    (activeElem.tagName === "TEXTAREA" ||
      (activeElem.tagName === "INPUT" &&
        ["text", "search", "email", "url", "tel"].includes(
          (activeElem.getAttribute("type") || "text").toLowerCase()
        )));

  if (isTextInput) {
    const input = activeElem as HTMLInputElement | HTMLTextAreaElement;
    selectedText = input.value.substring(
      input.selectionStart ?? 0,
      input.selectionEnd ?? 0
    );
  } else if (window.getSelection) {
    selectedText = window.getSelection()?.toString() ?? "";
  }

  if (!selectedText.trim()) {
    chrome.runtime.sendMessage({
      action: "notify",
      title: "No Selection",
      message: "Please select some text to fix.",
    });
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: "extensionToolCompletion",
      command: "check-grammar",
      payload: { selectedText },
    },
    (corrected: string | null) => {
      if (!corrected) return;
      corrected = corrected.replace(/^"|"$/g, "");

      // Case 1: input/textarea
      if (isTextInput) {
        const input = activeElem as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        const value = input.value;
        input.value = value.slice(0, start) + corrected + value.slice(end);

        const pos = start + corrected.length;
        input.setSelectionRange(pos, pos);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      // Case 2: contenteditable
      if (activeElem && activeElem.isContentEditable) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        const node = document.createTextNode(corrected);
        range.insertNode(node);

        range.setStartAfter(node);
        range.setEndAfter(node);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }

      // Not editable — notify with the corrected text (clickable to copy)
      chrome.runtime.sendMessage({
        action: "notify",
        title: "Grammar Fix",
        message: corrected,
        copyable: true,
      });
    }
  );
}

// ─── Context Menu Click Handler ─────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(
  async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === "auto-complete") {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: autoComplete,
        injectImmediately: true,
      });
    }

    if (info.menuItemId === "translate-selection") {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: translateSelection,
        injectImmediately: true,
      });
    }

    if (info.menuItemId === "check-grammar") {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: checkGrammar,
        injectImmediately: true,
      });
    }
  }
);

// ─── Message Handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    request: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean | undefined => {
    if (request.action === "extensionToolCompletion") {
      const toolRequest = request as ExtensionToolCompletionMessage;
      (async () => {
        try {
          const overrides =
            (await ChromeStorageManager.get<
              Partial<Record<ExtensionCommandId, string>>
            >(COMMAND_PROMPT_STORAGE_KEY)) ?? {};

          let completionRequest: CompletionRequest;

          if (toolRequest.command === "check-grammar") {
            completionRequest = {
              model: MODEL_CHAT_SMALL,
              messages: [
                {
                  role: "system",
                  content: resolvePrompt("check-grammar", overrides),
                },
                {
                  role: "user",
                  content: toolRequest.payload.selectedText,
                },
              ],
              max_completion_tokens: 1000,
              response_format: { type: "text" },
            };
          } else if (toolRequest.command === "translate-selection") {
            completionRequest = {
              model: MODEL_CHAT_SMALL,
              messages: [
                {
                  role: "system",
                  content: resolvePrompt("translate-selection", overrides),
                },
                {
                  role: "user",
                  content: toolRequest.payload.selectedText,
                },
              ],
              max_completion_tokens: 1000,
              response_format: { type: "text" },
            };
          } else {
            const system = fillAutocompleteTemplate(
              resolvePrompt("auto-complete", overrides),
              toolRequest.payload
            );
            completionRequest = {
              model: MODEL_CHAT_SMALL,
              messages: [
                { role: "system", content: system },
                { role: "user", content: "Fill the element please." },
              ],
              max_completion_tokens: 500,
              response_format: { type: "text" },
            };
          }

          const fillWith = await createCompletion(completionRequest);
          sendResponse(fillWith);
        } catch (error) {
          console.error("Error generating completion:", error);
          sendResponse(null);
          notify(
            "Error",
            "Error generating completion: " +
              (error instanceof Error ? error.message : String(error))
          );
        }
      })();
      return true;
    }

    if (request.action === "generateCompletion") {
      (async () => {
        try {
          const fillWith = await createCompletion(request);
          sendResponse(fillWith);
        } catch (error) {
          console.error("Error generating completion:", error);
          sendResponse(null);
          notify(
            "Error",
            "Error generating completion: " +
              (error instanceof Error ? error.message : String(error))
          );
        }
      })();
      return true; // Keep message channel open for async response
    }

    if (request.action === "generateNoteImage") {
      // Fire and forget: the job reports progress through chrome.storage
      // (aiImageJobs + attachments), not through this message channel.
      void runNoteImageJob(request);
      sendResponse({ accepted: true });
      return undefined;
    }

    if (request.action === "generateNoteCover") {
      // Fire and forget: progress is reported through aiCoverJobs + notes.
      void runNoteCoverJob(request);
      sendResponse({ accepted: true });
      return undefined;
    }

    if (request.action === "generateNoteAssistantTurn") {
      void runNoteAssistantJob(request);
      sendResponse({ accepted: true });
      return undefined;
    }

    if (request.action === "notify") {
      notify(request.title, request.message, {
        copyable: !!request.copyable,
      });
    }

    return undefined;
  }
);

// ─── Keyboard Shortcut Handler ──────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command: string) => {
  if (command === "auto-complete") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: autoComplete,
        injectImmediately: true,
      });
    }
  }

  if (command === "translate-selection") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: translateSelection,
        injectImmediately: true,
      });
    }
  }

  if (command === "check-grammar") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: checkGrammar,
        injectImmediately: true,
      });
    }
  }

  if (command === "open-automator") {
    const popupUrl = chrome.runtime.getURL("index.html");
    const tabs = await chrome.tabs.query({ url: popupUrl });
    if (tabs && tabs.length > 0 && tabs[0].id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId!, { focused: true });
    } else {
      await chrome.tabs.create({ url: popupUrl });
    }
  }
});
