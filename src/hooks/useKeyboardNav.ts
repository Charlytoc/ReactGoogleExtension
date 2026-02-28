import { useEffect } from "react";
import { useNavigate } from "react-router";
import { cacheLocation } from "../utils/lib";

type TShortcut = {
  key: string;
  path: string;
  requireShift?: boolean;
};

const SHORTCUTS: TShortcut[] = [
  { key: "b", path: "/snapties" },
  { key: "m", path: "/chat" },
  { key: "n", path: "/notes" },
  { key: "f", path: "/formatters" },
  { key: "j", path: "/tasks" },
];

const matchesShortcut = (e: KeyboardEvent, shortcut: TShortcut) => {
  const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
  if (!keyMatches) return false;
  if (Boolean(shortcut.requireShift) !== e.shiftKey) return false;
  return true;
};

export const useKeyboardNav = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Use explicit shortcuts (Ctrl/Cmd + key) so typing in inputs never
      // accidentally triggers navigation.
      const hasMainModifier = e.ctrlKey || e.metaKey;
      if (!hasMainModifier || e.altKey) return;

      const shortcut = SHORTCUTS.find((s) => matchesShortcut(e, s));
      if (!shortcut) return;

      e.preventDefault();
      e.stopPropagation();
      cacheLocation(shortcut.path);
      navigate(shortcut.path);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
};
