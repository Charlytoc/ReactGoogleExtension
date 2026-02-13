# Data Models & Storage Schema

## TypeScript Types

All types are defined in `src/types.ts`.

### TNote
```typescript
type TBackgroundType = "gradient" | "solid" | "none" | "image";

type TNote = {
  id: string;
  title?: string;
  content?: string;
  color?: string;
  backgroundType?: TBackgroundType;
  color2?: string;
  tags?: string[];
  font?: string;
  archived?: boolean;
  createdAt?: string;
  imageURL?: string;
  opacity?: number;
};
```

### TTask
```typescript
type TTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "";
type TTaskPriority = "low" | "medium" | "high";

type TTask = {
  id: string;
  title: string;
  description?: string;
  status?: TTaskStatus;
  createdAt?: string;
  startDatetime?: string;
  dueDatetime?: string;
  reminderEvery?: number;
  motivationText?: string;
  estimatedTime?: number;
  estimatedTimeUnit?: string;
  lastReminderAt?: string;
  priority: TTaskPriority;
};
```

### TConversation & TMessage
```typescript
type TMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  hidden?: boolean;
};

type TConversation = {
  id: string;
  title: string;
  date: string;
  messages: TMessage[];
};
```

### TSnaptie
```typescript
type TSnaptie = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  category: string;
  isUrl: boolean;
  color: string;
};
```

### TFormatter & TFormatterInput
```typescript
type TFormatterInput = {
  id: string;
  label: string;
  rememberLastValue?: boolean;
  lastValue?: string;
};

type TFormatter = {
  id: string;
  title: string;
  description?: string;
  inputs: TFormatterInput[];
  prompt: string;
  createdAt: string;
  updatedAt?: string;
  category?: string;
  color?: string;
};
```

### TModel
```typescript
type TModel = {
  name: string;       // Human-friendly name (e.g., "Gpt 4o mini")
  slug: string;       // API model ID (e.g., "gpt-4o-mini")
  hasReasoning: boolean; // true for o-series and gpt-5 models
};
```

### Config Types (Zustand Store)
```typescript
type TChatConfig = {
  autoSaveNotes: boolean;
  setTitleAtMessage: number;
};

type TAuthConfig = {
  openaiApiKey: string;
};

type TTheme = {
  fontColor: string;
  backgroundColor: string;
  activeColor: string;
  fontColorSecondary: string;
  backgroundColorSecondary: string;
  themePreferences: string;
  imageURL: string;
  backgroundType: TBackgroundType;
};

type TConfig = {
  chat: TChatConfig;
  auth: TAuthConfig;
  theme: TTheme;
};
```

### Additional Types (defined but used internally)
```typescript
type TNotesConfig = {
  autoSaveNotes: boolean;
  useAiSuggestions: boolean;
  useAiMotivation: boolean;
  reasoningEnabled: boolean;
  useAiSummary: boolean;
};

type TNoteHistory = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  color: string;
  tags: string[];
  archived: boolean;
};
```

---

## Chrome Storage Schema

All data is stored in `chrome.storage.local` as flat key-value pairs.

| Key                  | Type               | Description                              |
| -------------------- | ------------------ | ---------------------------------------- |
| `notes`              | `TNote[]`          | All user notes                           |
| `tasks`              | `TTask[]`          | All user tasks                           |
| `conversations`      | `TConversation[]`  | All chat conversations                   |
| `snapties`           | `TSnaptie[]`       | All quick snippets                       |
| `formatters`         | `TFormatter[]`     | All text formatters                      |
| `openaiApiKey`       | `string`           | User's OpenAI API key                    |
| `colorPreferences`   | `TTheme`           | Theme/color configuration                |
| `language`           | `string`           | UI language (`"en"` or `"es"`)           |
| `lastPage`           | `string`           | Last visited route (for navigation)      |
| `prevPage`           | `string`           | Previous visited route                   |
| `nameFilter`         | `string`           | Persisted search filter text             |

### Storage Manager API

Located in `src/managers/Storage.ts`:

```typescript
class ChromeStorageManager {
  static async add(key: string, value: any): Promise<void>;
  static async get(key: string): Promise<any>;
  static async delete(key: string): Promise<void>;
}
```

All methods are Promise-based wrappers around `chrome.storage.local`.

---

## Zustand Store

Located in `src/managers/store.ts`:

```typescript
const useStore = create<TStore>((set, get) => ({
  config: {
    chat: {
      autoSaveNotes: false,
      setTitleAtMessage: 0,
    },
    auth: {
      openaiApiKey: "",
    },
    theme: {
      fontColor: "#FFFFFF",
      backgroundColor: "#0b0c14",
      activeColor: "#FF007F",
      fontColorSecondary: "#B0B0B0",
      backgroundColorSecondary: "#151e47",
      themePreferences: "",
      imageURL: "",
      backgroundType: "solid",
    },
  },
  setConfig: (newConfig: Partial<TConfig>) => {
    const { config } = get();
    set({ config: { ...config, ...newConfig } });
    return true;
  },
}));
```

**Important**: The Zustand store only holds runtime configuration (theme, auth, chat settings). It does **not** persist automatically — persistence is done by explicitly calling `ChromeStorageManager.add()` (e.g., in the Config page's save button).

Entity data (notes, tasks, conversations, etc.) is **not** in the Zustand store. Each component loads its own data directly from Chrome storage on mount.

---

## ID Generation

IDs are generated using:
```typescript
const generateRandomId = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);
```

This produces ~26-character alphanumeric strings. No UUID library is used.
