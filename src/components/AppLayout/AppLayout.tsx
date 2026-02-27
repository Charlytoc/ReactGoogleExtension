import { Outlet } from "react-router";
import { Sidebar } from "../Sidebar/Sidebar";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";
import "./AppLayout.css";

export const AppLayout = () => {
  useKeyboardNav();

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  );
};
