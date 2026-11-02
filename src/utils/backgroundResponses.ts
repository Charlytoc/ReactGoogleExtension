import type { FunctionTool } from "openai/resources/responses/responses";

export type TInputContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; detail: "auto"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string };

type TResponseMessage = {
  role: string;
  content: string | TInputContentPart[];
};

type TFunctionCallOutput = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type TFunctionCallInput = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

type TAssistantMessageInput = {
  role: "assistant";
  content: string;
};

export type TResponsesFetchInputItem =
  | TResponseMessage
  | TFunctionCallOutput
  | TFunctionCallInput
  | TAssistantMessageInput;

type TResponseOutputItem = {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type: string; text?: string }>;
};

type TResponsesApiBody = {
  output_text?: string;
  output?: TResponseOutputItem[];
};

type TStreamEvent = {
  type?: string;
  delta?: string;
  response?: TResponsesApiBody;
  item?: TResponseOutputItem;
  error?: { message?: string };
};

const isFunctionCall = (
  item: TResponseOutputItem
): item is TResponseOutputItem & {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
} => {
  return (
    item.type === "function_call" &&
    typeof item.call_id === "string" &&
    typeof item.name === "string"
  );
};

const extractAssistantText = (body: TResponsesApiBody): string => {
  if (body.output_text) {
    return body.output_text;
  }

  const parts: string[] = [];
  for (const item of body.output ?? []) {
    if (item.type !== "message" || !item.content) continue;
    for (const part of item.content) {
      if (part.type === "output_text" && part.text) {
        parts.push(part.text);
      }
    }
  }
  return parts.join("");
};

const toStatelessReplayInput = (
  turnOutput: TResponseOutputItem[]
): TResponsesFetchInputItem[] => {
  const items: TResponsesFetchInputItem[] = [];

  for (const item of turnOutput) {
    if (isFunctionCall(item)) {
      items.push({
        type: "function_call",
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments ?? "{}",
      });
      continue;
    }

    if (item.type === "message") {
      const text = (item.content ?? [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text ?? "")
        .join("");
      if (text) {
        items.push({ role: "assistant", content: text });
      }
    }
  }

  return items;
};

const readResponsesStream = async (
  response: Response,
  onTextDelta: (delta: string) => void
): Promise<TResponsesApiBody> => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Empty stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";
  const items: TResponseOutputItem[] = [];
  let completed: TResponsesApiBody | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const data = chunk
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data || data === "[DONE]") continue;

      let event: TStreamEvent;
      try {
        event = JSON.parse(data) as TStreamEvent;
      } catch {
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.error?.message || "OpenAI stream error");
      }
      if (event.type === "response.output_text.delta" && event.delta) {
        outputText += event.delta;
        onTextDelta(event.delta);
      }
      if (event.type === "response.output_item.done" && event.item) {
        items.push(event.item);
      }
      if (event.type === "response.completed" && event.response) {
        completed = event.response;
      }
    }
  }

  return completed ?? { output_text: outputText, output: items };
};

export type TCreateResponseWithFunctionsFetchParams = {
  apiKey: string;
  model: string;
  input: TResponsesFetchInputItem[];
  tools: FunctionTool[];
  functionMap: Record<string, (args: Record<string, unknown>) => Promise<string>>;
  maxOutputTokens: number;
  onTextDelta?: (delta: string) => void;
};

export const createResponseWithFunctionsFetch = async ({
  apiKey,
  model,
  input,
  tools,
  functionMap,
  maxOutputTokens,
  onTextDelta,
}: TCreateResponseWithFunctionsFetchParams): Promise<string> => {
  let conversationInput: TResponsesFetchInputItem[] = [...input];
  let assistantText = "";

  while (true) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: conversationInput,
        tools,
        tool_choice: "auto",
        max_output_tokens: maxOutputTokens,
        store: false,
        ...(onTextDelta ? { stream: true } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} ${errorBody}`
      );
    }

    let roundStreamed = "";
    const body = onTextDelta
      ? await readResponsesStream(response, (delta) => {
          roundStreamed += delta;
          onTextDelta(delta);
        })
      : ((await response.json()) as TResponsesApiBody);
    const turnOutput = body.output ?? [];
    assistantText = extractAssistantText(body);
    if (
      onTextDelta &&
      assistantText.startsWith(roundStreamed) &&
      assistantText.length > roundStreamed.length
    ) {
      onTextDelta(assistantText.slice(roundStreamed.length));
    }

    const functionCalls = turnOutput.filter(isFunctionCall);
    if (functionCalls.length === 0) {
      break;
    }

    conversationInput = [...conversationInput, ...toStatelessReplayInput(turnOutput)];

    for (const call of functionCalls) {
      const handler = functionMap[call.name];
      if (!handler) {
        console.warn(`Function ${call.name} not found in functionMap`);
        continue;
      }

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
      } catch (error) {
        console.warn(`Could not parse arguments for ${call.name}`, error);
      }

      const result = await handler(args);
      conversationInput.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: result,
      });
    }
  }

  return assistantText;
};
