# AI Integration (OpenAI)

## Overview

The extension integrates with the OpenAI API for all AI features. The user provides their own API key, which is stored in `chrome.storage.local` under the key `"openaiApiKey"`.

**Important**: The OpenAI SDK runs directly in the browser with `dangerouslyAllowBrowser: true`. There is no backend proxy for AI calls — the user's API key is sent directly from the extension to OpenAI.

## AI Utility Functions

All AI functions are in `src/utils/ai.ts`.

### createCompletion()
Standard Responses API call (non-streaming).

```typescript
createCompletion(
  request: TCompletionRequest,
  callback?: (response: Response) => void
): Promise<string>
```

- Uses `openai.responses.create()` with `input`, `max_output_tokens`, and optional `text.format`
- Used for: theme generation, note title generation, formatter execution
- Returns `response.output_text`

### createStreamingResponseWithFunctions()
Streaming Responses API with custom function tools.

```typescript
createStreamingResponseWithFunctions(
  request: TCompletionRequest,
  callback: (textDelta: string) => void
): Promise<void>
```

- Used for: Chat and note AI prompter
- Streams `response.output_text.delta` events to the callback
- On `response.completed`, appends model output items to `input` and posts `function_call_output` items until no more tool calls

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

- Generates the JSON schema required by Responses API function tools
- Returns `{ schema: FunctionTool, function: callable }` (`type: "function"` with top-level `name`, `parameters`, `strict`)

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
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      input: request.messages,
      max_output_tokens: request.max_completion_tokens || 500,
      store: false,
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
| Chat (with tools)    | User-selected| `createStreamingResponseWithFunctions()` | Conversational AI + tools   |
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
  messages: ResponseInput;  // EasyInputMessage[] and/or function_call_output items
  model: string;
  apiKey: string;
  max_completion_tokens: number;
  response_format?: { type: "json_object" | "text" };  // mapped to text.format
  tools?: FunctionTool[];
  tool_choice?: "auto" | "none" | "required";
  functionMap?: Record<string, (args: Record<string, any>) => Promise<string>>;
};
```

---

## Important Notes for Developers

1. **API key is user-provided**: Never hardcode keys. The key is stored in Chrome storage and loaded at runtime.
2. **Browser mode**: The SDK uses `dangerouslyAllowBrowser: true`. This means the API key is exposed in the browser. This is intentional since each user provides their own key.
3. **Two AI execution paths**: The popup uses the OpenAI SDK directly; the background script (`src/background.ts`) uses raw `fetch()`. They share the same API key from storage. Both are now TypeScript.
4. **Error handling**: Errors from AI calls typically show a toast notification (`react-hot-toast`) or a Chrome notification (from background script).
