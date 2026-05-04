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
  /** Long-form / helper copy (e.g. saved prompt bodies). Kept separate from secondary labels. */
  fontColorTertiary: string;
  backgroundColorSecondary: string;
  themePreferences: string;
  imageURL: string;
  backgroundType: TBackgroundType;
};

export const DEFAULT_THEME: TTheme = {
  fontColor: "#FFFFFF",
  backgroundColor: "#0b0c14",
  activeColor: "#FF007F",
  fontColorSecondary: "#B0B0B0",
  fontColorTertiary: "#aab4c8",
  backgroundColorSecondary: "#151e47",
  themePreferences: "",
  imageURL: "",
  backgroundType: "solid",
};

/** Merges stored preferences with defaults; fills tertiary from secondary when missing (older saves). */
export function mergeStoredTheme(
  stored: Partial<TTheme> | null | undefined
): TTheme {
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_THEME };
  }
  const merged: TTheme = { ...DEFAULT_THEME, ...stored };
  const tertiary =
    (merged.fontColorTertiary && merged.fontColorTertiary.trim()) ||
    (merged.fontColorSecondary && merged.fontColorSecondary.trim()) ||
    DEFAULT_THEME.fontColorTertiary;
  return { ...merged, fontColorTertiary: tertiary };
}

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
