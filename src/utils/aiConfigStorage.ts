import { ChromeStorageManager } from "../managers/Storage";
import { TAIConfig, TModel } from "../types";
import { MODEL_CHAT_CAPABLE, MODEL_CHAT_NANO, MODEL_CHAT_SMALL } from "./models";

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

export const createDefaultAiConfig = (): TAIConfig => ({
  systemPrompt: "You are a helpful assistant. ",
  model: modelFromSlug(MODEL_CHAT_SMALL),
  notesAssistantModel: modelFromSlug(MODEL_CHAT_CAPABLE),
  formatterModel: modelFromSlug(MODEL_CHAT_NANO),
  autoSaveConversations: true,
  setTitleAtMessage: 0,
});

const mergeWithDefaults = (stored: Partial<TAIConfig> | null | undefined): TAIConfig => {
  const defaults = createDefaultAiConfig();
  if (!stored || typeof stored !== "object") {
    return defaults;
  }

  const model =
    stored.model?.slug != null
      ? { ...defaults.model, ...stored.model, slug: stored.model.slug }
      : defaults.model;

  const notesAssistantModel =
    stored.notesAssistantModel?.slug != null
      ? {
          ...defaults.notesAssistantModel!,
          ...stored.notesAssistantModel,
          slug: stored.notesAssistantModel.slug,
        }
      : defaults.notesAssistantModel!;

  const formatterModel =
    stored.formatterModel?.slug != null
      ? {
          ...defaults.formatterModel!,
          ...stored.formatterModel,
          slug: stored.formatterModel.slug,
        }
      : defaults.formatterModel!;

  return {
    ...defaults,
    ...stored,
    model,
    notesAssistantModel,
    formatterModel,
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
