import { useLocation, useNavigate } from "react-router";
import { Tooltip, ActionIcon, Stack } from "@mantine/core";
import {
  IconHome,
  IconMessageCircle,
  IconNote,
  IconListCheck,
  IconBookmark,
  IconCode,
  IconCalendar,
  IconSettings,
} from "@tabler/icons-react";
import { cacheLocation } from "../../utils/lib";
import "./Sidebar.css";

type NavItem = {
  icon: React.ReactNode;
  label: string;
  path: string;
};

const topItems: NavItem[] = [
  { icon: <IconHome size={18} />, label: "Home", path: "/" },
  { icon: <IconMessageCircle size={18} />, label: "Chat", path: "/chat" },
  { icon: <IconNote size={18} />, label: "Notes", path: "/notes" },
  { icon: <IconListCheck size={18} />, label: "Tasks", path: "/tasks" },
  { icon: <IconBookmark size={18} />, label: "Bookmarks", path: "/snapties" },
  { icon: <IconCode size={18} />, label: "Formatters", path: "/formatters" },
  { icon: <IconCalendar size={18} />, label: "Calendar", path: "/calendar" },
];

const bottomItems: NavItem[] = [
  { icon: <IconSettings size={18} />, label: "Settings", path: "/config" },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") {
      return (
        location.pathname === "/" || location.pathname === "/index.html"
      );
    }
    return location.pathname.startsWith(path);
  };

  const go = (path: string) => {
    cacheLocation(path);
    navigate(path);
  };

  const renderItem = (item: NavItem) => (
    <Tooltip key={item.path} label={item.label} position="right" withArrow>
      <ActionIcon
        variant={isActive(item.path) ? "light" : "subtle"}
        color={isActive(item.path) ? "violet" : "gray"}
        size="lg"
        onClick={() => go(item.path)}
        aria-label={item.label}
      >
        {item.icon}
      </ActionIcon>
    </Tooltip>
  );

  return (
    <nav className="sidebar">
      <Stack gap={4} align="center">
        {topItems.map(renderItem)}
      </Stack>
      <Stack gap={4} align="center">
        {bottomItems.map(renderItem)}
      </Stack>
    </nav>
  );
};
