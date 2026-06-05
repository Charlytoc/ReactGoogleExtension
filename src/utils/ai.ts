import OpenAI from "openai";
import type {
  EasyInputMessage,
  FunctionTool,
  Response,
  ResponseFunctionToolCall,
  ResponseInput,
  ResponseInputItem,
  ResponseOutputItem,
  ResponseTextConfig,
} from "openai/resources/responses/responses";

import { TMessage, TModel } from "../types";
import { MODEL_IMAGE_GENERATION } from "./models";

type TResponseFormat = { type: "json_object" | "text" };

export type TCompletionRequest = {
  messages: ResponseInput;
  model: string;
  apiKey: string;
  max_completion_tokens: number;
  response_format?: TResponseFormat;
  tools?: FunctionTool[];
  tool_choice?: "auto" | "none" | "required";
  functionMap?: Record<string, (args: Record<string, any>) => Promise<string>>;
};

export type TTool = {
  schema: FunctionTool;
  function: (args: Record<string, any>) => Promise<string>;
};

type TToolArguments = {
  type: string;
  description: string;
};

const mapResponseTextFormat = (
  responseFormat?: TResponseFormat
): ResponseTextConfig | undefined => {
  if (!responseFormat || responseFormat.type === "text") {
    return undefined;
  }
  return { format: { type: "json_object" } };
};

const hasFunctionToolSchema = (
  tool: FunctionTool
): tool is FunctionTool & { name: string } => {
  return tool.type === "function" && typeof tool.name === "string";
};

const isFunctionToolCall = (
  item: ResponseOutputItem
): item is ResponseFunctionToolCall => {
  return item.type === "function_call";
};

/** Converts model output into input items safe to resend when store is false. */
const toStatelessReplayInput = (
  turnOutput: ResponseOutputItem[]
): ResponseInputItem[] => {
  const items: ResponseInputItem[] = [];

  for (const item of turnOutput) {
    if (item.type === "function_call") {
      items.push({
        type: "function_call",
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      });
      continue;
    }

    if (item.type === "message") {
      const text = item.content
        .filter((part) => part.type === "output_text")
        .map((part) => part.text)
        .join("");
      if (text) {
        items.push({ role: "assistant", content: text });
      }
    }

    // Reasoning and other server-scoped items (rs_*, etc.) cannot be replayed
    // when store is false — omit them from the next request input.
  }

  return items;
};

export const toolify = <T extends (args: any) => any>(
  fn: T,
  name: string,
  description: string,
  argumentsMap: Record<string, TToolArguments>
): TTool => {
  const properties: Record<string, TToolArguments> = {};
  const required: string[] = [];

  for (const key of Object.keys(argumentsMap)) {
    properties[key] = {
      type: typeof argumentsMap[key].type,
      description: argumentsMap[key].description,
    };
  }
  if (typeof fn === "function") {
    for (const key of Object.keys(argumentsMap)) {
      required.push(key);
      properties[key] = {
        type: typeof (fn as Record<string, unknown>)[key] === "number" ? "number" : "string",
        description: `${argumentsMap[key].description}`,
      };
    }
  }

  return {
    schema: {
      type: "function",
      name,
      description,
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
      strict: true,
    },
    function: fn,
  };
};

export const createCompletion = async (
  request: TCompletionRequest,
  callback?: (response: Response) => void
) => {
  const openai = new OpenAI({
    apiKey: request.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await openai.responses.create({
    model: request.model,
    input: request.messages,
    max_output_tokens: request.max_completion_tokens,
    text: mapResponseTextFormat(request.response_format),
    store: false,
  });

  callback?.(response);
  return response.output_text ?? "";
};

export const createStreamingResponseWithFunctions = async (
  request: TCompletionRequest,
  callback: (textDelta: string) => void
) => {
  const openai = new OpenAI({
    apiKey: request.apiKey,
    dangerouslyAllowBrowser: true,
  });

  let input: ResponseInput = [...request.messages];

  while (true) {
    const stream = await openai.responses.create({
      model: request.model,
      input,
      stream: true,
      tools: request.tools,
      tool_choice: request.tool_choice,
      max_output_tokens: request.max_completion_tokens,
      text: mapResponseTextFormat(request.response_format),
      store: false,
    });

    let turnOutput: ResponseOutputItem[] = [];

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        callback(event.delta);
      }
      if (event.type === "response.completed") {
        turnOutput = event.response.output;
      }
    }

    const functionCalls = turnOutput.filter(isFunctionToolCall);
    if (functionCalls.length === 0) {
      break;
    }

    input = [...input, ...toStatelessReplayInput(turnOutput)];

    for (const call of functionCalls) {
      const handler = request.functionMap?.[call.name];
      if (!handler) {
        console.warn(`Function ${call.name} not found in functionMap`);
        continue;
      }

      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call.arguments || "{}") as Record<string, any>;
      } catch (error) {
        console.warn(`Could not parse arguments for ${call.name}`, error);
      }

      const result = await handler(args);
      const outputItem: ResponseInputItem.FunctionCallOutput = {
        type: "function_call_output",
        call_id: call.call_id,
        output: result,
      };
      input.push(outputItem);
    }
  }
};

export const convertToMessage = (
  m: TMessage
): EasyInputMessage | ResponseInputItem.FunctionCallOutput => {
  if (m.role === "tool") {
    return {
      type: "function_call_output",
      call_id: m.tool_call_id ?? "",
      output: m.content,
    };
  }

  const role =
    m.role === "system"
      ? "system"
      : m.role === "assistant"
        ? "assistant"
        : "user";

  return {
    role,
    content: m.content,
  };
};

export const createToolsMap = (functions: TTool[]) => {
  const toolNames = functions.map((tool) =>
    hasFunctionToolSchema(tool.schema) ? tool.schema.name : ""
  );
  const toolFunctions = functions.map((tool) => tool.function);

  const functionMap: Record<string, (args: Record<string, any>) => Promise<string>> = {};

  for (let i = 0; i < toolNames.length; i++) {
    if (!toolNames[i]) continue;
    functionMap[toolNames[i]] = toolFunctions[i];
  }

  return functionMap;
};

export const createTranscription = async (
  audio: File,
  apiKey: string,
  model: string = "whisper-1"
) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const transcription = await openai.audio.transcriptions.create({
    file: audio,
    model,
  });
  return transcription.text;
};

type TSpeechVoice =
  | "alloy"
  | "ash"
  | "coral"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "sage"
  | "shimmer";

type TSpeedRange =
  | 0.25
  | 0.5
  | 0.75
  | 1.0
  | 1.25
  | 1.5
  | 1.75
  | 2.0
  | 2.25
  | 2.5
  | 2.75
  | 3.0
  | 3.25
  | 3.5
  | 3.75
  | 4.0;

type TSpeechRequest = {
  text: string;
  model: string;
  voice: TSpeechVoice;
  speed: TSpeedRange;
};

export const createSpeech = async (request: TSpeechRequest, apiKey: string) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await openai.audio.speech.create({
    model: request.model,
    voice: request.voice,
    speed: request.speed,
    input: request.text,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
};

type TImageOutputFormat = "png" | "jpeg" | "webp";
type TImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";
type TImageQuality = "low" | "medium" | "high" | "auto";
type TImageBackground = "transparent" | "opaque" | "auto";

type TGenerateImageRequest = {
  prompt: string;
  apiKey: string;
  model?:
    | "gpt-image-2"
    | "gpt-image-1.5"
    | "gpt-image-1"
    | "gpt-image-1-mini";
  size?: TImageSize;
  quality?: TImageQuality;
  background?: TImageBackground;
  outputFormat?: TImageOutputFormat;
  outputCompression?: number;
};

export const generateImage = async ({
  prompt,
  apiKey,
  model = MODEL_IMAGE_GENERATION,
  size = "1024x1024",
  quality = "medium",
  background = "auto",
  outputFormat = "jpeg",
  outputCompression = 60,
}: TGenerateImageRequest): Promise<{
  b64: string;
  mimeType: string;
  revisedPrompt?: string;
}> => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const response = await openai.images.generate({
    model,
    prompt,
    size,
    quality,
    background,
    output_format: outputFormat,
    output_compression: outputCompression,
  });

  const firstImage = response.data?.[0];
  if (!firstImage?.b64_json) {
    throw new Error("No image returned by the API");
  }

  const mimeType =
    outputFormat === "png"
      ? "image/png"
      : outputFormat === "webp"
        ? "image/webp"
        : "image/jpeg";

  return {
    b64: firstImage.b64_json,
    mimeType,
    revisedPrompt: (firstImage as { revised_prompt?: string }).revised_prompt,
  };
};

const titlelify = (slug: string) => {
  const title = slug.replace(/-/g, " ");
  return title.charAt(0).toUpperCase() + title.slice(1);
};

const isLLM = (slug: string) => {
  if (slug.startsWith("gpt-image")) return false;
  return (
    slug.startsWith("gpt-") ||
    slug.startsWith("o") ||
    slug.startsWith("chatgpt")
  );
};

const isReasoningModel = (slug: string) => {
  if (slug.startsWith("o")) return true;
  if (slug.startsWith("gpt-5.4-mini") || slug.startsWith("gpt-5.4-nano")) {
    return false;
  }
  if (slug.startsWith("gpt-5")) return true;
  return false;
};

export const listModels = async (apiKey: string) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const list = await openai.models.list();

  const models: TModel[] = [];

  for await (const model of list) {
    if (model.owned_by === "system" && isLLM(model.id)) {
      models.push({
        name: titlelify(model.id),
        slug: model.id,
        hasReasoning: isReasoningModel(model.id),
      });
    }
  }
  return models;
};
