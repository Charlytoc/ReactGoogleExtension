import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button/Button";
import { useNavigate } from "react-router";
import { SVGS } from "../../assets/svgs.tsx";
import { ChromeStorageManager } from "../../managers/Storage.ts";
import { saveLastPage } from "../../utils/lib.ts";
import { useEffect, useState } from "react";
import { LabeledInput } from "../../components/LabeledInput/LabeledInput.tsx";

export default function Config() {
  const { i18n, t } = useTranslation();
  const [apiKey, setApiKey] = useState<string>("");

  const [colors, setColors] = useState<{
    fontColor: string;
    backgroundColor: string;
    activeColor: string;
  }>({
    fontColor: "",
    backgroundColor: "",
    activeColor: "",
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
      console.log(colorPreferences);
      setColors(colorPreferences);
    }
  };

  return (
    <div className="padding-10 flex-column gap-10">
      <h3 className="flex-row gap-10 justify-between">
        <Button
          svg={SVGS.back}
          onClick={() => {
            saveLastPage("/index.html");
            navigate("/index.html");
          }}
          className="padding-5 active-on-hover"
        />
        {t("settings")}
      </h3>
      <div className="flex-column gap-10">
        <h3 className="text-left">{t("language")}</h3>
        <select
          className="padding-10 w-100 bg-default rounded"
          onChange={handleLanguageChange}
          defaultValue={i18n.language}
        >
          <option value="en">{t("english")}</option>
          <option value="es">{t("spanish")}</option>
        </select>
      </div>
      <div className="flex-column gap-10">
        {/* <h3 className="text-left">{t("openaiApiKey")}</h3> */}
        <h3 className="text-left">{t("secrets")}</h3>
        <LabeledInput
          label={t("openaiApiKey")}
          type="text"
          name="openaiApiKey"
          value={apiKey}
          onChange={(value) => setApiKey(value)}
        />
      </div>
      <h3 className="text-left">{t("colors")}</h3>
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
          <span className="text-left">{t("background")}</span>
          <input
            type="color"
            name="backgroundColor"
            value={colors.backgroundColor ? colors.backgroundColor : "#000000"}
            onChange={(e) =>
              setColors({ ...colors, backgroundColor: e.target.value })
            }
          />
        </div>
      </div>
      <Button
        className="w-100 bg-default border-gray padding-10"
        text={t("saveAndApply")}
        onClick={() => {
          ChromeStorageManager.add("colorPreferences", colors);
          document.documentElement.style.setProperty(
            "--active-color",
            colors.activeColor
          );
          document.documentElement.style.setProperty(
            "--font-color",
            colors.fontColor
          );
          document.documentElement.style.setProperty(
            "--bg-color",
            colors.backgroundColor
          );
        }}
      />
    </div>
  );
}
