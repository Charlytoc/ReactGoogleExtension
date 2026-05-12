/** Font options for note customization (must match note detail Select). */
export const NOTE_FONT_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Comic Sans MS", value: '"Comic Sans MS", cursive' },
  { label: "Lucida Console", value: '"Lucida Console", monospace' },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "ShareTechMono", value: "ShareTechMono" },
] as const;

const FONT_VALUES = new Set(NOTE_FONT_OPTIONS.map((o) => o.value));

export function pickAllowedFont(
  requested: string | undefined,
  fallback: string | undefined
): string {
  if (requested && FONT_VALUES.has(requested)) return requested;
  if (fallback && FONT_VALUES.has(fallback)) return fallback;
  return NOTE_FONT_OPTIONS[0].value;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(s: string): boolean {
  return HEX_RE.test(s.trim());
}

export type TAIThemeBackgroundType = "solid" | "gradient";

export type TClampedNoteTheme = {
  imagePrompt: string;
  backgroundType: TAIThemeBackgroundType;
  color: string;
  color2: string;
  font: string;
  tagsFromAi: string[];
};

export function clampAiNoteThemeJson(
  raw: unknown,
  ctx: {
    fallbackFont: string | undefined;
    fallbackColor: string;
    fallbackColor2: string;
  }
): TClampedNoteTheme {
  const o =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const fromImagePrompt =
    typeof o.imagePrompt === "string" ? o.imagePrompt.trim() : "";
  const fromLegacy =
    typeof o.coverImagePrompt === "string" ? o.coverImagePrompt.trim() : "";
  const imagePrompt = fromImagePrompt || fromLegacy;

  let backgroundType: TAIThemeBackgroundType = "solid";
  if (o.backgroundType === "gradient" || o.backgroundType === "solid") {
    backgroundType = o.backgroundType;
  }

  const colorCandidate =
    typeof o.color === "string" ? o.color.trim() : "";
  const color =
    colorCandidate && isValidHexColor(colorCandidate)
      ? colorCandidate
      : ctx.fallbackColor;

  const color2Candidate =
    typeof o.color2 === "string" ? o.color2.trim() : "";
  const color2 =
    color2Candidate && isValidHexColor(color2Candidate)
      ? color2Candidate
      : ctx.fallbackColor2;

  const font = pickAllowedFont(
    typeof o.font === "string" ? o.font.trim() : undefined,
    ctx.fallbackFont
  );

  const tagsFromAi: string[] = [];
  if (Array.isArray(o.tags)) {
    for (const item of o.tags) {
      if (typeof item === "string" && item.trim()) {
        tagsFromAi.push(item);
      }
    }
  }

  return {
    imagePrompt,
    backgroundType,
    color,
    color2,
    font,
    tagsFromAi,
  };
}

/** For prompts: serialize allowed font values (exact match required from model). */
export function formatFontCatalogForPrompt(): string {
  return NOTE_FONT_OPTIONS.map((f) => `${f.label} -> "${f.value}"`).join("\n");
}
