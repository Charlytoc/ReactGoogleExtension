/**
 * Defaults and storage key for extension command (injected tool) system prompts.
 * Used by the background service worker and Settings UI.
 */

export const COMMAND_PROMPT_STORAGE_KEY = "commandPromptOverrides";

export type ExtensionCommandId =
  | "auto-complete"
  | "translate-selection"
  | "check-grammar";

export const EXTENSION_COMMAND_IDS: ExtensionCommandId[] = [
  "auto-complete",
  "translate-selection",
  "check-grammar",
];

/** Default autocomplete system message; placeholders are substituted in the background. */
export const DEFAULT_AUTOCOMPLETE_TEMPLATE = `You are an useful assistant working for a Google Extension. Your task is to assist the user filling inputs with the text that best match the user intent. You will get the page context so you can figure out what the user intent is. You will also get the active element to give you more context.


This is the page context: ---
{{PAGE_INNER_TEXT}}
---

This is the active element: ---
{{ACTIVE_ELEMENT_OUTER_HTML}}
---

The current text of the input is: ---
{{CURRENT_INPUT_VALUE}}
---

Return only the next text of the input, no other text or comment are allowed.
If the input already have text, you must continue writting the text, otherwise you should return the complete text to fill the input.

Examples:
Input: "Hello, how ar"
Output: "Hello, how are you?"

Input: "What is the capital of Fr"
Output: "What is the capital of France?"

`;

export const DEFAULT_PROMPTS: Record<ExtensionCommandId, string> = {
  "auto-complete": DEFAULT_AUTOCOMPLETE_TEMPLATE,
  "translate-selection":
    "You are a translator that toggles between English and Spanish. If the given text is in Spanish, translate it to English. If the given text is in English, translate it to Spanish. If it is in any other language, translate it to English. Return ONLY the translated text, nothing else. No quotes, no explanations, no notes. Preserve the original formatting (line breaks, punctuation, etc.).",
  "check-grammar":
    "You are a grammar and spelling corrector. Fix the grammar, spelling, and punctuation of the given text. Keep the SAME language as the original — do NOT translate. Return ONLY the corrected text, nothing else. No quotes, no explanations, no notes. Preserve the original meaning and tone. If the text is already correct, return it unchanged.",
};

export function fillAutocompleteTemplate(
  template: string,
  vars: {
    pageInnerText: string;
    activeOuterHTML: string;
    currentInputValue: string;
  }
): string {
  return template
    .replace(/\{\{PAGE_INNER_TEXT\}\}/g, vars.pageInnerText)
    .replace(/\{\{ACTIVE_ELEMENT_OUTER_HTML\}\}/g, vars.activeOuterHTML)
    .replace(/\{\{CURRENT_INPUT_VALUE\}\}/g, vars.currentInputValue);
}

export function resolvePrompt(
  command: ExtensionCommandId,
  overrides: Partial<Record<ExtensionCommandId, string>> | undefined
): string {
  const trimmed = overrides?.[command]?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_PROMPTS[command];
}
