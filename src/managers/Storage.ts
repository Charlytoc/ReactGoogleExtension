const isChromeExtension = (): boolean =>
  typeof chrome !== "undefined" &&
  typeof chrome.storage !== "undefined" &&
  typeof chrome.storage.local !== "undefined";

const chromeAdapter = {
  add: (key: string, value: any): Promise<void> =>
    new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message || "Error adding value to storage");
        } else {
          resolve();
        }
      });
    }),

  get: (key: string): Promise<any> =>
    new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(result[key]);
        }
      });
    }),

  delete: (key: string): Promise<void> =>
    new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve();
        }
      });
    }),
};

const localStorageAdapter = {
  add: (key: string, value: any): Promise<void> => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },

  get: (key: string): Promise<any> => {
    try {
      const item = localStorage.getItem(key);
      return Promise.resolve(item !== null ? JSON.parse(item) : undefined);
    } catch (e) {
      return Promise.reject(e);
    }
  },

  delete: (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },
};

const adapter = () => (isChromeExtension() ? chromeAdapter : localStorageAdapter);

export const StorageManager = {
  add: async (
    key: string,
    value: any,
    onSuccess?: () => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    try {
      await adapter().add(key, value);
      onSuccess?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onError?.(msg);
      throw e;
    }
  },

  get: (key: string): Promise<any> => adapter().get(key),

  delete: (key: string): Promise<void> => adapter().delete(key),
};

/** @deprecated Use StorageManager instead */
export const ChromeStorageManager = StorageManager;
