const createRandomId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export const notify = (title: string, message: string) => {
  if (typeof chrome === "undefined" || !chrome.runtime) return;
  const root = chrome.runtime.getURL("icons/icon.png");
  chrome.notifications.create(createRandomId(), {
    type: "basic",
    title: title,
    message: message,
    iconUrl: root,
  });
};

export const createAlarm = (
  hash: string,
  dateInMilliseconds: number,
  periodInMinutes = 5
) => {
  clearAlarm(hash);
  chrome.alarms.create(hash, {
    when: dateInMilliseconds,
    periodInMinutes: periodInMinutes,
  });
};

export const clearAlarm = (hash: string) => {
  chrome.alarms.clear(hash, function (wasCleared) {
    console.log(`Alarm ${hash} was cleared: ${wasCleared}`);
  });
};

export const clearAllAlarms = () => {
  chrome.alarms.clearAll();
};

/** Opens the extension UI at an in-app route in a normal browser tab (Chrome extension only). */
export type TActiveTabInfo = {
  url: string;
  title?: string;
};

/**
 * Active tab in the last-focused browser window (the page behind the extension popup).
 * Requires the "tabs" permission to read `url` reliably.
 */
export const getLastFocusedActiveTabInfo = (): Promise<TActiveTabInfo | null> => {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      resolve(null);
      return;
    }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      const tab = tabs[0];
      const url = tab?.url || tab?.pendingUrl;
      if (!url || typeof url !== "string") {
        resolve(null);
        return;
      }
      resolve({ url, title: tab?.title });
    });
  });
};

export const openExtensionRouteInNewTab = (routePath: string) => {
  const normalized = routePath.startsWith("/") ? routePath : `/${routePath}`;
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime?.getURL &&
    chrome.tabs?.create
  ) {
    const base = chrome.runtime.getURL("index.html");
    const url = `${base}#${normalized}`;
    void chrome.tabs.create({ url });
    return;
  }
  if (typeof window !== "undefined") {
    window.open(normalized, "_blank", "noopener,noreferrer");
  }
};
