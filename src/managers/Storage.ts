export const ChromeStorageManager = {
  // Agregar un valor al almacenamiento
  add: async (
    key: string,
    value: any,
    onSuccess?: () => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    console.log(key, value, "adding value to storage");

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          onError?.(
            chrome.runtime.lastError.message || "Error adding value to storage"
          );
          reject(
            chrome.runtime.lastError.message || "Error adding value to storage"
          );
        } else {
          onSuccess?.();
          resolve();
        }
      });
    });
  },

  // Obtener un valor del almacenamiento
  get: async (key: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(result[key]);
        }
      });
    });
  },

  // Eliminar un valor del almacenamiento
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
