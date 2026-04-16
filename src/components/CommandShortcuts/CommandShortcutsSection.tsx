import { useTranslation } from "react-i18next";
import { Button } from "../Button/Button";
import {
  DEFAULT_PROMPTS,
  EXTENSION_COMMAND_IDS,
  type ExtensionCommandId,
} from "../../commandPrompts";

const I18N_GROUP: Record<ExtensionCommandId, "autocomplete" | "translate" | "grammar"> = {
  "auto-complete": "autocomplete",
  "translate-selection": "translate",
  "check-grammar": "grammar",
};

type Props = {
  prompts: Record<ExtensionCommandId, string>;
  onPromptChange: (id: ExtensionCommandId, value: string) => void;
  onResetPrompt: (id: ExtensionCommandId) => void;
  /** When false, only intro + editors (page already has a main title). */
  showHeading?: boolean;
};

export function CommandShortcutsSection({
  prompts,
  onPromptChange,
  onResetPrompt,
  showHeading = true,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex-column gap-15 padding-10">
      <div className="flex-column gap-5">
        {showHeading ? (
          <h4 className="font-mono margin-0">{t("commandShortcuts.sectionTitle")}</h4>
        ) : null}
        <p className="text-left text-mini color-gray margin-0">
          {t("commandShortcuts.sectionIntro")}
        </p>
      </div>

      {EXTENSION_COMMAND_IDS.map((id) => {
        const g = I18N_GROUP[id];
        return (
          <div key={id} className="flex-column gap-8">
            <div className="flex-column gap-3">
              <strong className="text-left">{t(`commandShortcuts.${g}.title`)}</strong>
              <p className="text-left text-mini color-gray margin-0">
                {t(`commandShortcuts.${g}.shortcut`)}
              </p>
              <p className="text-left text-mini color-gray margin-0">
                {t(`commandShortcuts.${g}.body`)}
              </p>
            </div>
            <label className="text-left text-mini">{t("commandShortcuts.systemPromptLabel")}</label>
            <textarea
              className="w-100 font-mono"
              style={{ minHeight: id === "auto-complete" ? 200 : 120, resize: "vertical" }}
              value={prompts[id]}
              onChange={(e) => onPromptChange(id, e.target.value)}
              spellCheck={false}
            />
            <div className="flex-row gap-10">
              <Button
                className="padding-10 justify-center active-on-hover"
                text={t("commandShortcuts.resetToDefault")}
                onClick={() => onResetPrompt(id)}
              />
              {prompts[id].trim() === DEFAULT_PROMPTS[id].trim() ? null : (
                <span className="text-mini color-gray align-self-center">
                  {t("commandShortcuts.modifiedHint")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
