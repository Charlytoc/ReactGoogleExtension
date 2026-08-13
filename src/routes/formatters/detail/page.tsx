import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { Section } from "../../../components/Section/Section";
import { Button } from "../../../components/Button/Button";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";
import { Textarea } from "../../../components/Textarea/Textarea";
import { TagsField } from "../../../components/TagsField/TagsField";
import {
  collectAllTags,
  migrateFormatter,
  migrateSnaptie,
  migrateTask,
} from "../../../utils/tags";
import {
  extractVariables,
  fillVariables,
  formatterInputsFromPrompt,
} from "../../../utils/promptVariables";
import { SVGS } from "../../../assets/svgs";
import { ChromeStorageManager } from "../../../managers/Storage";
import { createCompletion } from "../../../utils/ai";
import { getFormatterModelSlug } from "../../../utils/aiConfigStorage";
import { useStore } from "../../../managers/store";
import { useShallow } from "zustand/shallow";
import { TFormatter, TFormatterInput } from "../../../types";

const lastValuesFromInputs = (
  variables: string[],
  inputs: TFormatterInput[]
): Record<string, string> => {
  const prevByName = new Map<string, string>();
  for (const input of inputs) {
    if (typeof input.lastValue !== "string") continue;
    if (input.id) prevByName.set(input.id, input.lastValue);
    if (input.label) prevByName.set(input.label, input.lastValue);
  }
  const initialValues: Record<string, string> = {};
  for (const name of variables) {
    initialValues[name] = prevByName.get(name) ?? "";
  }
  return initialValues;
};

export default function FormatterDetail() {
  const isLoaded = useRef(false);
  const [formatter, setFormatter] = useState<TFormatter | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"run" | "edit">("run");
  const [shouldAutoRun, setShouldAutoRun] = useState(false);

  const { t } = useTranslation();
  const { id } = useParams();
  const auth = useStore(useShallow((state) => state.config.auth));

  const variables = formatter ? extractVariables(formatter.prompt) : [];

  useEffect(() => {
    isLoaded.current = false;
    getFormatter();
  }, [id]);

  useEffect(() => {
    if (formatter) {
      persistFormatter();
    }
  }, [formatter]);

  const getFormatter = async () => {
    const [notes, tasks, snaptiesRaw, formattersRaw] = await Promise.all([
      ChromeStorageManager.get("notes"),
      ChromeStorageManager.get("tasks"),
      ChromeStorageManager.get("snapties"),
      ChromeStorageManager.get("formatters"),
    ]);

    const formatters: TFormatter[] = Array.isArray(formattersRaw)
      ? formattersRaw.map(migrateFormatter)
      : [];
    const current = formatters.find((f) => f.id === id) || null;
    setFormatter(current);
    setMode(current && current.prompt.trim() ? "run" : "edit");
    if (current) {
      isLoaded.current = true;
    }

    const snapties = Array.isArray(snaptiesRaw)
      ? snaptiesRaw.map(migrateSnaptie)
      : [];
    setTagSuggestions(
      collectAllTags({
        notes: Array.isArray(notes) ? notes : [],
        tasks: Array.isArray(tasks) ? tasks.map(migrateTask) : [],
        snapties,
        formatters,
      })
    );

    if (current) {
      setInputValues(
        lastValuesFromInputs(extractVariables(current.prompt), current.inputs)
      );
    }
  };

  const persistFormatter = async () => {
    if (!isLoaded.current) return;
    if (!formatter) return;

    const prevRaw = await ChromeStorageManager.get("formatters");
    const prev: TFormatter[] = Array.isArray(prevRaw)
      ? prevRaw.map(migrateFormatter)
      : [];
    const toSave: TFormatter = {
      ...formatter,
      inputs: formatterInputsFromPrompt(formatter.prompt, formatter.inputs),
      updatedAt: new Date().toISOString(),
    };
    const updated: TFormatter[] = prev.map((f) =>
      f.id === formatter.id ? toSave : f
    );

    await ChromeStorageManager.add("formatters", updated);
  };

  const updatePrompt = (value: string) => {
    if (!formatter) return;
    const nextInputs = formatterInputsFromPrompt(value, formatter.inputs);
    setFormatter({ ...formatter, prompt: value, inputs: nextInputs });
    setInputValues((prev) => {
      const next: Record<string, string> = {};
      for (const input of nextInputs) {
        next[input.id] =
          prev[input.id] ??
          (typeof input.lastValue === "string" ? input.lastValue : "");
      }
      return next;
    });
  };

  const runFormatter = async () => {
    if (!formatter) return;

    if (!auth.openaiApiKey) {
      setRunError(
        "Please add your OpenAI API key in the Config page before running a formatter."
      );
      setRunResult(null);
      return;
    }

    setRunError(null);
    setRunResult(null);
    setIsRunning(true);

    const promptText =
      fillVariables(formatter.prompt, inputValues) ||
      "Format the text based on the inputs. Always return a single string.";

    const systemPrompt =
      "You are a strict string formatter. You receive instructions and concrete input values. You MUST answer with a single formatted string only, with no explanations, quotes, or markdown.";

    try {
      const model = await getFormatterModelSlug();
      const content = await createCompletion(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText },
          ],
          model,
          apiKey: auth.openaiApiKey,
          max_completion_tokens: 256,
          response_format: { type: "text" },
        },
        () => {}
      );

      if (!content) {
        setRunError("Empty response from AI.");
      } else {
        setRunResult(content);

        try {
          await navigator.clipboard.writeText(content);
          toast.success("Result copied to clipboard");
        } catch (error) {
          console.error("Error copying result to clipboard", error);
        }

        try {
          const updatedInputs: TFormatterInput[] = formatterInputsFromPrompt(
            formatter.prompt,
            formatter.inputs
          ).map((input) => ({
            ...input,
            lastValue: inputValues[input.id] ?? "",
          }));

          const updatedFormatter: TFormatter = {
            ...formatter,
            inputs: updatedInputs,
            updatedAt: new Date().toISOString(),
          };

          setFormatter(updatedFormatter);
        } catch (error) {
          console.error("Error saving formatter with last values", error);
        }
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (mode !== "run") return;
    if (!shouldAutoRun) return;
    if (!formatter) return;

    const vars = extractVariables(formatter.prompt);
    if (vars.length === 0) return;

    const allFilled = vars.every(
      (name) => (inputValues[name] ?? "").trim() !== ""
    );

    if (!allFilled) return;

    setShouldAutoRun(false);
    void runFormatter();
  }, [shouldAutoRun, formatter, inputValues, mode]);

  const firstPendingIndex =
    variables.length > 0
      ? variables.findIndex((name) => (inputValues[name] ?? "").trim() === "")
      : -1;

  return (
    <Section
      className="bg-gradient"
      headerLeft={
        <h3 className="font-mono">
          {formatter?.title?.trim() ||
            (mode === "edit" ? t("edit") : "Untitled")}
        </h3>
      }
      headerRight={
        <Button
          onClick={() =>
            setMode((prev) => (prev === "run" ? "edit" : "run"))
          }
          text={mode === "run" ? t("edit") : "Run"}
          className="w-auto padding-5 justify-center"
          svg={mode === "run" ? SVGS.edit : SVGS.play}
        />
      }
    >
      <div className="padding-10 rounded-10">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex-column gap-10 formatter-form"
        >
          {mode === "edit" && (
            <>
              <LabeledInput
                name="title"
                label={t("title")}
                type="text"
                value={formatter?.title || ""}
                onChange={(value) => {
                  if (!formatter) return;
                  setFormatter({ ...formatter, title: value });
                }}
              />

              <div className="flex-column gap-5">
                <h4 className="font-mono">{t("content")}</h4>
                <p className="text-sm text-gray-400">
                  {t("formatterPromptHelp", {
                    example: "{{name}}",
                  })}
                </p>

                <div className="formatter-function-container">
                  <pre className="formatter-function-header">
{`Prompt for ${formatter?.title || "Formatter"}`}
                  </pre>
                  <Textarea
                    key={formatter?.id ?? "new-formatter"}
                    name="prompt"
                    maxHeight="40vh"
                    placeholder={t("formatterPromptPlaceholder", {
                      example: "{{name}}",
                    })}
                    defaultValue={formatter?.prompt || ""}
                    onChange={updatePrompt}
                  />
                  <pre className="formatter-function-footer"></pre>
                </div>

                {variables.length > 0 && (
                  <p className="text-mini color-gray">
                    {t("detectedVariables")}:{" "}
                    {variables.map((v) => (
                      <span key={v} className="tag" style={{ marginRight: 4 }}>
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </p>
                )}
              </div>

              {formatter && (
                <TagsField
                  label={t("tags")}
                  value={formatter.tags ?? []}
                  onChange={(tags) => setFormatter({ ...formatter, tags })}
                  suggestions={tagSuggestions}
                  hint={t("tags-comma-hint")}
                />
              )}

              <div className="flex-row gap-10 align-center">
                <span className="color-label">{t("color")}</span>
                <input
                  type="color"
                  name="color"
                  value={formatter?.color || "#09090d"}
                  onChange={(e) => {
                    if (!formatter) return;
                    setFormatter({ ...formatter, color: e.target.value });
                  }}
                  className="color-input"
                />
              </div>
            </>
          )}

          {mode === "run" && (
          <div className="flex-column gap-5">
            <h4 className="font-mono">
              {formatter?.title?.trim() || "Untitled"}
            </h4>
            <p className="text-sm text-gray-400">
              {variables.length === 0
                ? t("formatterRunNoVariables")
                : t("formatterRunHelp")}
            </p>

            {variables.length > 0 && (
              <div className="flex-column gap-5">
                {variables.map((name, index) => (
                  <LabeledInput
                    key={name}
                    name={`run-${name}`}
                    label={name}
                    type="text"
                    value={inputValues[name] ?? ""}
                    onChange={(value) => {
                      setInputValues((prev) => ({
                        ...prev,
                        [name]: value,
                      }));
                    }}
                    autoFocus={
                      firstPendingIndex === -1
                        ? index === 0
                        : index === firstPendingIndex
                    }
                    onPaste={
                      index === variables.length - 1
                        ? () => {
                            setShouldAutoRun(true);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            )}

            <div className="flex-row gap-5 align-center">
              <Button
                className="padding-5 w-auto justify-center"
                svg={SVGS.play}
                text={isRunning ? t("generating") : t("execute")}
                onClick={runFormatter}
              />
              {runResult && (
                <Button
                  className="padding-5 w-auto justify-center"
                  svg={SVGS.copy}
                  onClick={() => {
                    navigator.clipboard.writeText(runResult);
                    toast.success("Result copied to clipboard");
                  }}
                />
              )}
            </div>

            {runError && (
              <div className="text-sm text-red-400 whitespace-pre-wrap">
                {runError}
              </div>
            )}

            {runResult !== null && (
              <div className="flex-column gap-2">
                <h5 className="font-mono">Result</h5>
                <pre className="formatter-result whitespace-pre-wrap">
                  {runResult}
                </pre>
              </div>
            )}
          </div>
          )}
        </form>
      </div>
    </Section>
  );
}
