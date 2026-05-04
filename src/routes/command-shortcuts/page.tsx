import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "../../components/Section/Section.tsx";
import { CommandShortcutsSection } from "../../components/CommandShortcuts/CommandShortcutsSection.tsx";
import { ChromeStorageManager } from "../../managers/Storage.ts";
import {
  COMMAND_PROMPT_STORAGE_KEY,
  DEFAULT_PROMPTS,
  EXTENSION_COMMAND_IDS,
  type ExtensionCommandId,
} from "../../commandPrompts";
import { Button } from "../../components/Button/Button.tsx";
import { SVGS } from "../../assets/svgs.tsx";
import toast from "react-hot-toast";

export default function CommandShortcutsPage() {
  const { t } = useTranslation();
  const [commandPrompts, setCommandPrompts] = useState<
    Record<ExtensionCommandId, string>
  >(() => ({ ...DEFAULT_PROMPTS }));

  useEffect(() => {
    void (async () => {
      const overrides = (await ChromeStorageManager.get(
        COMMAND_PROMPT_STORAGE_KEY
      )) as Partial<Record<ExtensionCommandId, string>> | undefined;
      const merged = { ...DEFAULT_PROMPTS };
      for (const id of EXTENSION_COMMAND_IDS) {
        const custom = overrides?.[id];
        if (typeof custom === "string" && custom.trim()) {
          merged[id] = custom;
        }
      }
      setCommandPrompts(merged);
    })();
  }, []);

  const savePrompts = async () => {
    const nextOverrides: Partial<Record<ExtensionCommandId, string>> = {};
    for (const id of EXTENSION_COMMAND_IDS) {
      if (commandPrompts[id].trim() !== DEFAULT_PROMPTS[id].trim()) {
        nextOverrides[id] = commandPrompts[id].trim();
      }
    }
    if (Object.keys(nextOverrides).length === 0) {
      await ChromeStorageManager.delete(COMMAND_PROMPT_STORAGE_KEY);
    } else {
      await ChromeStorageManager.add(
        COMMAND_PROMPT_STORAGE_KEY,
        nextOverrides
      );
    }
    toast.success(t("commandShortcuts.saved"));
  };

  return (
    <Section
      className="bg-gradient"
      headerLeft={
        <h3 className="font-mono">{t("commandShortcuts.pageTitle")}</h3>
      }
    >
      <div className="command-shortcuts-layout">
        <CommandShortcutsSection
          showHeading={false}
          prompts={commandPrompts}
          onPromptChange={(id, value) =>
            setCommandPrompts((prev) => ({ ...prev, [id]: value }))
          }
          onResetPrompt={(id) =>
            setCommandPrompts((prev) => ({ ...prev, [id]: DEFAULT_PROMPTS[id] }))
          }
        />
        <div className="command-shortcuts-layout__footer">
          <Button
            className="w-100 padding-10 justify-center active-on-hover"
            text={t("save")}
            svg={SVGS.save}
            onClick={() => void savePrompts()}
          />
        </div>
      </div>
    </Section>
  );
}
