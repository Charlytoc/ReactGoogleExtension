import { createContext, useContext } from "react";

export type SidebarAction = {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  color?: string;
};

type SidebarActionsContextValue = {
  actions: SidebarAction[];
  setActions: (actions: SidebarAction[]) => void;
};

export const SidebarActionsContext =
  createContext<SidebarActionsContextValue | null>(null);

export const useSidebarActions = () => {
  const context = useContext(SidebarActionsContext);
  if (!context) {
    throw new Error("useSidebarActions must be used within AppLayout");
  }
  return context;
};
