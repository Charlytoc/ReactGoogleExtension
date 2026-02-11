import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { Section } from "../../../components/Section/Section";
import { Button } from "../../../components/Button/Button";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";
import { Textarea } from "../../../components/Textarea/Textarea";
import { Select } from "../../../components/Select/Select";
import { SVGS } from "../../../assets/svgs";
import { ChromeStorageManager } from "../../../managers/Storage";
import { cacheLocation } from "../../../utils/lib";
import { createCompletion } from "../../../utils/ai";
import { useStore } from "../../../managers/store";
import { useShallow } from "zustand/shallow";
import { TFormatter, TFormatterInput } from "../../../types";

const buildParamName = (input: TFormatterInput, index: number) => {
  const base = input.label.trim() || String.fromCharCode(65 + index); // A, B, C...
  const sanitized = base.replace(/[^a-zA-Z0-9]+/g, "");
  if (!sanitized) {
    return `input${String.fromCharCode(65 + index)}`;
  }
  const capitalized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  return `input${capitalized}`;
};

export default function FormatterDetail() {
  const formRef = useRef<HTMLFormElement>(null);
  const [formatter, setFormatter] = useState<TFormatter | null>(null);
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"run" | "edit">("run");
  const [shouldAutoRun, setShouldAutoRun] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();
  const auth = useStore(useShallow((state) => state.config.auth));

  useEffect(() => {
    getFormatter();
  }, [id]);

  const getFormatter = async () => {
    const formatters: TFormatter[] =
      (await ChromeStorageManager.get("formatters")) || [];
    const current = formatters.find((f) => f.id === id) || null;
    setFormatter(current);

    setUsedCategories([
      ...new Set(
        formatters
          .filter((f) => f.category && f.category.trim() !== "")
          .map((f) => f.category as string)
      ),
    ] as string[]);

    if (current) {
      const initialValues: Record<string, string> = {};
      current.inputs.forEach((input) => {
        const key = input.id;
        if (input.rememberLastValue && typeof input.lastValue === "string") {
          initialValues[key] = input.lastValue;
        } else {
          initialValues[key] = "";
        }
      });
      setInputValues(initialValues);
    }
  };

  const saveFormatter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formatter) return;

    const prev: TFormatter[] =
      (await ChromeStorageManager.get("formatters")) || [];
    const updated: TFormatter[] = prev.map((f) =>
      f.id === formatter.id ? { ...formatter, updatedAt: new Date().toISOString() } : f
    );

    await ChromeStorageManager.add("formatters", updated);
    toast.success(t("save"));
    navigate("/formatters");
    cacheLocation("/formatters");
  };

  const addInput = () => {
    if (!formatter) return;
    const nextIndex = formatter.inputs.length;
    const label = String.fromCharCode(65 + nextIndex); // A, B, C...
    const newInput: TFormatterInput = {
      id: `${formatter.id}-input-${nextIndex}`,
      label,
    };
    setFormatter({ ...formatter, inputs: [...formatter.inputs, newInput] });
    setInputValues((prev) => ({ ...prev, [newInput.id]: "" }));
  };

  const removeInput = (inputId: string) => {
    if (!formatter) return;
    const remaining = formatter.inputs.filter((i) => i.id !== inputId);
    setFormatter({ ...formatter, inputs: remaining });
    setInputValues((prev) => {
      const copy = { ...prev };
      delete copy[inputId];
      return copy;
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

    const inputLines = (formatter.inputs || []).map((input, index) => {
      const paramName = buildParamName(input, index);
      const value = inputValues[input.id] ?? "";
      return `- ${paramName} (${input.label || `Input ${index + 1}`}): "${value}"`;
    });

    const promptText =
      formatter.prompt ||
      "Format the text based on the inputs. Always return a single string.";

    const systemPrompt =
      "You are a strict string formatter. You receive instructions and concrete input values. You MUST answer with a single formatted string only, with no explanations, quotes, or markdown.";

    const userContent = `Instructions:\n${promptText}\n\nInputs:\n${inputLines.join(
      "\n"
    )}`.trim();

    try {
      const content = await createCompletion(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          model: "gpt-4.1-nano",
          temperature: 0.1,
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

        // Auto-copy result to clipboard
        try {
          await navigator.clipboard.writeText(content);
          toast.success("Result copied to clipboard");
        } catch (error) {
          console.error("Error copying result to clipboard", error);
        }

        // Persist last values inside the formatter definition itself
        try {
          const updatedInputs: TFormatterInput[] = formatter.inputs.map(
            (input) => ({
              ...input,
              lastValue: input.rememberLastValue
                ? inputValues[input.id] ?? ""
                : undefined,
            })
          );

          const updatedFormatter: TFormatter = {
            ...formatter,
            inputs: updatedInputs,
            updatedAt: new Date().toISOString(),
          };

          setFormatter(updatedFormatter);

          const allFormatters: TFormatter[] =
            (await ChromeStorageManager.get("formatters")) || [];
          const newFormatters = allFormatters.map((f) =>
            f.id === updatedFormatter.id ? updatedFormatter : f
          );

          await ChromeStorageManager.add("formatters", newFormatters);
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

  // Auto-run after paste into the last input, once all inputs are filled
  useEffect(() => {
    if (!shouldAutoRun) return;
    if (!formatter) return;

    const inputs = formatter.inputs || [];
    if (inputs.length === 0) return;

    const allFilled = inputs.every(
      (input) => (inputValues[input.id] ?? "").trim() !== ""
    );

    if (!allFilled) return;

    setShouldAutoRun(false);
    void runFormatter();
  }, [shouldAutoRun, formatter, inputValues]);

  const firstPendingIndex =
    formatter && formatter.inputs.length > 0
      ? formatter.inputs.findIndex(
          (input) => (inputValues[input.id] ?? "").trim() === ""
        )
      : -1;

  return (
    <Section
      className="bg-gradient"
      close={() => {
        navigate("/formatters");
        cacheLocation("/formatters");
      }}
      headerLeft={<h3 className="font-mono">{t("edit")}</h3>}
      headerRight={
        <div className="flex-row gap-5">
          <Button
            onClick={() =>
              setMode((prev) => (prev === "run" ? "edit" : "run"))
            }
            text={mode === "run" ? t("edit") : "Run"}
            className="w-auto padding-5 justify-center"
            svg={mode === "run" ? SVGS.edit : SVGS.play}
          />
          <Button
            onClick={() => {
              formRef.current?.dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
              );
            }}
            text={t("save")}
            className="w-100 padding-5 justify-center"
            svg={SVGS.save}
          />
        </div>
      }
    >
      <div className="padding-10 rounded-10">
        <form
          ref={formRef}
          onSubmit={saveFormatter}
          className="flex-column gap-10 formatter-form"
        >
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

          <Textarea
            label={t("description")}
            name="description"
            maxHeight="15vh"
            defaultValue={formatter?.description || ""}
            onChange={(value) => {
              if (!formatter) return;
              setFormatter({ ...formatter, description: value });
            }}
          />

          {mode === "edit" && (
            <>
              <div className="flex-column gap-5">
                <label className="color-secondary">{t("category")}</label>
                <Select
                  name="category"
                  options={[
                    {
                      label: t("select-category") || "Select category",
                      value: "",
                    },
                    ...usedCategories.map((category) => ({
                      label: category,
                      value: category,
                    })),
                  ]}
                  defaultValue={formatter?.category || ""}
                  onChange={(value) => {
                    if (!formatter) return;
                    setFormatter({ ...formatter, category: value });
                  }}
                />
              </div>

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

              <div className="flex-column gap-5">
                <h4 className="font-mono">{t("inputs")}</h4>
                <p className="text-sm text-gray-400">
                  {t("inputs-help", {
                    defaultValue:
                      "Add inputs like A, B or custom names. They will be available as variables in the formatter prompt.",
                  })}
                </p>
                <div className="flex-column gap-5">
                  {(formatter?.inputs || []).map((input, index) => (
                    <div key={input.id} className="flex-row gap-5 align-center">
                      <LabeledInput
                        name={`input-${input.id}`}
                        label={`${t("input")} ${index + 1}`}
                        type="text"
                        value={input.label}
                        onChange={(value) => {
                          if (!formatter) return;
                          const updatedInputs = formatter.inputs.map((i) =>
                            i.id === input.id ? { ...i, label: value } : i
                          );
                          setFormatter({ ...formatter, inputs: updatedInputs });
                        }}
                      />
                      <span className="text-xs font-mono color-secondary">
                        {buildParamName(input, index)}
                      </span>
                      <label className="flex-row gap-2 align-center text-xs color-secondary">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={!!input.rememberLastValue}
                          onChange={(e) => {
                            if (!formatter) return;
                            const updatedInputs = formatter.inputs.map((i) =>
                              i.id === input.id
                                ? { ...i, rememberLastValue: e.target.checked }
                                : i
                            );
                            setFormatter({
                              ...formatter,
                              inputs: updatedInputs,
                            });
                          }}
                        />
                        {t("rememberLastValue", {
                          defaultValue: "Remember last value",
                        })}
                      </label>
                      <Button
                        className="padding-5"
                        svg={SVGS.trash}
                        onClick={() => removeInput(input.id)}
                      />
                    </div>
                  ))}
                  <Button
                    className="padding-5 w-auto justify-center"
                    svg={SVGS.plus}
                    text={t("add")}
                    onClick={addInput}
                  />
                </div>
              </div>

              <div className="flex-column gap-5">
                <h4 className="font-mono">{t("content")}</h4>
                <p className="text-sm text-gray-400">
                  {t("formatter-function-help", {
                    defaultValue:
                      "Write clear instructions for how to format the text. The AI will receive the inputs and must always return a single string.",
                  })}
                </p>

                <div className="formatter-function-container">
                  <pre className="formatter-function-header">
{`Prompt for ${formatter?.title || "Formatter"}`}
                  </pre>
                  <Textarea
                    name="prompt"
                    maxHeight="40vh"
                    defaultValue={formatter?.prompt || ""}
                    onChange={(value) => {
                      if (!formatter) return;
                      setFormatter({ ...formatter, prompt: value });
                    }}
                  />
                  <pre className="formatter-function-footer"></pre>
                </div>
              </div>
            </>
          )}

          <div className="flex-column gap-5">
            <h4 className="font-mono">Run</h4>
            <p className="text-sm text-gray-400">
              Provide input values and execute the formatter. The result will be
              a single string.
            </p>

            <div className="flex-column gap-5">
              {(formatter?.inputs || []).map((input, index) => (
                <LabeledInput
                  key={input.id}
                  name={`run-${input.id}`}
                  label={`Value for ${input.label || `Input ${index + 1}`}`}
                  type="text"
                  value={inputValues[input.id] ?? ""}
                  onChange={(value) => {
                    setInputValues((prev) => ({
                      ...prev,
                      [input.id]: value,
                    }));
                  }}
                  autoFocus={
                    mode === "run" &&
                    (firstPendingIndex === -1 ? index === 0 : index === firstPendingIndex)
                  }
                  onPaste={
                    index === (formatter?.inputs.length || 0) - 1
                      ? () => {
                          setShouldAutoRun(true);
                        }
                      : undefined
                  }
                />
              ))}
            </div>

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
        </form>
      </div>
    </Section>
  );
}
