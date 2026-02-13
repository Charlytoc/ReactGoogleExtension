# AI Integration (OpenAI)

## Overview

The extension integrates with the OpenAI API for all AI features. The user provides their own API key, which is stored in `chrome.storage.local` under the key `"openaiApiKey"`.

**Important**: The OpenAI SDK runs directly in the browser with `dangerouslyAllowBrowser: true`. There is no backend proxy for AI calls — the user's API key is sent directly from the extension to OpenAI.

## AI Utility Functions

All AI functions are in `src/utils/ai.ts`.

### createCompletion()
Standard chat completion (non-streaming).

```typescript
createCompletion(
  request: TCompletionRequest,
  callback: (completion: ChatCompletion) => void
): Promise<string | null>
```

- Used for: theme generation, note title generation, formatter execution
- Returns the completion text content

### createStreamingResponse()
Streaming chat completion (token-by-token).

```typescript
createStreamingResponse(
  request: TStreamingResponseRequest,
  apiKey: string,
  callback: (chunk: string) => void
): Promise<void>
```

- Used for: Chat feature (real-time AI responses)
- Handles reasoning models by skipping `temperature` when `model.hasReasoning` is true

### createCompletionWithFunctions()
Chat completion with OpenAI function/tool calling support.

```typescript
createCompletionWithFunctions(
  request: TCompletionRequest,
  callback: (completion: ChatCompletion) => void,
  functionMap: Record<string, (args: Record<string, any>) => Promise<string>>
): Promise<string | null>
```

- Sends initial request with tools defined
- If AI returns tool calls, executes them via `functionMap`
- Sends tool results back to AI for a final response

### createStreamingResponseWithFunctions()
Streaming completion with function calling (most advanced).

```typescript
createStreamingResponseWithFunctions(
  request: TCompletionRequest,
  callback: (completion: ChatCompletionChunk) => void
): Promise<void>
```

- Combines streaming + tool calling in a loop
- Keeps calling tools until no more tool calls are returned
- Handles streamed tool call argument accumulation

### createTranscription()
Audio-to-text using Whisper.

```typescript
createTranscription(
  audio: File,
  apiKey: string,
  model: string = "whisper-1"
): Promise<string>
```

### createSpeech()
Text-to-speech generation.

```typescript
createSpeech(
  request: TSpeechRequest,
  apiKey: string
): Promise<Buffer>
```

- Supports voices: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer
- Speed range: 0.25x to 4.0x

### listModels()
Lists available OpenAI models from the user's API key.

```typescript
listModels(apiKey: string): Promise<TModel[]>
```

- Filters to only system-owned LLM models (gpt-*, o*, chatgpt*)
- Marks reasoning models (`o*`, `gpt-5*`) with `hasReasoning: true`
- Returns `{ name, slug, hasReasoning }` for each model

### toolify()
Helper to create OpenAI tool definitions from regular functions.

```typescript
toolify<T>(
  fn: T,
  name: string,
  description: string,
  argumentsMap: Record<string, TToolArguments>
): TTool
```

- Generates the JSON schema required by OpenAI function calling
- Returns `{ schema: ChatCompletionTool, function: callable }`

### createToolsMap()
Converts an array of `TTool` objects into a function map for use with completion functions.

```typescript
createToolsMap(functions: TTool[]): Record<string, (args) => Promise<string>>
```

---

## Background Script AI

The background service worker (`src/background.ts`) has its own `createCompletion()` that uses raw `fetch()` instead of the OpenAI SDK (to keep the bundle small and avoid shared chunks with the main app):

```javascript
const createCompletion = async (request, callback) => {
  const apiKey = await ChromeStorageManager.get("openaiApiKey");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_completion_tokens || 500,
      response_format: { type: "text" },
    }),
  });
  // ...
};
```

This is triggered via `chrome.runtime.onMessage` with `action: "generateCompletion"`.

---

## AI Use Cases in the Extension

| Feature              | Model Used   | Function                            | Purpose                            |
| -------------------- | ------------ | ----------------------------------- | ---------------------------------- |
| Chat                 | User-selected| `createStreamingResponse()`         | Conversational AI                  |
| Chat (with tools)    | User-selected| `createStreamingResponseWithFunctions()` | AI with function calling      |
| Theme generation     | gpt-4o-mini  | `createCompletion()`                | Generate color schemes from prefs  |
| Auto-complete        | gpt-4o-mini  | Background `createCompletion()`     | Fill inputs on web pages           |
| Translate selection  | gpt-4o-mini  | Background `createCompletion()`     | Translate text to English          |
| Fix grammar          | gpt-4o-mini  | Background `createCompletion()`     | Grammar/spelling correction        |
| Formatters           | Configurable | `createCompletion()`                | AI text formatting                 |
| Transcription        | whisper-1    | `createTranscription()`             | Audio to text                      |
| Text-to-speech       | Configurable | `createSpeech()`                    | Generate spoken audio              |

---

## Request Type Reference

```typescript
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

type TStreamingResponseRequest = {
  messages: TMessage[];
  model: TModel;        // Full model object (name, slug, hasReasoning)
  temperature: number;
  max_completion_tokens: number;
};
```

---

## Important Notes for Developers

1. **API key is user-provided**: Never hardcode keys. The key is stored in Chrome storage and loaded at runtime.
2. **Browser mode**: The SDK uses `dangerouslyAllowBrowser: true`. This means the API key is exposed in the browser. This is intentional since each user provides their own key.
3. **Reasoning models**: When `model.hasReasoning` is true, `temperature` is set to `undefined` (OpenAI requirement for o-series models).
4. **Two AI execution paths**: The popup uses the OpenAI SDK directly; the background script (`src/background.ts`) uses raw `fetch()`. They share the same API key from storage. Both are now TypeScript.
5. **Error handling**: Errors from AI calls typically show a toast notification (`react-hot-toast`) or a Chrome notification (from background script).
