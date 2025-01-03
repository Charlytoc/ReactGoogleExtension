import { ChromeStorageManager } from "../managers/Storage";

export const getLastPage = async () => {
  const lastPage = await ChromeStorageManager.get("lastPage");
  return lastPage.lastPage;
};

export const saveLastPage = async (url: string) => {
  await ChromeStorageManager.add("lastPage", url);
};
