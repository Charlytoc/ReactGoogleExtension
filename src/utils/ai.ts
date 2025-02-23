import OpenAI from "openai";
import { TMessage } from "../types";

export const createCompletion = async (
  messages: TMessage[],
  model = "gpt-4o-mini",
  apiKey: string,
  temperature = 0.5,
  maxTokens = 4000,
  responseFormat: "json_object" | "text" = "text"
) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    response_format: { type: responseFormat },
  });
  return completion.choices[0].message.content;
};

export const createStreamingResponse = async (
  messages: TMessage[] = [
    {
      role: "system",
      content: "You are a helpful assistant.",
    },
  ],
  apiKey: string,
  model: string = "chatgpt-4o-latest",
  temperature = 0.5,
  maxTokens = 4000,
  callback: (chunk: string) => void
) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const stream = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature,
    max_completion_tokens: maxTokens,
  });
  for await (const chunk of stream) {
    callback(chunk.choices[0]?.delta?.content || "");
  }
  return stream;
};
