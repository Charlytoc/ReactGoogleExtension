import "./App.css";
import { Navbar } from "../../components/Navbar/Navbar";
import { Content } from "../../components/Content/Content";
import { useEffect } from "react";
import { ChromeStorageManager } from "../../managers/Storage";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

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
        "--bg-color",
        colorPreferences.backgroundColor
      );
    }
    if (lastPage) {
      navigate(lastPage);
    }
  };

  return (
    <>
      <Navbar />
      <Content />
    </>
  );
}

export default App;
