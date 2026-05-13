/**
 * Central OpenAI model ids for the extension.
 * Update here when bumping defaults app-wide.
 */

/** Longer / tool-heavy chat (note assistant, etc.) */
export const MODEL_CHAT_CAPABLE = "gpt-5.5";

/** Default “small” chat completions (JSON, titles, light edits) */
export const MODEL_CHAT_SMALL = "gpt-5.4-mini";

/** Cheapest completions (strict formatting, trivial transforms) */
export const MODEL_CHAT_NANO = "gpt-5.4-nano";

/** Image generation (covers, inline attachments) */
export const MODEL_IMAGE_GENERATION = "gpt-image-2";
