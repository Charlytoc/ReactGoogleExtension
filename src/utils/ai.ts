import OpenAI from "openai";

import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import { TMessage, TModel } from "../types";

type TCompletionRequest = {
  messages: ChatCompletionMessageParam[];
  model: string;
  temperature: number;
  apiKey: string;
  max_completion_tokens: number;
  response_format: { type: "json_object" | "text" };
  tools?: ChatCompletionTool[];
  tool_choice?: "auto" | "none" | "required";
  functionMap?: Record<string, (args: Record<string, any>) => Promise<string>>;
};

export type TTool = {
  schema: ChatCompletionTool;
  function: (args: Record<string, any>) => Promise<string>;
};

type TToolArguments = {
  type: string;
  description: string;
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
        type: typeof (fn as any)[key] === "number" ? "number" : "string",
        description: `${argumentsMap[key].description}`,
      };
    }
  }

  return {
    schema: {
      type: "function",
      function: {
        name,
        description,
        parameters: {
          type: "object",
          properties,
          required,
          additionalProperties: false,
        },
        strict: true,
        required: Object.keys(argumentsMap),
      },
    } as ChatCompletionTool,
    function: fn,
  };
};

export const createCompletion = async (
  request: TCompletionRequest,
  callback: (completion: ChatCompletion) => void
) => {
  const openai = new OpenAI({
    apiKey: request.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const completion = await openai.chat.completions.create({
    model: request.model,
    // @ts-ignore
    messages: request.messages,
    temperature: request.temperature,
    max_completion_tokens: request.max_completion_tokens,
    response_format: request.response_format,
  });

  if (typeof callback === "function") {
    callback(completion);
  }
  return completion.choices[0].message.content;
};

type TStreamingResponseRequest = {
  messages: TMessage[];
  model: TModel;
  temperature: number;
  max_completion_tokens: number;
};

export const createStreamingResponse = async (
  request: TStreamingResponseRequest,
  apiKey: string,
  callback: (chunk: string) => void
) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const stream = await openai.chat.completions.create({
    model: request.model.slug,
    // @ts-ignore
    messages: request.messages,
    stream: true,
    temperature: request.model.hasReasoning ? undefined : request.temperature,
    max_completion_tokens: request.max_completion_tokens,
  });
  for await (const chunk of stream) {
    callback(chunk.choices[0]?.delta?.content || "");
  }
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
    // @ts-ignore
    voice: request.voice,
    speed: request.speed,
    input: request.text,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
};

export const createCompletionWithFunctions = async (
  request: TCompletionRequest,
  callback: (completion: ChatCompletion) => void,
  functionMap: Record<string, (args: Record<string, any>) => Promise<string>>
) => {
  const openai = new OpenAI({
    apiKey: request.apiKey,
    dangerouslyAllowBrowser: true,
  });

  let messages = [...request.messages];

  const completion = await openai.chat.completions.create({
    model: request.model,
    messages: messages as ChatCompletionMessageParam[],
    tools: request.tools,
    tool_choice: request.tool_choice,
    temperature: request.temperature,
    max_completion_tokens: request.max_completion_tokens,
    response_format: request.response_format,
  });

  const toolCalls = completion.choices[0].message.tool_calls;
  messages.push(completion.choices[0].message);

  if (toolCalls && toolCalls.length > 0) {
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      if (functionMap[functionName]) {
        const result = await functionMap[functionName](args);

        if (completion.choices[0].message.content) {
          messages.push({
            role: "assistant",
            content: completion.choices[0].message.content,
          });
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } else {
        console.warn(`Function ${functionName} not found in functionMap`);
      }
    }
    const finalCompletion = await openai.chat.completions.create({
      model: request.model,
      // @ts-ignore
      messages,
      tools: request.tools,
      tool_choice: request.tool_choice,
      temperature: request.temperature,
      max_completion_tokens: request.max_completion_tokens,
      response_format: request.response_format,
    });

    if (typeof callback === "function") {
      callback(finalCompletion);
    }
    return finalCompletion.choices[0].message.content;
  }

  if (typeof callback === "function") {
    callback(completion);
  }

  return completion.choices[0].message.content;
};

export const createStreamingResponseWithFunctions = async (
  request: TCompletionRequest,
  callback: (completion: ChatCompletionChunk) => void
) => {
  const openai = new OpenAI({
    apiKey: request.apiKey,
    dangerouslyAllowBrowser: true,
  });

  let messages = [...request.messages];

  while (true) {
    let generatedMessage: ChatCompletionMessageParam = {
      role: "assistant",
      content: "",
      tool_calls: [],
    };

    const stream = await openai.chat.completions.create({
      model: request.model,
      stream: true,
      messages: messages as ChatCompletionMessageParam[],
      tools: request.tools,
    });

    let toolCalls: Record<number, any> = {};

    for await (const chunk of stream) {
      const choice = chunk.choices[0].delta;

      if (choice.content) {
        callback(chunk);
        generatedMessage.content += choice.content;
      }

      if (choice.tool_calls) {
        for (const toolCall of choice.tool_calls) {
          const index = toolCall.index;

          if (!toolCalls[index]) {
            toolCalls[index] = toolCall;
          } else if (toolCall.function) {
            toolCalls[index].function.arguments += toolCall.function.arguments;
          }
        }
      }
    }

    if (Object.keys(toolCalls).length === 0) {
      break; // No more function calls, exit loop
    }

    generatedMessage.tool_calls = Object.values(toolCalls);
    messages.push(generatedMessage);

    for (const toolCall of Object.values(toolCalls)) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);

      if (request.functionMap && request.functionMap[name]) {
        const result = await request.functionMap[name](args);
        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        });
      }
    }
  }
};

export const convertToMessage = (m: TMessage): ChatCompletionMessageParam => {
  return {
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  };
};

export const createToolsMap = (functions: TTool[]) => {
  let toolNames = functions.map((tool) => tool.schema.function.name);
  let toolFunctions = functions.map((tool) => tool.function);

  let functionMap: Record<
    string,
    (args: Record<string, any>) => Promise<string>
  > = {};

  for (let i = 0; i < toolNames.length; i++) {
    functionMap[toolNames[i]] = toolFunctions[i];
  }

  return functionMap;
};
