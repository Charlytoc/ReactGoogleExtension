import type { TFormatterInput } from "../types";

export const extractVariables = (content: string): string[] => {
  const matches = content.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return [
    ...new Set(
      matches.map((m) => m.slice(2, -2).trim()).filter((name) => name !== "")
    ),
  ];
};

export const fillVariables = (
  content: string,
  values: Record<string, string>
): string =>
  content.replace(
    /\{\{([^}]+)\}\}/g,
    (_, key) => values[key.trim()] ?? `{{${key}}}`
  );

export const formatterInputsFromPrompt = (
  prompt: string,
  previous: TFormatterInput[] = []
): TFormatterInput[] => {
  const prevByName = new Map<string, TFormatterInput>();
  for (const input of previous) {
    if (input.id) prevByName.set(input.id, input);
    if (input.label) prevByName.set(input.label, input);
  }
  return extractVariables(prompt).map((name) => ({
    id: name,
    label: name,
    lastValue: prevByName.get(name)?.lastValue,
  }));
};

const inputVariableName = (input: TFormatterInput, index: number): string => {
  const raw = (input.label || input.id || "").trim();
  if (raw) return raw;
  return String.fromCharCode(65 + index);
};

/** Legacy formatters stored inputs separately. Fold them into {{placeholders}}. */
export const migrateLegacyFormatterPrompt = (
  prompt: string,
  inputs: TFormatterInput[]
): string => {
  if (extractVariables(prompt).length > 0 || inputs.length === 0) {
    return prompt;
  }
  const lines = [
    ...new Set(inputs.map((input, index) => `{{${inputVariableName(input, index)}}}`)),
  ];
  const block = lines.join("\n");
  const trimmed = prompt.trim();
  return trimmed ? `${trimmed}\n\n${block}` : block;
};
