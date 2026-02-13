# Features

## 1. Notes

**Routes**: `/notes` (list), `/notes/:id` (detail)
**Components**: `NotesManager`, `Note`
**Storage key**: `"notes"` → `TNote[]`

### Capabilities
- **Create/Edit/Delete** notes with title, content (markdown), and tags
- **Markdown support**: Full markdown rendering with `react-markdown` + GFM (tables, strikethrough, etc.)
- **Customizable appearance**:
  - Background type: `gradient`, `solid`, `none`, `image`
  - Two colors for gradients (`color`, `color2`)
  - Custom font selection
  - Opacity control
  - Background image URL
- **Tags**: Add tags to categorize notes; filter notes by tag
- **Archiving**: Archive notes to hide them from the main view
- **Search & filter**: Filter notes by text, tags, or archived status
- **AI-assisted**: Generate titles and color suggestions via OpenAI

### Note Structure
```typescript
{
  id: string;
  title?: string;
  content?: string;       // Markdown text
  color?: string;         // Primary color
  color2?: string;        // Secondary color (for gradients)
  backgroundType?: "gradient" | "solid" | "none" | "image";
  tags?: string[];
  font?: string;
  archived?: boolean;
  createdAt?: string;
  imageURL?: string;
  opacity?: number;
}
```

---

## 2. Tasks

**Routes**: `/tasks` (list), `/tasks/:id` (detail)
**Components**: `TaskManager`, `TaskCard`, `TaskForm`
**Storage key**: `"tasks"` → `TTask[]`

### Capabilities
- **Create/Edit/Delete** tasks with full form
- **Status tracking**: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`
- **Priority levels**: `low`, `medium`, `high`
- **Scheduling**: Start date/time and due date/time
- **Reminders**: Set recurring reminders via `chrome.alarms` (every N minutes)
  - Notification includes motivation text or description
  - End-of-task alarm fires when estimated time is up
  - `lastReminderAt` tracks the most recent reminder
- **Motivation text**: Custom text shown in reminder notifications
- **Time estimation**: Set estimated time with configurable units
- **Calendar view**: Visualize tasks on a calendar (`/calendar` route)

### Task Structure
```typescript
{
  id: string;
  title: string;
  description?: string;
  status?: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "";
  priority: "low" | "medium" | "high";
  createdAt?: string;
  startDatetime?: string;
  dueDatetime?: string;
  reminderEvery?: number;       // Minutes between reminders
  motivationText?: string;      // Shown in notifications
  estimatedTime?: number;
  estimatedTimeUnit?: string;   // e.g., "minutes", "hours"
  lastReminderAt?: string;      // ISO timestamp
}
```

### Alarm System
- When a task has `reminderEvery` set, a `chrome.alarms.create()` call is made with `periodInMinutes`
- An additional `{taskId}-endOfTask` alarm is created if `estimatedTime` is provided
- The background script listens for `chrome.alarms.onAlarm` and creates notifications
- After firing, `lastReminderAt` is updated in storage

---

## 3. AI Chat

**Route**: `/chat`
**Component**: `Chat`
**Storage key**: `"conversations"` → `TConversation[]`

### Capabilities
- **Multi-conversation**: Create and switch between multiple conversations
- **Streaming responses**: Real-time token-by-token output
- **Function calling**: AI can call registered tools/functions and use results
- **Model selection**: Dynamically lists available OpenAI models from user's API key
- **Reasoning model support**: Detects reasoning models (o-series, gpt-5) and adjusts parameters
- **Auto-save**: Conversations persist to Chrome storage
- **Title generation**: Can auto-generate conversation titles after N messages
- **Markdown rendering**: AI responses render as styled markdown

### Conversation Structure
```typescript
{
  id: string;
  title: string;
  date: string;
  messages: TMessage[];
}

// Each message:
{
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  hidden?: boolean;
}
```

---

## 4. Formatters

**Routes**: `/formatters` (list), `/formatters/:id` (detail)
**Component**: `Formatters`
**Storage key**: `"formatters"` → `TFormatter[]`

### Capabilities
- **Create reusable AI text formatters**: Define a prompt template with named inputs
- **Dynamic inputs**: Each formatter has N configurable inputs with labels
- **Remember last values**: Inputs can optionally remember their last used value
- **Run formatter**: Fill in inputs → AI processes the prompt → get formatted output
- **Auto-copy**: Results are copied to clipboard automatically
- **Categories**: Organize formatters by category
- **Color coding**: Each formatter can have a custom color

### Example Use Case
A "Meeting Summary" formatter with inputs `[attendees, raw_notes]` and a prompt like:
> "Summarize these meeting notes for {attendees}: {raw_notes}. Return a structured summary with action items."

### Formatter Structure
```typescript
{
  id: string;
  title: string;
  description?: string;
  inputs: TFormatterInput[];   // Dynamic input fields
  prompt: string;              // AI prompt template
  createdAt: string;
  updatedAt?: string;
  category?: string;
  color?: string;
}

// Each input:
{
  id: string;
  label: string;              // Display name
  rememberLastValue?: boolean; // Persist last used value
  lastValue?: string;         // Cached value
}
```

---

## 5. Snapties (Quick Snippets)

**Routes**: `/snapties` (list), `/snapties/:id` (detail)
**Component**: `Snapties`
**Storage key**: `"snapties"` → `TSnaptie[]`

### Capabilities
- **Save text clips or URLs** as quick-access snippets
- **Categories**: Organize snapties by category; filter by category
- **Search**: Full-text search across snapties
- **Keyboard navigation**: Navigate between snapties with keyboard
- **Copy to clipboard**: One-click copy
- **URL detection**: Automatically detects if content is a URL (`isUrl` flag)
- **Color coding**: Each snaptie has a custom color

### Snaptie Structure
```typescript
{
  id: string;
  title: string;
  content: string;
  createdAt: string;
  category: string;
  isUrl: boolean;
  color: string;
}
```

---

## 6. Browser Automation (Keyboard Shortcuts & Context Menus)

These features work on any webpage via the background service worker and content script injection.

### Auto-Complete (Ctrl+Shift+V / Context Menu)
- Reads the active input/textarea element and the full page text
- Sends context to GPT-4o-mini to predict the best completion
- Fills the active element with the AI-generated text
- Works on `<input>`, `<textarea>`, and `contenteditable` elements

### Translate Selection (Ctrl+Shift+L / Context Menu)
- Reads the selected text on the page
- Translates to English using GPT-4o-mini
- **In editable fields**: Replaces the selection inline
- **In non-editable areas**: Shows a notification with the translation (click to copy)

### Fix Grammar (Ctrl+Shift+G / Context Menu)
- Reads the selected text
- Fixes grammar, spelling, and punctuation (preserves original language)
- **In editable fields**: Replaces the selection inline
- **In non-editable areas**: Shows a notification with the corrected text (click to copy)

### Open Automator (Ctrl+Shift+Y)
- Opens or focuses the extension popup in a new tab

---

## 7. Settings / Configuration

**Route**: `/config`
**Component**: `Config`

### Capabilities
- **API Key management**: Set and save OpenAI API key
- **Language selection**: Switch between English and Spanish
- **Theme customization**:
  - 5 color pickers: active, font, font-secondary, background, background-secondary
  - Background type: gradient, solid, image
  - Image URL for background
  - Theme preferences text (used for AI theme generation)
- **AI theme generation**: Describe preferences in text → AI generates a matching color scheme
- **Copy colors**: Export current color scheme to clipboard as CSS variables

### Storage Keys
- `"openaiApiKey"` → string
- `"colorPreferences"` → TTheme object
- `"language"` → `"en"` | `"es"`

---

## 8. Calendar

**Route**: `/calendar`
**Component**: `Calendar`

### Capabilities
- Calendar grid view showing tasks and notes by date
- Visual overview of scheduled items
- Navigate between months

---

## 9. Command Palette

**Component**: `CommandPalette`

### Capabilities
- Quick action launcher (similar to VS Code Ctrl+K)
- Search and jump to features quickly

---

## 10. Page Reader

**Component**: `PageReader`

### Capabilities
- Extract content/HTML from the current web page
- Extract clickable and editable elements
- Used for AI context when performing browser automation

---

## 11. Money Manager

**Component**: `MoneyManager`

A budgeting/money tracking feature (implementation details in the component).

---

## 12. Internationalization

- **Languages**: English (`en.json`) and Spanish (`es.json`)
- **Library**: `react-i18next`
- **Usage**: `useTranslation()` hook → `t("key")` for translations
- **Persistence**: Language choice saved in Chrome storage (`"language"` key)
- **Initialization**: `src/internationalization.ts` configures i18next with both locale files
