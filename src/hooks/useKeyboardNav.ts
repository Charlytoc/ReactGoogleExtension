import { useEffect } from "react";
import { useNavigate } from "react-router";
import { cacheLocation } from "../utils/lib";

const KEY_MAP: Record<string, string> = {
  b: "/snapties",
  c: "/chat",
  n: "/notes",
  f: "/formatters",
  t: "/tasks",
};

const isEditableTarget = (el: Element | null): boolean => {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
};

export const useKeyboardNav = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isEditableTarget(document.activeElement)) return;

      const path = KEY_MAP[e.key.toLowerCase()];
      if (!path) return;

      cacheLocation(path);
      navigate(path);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);
};
