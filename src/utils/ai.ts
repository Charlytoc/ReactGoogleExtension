import OpenAI from "openai";
import { TMessage } from "../types";

export const createCompletion = async (
  messages: TMessage[] = [
    {
      role: "system",
      content: "You are a helpful assistant.",
    },
    {
      role: "user",
      content: "Write a haiku about recursion in programming.",
    },
  ],
  apiKey: string
) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
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
  callback: (chunk: string) => void
) => {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    stream: true,
  });
  for await (const chunk of stream) {
    callback(chunk.choices[0]?.delta?.content || "");
  }
  return stream;
};
