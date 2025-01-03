import "./App.css";
import { Navbar } from "../../components/Navbar/Navbar";
import { Content } from "../../components/Content/Content";
import { useEffect } from "react";
import { ChromeStorageManager } from "../../managers/Storage";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Chat } from "../../components/Chat/Chat";

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
    console.log(lastPage, "REDIRECT");
    if (lastPage) {
      navigate(lastPage);
    }
  };

  return (
    <>
      <Navbar />
      <Content />
      <Chat />
    </>
  );
}

export default App;
