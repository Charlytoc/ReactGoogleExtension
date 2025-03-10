import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button/Button";
import { useNavigate } from "react-router";
import { SVGS } from "../../assets/svgs.tsx";
import { ChromeStorageManager } from "../../managers/Storage.ts";
import { cacheLocation } from "../../utils/lib.ts";
import { useEffect, useState } from "react";
import { LabeledInput } from "../../components/LabeledInput/LabeledInput.tsx";
import { Section } from "../../components/Section/Section.tsx";
import toast from "react-hot-toast";
import { createCompletion } from "../../utils/ai.ts";
import { useShallow } from "zustand/shallow";
import { useStore } from "../../managers/store.ts";
import { TTheme } from "../../managers/storeTypes.ts";
import { Select } from "../../components/Select/Select.tsx";

const generateRandomTheme = async (
  apiKey: string,
  userPreferences: string = ""
) => {
  const prompt = `You are tasked to create a set of colors for a website.
  The colors should be random and should be in the HSL format.
  The colors should be in the following format:
  {
    fontColor: string;
    backgroundColor: string;
    activeColor: string;
    fontColorSecondary: string;
    backgroundColorSecondary: string;
  }
    
  All the colors should be in #RRGGBB format.

  Keep in mind: 
  The font color should be readable over the background color.
  The font color secondary will be use for less important texts.
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
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.8,
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
  const colors = JSON.parse(response);

  return colors;
};

type TColors = {
  fontColor: string;
  backgroundColor: string;
  activeColor: string;
  fontColorSecondary: string;
  backgroundColorSecondary: string;
};

const setColorsInDocument = (colors: TColors) => {
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

  const [colors, setColors] = useState<TTheme>({
    fontColor: "",
    backgroundColor: "",
    activeColor: "",
    fontColorSecondary: "",
    backgroundColorSecondary: "",
    themePreferences: "",
  });

  const setConfig = useStore(useShallow((state) => state.setConfig));
  const navigate = useNavigate();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    ChromeStorageManager.add("language", value);
  };

  useEffect(() => {
    getStored();
  }, []);

  const getStored = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    setApiKey(apiKey);
    const colorPreferences = await ChromeStorageManager.get("colorPreferences");
    if (colorPreferences) {
      setColors(colorPreferences);
    }
  };

  const pasteColorsToClipboard = () => {
    navigator.clipboard.writeText(
      `--active-color: ${colors.activeColor};
--font-color: ${colors.fontColor};
--font-color-secondary: ${colors.fontColorSecondary};
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
      title={t("settings")}
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
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
        <div className="flex-column gap-10">
          {/* <h3 className="text-left">{t("colors")}</h3> */}
          <div className="flex-row gap-10 justify-between">
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

      <Button
        className="w-100  padding-10 justify-center active-on-hover"
        text={t("saveAndApply")}
        svg={SVGS.save}
        onClick={() => {
          ChromeStorageManager.add("colorPreferences", colors);
          toast.success(t("settingsSaved"));
        }}
      />
    </Section>
  );
}
