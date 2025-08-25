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
  type: "note" | "task" | "conversation" | "snaptie"
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

export const extractPageData = (start: number, end: number): Promise<{
  url: string;
  content: string;
  html: string;
}> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return reject("No active tab found");

      const url = tabs[0].url || "";

      chrome.scripting
        .executeScript({
          target: { tabId: tabs[0].id },
          func: () => ({
            content: document.body.innerText, // Extract visible text
            html: document.documentElement.outerHTML, // Extract full HTML
          }),
        })
        .then((results) => {
          if (results && results[0] && results[0].result) {
            const slicedContent = getSlicedContent(
              results[0].result.content,
              start,
              end
            );
            const slicedHtml = getSlicedContent(
              results[0].result.html,
              start,
              end
            );
            resolve({ url, content: slicedContent, html: slicedHtml });
          } else {
            console.log(results, "results");
            reject("Failed to extract content");
          }
        })
        .catch(reject);
    });
  });
};

export const extractClickableElements = (): Promise<
  {
    text: string;
    tag: string;
    position: { x: number; y: number };
    outerHTML: string;
  }[]
> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return reject("No active tab found");

      chrome.scripting
        .executeScript({
          target: { tabId: tabs[0].id },
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
        })
        .then((results) => {
          if (results && results[0] && results[0].result) {
            resolve(results[0].result);
          } else {
            reject("Failed to extract clickable elements");
          }
        })
        .catch(reject);
    });
  });
};

export const extractEditableElements = (): Promise<
  {
    text: string;
    tag: string;
    position: { x: number; y: number };
    outerHTML: string;
  }[]
> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return reject("No active tab found");

      chrome.scripting
        .executeScript({
          target: { tabId: tabs[0].id },
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
        })
        .then((results) => {
          if (results && results[0] && results[0].result) {
            resolve(results[0].result);
          } else {
            reject("Failed to extract editable elements");
          }
        })
        .catch(reject);
    });
  });
};

export const clickElementBySelector = (selector: string) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) {
      console.error("No active tab found");
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (selector) => {
        const element = document.querySelector(selector);
        if (element) {
          (element as HTMLElement).click();
        } else {
          console.warn("No element found with selector:", selector);
        }
      },
      args: [selector],
    });
  });
};

export const fillElementBySelector = (selector: string, text: string) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) {
      console.error("No active tab found");
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: (selector, text) => {
        const element = document.querySelector(selector) as
          | HTMLInputElement
          | HTMLTextAreaElement;
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
