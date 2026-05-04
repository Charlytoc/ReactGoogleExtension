import { create } from "zustand";
import { DEFAULT_THEME, type TStore } from "./storeTypes";

export const useStore = create<TStore>((set, get) => ({
  config: {
    chat: {
      autoSaveNotes: false,
      setTitleAtMessage: 0,
    },
    auth: {
      openaiApiKey: "",
    },
    theme: { ...DEFAULT_THEME },
  },
  setConfig: (newConfig) => {
    const { config } = get();
    set({ config: { ...config, ...newConfig } });
    return true;
  },
}));
