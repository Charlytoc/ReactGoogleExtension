import { TBackgroundType } from "../types";

type TChatConfig = {
  autoSaveNotes: boolean;
  setTitleAtMessage: number;
};

type TAuthConfig = {
  openaiApiKey: string;
};

export type TTheme = {
  fontColor: string;
  backgroundColor: string;
  activeColor: string;
  fontColorSecondary: string;
  backgroundColorSecondary: string;
  themePreferences: string;
  imageURL: string;
  backgroundType: TBackgroundType;
};

type TConfig = {
  chat: TChatConfig;
  auth: TAuthConfig;
  theme: TTheme;
};

type TStore = {
  config: TConfig;
  setConfig: (config: Partial<TConfig>) => boolean;
};

export type { TChatConfig, TConfig, TStore };
