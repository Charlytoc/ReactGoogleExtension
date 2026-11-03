import { ChromeStorageManager } from "../managers/Storage";
import { TAIConfig, TModel } from "../types";
import {
  MODEL_CHAT_CAPABLE,
  MODEL_CHAT_NANO,
  MODEL_CHAT_SMALL,
  MODEL_IMAGE_GENERATION,
  MODEL_IMAGE_PROMPT,
} from "./models";

const AI_CONFIG_KEY = "aiConfig";

const titlelify = (slug: string) => {
  const title = slug.replace(/-/g, " ");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const isReasoningModel = (slug: string) => {
  if (slug.startsWith("o")) return true;
  if (slug.startsWith("gpt-5.4-mini") || slug.startsWith("gpt-5.4-nano")) {
    return false;
  }
  if (slug.startsWith("gpt-5")) return true;
  return false;
};

export const modelFromSlug = (slug: string): TModel => ({
  name: titlelify(slug),
  slug,
  hasReasoning: isReasoningModel(slug),
});

const mergeModel = (stored: TModel | undefined, fallback: TModel): TModel => {
  if (stored?.slug == null) return fallback;
  return { ...fallback, ...stored, slug: stored.slug };
};

export const createDefaultAiConfig = (): TAIConfig => ({
  systemPrompt: "You are a helpful assistant. ",
  model: modelFromSlug(MODEL_CHAT_SMALL),
  notesAssistantModel: modelFromSlug(MODEL_CHAT_CAPABLE),
  formatterModel: modelFromSlug(MODEL_CHAT_NANO),
  imagePromptModel: modelFromSlug(MODEL_IMAGE_PROMPT),
  imageModel: modelFromSlug(MODEL_IMAGE_GENERATION),
  autoSaveConversations: true,
  notifyChatFinished: true,
  setTitleAtMessage: 0,
});

const mergeWithDefaults = (stored: Partial<TAIConfig> | null | undefined): TAIConfig => {
  const defaults = createDefaultAiConfig();
  if (!stored || typeof stored !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    ...stored,
    model: mergeModel(stored.model, defaults.model),
    notesAssistantModel: mergeModel(
      stored.notesAssistantModel,
      defaults.notesAssistantModel!
    ),
    formatterModel: mergeModel(stored.formatterModel, defaults.formatterModel!),
    imagePromptModel: mergeModel(
      stored.imagePromptModel,
      defaults.imagePromptModel!
    ),
    imageModel: mergeModel(stored.imageModel, defaults.imageModel!),
  };
};

export async function getAiConfig(): Promise<TAIConfig> {
  const stored = (await ChromeStorageManager.get(AI_CONFIG_KEY)) as
    | Partial<TAIConfig>
    | undefined;
  return mergeWithDefaults(stored);
}

export async function saveAiConfig(partial: Partial<TAIConfig>): Promise<TAIConfig> {
  const current = await getAiConfig();
  const merged = mergeWithDefaults({ ...current, ...partial });
  await ChromeStorageManager.add(AI_CONFIG_KEY, merged);
  return merged;
}

export async function getNotesAssistantModelSlug(): Promise<string> {
  const config = await getAiConfig();
  return config.notesAssistantModel?.slug ?? MODEL_CHAT_CAPABLE;
}

export async function getFormatterModelSlug(): Promise<string> {
  const config = await getAiConfig();
  return config.formatterModel?.slug ?? MODEL_CHAT_NANO;
}

export async function getImagePromptModelSlug(): Promise<string> {
  const config = await getAiConfig();
  return config.imagePromptModel?.slug ?? MODEL_IMAGE_PROMPT;
}

export async function getImageModelSlug(): Promise<string> {
  const config = await getAiConfig();
  return config.imageModel?.slug ?? MODEL_IMAGE_GENERATION;
}
