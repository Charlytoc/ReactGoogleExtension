import { create } from "zustand";
import { TStore } from "./storeTypes";

export const useStore = create<TStore>((set, get) => ({
  config: {
    chat: {
      autoSaveNotes: false,
      setTitleAtMessage: 0,
    },
    auth: {
      openaiApiKey: "",
    },
    theme: {
      fontColor: "#FFFFFF",
      backgroundColor: "#0b0c14",
      activeColor: "#FF007F",
      fontColorSecondary: "#B0B0B0",
      backgroundColorSecondary: "#151e47",
      themePreferences: "",
    },
  },
  setConfig: (newConfig) => {
    const { config } = get();
    set({ config: { ...config, ...newConfig } });
    return true;
  },
}));
