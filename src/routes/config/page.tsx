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
    [
      {
        role: "system",
        content: prompt,
      },
    ],
    "gpt-4o-mini",
    apiKey,
    0.5,
    4000,
    "json_object"
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

  const [colors, setColors] = useState<{
    fontColor: string;
    backgroundColor: string;
    activeColor: string;
    fontColorSecondary: string;
    backgroundColorSecondary: string;
    themePreferences: string;
  }>({
    fontColor: "",
    backgroundColor: "",
    activeColor: "",
    fontColorSecondary: "",
    backgroundColorSecondary: "",
    themePreferences: "",
  });
  const navigate = useNavigate();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
    ChromeStorageManager.add("language", e.target.value);
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

  useEffect(() => {
    setColorsInDocument(colors);
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
          {/* <h3 className="text-left">{t("language")}</h3> */}
          <select
            className="padding-10 w-100  rounded bg-default"
            onChange={handleLanguageChange}
            defaultValue={i18n.language}
          >
            <option value="en">{t("english")}</option>
            <option value="es">{t("spanish")}</option>
          </select>
        </div>
        <div className="flex-column">
          {/* <h3 className="text-left">{t("openaiApiKey")}</h3> */}
          {/* <h3 className="text-left">{t("secrets")}</h3> */}
          <LabeledInput
            label={t("openaiApiKey")}
            type="text"
            name="openaiApiKey"
            value={apiKey}
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
        <Button
          className="  padding-10 justify-center active-on-hover"
          svg={SVGS.random}
          title={t("randomColors")}
          onClick={() => {
            generateRandomTheme(apiKey, colors.themePreferences).then(
              (colors) => {
                setColors((prev) => ({ ...prev, ...colors }));
              }
            );
          }}
        />
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
