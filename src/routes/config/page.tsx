import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button/Button";
import { useNavigate } from "react-router";
import { SVGS } from "../../assets/svgs.tsx";
import { ChromeStorageManager } from "../../managers/Storage.ts";
import { saveLastPage } from "../../utils/lib.ts";
import { useEffect, useState } from "react";

export default function Config() {
  const { i18n, t } = useTranslation();
  const [apiKey, setApiKey] = useState<string>("");
  const navigate = useNavigate();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
    ChromeStorageManager.add("language", e.target.value);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    ChromeStorageManager.add("openaiApiKey", e.target.value);
  };

  useEffect(() => {
    getStored();
  }, []);

  const getStored = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    setApiKey(apiKey);
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
        <h3 className="text-left">{t("openaiApiKey")}</h3>
        <input
          defaultValue={apiKey}
          className="padding-10 w-100 bg-default rounded"
          onChange={handleApiKeyChange}
        />
      </div>
    </div>
  );
}
