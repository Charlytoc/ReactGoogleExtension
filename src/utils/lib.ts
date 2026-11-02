import { ChromeStorageManager } from "../managers/Storage";
import { TBackgroundType } from "../types";

export const getLastPage = async () => {
  const lastPage = await ChromeStorageManager.get("lastPage");
  return lastPage.lastPage;
};

export const cacheLocation = async (
  nextPage: string,
  currentPage: string | undefined = "/index.html"
) => {
  await ChromeStorageManager.add("lastPage", nextPage);
  await ChromeStorageManager.add("prevPage", currentPage);
};

export const generateRandomId = (
  type:
    | "note"
    | "task"
    | "conversation"
    | "snaptie"
    | "formatter"
    | "attachment"
    | "prompt"
    | "node"
) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${type}-${timestamp}-${randomString}`;
};

export const isUrl = (url: string) => {
  return url.startsWith("http://") || url.startsWith("https://");
};

export const transformToMinutes = (amount: number, unit: string) => {
  if (unit === "minutes") {
    return amount;
  }
  if (unit === "hours") {
    return amount * 60;
  }
  if (unit === "days") {
    return amount * 1440;
  }
  return amount;
};

const resolveTab = async (
  tabId?: number
): Promise<{ id: number; url: string }> => {
  if (typeof tabId === "number") {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.id) {
      throw new Error("No active tab found");
    }
    return { id: tab.id, url: tab.url || "" };
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        reject(new Error("No active tab found"));
        return;
      }
      resolve({ id: tabs[0].id, url: tabs[0].url || "" });
    });
  });
};

const getSlicedContent = (content: string, start: number, end: number) => {
  // Calcukate the percentage of the content based in the start, that is a float from 0 to 1
  const startIndex = Math.floor(content.length * start);
  const endIndex = Math.floor(content.length * end);

  // If the startIndex is greater than the endIndex, return an empty string
  if (startIndex > endIndex) {
    return "";
  }

  return content.slice(startIndex, endIndex);
};

export const extractPageData = async (
  start: number,
  end: number,
  tabId?: number
): Promise<{
  url: string;
  content: string;
  html: string;
}> => {
  const tab = await resolveTab(tabId);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      content: document.body.innerText, // Extract visible text
      html: document.documentElement.outerHTML, // Extract full HTML
    }),
  });

  if (results && results[0] && results[0].result) {
    return {
      url: tab.url,
      content: getSlicedContent(results[0].result.content, start, end),
      html: getSlicedContent(results[0].result.html, start, end),
    };
  }

  console.log(results, "results");
  throw new Error("Failed to extract content");
};

export const extractClickableElements = async (
  tabId?: number
): Promise<
  {
    text: string;
    tag: string;
    position: { x: number; y: number };
    outerHTML: string;
  }[]
> => {
  const tab = await resolveTab(tabId);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
            const elements = Array.from(
              document.querySelectorAll(
                "a, button, [onclick], input[type='submit'], input[type='button']"
              )
            );

            return elements.map((el) => {
              const rect = el.getBoundingClientRect();
              return {
                text:
                  (el as HTMLElement).innerText ||
                  el.getAttribute("aria-label") ||
                  el.getAttribute("alt") ||
                  "",
                tag: el.tagName.toLowerCase(),

                position: {
                  x: rect.left + window.scrollX,
                  y: rect.top + window.scrollY,
                },
                outerHTML: el.outerHTML,
              };
            });
          },
  });

  if (results && results[0] && results[0].result) {
    return results[0].result;
  }
  throw new Error("Failed to extract clickable elements");
};

export const extractEditableElements = async (
  tabId?: number
): Promise<
  {
    text: string;
    tag: string;
    position: { x: number; y: number };
    outerHTML: string;
  }[]
> => {
  const tab = await resolveTab(tabId);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
            const elements = Array.from(
              document.querySelectorAll(
                "input, textarea, [contenteditable='true']"
              )
            );

            return elements.map((el) => {
              const rect = el.getBoundingClientRect();
              return {
                text:
                  (el as HTMLInputElement).value ||
                  (el as HTMLElement).innerText ||
                  el.getAttribute("aria-label") ||
                  el.getAttribute("alt") ||
                  "",
                tag: el.tagName.toLowerCase(),

                position: {
                  x: rect.left + window.scrollX,
                  y: rect.top + window.scrollY,
                },
                outerHTML: el.outerHTML,
              };
            });
          },
  });

  if (results && results[0] && results[0].result) {
    return results[0].result;
  }
  throw new Error("Failed to extract editable elements");
};

export const clickElementBySelector = async (
  selector: string,
  tabId?: number
) => {
  const tab = await resolveTab(tabId);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (selector) => {
        let element: Element | null = null;
        try {
          element = document.querySelector(selector);
        } catch {
          if (selector.startsWith("#")) {
            element = document.getElementById(selector.slice(1).replace(/\\/g, ""));
          }
        }
        if (element) {
          (element as HTMLElement).click();
        } else {
          console.warn("No element found with selector:", selector);
        }
      },
      args: [selector],
    });
};

export const fillElementBySelector = async (
  selector: string,
  text: string,
  tabId?: number
) => {
  const tab = await resolveTab(tabId);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (selector, text) => {
        let element: HTMLInputElement | HTMLTextAreaElement | null = null;
        try {
          element = document.querySelector(selector) as
            | HTMLInputElement
            | HTMLTextAreaElement
            | null;
        } catch {
          if (selector.startsWith("#")) {
            element = document.getElementById(selector.slice(1).replace(/\\/g, "")) as
              | HTMLInputElement
              | HTMLTextAreaElement
              | null;
          }
        }
        if (element) {
          element.focus();
          element.value = text;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          console.warn("No element found with selector:", selector);
        }
      },
      args: [selector, text],
    });
};

export const buildBackground = (
  color: string | undefined,
  color2: string | undefined,
  type: TBackgroundType,
  image?: string
) => {
  if (type === "image") {
    return `url(${image}) center center / cover no-repeat`;
  }

  if (type === "gradient") {
    return `radial-gradient(circle, ${color} 0%, ${color2} 100%)`;
  } else if (type === "solid") {
    return color;
  } else if (type === "none") {
    return "none";
  }
};
