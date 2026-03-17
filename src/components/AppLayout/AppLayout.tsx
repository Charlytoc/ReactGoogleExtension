import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "../Sidebar/Sidebar";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import {
  SidebarAction,
  SidebarActionsContext,
} from "./SidebarActionsContext";
import { useStore } from "../../managers/store";
import { ChromeStorageManager } from "../../managers/Storage";
import "./AppLayout.css";

export const AppLayout = () => {
  useKeyboardNav();
  const [sidebarActions, setSidebarActions] = useState<SidebarAction[]>([]);
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
    <SidebarActionsContext.Provider
      value={{ actions: sidebarActions, setActions: setSidebarActions }}
    >
      <div className="app-layout">
        <Sidebar actions={sidebarActions} />
        <div className="app-layout-content">
          <Outlet />
        </div>
      </div>
    </SidebarActionsContext.Provider>
  );
};
