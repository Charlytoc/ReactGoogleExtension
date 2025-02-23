import { ChromeStorageManager } from "../managers/Storage";

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



export const transformToMinutes = (
  amount: number,
  unit: string
) => {
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