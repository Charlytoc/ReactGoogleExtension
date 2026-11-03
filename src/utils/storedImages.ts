import type { TAttachment } from "../types";
import { ChromeStorageManager } from "../managers/Storage";
import { generateRandomId } from "./lib";
import { getImageModelSlug, getImagePromptModelSlug } from "./aiConfigStorage";

const IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024", "auto"] as const;

export type TStoredImageSize = (typeof IMAGE_SIZES)[number];

export const normalizeStoredImageSize = (size: string): TStoredImageSize =>
  (IMAGE_SIZES as readonly string[]).includes(size)
    ? (size as TStoredImageSize)
    : "1024x1024";

type TResponsesBody = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

const readApiKey = async (): Promise<string> => {
  const apiKey = await ChromeStorageManager.get("openaiApiKey");
  if (typeof apiKey !== "string" || !apiKey) {
    throw new Error("No API key found");
  }
  return apiKey;
};

const readImageBody = async (response: Response): Promise<string> => {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenAI API error: ${response.statusText}${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }
  const body: { data?: Array<{ b64_json?: string }> } = await response.json();
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image returned by the API");
  }
  return b64;
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,([\s\S]*)$/);
  if (!match) {
    throw new Error("Image data is missing");
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: match[1] || "image/jpeg" });
};

const saveAttachment = async (
  attachment: TAttachment,
  altText: string
): Promise<{ attachmentId: string; markdownLink: string }> => {
  const stored = await ChromeStorageManager.get("attachments");
  const attachments: TAttachment[] = Array.isArray(stored) ? stored : [];
  await ChromeStorageManager.add("attachments", [...attachments, attachment]);
  return {
    attachmentId: attachment.id,
    markdownLink: `![${altText}](attachment:${attachment.id})`,
  };
};

const readOutputText = (body: TResponsesBody): string => {
  if (body.output_text) return body.output_text;
  for (const item of body.output ?? []) {
    if (item.type !== "message" || !item.content) continue;
    for (const part of item.content) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  return "";
};

const completeText = async (
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxCompletionTokens: number
): Promise<string> => {
  const apiKey = await readApiKey();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: messages,
      max_output_tokens: maxCompletionTokens,
      store: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion: TResponsesBody = await response.json();
  return readOutputText(completion);
};

export const fetchImageBase64 = async (
  apiKey: string,
  prompt: string,
  size: string,
  outputCompression: number,
  model: string
): Promise<string> => {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality: "medium",
      output_format: "jpeg",
      output_compression: outputCompression,
    }),
  });

  return readImageBody(response);
};

const expandImagePrompt = async (
  prompt: string,
  size: string,
  context?: string
): Promise<string> => {
  const rawPrompt = prompt.trim();
  try {
    const refined = await completeText(
      await getImagePromptModelSlug(),
      [
        {
          role: "system",
          content: `You are an expert image prompt engineer.
Write a single, vivid, detailed image generation prompt based on the user's request.
Use the provided context (surrounding note or block text) to inform the subject, style, and mood when relevant — but the request always wins over the context.
Tailor the composition to the requested size/aspect ratio.
Respond with the final prompt only — no quotes, no preamble, no explanations.`,
        },
        {
          role: "user",
          content: `Request: ${rawPrompt}

Size/aspect ratio: ${size}

Context:
${(context || "none").slice(0, 6000)}`,
        },
      ],
      400
    );
    return refined.trim() || rawPrompt;
  } catch (error) {
    console.warn("Image prompt generation failed, using raw prompt:", error);
    return rawPrompt;
  }
};

export type TCreateStoredImageParams = {
  prompt: string;
  context?: string;
  altText: string;
  size: string;
  attachmentId?: string;
  sourceNoteId?: string;
  sourceConversationId?: string;
  outputCompression?: number;
};

export const createStoredImage = async (
  params: TCreateStoredImageParams
): Promise<{ attachmentId: string; markdownLink: string }> => {
  const apiKey = await readApiKey();
  const size = normalizeStoredImageSize(params.size);
  const altText = params.altText.trim() || "generated image";
  const imagePrompt = await expandImagePrompt(params.prompt, size, params.context);
  const imageModel = await getImageModelSlug();
  const b64 = await fetchImageBase64(
    apiKey,
    imagePrompt,
    size,
    params.outputCompression ?? 60,
    imageModel
  );

  const attachmentId = params.attachmentId ?? generateRandomId("attachment");
  return saveAttachment(
    {
      id: attachmentId,
      type: "image",
      name: `ai-image-${new Date().toISOString()}`,
      dataUrl: `data:image/jpeg;base64,${b64}`,
      mimeType: "image/jpeg",
      sourceNoteId: params.sourceNoteId,
      sourceConversationId: params.sourceConversationId,
      createdAt: new Date().toISOString(),
    },
    altText
  );
};

export const editStoredImage = async (params: {
  sourceAttachmentId: string;
  prompt: string;
  altText: string;
  size?: string;
  sourceConversationId?: string;
}): Promise<{ attachmentId: string; markdownLink: string }> => {
  const apiKey = await readApiKey();
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new Error("No instruction provided");
  }

  const stored = await ChromeStorageManager.get("attachments");
  const attachments: TAttachment[] = Array.isArray(stored) ? stored : [];
  const source = attachments.find((item) => item.id === params.sourceAttachmentId);
  if (!source?.dataUrl) {
    throw new Error("Image not found");
  }

  const blob = dataUrlToBlob(source.dataUrl);
  const extension = blob.type.includes("png") ? "png" : "jpg";
  const form = new FormData();
  form.append("model", await getImageModelSlug());
  form.append("prompt", prompt);
  form.append("image[]", blob, `source.${extension}`);
  const size = params.size?.trim();
  if (size && size !== "auto") {
    form.append("size", normalizeStoredImageSize(size));
  }
  form.append("quality", "medium");
  form.append("output_format", "jpeg");
  form.append("output_compression", "60");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });
  const b64 = await readImageBody(response);
  const altText = params.altText.trim() || "edited image";

  return saveAttachment(
    {
      id: generateRandomId("attachment"),
      type: "image",
      name: `ai-image-${new Date().toISOString()}`,
      dataUrl: `data:image/jpeg;base64,${b64}`,
      mimeType: "image/jpeg",
      sourceConversationId: params.sourceConversationId,
      createdAt: new Date().toISOString(),
    },
    altText
  );
};
