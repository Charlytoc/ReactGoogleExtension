import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button/Button";
import { SVGS } from "../../assets/svgs.tsx";
import { ChromeStorageManager } from "../../managers/Storage.ts";
import { repairStoredNotes } from "../../utils/tags";
import { useEffect, useRef, useState } from "react";
import { LabeledInput } from "../../components/LabeledInput/LabeledInput.tsx";
import { Section } from "../../components/Section/Section.tsx";
import toast from "react-hot-toast";
import { createCompletion, listModelCatalog } from "../../utils/ai.ts";
import { MODEL_CHAT_SMALL } from "../../utils/models.ts";
import {
  createDefaultAiConfig,
  getAiConfig,
  modelFromSlug,
  saveAiConfig,
} from "../../utils/aiConfigStorage.ts";
import { useShallow } from "zustand/shallow";
import { useStore } from "../../managers/store.ts";
import {
  DEFAULT_THEME,
  mergeStoredTheme,
  type TTheme,
} from "../../managers/storeTypes.ts";
import { Select } from "../../components/Select/Select.tsx";
import type { TModel } from "../../types.ts";
import {
  downloadBackup,
  exportAllData,
  importAllData,
  parseBackupFile,
} from "../../utils/backup.ts";
import { isSupabaseConfigured } from "../../utils/supabaseClient.ts";
import {
  BACKUPS_TABLE_SETUP_SQL,
  downloadBackupFromCloud,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  TableMissingError,
  uploadBackupToCloud,
  type TCloudUser,
} from "../../utils/cloudSync.ts";
import { useSearchParams } from "react-router";
import { Switch } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import "./page.css";

const SETTINGS_SECTIONS = ["general", "ai", "look", "data"] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const SECTION_COPY: Record<
  SettingsSection,
  { title: string; hint: string }
> = {
  general: { title: "settingsGeneral", hint: "settingsGeneralHint" },
  ai: { title: "settingsAi", hint: "settingsAiHint" },
  look: { title: "settingsLook", hint: "settingsLookHint" },
  data: { title: "settingsData", hint: "settingsDataHint" },
};

const COLOR_FIELDS = [
  ["activeColor", "active"],
  ["fontColor", "font"],
  ["fontColorSecondary", "font-secondary"],
  ["fontColorTertiary", "font-tertiary"],
  ["backgroundColor", "background"],
  ["backgroundColorSecondary", "gradient"],
] as const;

const isSettingsSection = (value: string | null): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section === value);

const modelOptions = (models: TModel[], current: TModel) => {
  const list = models.some((model) => model.slug === current.slug)
    ? models
    : [current, ...models];
  return list.map((model) => ({ label: model.name, value: model.slug }));
};

const pickModel = (models: TModel[], slug: string) =>
  models.find((model) => model.slug === slug) ?? modelFromSlug(slug);

const generateRandomTheme = async (
  apiKey: string,
  userPreferences: string = ""
): Promise<TTheme> => {
  const prompt = `You are tasked to create a set of colors for a website.
  The colors should be random and should be in the HSL format.
  The colors should be in the following format:
  {
    fontColor: string;
    backgroundColor: string;
    activeColor: string;
    fontColorSecondary: string;
    fontColorTertiary: string;
    backgroundColorSecondary: string;
  }
    
  All the colors should be in #RRGGBB format.

  Keep in mind: 
  The font color should be readable over the background color.
  The font color secondary will be use for less important texts.
  The font color tertiary is for longer muted body text (e.g. descriptions). It must stay clearly readable on the background—typically slightly dimmer than fontColor but much higher contrast than a 30% gray overlay.
  The active color should be readable over and contrast with the background color.
  The secondary background color should be readable over the background color and closer to the background color. Both colors are used to generate a gradient.

  This are the preferences of the user: ${userPreferences}

  Your response should be a valid JSON with the colors in the format specified above.
  `;

  const response = await createCompletion({
    messages: [
      {
        role: "system",
        content: prompt,
      },
    ],
    model: MODEL_CHAT_SMALL,
    response_format: { type: "json_object" },
    max_completion_tokens: 100,
    apiKey,
  });
  if (!response) {
    throw new Error("No response from AI");
  }
  const parsed = JSON.parse(response) as Partial<TTheme>;
  return mergeStoredTheme(parsed);
};

const setColorsInDocument = (colors: TTheme) => {
  document.documentElement.style.setProperty(
    "--active-color",
    colors.activeColor
  );
  document.documentElement.style.setProperty("--font-color", colors.fontColor);
  document.documentElement.style.setProperty(
    "--font-color-secondary",
    colors.fontColorSecondary
  );
  document.documentElement.style.setProperty(
    "--font-color-tertiary",
    colors.fontColorTertiary
  );
  document.documentElement.style.setProperty(
    "--bg-color",
    colors.backgroundColor
  );
  document.documentElement.style.setProperty(
    "--bg-color-secondary",
    colors.backgroundColorSecondary
  );
};

const applyGeneratedColors = (current: TTheme, generated: TTheme): TTheme => ({
  ...current,
  activeColor: generated.activeColor,
  fontColor: generated.fontColor,
  fontColorSecondary: generated.fontColorSecondary,
  fontColorTertiary: generated.fontColorTertiary,
  backgroundColor: generated.backgroundColor,
  backgroundColorSecondary: generated.backgroundColorSecondary,
});

export default function Config() {
  const { i18n, t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const section = isSettingsSection(sectionParam) ? sectionParam : null;
  const [apiKey, setApiKey] = useState<string>("");
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [colors, setColors] = useState<TTheme>(DEFAULT_THEME);
  const [savedColors, setSavedColors] = useState<TTheme>(DEFAULT_THEME);
  const [notesAssistantModel, setNotesAssistantModel] = useState<TModel>(
    () => createDefaultAiConfig().notesAssistantModel!
  );
  const [formatterModel, setFormatterModel] = useState<TModel>(
    () => createDefaultAiConfig().formatterModel!
  );
  const [imagePromptModel, setImagePromptModel] = useState<TModel>(
    () => createDefaultAiConfig().imagePromptModel!
  );
  const [imageModel, setImageModel] = useState<TModel>(
    () => createDefaultAiConfig().imageModel!
  );
  const [chatModel, setChatModel] = useState<TModel>(
    () => createDefaultAiConfig().model
  );
  const [autoSaveConversations, setAutoSaveConversations] = useState(true);
  const [notifyChatFinished, setNotifyChatFinished] = useState(true);
  const [availableModels, setAvailableModels] = useState<TModel[]>([]);
  const [availableImageModels, setAvailableImageModels] = useState<TModel[]>([]);

  const [cloudUser, setCloudUser] = useState<TCloudUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const setConfig = useStore(useShallow((state) => state.setConfig));
  const lookDirty = JSON.stringify(colors) !== JSON.stringify(savedColors);

  const openSection = (next: SettingsSection) => {
    setSearchParams({ section: next });
  };

  const closeSection = () => {
    setSearchParams({});
  };

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    ChromeStorageManager.add("language", value);
  };

  const loadModels = async (key: string) => {
    if (!key) {
      setAvailableModels([]);
      setAvailableImageModels([]);
      return;
    }
    try {
      const catalog = await listModelCatalog(key);
      setAvailableModels(catalog.chat);
      setAvailableImageModels(catalog.image);
    } catch {
      setAvailableModels([]);
      setAvailableImageModels([]);
    }
  };

  useEffect(() => {
    getStored();
  }, []);

  const getStored = async () => {
    const storedKey = await ChromeStorageManager.get("openaiApiKey");
    const key = typeof storedKey === "string" ? storedKey : "";
    setApiKey(key);
    const colorPreferences = await ChromeStorageManager.get("colorPreferences");
    if (colorPreferences && typeof colorPreferences === "object") {
      const theme = mergeStoredTheme(colorPreferences as Partial<TTheme>);
      setColors(theme);
      setSavedColors(theme);
    }

    const aiConfig = await getAiConfig();
    if (aiConfig.notesAssistantModel) {
      setNotesAssistantModel(aiConfig.notesAssistantModel);
    }
    if (aiConfig.formatterModel) {
      setFormatterModel(aiConfig.formatterModel);
    }
    if (aiConfig.imagePromptModel) {
      setImagePromptModel(aiConfig.imagePromptModel);
    }
    if (aiConfig.imageModel) {
      setImageModel(aiConfig.imageModel);
    }
    setChatModel(aiConfig.model);
    setAutoSaveConversations(aiConfig.autoSaveConversations);
    setNotifyChatFinished(aiConfig.notifyChatFinished);

    await loadModels(key);

    if (isSupabaseConfigured()) {
      try {
        const user = await getCurrentUser();
        setCloudUser(user);
      } catch {
        setCloudUser(null);
      }
    }
  };

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      const user = await signIn(authEmail.trim(), authPassword);
      setCloudUser(user);
      setAuthPassword("");
    } catch (e) {
      const message = e instanceof Error ? e.message : undefined;
      toast.error(message ? `${t("signInError")}: ${message}` : t("signInError"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignUp = async () => {
    setAuthBusy(true);
    try {
      const user = await signUp(authEmail.trim(), authPassword);
      setCloudUser(user);
      setAuthPassword("");
      toast.success(t("signUpSuccess"));
    } catch (e) {
      const message = e instanceof Error ? e.message : undefined;
      toast.error(message ? `${t("signUpError")}: ${message}` : t("signUpError"));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setCloudUser(null);
  };

  const handleUploadToCloud = async () => {
    setCloudBusy(true);
    try {
      await uploadBackupToCloud();
      setTableMissing(false);
      toast.success(t("uploadToCloudSuccess"));
    } catch (e) {
      if (e instanceof TableMissingError) {
        setTableMissing(true);
      } else {
        toast.error(t("uploadToCloudError"));
      }
    } finally {
      setCloudBusy(false);
    }
  };

  const handleDownloadFromCloud = async () => {
    if (!window.confirm(t("downloadFromCloudConfirm"))) return;
    setCloudBusy(true);
    try {
      await downloadBackupFromCloud();
      setTableMissing(false);
      toast.success(t("downloadFromCloudSuccess"));
      window.location.reload();
    } catch (e) {
      if (e instanceof TableMissingError) {
        setTableMissing(true);
      } else {
        toast.error(t("downloadFromCloudError"));
      }
    } finally {
      setCloudBusy(false);
    }
  };

  const copySetupSql = () => {
    navigator.clipboard.writeText(BACKUPS_TABLE_SETUP_SQL);
    toast.success(t("sqlCopiedToClipboard"));
  };

  const handleRepairNotes = async () => {
    const { repaired } = await repairStoredNotes();
    if (repaired === 0) {
      toast.success(t("notesAlreadyHealthy"));
      return;
    }
    toast.success(t("notesRepaired").replace("%s", String(repaired)));
  };

  const handleExportData = async () => {
    const backup = await exportAllData();
    downloadBackup(backup);
    toast.success(t("exportDataSuccess"));
  };

  const handleImportFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!window.confirm(t("importDataConfirm"))) return;

    try {
      const raw = await file.text();
      const backup = parseBackupFile(raw);
      await importAllData(backup);
      toast.success(t("importDataSuccess"));
      window.location.reload();
    } catch {
      toast.error(t("importDataError"));
    }
  };

  const pasteColorsToClipboard = () => {
    navigator.clipboard.writeText(
      `--active-color: ${colors.activeColor};
--font-color: ${colors.fontColor};
--font-color-secondary: ${colors.fontColorSecondary};
--font-color-tertiary: ${colors.fontColorTertiary};
--bg-color: ${colors.backgroundColor};
--bg-color-secondary: ${colors.backgroundColorSecondary};
    `
    );
    toast.success(t("colorsPastedToClipboard"));
  };

  const saveAi = async () => {
    await ChromeStorageManager.add("openaiApiKey", apiKey);
    await saveAiConfig({
      notesAssistantModel,
      formatterModel,
      imagePromptModel,
      imageModel,
      model: chatModel,
      autoSaveConversations,
      notifyChatFinished,
    });
    setConfig({ auth: { openaiApiKey: apiKey } });
    await loadModels(apiKey);
    toast.success(t("settingsSaved"));
  };

  const saveLook = async () => {
    await ChromeStorageManager.add("colorPreferences", colors);
    setSavedColors(colors);
    toast.success(t("settingsSaved"));
  };

  useEffect(() => {
    setColorsInDocument(colors);
    setConfig({
      theme: colors,
    });
  }, [colors]);

  const modelFields = [
    {
      id: "notesAssistantModel",
      label: t("settingsModelNotes"),
      model: notesAssistantModel,
      options: modelOptions(availableModels, notesAssistantModel),
      onChange: (value: string) =>
        setNotesAssistantModel(pickModel(availableModels, value)),
    },
    {
      id: "formatterModel",
      label: t("settingsModelFormatters"),
      model: formatterModel,
      options: modelOptions(availableModels, formatterModel),
      onChange: (value: string) =>
        setFormatterModel(pickModel(availableModels, value)),
    },
    {
      id: "imagePromptModel",
      label: t("settingsModelImagePrompt"),
      model: imagePromptModel,
      options: modelOptions(availableModels, imagePromptModel),
      onChange: (value: string) =>
        setImagePromptModel(pickModel(availableModels, value)),
    },
    {
      id: "imageModel",
      label: t("settingsModelImage"),
      model: imageModel,
      options: modelOptions(availableImageModels, imageModel),
      onChange: (value: string) =>
        setImageModel(pickModel(availableImageModels, value)),
    },
  ];

  return (
    <Section
      className="bg-gradient"
      headerLeft={
        <h3 className="font-mono">
          {section ? t(SECTION_COPY[section].title) : t("settings")}
        </h3>
      }
      close={section ? closeSection : undefined}
    >
      {!section && (
        <div className="settings-menu">
          {SETTINGS_SECTIONS.map((id) => (
            <button
              key={id}
              type="button"
              className="settings-row"
              onClick={() => openSection(id)}
            >
              <span className="flex-column gap-5">
                <span>{t(SECTION_COPY[id].title)}</span>
                <span className="settings-hint text-sm">
                  {id === "look" && lookDirty
                    ? t("unsaved")
                    : t(SECTION_COPY[id].hint)}
                </span>
              </span>
              <IconChevronRight size={18} />
            </button>
          ))}
        </div>
      )}

      {section === "general" && (
        <div className="settings-screen">
          <label className="text-left" htmlFor="language">
            {t("language")}
          </label>
          <Select
            name="language"
            id="language"
            options={[
              { label: t("english"), value: "en" },
              { label: t("spanish"), value: "es" },
            ]}
            onChange={(value) => handleLanguageChange(value)}
            defaultValue={i18n.language}
          />
        </div>
      )}

      {section === "ai" && (
        <div className="settings-screen">
          <LabeledInput
            label={t("openaiApiKey")}
            type="password"
            name="openaiApiKey"
            className="w-100"
            value={apiKey}
            onChange={(value) => setApiKey(value)}
          />
          <div className="flex-column gap-10">
            <span className="text-left">{t("settingsModels")}</span>
            <span className="settings-hint text-left text-sm">
              {t("settingsModelsHint")}
            </span>
            {modelFields.map((field) => (
              <div key={field.id} className="flex-column gap-5">
                <label className="text-left" htmlFor={field.id}>
                  {field.label}
                </label>
                <Select
                  name={field.id}
                  id={field.id}
                  options={field.options}
                  defaultValue={field.model.slug}
                  onChange={field.onChange}
                />
              </div>
            ))}
          </div>
          <div className="flex-column gap-10">
            <label className="text-left" htmlFor="chatModel">
              {t("chat")}
            </label>
            <Select
              name="chatModel"
              id="chatModel"
              options={modelOptions(availableModels, chatModel)}
              defaultValue={chatModel.slug}
              onChange={(value) =>
                setChatModel(pickModel(availableModels, value))
              }
            />
            <Switch
              label={t("autoSaveConversations")}
              checked={autoSaveConversations}
              onChange={(event) =>
                setAutoSaveConversations(event.currentTarget.checked)
              }
            />
            <Switch
              label={t("notifyChatFinished")}
              checked={notifyChatFinished}
              onChange={(event) =>
                setNotifyChatFinished(event.currentTarget.checked)
              }
            />
          </div>
          <Button
            className="w-100 padding-10 justify-center active-on-hover"
            text={t("save")}
            svg={SVGS.save}
            onClick={saveAi}
          />
        </div>
      )}

      {section === "look" && (
        <div className="settings-screen">
          <div className="settings-swatches">
            {COLOR_FIELDS.map(([key, label]) => (
              <label key={key} className="settings-swatch">
                <span>{t(label)}</span>
                <input
                  type="color"
                  name={key}
                  value={colors[key] || "#000000"}
                  onChange={(event) =>
                    setColors({ ...colors, [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div
            className="settings-preview"
            style={{
              background: `linear-gradient(90deg, ${colors.backgroundColor}, ${colors.backgroundColorSecondary})`,
              borderLeftColor: colors.activeColor,
            }}
          >
            <span style={{ color: colors.fontColor }}>{t("font")}</span>
            <span style={{ color: colors.fontColorSecondary }}>
              {t("font-secondary")}
            </span>
            <span style={{ color: colors.fontColorTertiary }}>
              {t("font-tertiary")}
            </span>
          </div>
          <LabeledInput
            label={t("themePreferences")}
            type="text"
            placeholder={t("themePreferencesPlaceholder")}
            name="themePreferences"
            className="w-100 settings-theme"
            value={colors.themePreferences}
            onChange={(value) =>
              setColors({ ...colors, themePreferences: value })
            }
          />
          <div className="flex-row gap-10">
            <Button
              className="padding-10 justify-center active-on-hover"
              svg={SVGS.generate}
              title={t("generateColorDescription")}
              onClick={() => {
                if (!apiKey) {
                  toast.error(t("noApiKeyError"));
                  return;
                }
                generateRandomTheme(apiKey, colors.themePreferences).then(
                  (generated) => {
                    setColors((prev) => applyGeneratedColors(prev, generated));
                  }
                );
              }}
            />
            <Button
              className="padding-10 justify-center active-on-hover"
              svg={SVGS.paste}
              title={t("pasteColorsToClipboard")}
              onClick={pasteColorsToClipboard}
            />
          </div>
          <div className="flex-row gap-10 justify-between align-center">
            <span className="settings-unsaved">
              {lookDirty ? t("unsaved") : ""}
            </span>
            <Button
              className="padding-10 justify-center active-on-hover"
              text={t("save")}
              svg={SVGS.save}
              disabled={!lookDirty}
              onClick={saveLook}
            />
          </div>
        </div>
      )}

      {section === "data" && (
        <div className="settings-screen">
          <div className="flex-column gap-10">
            <h3 className="text-left">{t("settingsFile")}</h3>
            <span className="settings-hint text-left text-sm">
              {t("backupAndRestoreDescription")}
            </span>
            <div className="flex-row gap-10 wrap">
              <Button
                className="padding-10 justify-center active-on-hover"
                text={t("exportData")}
                svg={SVGS.save}
                onClick={handleExportData}
              />
              <Button
                className="padding-10 justify-center active-on-hover"
                text={t("importData")}
                svg={SVGS.read}
                onClick={() => importFileInputRef.current?.click()}
              />
              <input
                ref={importFileInputRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={handleImportFileSelected}
              />
            </div>
          </div>

          <div className="flex-column gap-10">
            <h3 className="text-left">{t("settingsCloud")}</h3>
            <span className="settings-hint text-left text-sm">
              {t("supabaseConfigDescription")}
            </span>
            {isSupabaseConfigured() ? (
              <div className="flex-column gap-10">
                {cloudUser ? (
                  <>
                    <span className="text-left text-sm">
                      {t("signedInAs", {
                        email: cloudUser.email ?? cloudUser.id,
                      })}
                    </span>
                    <div className="flex-row gap-10 wrap">
                      <Button
                        className="padding-10 justify-center active-on-hover"
                        text={t("uploadToCloud")}
                        svg={SVGS.save}
                        disabled={cloudBusy}
                        onClick={handleUploadToCloud}
                      />
                      <Button
                        className="padding-10 justify-center active-on-hover"
                        text={t("downloadFromCloud")}
                        svg={SVGS.read}
                        disabled={cloudBusy}
                        onClick={handleDownloadFromCloud}
                      />
                      <Button
                        className="padding-10 justify-center active-on-hover"
                        text={t("signOut")}
                        onClick={handleSignOut}
                      />
                    </div>
                    {tableMissing && (
                      <div className="flex-column gap-5">
                        <span className="text-left text-sm settings-hint">
                          {t("tableMissingHint")}
                        </span>
                        <pre
                          className="text-left text-sm"
                          style={{
                            whiteSpace: "pre-wrap",
                            maxHeight: 160,
                            overflowY: "auto",
                            padding: 10,
                          }}
                        >
                          {BACKUPS_TABLE_SETUP_SQL}
                        </pre>
                        <Button
                          className="padding-10 justify-center active-on-hover"
                          text={t("copySql")}
                          svg={SVGS.copy}
                          onClick={copySetupSql}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <LabeledInput
                      label={t("email")}
                      type="email"
                      name="authEmail"
                      className="w-100"
                      value={authEmail}
                      onChange={setAuthEmail}
                    />
                    <LabeledInput
                      label={t("password")}
                      type="password"
                      name="authPassword"
                      className="w-100"
                      value={authPassword}
                      onChange={setAuthPassword}
                    />
                    <div className="flex-row gap-10 wrap">
                      <Button
                        className="padding-10 justify-center active-on-hover"
                        text={t("signIn")}
                        disabled={authBusy}
                        onClick={handleSignIn}
                      />
                      <Button
                        className="padding-10 justify-center active-on-hover"
                        text={t("signUp")}
                        disabled={authBusy}
                        onClick={handleSignUp}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <span className="text-left text-sm settings-hint">
                {t("supabaseNotConfigured")}
              </span>
            )}
          </div>

          <div className="flex-column gap-10">
            <h3 className="text-left">{t("settingsMaintenance")}</h3>
            <Button
              className="padding-10 justify-center active-on-hover"
              text={t("repairNotes")}
              svg={SVGS.repair}
              title={t("repairNotesConfirm")}
              onClick={handleRepairNotes}
              confirmations={[
                {
                  text: t("repairNotesConfirm"),
                  className: "bg-danger",
                },
              ]}
            />
          </div>
        </div>
      )}
    </Section>
  );
}
