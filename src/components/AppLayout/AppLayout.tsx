import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { Sidebar } from "../Sidebar/Sidebar";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import { useStore } from "../../managers/store";
import { ChromeStorageManager } from "../../managers/Storage";
import "./AppLayout.css";

export const AppLayout = () => {
  useKeyboardNav();
  const navigate = useNavigate();
  const setConfig = useStore((state) => state.setConfig);

  useEffect(() => {
    const { hash } = window.location;
    if (hash.length > 2 && hash.startsWith("#/")) {
      const target = decodeURIComponent(hash.slice(1));
      if (target.startsWith("/")) {
        navigate(target, { replace: true });
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`
        );
      }
    }
  }, [navigate]);

  useEffect(() => {
    const hydrateAuthFromStorage = async () => {
      const openaiApiKey = await ChromeStorageManager.get("openaiApiKey");
      if (openaiApiKey) {
        setConfig({ auth: { openaiApiKey } });
      }
    };
    void hydrateAuthFromStorage();
  }, [setConfig]);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  );
};
