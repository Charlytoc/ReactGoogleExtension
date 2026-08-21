import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button/Button";
import { SVGS } from "../../assets/svgs.tsx";
import { ChromeStorageManager } from "../../managers/Storage.ts";
import { useEffect, useRef, useState } from "react";
import { LabeledInput } from "../../components/LabeledInput/LabeledInput.tsx";
import { Section } from "../../components/Section/Section.tsx";
import toast from "react-hot-toast";
import { createCompletion, listModels } from "../../utils/ai.ts";
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

  const response = await createCompletion(
    {
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
    },
    (completion) => {
      console.log(completion, "completion finished successfully");
    }
  );
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

export default function Config() {
  const { i18n, t } = useTranslation();
  const [apiKey, setApiKey] = useState<string>("");
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [colors, setColors] = useState<TTheme>(DEFAULT_THEME);
  const [notesAssistantModel, setNotesAssistantModel] = useState<TModel>(
    () => createDefaultAiConfig().notesAssistantModel!
  );
  const [formatterModel, setFormatterModel] = useState<TModel>(
    () => createDefaultAiConfig().formatterModel!
  );
  const [availableModels, setAvailableModels] = useState<TModel[]>([]);

  const [cloudUser, setCloudUser] = useState<TCloudUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const setConfig = useStore(useShallow((state) => state.setConfig));

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    ChromeStorageManager.add("language", value);
  };

  useEffect(() => {
    getStored();
  }, []);

  const getStored = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    setApiKey(apiKey ?? "");
    const colorPreferences = await ChromeStorageManager.get("colorPreferences");
    if (colorPreferences && typeof colorPreferences === "object") {
      setColors(mergeStoredTheme(colorPreferences as Partial<TTheme>));
    }

    const aiConfig = await getAiConfig();
    if (aiConfig.notesAssistantModel) {
      setNotesAssistantModel(aiConfig.notesAssistantModel);
    }
    if (aiConfig.formatterModel) {
      setFormatterModel(aiConfig.formatterModel);
    }

    if (apiKey) {
      try {
        const models = await listModels(apiKey as string);
        setAvailableModels(models);
      } catch {
        setAvailableModels([]);
      }
    }

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

  useEffect(() => {
    setColorsInDocument(colors);
    setConfig({
      theme: colors,
    });
  }, [colors]);

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("settings")}</h3>}
    >
      <div className="flex-column gap-10">
        <div className="flex-column ">
          <Select
            name="language"
            options={[
              { label: t("english"), value: "en" },
              { label: t("spanish"), value: "es" },
            ]}
            onChange={(value) => handleLanguageChange(value)}
            defaultValue={i18n.language}
          />
        </div>
        <div className="flex-column">
          <LabeledInput
            label={t("openaiApiKey")}
            type="text"
            name="openaiApiKey"
            className="w-100"
            value={apiKey}
            // TODO: IMPLEMENT IN THE FUTURE
            // validator={() => {
            //   if (apiKey.length < 10) {
            //     return false;
            //   }
            //   return true;
            // }}
            onChange={(value) => setApiKey(value)}
          />
        </div>
        <div className="flex-column gap-5">
            <label className="color-secondary text-left" htmlFor="notesAssistantModel">
              {t("notesAssistantModel")}
            </label>
            <span className="color-secondary text-left text-sm">
              {t("notesAssistantModelDescription")}
            </span>
            <Select
              name="notesAssistantModel"
              id="notesAssistantModel"
              options={
                availableModels.length > 0
                  ? availableModels.map((m) => ({ label: m.name, value: m.slug }))
                  : [
                      {
                        label: notesAssistantModel.name,
                        value: notesAssistantModel.slug,
                      },
                    ]
              }
              defaultValue={notesAssistantModel.slug}
              onChange={(value) => {
                const model = availableModels.find((m) => m.slug === value);
                setNotesAssistantModel(model ?? modelFromSlug(value));
              }}
            />
          </div>
        <div className="flex-column gap-5">
            <label className="color-secondary text-left" htmlFor="formatterModel">
              {t("formatterModel")}
            </label>
            <span className="color-secondary text-left text-sm">
              {t("formatterModelDescription")}
            </span>
            <Select
              name="formatterModel"
              id="formatterModel"
              options={
                availableModels.length > 0
                  ? availableModels.map((m) => ({ label: m.name, value: m.slug }))
                  : [
                      {
                        label: formatterModel.name,
                        value: formatterModel.slug,
                      },
                    ]
              }
              defaultValue={formatterModel.slug}
              onChange={(value) => {
                const model = availableModels.find((m) => m.slug === value);
                setFormatterModel(model ?? modelFromSlug(value));
              }}
            />
          </div>
        <div className="flex-column gap-10">
          {/* <h3 className="text-left">{t("colors")}</h3> */}
          <div className="flex-row gap-10 justify-between wrap">
            <div className="flex-column gap-10 align-center justify-center">
              <span className="text-left">{t("active")}</span>
              <input
                type="color"
                name="activeColor"
                value={colors.activeColor ? colors.activeColor : "#000000"}
                onChange={(e) =>
                  setColors({ ...colors, activeColor: e.target.value })
                }
              />
            </div>
            <div className="flex-column gap-10 align-center justify-center">
              <span className="text-left">{t("font")}</span>
              <input
                type="color"
                name="fontColor"
                value={colors.fontColor ? colors.fontColor : "#000000"}
                onChange={(e) =>
                  setColors({ ...colors, fontColor: e.target.value })
                }
              />
            </div>
            <div className="flex-column gap-10 align-center justify-center">
              <span className="text-left">{t("font-secondary")}</span>
              <input
                type="color"
                name="fontColorSecondary"
                value={
                  colors.fontColorSecondary
                    ? colors.fontColorSecondary
                    : "#000000"
                }
                onChange={(e) => {
                  setColors({ ...colors, fontColorSecondary: e.target.value });
                }}
              />
            </div>
            <div className="flex-column gap-10 align-center justify-center">
              <span className="text-left">{t("font-tertiary")}</span>
              <input
                type="color"
                name="fontColorTertiary"
                value={
                  colors.fontColorTertiary
                    ? colors.fontColorTertiary
                    : "#000000"
                }
                onChange={(e) =>
                  setColors({ ...colors, fontColorTertiary: e.target.value })
                }
              />
            </div>

            <div className="flex-column gap-10 align-center justify-center">
              <span className="text-left">{t("background")}</span>
              <input
                type="color"
                name="backgroundColor"
                value={
                  colors.backgroundColor ? colors.backgroundColor : "#000000"
                }
                onChange={(e) =>
                  setColors({ ...colors, backgroundColor: e.target.value })
                }
              />
            </div>

            <div className="flex-column gap-10 align-center justify-center">
              <span className="text-left">{t("background")}</span>
              <input
                type="color"
                name="backgroundColorSecondary"
                value={
                  colors.backgroundColorSecondary
                    ? colors.backgroundColorSecondary
                    : "#000000"
                }
                onChange={(e) =>
                  setColors({
                    ...colors,
                    backgroundColorSecondary: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-row gap-10 padding-10 justify-between">
        <LabeledInput
          label={t("themePreferences")}
          type="text"
          placeholder={t("themePreferencesPlaceholder")}
          name="themePreferences"
          value={colors.themePreferences}
          onChange={(value) =>
            setColors({ ...colors, themePreferences: value })
          }
        />
        <div className="flex-row gap-10">
          <Button
            // usesAI={true}
            className="  padding-10 justify-center active-on-hover"
            svg={SVGS.generate}
            title={t("generateColorDescription")}
            onClick={() => {
              generateRandomTheme(apiKey, colors.themePreferences).then(
                (colors) => {
                  setColors((prev) => ({ ...prev, ...colors }));
                }
              );
            }}
          />
          <Button
            className="  padding-10 justify-center active-on-hover"
            svg={SVGS.paste}
            title={t("pasteColorsToClipboard")}
            onClick={() => {
              pasteColorsToClipboard();
            }}
          />
        </div>
      </div>

      <div className="flex-column gap-10 padding-10">
        <h3 className="text-left">{t("backupAndRestore")}</h3>
        <span className="color-secondary text-left text-sm">
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

      <div className="flex-column gap-10 padding-10">
        <h3 className="text-left">{t("supabaseConfig")}</h3>
        <span className="color-secondary text-left text-sm">
          {t("supabaseConfigDescription")}
        </span>

        {isSupabaseConfigured() ? (
          <div className="flex-column gap-10">
            {cloudUser ? (
              <>
                <span className="text-left text-sm">
                  {t("signedInAs", { email: cloudUser.email ?? cloudUser.id })}
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
                    <span className="text-left text-sm color-secondary">
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
          <span className="text-left text-sm color-secondary">
            {t("supabaseNotConfigured")}
          </span>
        )}
      </div>

      <Button
        className="w-100  padding-10 justify-center active-on-hover"
        text={t("saveAndApply")}
        svg={SVGS.save}
        onClick={async () => {
          await ChromeStorageManager.add("colorPreferences", colors);
          await ChromeStorageManager.add("openaiApiKey", apiKey);
          await saveAiConfig({ notesAssistantModel, formatterModel });
          setConfig({ auth: { openaiApiKey: apiKey } });
          toast.success(t("settingsSaved"));
        }}
      />
    </Section>
  );
}
