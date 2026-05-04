import { useTranslation } from "react-i18next";
import { Button } from "../Button/Button";
import {
  DEFAULT_PROMPTS,
  EXTENSION_COMMAND_IDS,
  type ExtensionCommandId,
} from "../../commandPrompts";
import "./CommandShortcutsSection.css";

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
    <div className="command-shortcuts">
      {showHeading ? (
        <h4 className="font-mono margin-0">{t("commandShortcuts.sectionTitle")}</h4>
      ) : null}
      <p className="command-shortcuts__intro">{t("commandShortcuts.sectionIntro")}</p>

      {EXTENSION_COMMAND_IDS.map((id) => {
        const g = I18N_GROUP[id];
        const fieldId = `command-prompt-${id}`;
        return (
          <section key={id} className="command-shortcuts-card" aria-labelledby={`${fieldId}-title`}>
            <header className="command-shortcuts-card__header">
              <h4 id={`${fieldId}-title`} className="command-shortcuts-card__title font-mono">
                {t(`commandShortcuts.${g}.title`)}
              </h4>
              <span className="command-shortcuts-card__shortcut">
                {t(`commandShortcuts.${g}.shortcut`)}
              </span>
              <p className="command-shortcuts-card__body">{t(`commandShortcuts.${g}.body`)}</p>
            </header>

            <div className="command-shortcuts-field">
              <label className="command-shortcuts-field__label" htmlFor={fieldId}>
                {t("commandShortcuts.systemPromptLabel")}
              </label>
              <textarea
                id={fieldId}
                className="command-shortcuts-field__input font-mono"
                style={{ minHeight: id === "auto-complete" ? 200 : 120 }}
                value={prompts[id]}
                onChange={(e) => onPromptChange(id, e.target.value)}
                spellCheck={false}
              />
            </div>

            <footer className="command-shortcuts-card__footer">
              <Button
                className="padding-10 justify-center active-on-hover"
                text={t("commandShortcuts.resetToDefault")}
                onClick={() => onResetPrompt(id)}
              />
              {prompts[id].trim() === DEFAULT_PROMPTS[id].trim() ? null : (
                <span className="command-shortcuts-card__hint">{t("commandShortcuts.modifiedHint")}</span>
              )}
            </footer>
          </section>
        );
      })}
    </div>
  );
}
