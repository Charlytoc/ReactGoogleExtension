import { Outlet } from "react-router";
import { Sidebar } from "../Sidebar/Sidebar";
import "./AppLayout.css";

export const AppLayout = () => {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout-content">
        <Outlet />
      </div>
    </div>
  );
};
