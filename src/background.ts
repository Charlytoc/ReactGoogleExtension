/**
 * Background service worker for the Automator Chrome extension.
 *
 * Handles: context menus, keyboard shortcuts, task alarms/notifications,
 * OpenAI API calls (via fetch), and message passing between extension parts.
 *
 * NOTE: The functions `autoComplete`, `translateSelection`, and `checkGrammar`
 * are injected into web pages via chrome.scripting.executeScript(). They MUST
 * remain fully self-contained — no module-level references allowed inside them.
 */

import type { TTask } from "./types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_completion_tokens?: number;
  response_format?: { type: string };
}

interface CompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
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

type ExtensionMessage = GenerateCompletionMessage | NotifyMessage;

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

// ─── OpenAI Completion (raw fetch, no SDK) ──────────────────────────────────

const createCompletion = async (
  request: CompletionRequest,
  callback?: (completion: CompletionResponse) => void
): Promise<string> => {
  const apiKey = await ChromeStorageManager.get<string>("openaiApiKey");
  if (!apiKey) {
    throw new Error("No API key found");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_completion_tokens || 500,
      response_format: { type: "text" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion: CompletionResponse = await response.json();

  if (typeof callback === "function") {
    callback(completion);
  }

  return completion.choices[0].message.content;
};

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

const retrieveFromLs = async <T>(
  key: string,
  callback: (result: T) => void
): Promise<void> => {
  const result = await ChromeStorageManager.get<T>(key);
  callback(result);
};

const updateTask = async (task: TTask): Promise<void> => {
  const tasks = await ChromeStorageManager.get<TTask[]>("tasks");
  if (tasks) {
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

  await retrieveFromLs<TTask[]>("tasks", notifyMessage);
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
    title: "Translate to English",
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
        action: "generateCompletion",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an useful assistant working for a Google Extension. Your task is to assist the user filling inputs with the text that best match the user intent. You will get the page context so you can figure out what the user intent is. You will also get the active element to give you more context.
                    
                    
                    This is the page context: ---
                    ${innerText}
                    ---
                    
                    This is the active element: ---
                    ${activeElem.outerHTML}
                    ---

                    The current text of the input is: ---
                    ${activeElem.value}
                    ---

                    Return only the next text of the input, no other text or comment are allowed.
                    If the input already have text, you must continue writting the text, otherwise you should return the complete text to fill the input.

                    Examples:
                    Input: "Hello, how ar"
                    Output: "Hello, how are you?"

                    Input: "What is the capital of Fr"
                    Output: "What is the capital of France?"
                    

                    `,
          },
          {
            role: "user",
            content: "Fill the element please.",
          },
        ],
        max_completion_tokens: 500,
        temperature: 0.5,
        response_format: { type: "text" },
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
      action: "generateCompletion",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a translator. Translate the given text to English. Return ONLY the translated text, nothing else. No quotes, no explanations, no notes. Preserve the original formatting (line breaks, punctuation, etc.).",
        },
        {
          role: "user",
          content: selectedText,
        },
      ],
      max_completion_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "text" },
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
      action: "generateCompletion",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a grammar and spelling corrector. Fix the grammar, spelling, and punctuation of the given text. Keep the SAME language as the original — do NOT translate. Return ONLY the corrected text, nothing else. No quotes, no explanations, no notes. Preserve the original meaning and tone. If the text is already correct, return it unchanged.",
        },
        {
          role: "user",
          content: selectedText,
        },
      ],
      max_completion_tokens: 1000,
      temperature: 0.2,
      response_format: { type: "text" },
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
