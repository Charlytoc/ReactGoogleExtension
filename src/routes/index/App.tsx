import "./App.css";
import { Navbar } from "../../components/Navbar/Navbar";
import { Content } from "../../components/Content/Content";
import { useEffect } from "react";
import { ChromeStorageManager } from "../../managers/Storage";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Section } from "../../components/Section/Section";

function App() {
  const { i18n } = useTranslation();
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

  const redirectToLastPage = async () => {
    const lastPage = await ChromeStorageManager.get("lastPage");
    const colorPreferences = await ChromeStorageManager.get("colorPreferences");
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
    }
    if (lastPage) {
      navigate(lastPage);
    }
  };

  return (
    <Section title="automata.ai">
      <Content />
    </Section>
  );
}

export default App;
