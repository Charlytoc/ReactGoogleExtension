import "./App.css";

import { Content } from "../../components/Content/Content";
import { useEffect } from "react";
import { ChromeStorageManager } from "../../managers/Storage";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useStore } from "../../managers/store";
import { useShallow } from "zustand/shallow";
import { TTheme } from "../../managers/storeTypes";
import { Section } from "../../components/Section/Section";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconSettings } from "@tabler/icons-react";
import { cacheLocation } from "../../utils/lib";

function App() {
  const { t, i18n } = useTranslation();

  const setConfig = useStore(useShallow((state) => state.setConfig));
  const navigate = useNavigate();
  useEffect(() => {
    redirectToLastPage();
    setSelectedLanguage();
  }, []);

  const setSelectedLanguage = async () => {
    const language = await ChromeStorageManager.get("language");
    if (language) {
      i18n.changeLanguage(language);
    }
  };

  const setStoredTheme = async () => {
    const colorPreferences: TTheme = await ChromeStorageManager.get(
      "colorPreferences"
    );
    const openaiApiKey = await ChromeStorageManager.get("openaiApiKey");
    if (colorPreferences) {
      document.documentElement.style.setProperty(
        "--active-color",
        colorPreferences.activeColor
      );
      document.documentElement.style.setProperty(
        "--font-color",
        colorPreferences.fontColor
      );
      document.documentElement.style.setProperty(
        "--font-color-secondary",
        colorPreferences.fontColorSecondary
      );
      document.documentElement.style.setProperty(
        "--bg-color",
        colorPreferences.backgroundColor
      );
      document.documentElement.style.setProperty(
        "--bg-color-secondary",
        colorPreferences.backgroundColorSecondary
      );
      setConfig({
        theme: colorPreferences,
        auth: {
          openaiApiKey,
        },
      });
    }
  };

  const redirectToLastPage = async () => {
    const lastPage = await ChromeStorageManager.get("lastPage");
    await setStoredTheme();

    if (lastPage) {
      navigate(lastPage);
    }
  };
  const goToSettings = () => {
    cacheLocation("/config");
    navigate("/config");
  };

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">automata.ai</h3>}
      headerRight={
        <Tooltip label={t("config")} position="left" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={goToSettings}
          >
            <IconSettings size={20} />
          </ActionIcon>
        </Tooltip>
      }
    >
      <Content />
    </Section>
  );
}

export default App;
