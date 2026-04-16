import { useEffect } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "../Sidebar/Sidebar";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import { useStore } from "../../managers/store";
import { ChromeStorageManager } from "../../managers/Storage";
import "./AppLayout.css";

export const AppLayout = () => {
  useKeyboardNav();
  const setConfig = useStore((state) => state.setConfig);

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
