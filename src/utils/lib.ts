import { ChromeStorageManager } from "../managers/Storage";

export const getLastPage = async () => {
  const lastPage = await ChromeStorageManager.get("lastPage");
  return lastPage.lastPage;
};

export const cacheLocation = async (url: string) => {
  await ChromeStorageManager.add("lastPage", url);
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
