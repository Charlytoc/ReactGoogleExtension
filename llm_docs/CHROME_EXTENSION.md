# Chrome Extension Details

## Manifest V3

The extension uses Chrome Manifest V3. The full manifest is at `public/manifest.json`.

### Key Manifest Properties

```json
{
  "manifest_version": 3,
  "name": "Automator",
  "version": "0.0.53",
  "description": "A AI Agent to help you manage your tasks and make them automatically with AI right in your browser",
  "action": {
    "default_popup": "index.html"
  }
}
```

### Permissions

| Permission      | Purpose                                                |
| --------------- | ------------------------------------------------------ |
| `storage`       | Persist all data in `chrome.storage.local`             |
| `notifications` | Show task reminders and translation/grammar results    |
| `alarms`        | Schedule recurring task reminders                      |
| `contextMenus`  | Right-click menu items (auto-complete, translate, fix) |
| `scripting`     | Inject functions into active web pages                 |
| `commands`      | Register keyboard shortcuts                            |
| `tts`           | Text-to-speech (currently unused/commented out)        |

### Host Permissions
```json
"host_permissions": ["<all_urls>"]
```
Required for injecting scripts and reading page content on any website.

---

## Keyboard Shortcuts (Commands)

| Command              | Windows/Default    | Mac               | Description                   |
| -------------------- | ------------------ | ----------------- | ----------------------------- |
| `auto-complete`      | Ctrl+Shift+V       | Cmd+Shift+V       | AI auto-complete active input |
| `open-automator`     | Ctrl+Shift+Y       | Cmd+Shift+Y       | Open/focus extension popup    |
| `translate-selection`| Ctrl+Shift+L       | Cmd+Shift+L       | Translate selected text       |
| `check-grammar`      | Ctrl+Shift+G       | Cmd+Shift+G       | Fix grammar of selected text  |

These are defined in `manifest.json` under `"commands"` and handled in `background.js` via `chrome.commands.onCommand.addListener()`.

---

## Context Menus

Created on `chrome.runtime.onInstalled`:

| Menu Item            | Context      | Action                              |
| -------------------- | ------------ | ----------------------------------- |
| "Auto Complete"      | `all`        | AI-fills the focused input          |
| "Translate to English"| `selection` | Translates selected text to English |
| "Fix Grammar"        | `selection`  | Fixes grammar of selected text      |

---

## Background Service Worker

**File**: `src/background.ts` (TypeScript, built by Vite as a separate entry point → `dist/background.js`)

The background script is configured as an ES module service worker (`"type": "module"` in manifest.json, supported since Chrome 92). It uses `import type` from shared types (`src/types.ts`) which are erased at compile time, so the output is self-contained with no runtime imports.

### Responsibilities

1. **Context menu creation**: Sets up right-click menu items on install
2. **Command handling**: Listens for keyboard shortcuts
3. **Script injection**: Uses `chrome.scripting.executeScript()` to run AI functions in the active tab
4. **Message passing**: Acts as a bridge for AI completions
   - Content scripts send `{ action: "generateCompletion", ... }` → background fetches OpenAI → sends response back
   - Also handles `{ action: "notify", ... }` for showing notifications
5. **Alarm management**: Listens for `chrome.alarms.onAlarm` to show task reminders
6. **Notification click handling**: When a "copyable" notification is clicked, copies text to clipboard via the active tab
7. **Storage management**: Has its own `ChromeStorageManager` (self-contained TypeScript implementation, separate from `src/managers/Storage.ts` to avoid shared chunks)

### Message Protocol

Messages sent between content/popup and background:

```javascript
// Request AI completion
{ action: "generateCompletion", model, messages, max_completion_tokens, temperature, response_format }
// → Response: string (completion text) or null (error)

// Show notification
{ action: "notify", title, message, copyable? }
// → No response
```

### Script Injection Pattern

For keyboard shortcuts and context menus, the background script injects functions directly into the active tab:

```javascript
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: autoComplete,        // The actual function to execute
  injectImmediately: true
});
```

The injected functions (`autoComplete`, `translateSelection`, `checkGrammar`) read the DOM, then communicate back via `chrome.runtime.sendMessage()`.

---

## Content Script

**File**: `public/content.js`

**Current status**: Disabled (all code is commented out).

Originally intended for showing an auto-complete button when inputs are focused. The functionality was moved to the background script's injection approach.

---

## Popup (Main UI)

The popup is a full React SPA loaded from `index.html`. It has a fixed size defined in CSS:

```css
--extension-width: 500px;
--extension-height: 600px;
```

The popup opens when clicking the extension icon in the toolbar, or can be opened as a full tab via Ctrl+Shift+Y.

---

## Extension Icons

| File             | Size     | Used For                        |
| ---------------- | -------- | ------------------------------- |
| `icon-16.png`    | 16x16    | Toolbar icon                    |
| `icon-48.png`    | 48x48    | Extension management page       |
| `icon-128.png`   | 128x128  | Chrome Web Store / install      |
| `icon.png`       | Source   | Base image for icon generation  |

Icons are generated from `icon.png` using the `src/utils/generateIcons.js` script (which uses the `sharp` library).

---

## Notification System

### Creating Notifications
```javascript
chrome.notifications.create(id, {
  title: string,
  message: string,
  iconUrl: "icons/icon.png",
  type: "basic"
});
```

### Copyable Notifications
When `copyable: true`, the notification message includes "(Click to copy)". On click:
1. The `pendingCopies` Map stores text by notification ID
2. `chrome.notifications.onClicked` handler retrieves the text
3. Uses `chrome.scripting.executeScript()` to write to clipboard in the active tab
4. Shows a confirmation notification

---

## Alarm System (Task Reminders)

### Creating Alarms
```javascript
// Recurring reminder
chrome.alarms.create(taskId, { periodInMinutes: reminderEvery });

// End-of-task alarm
chrome.alarms.create(taskId + "-endOfTask", {
  when: Date.now() + estimatedTimeInMs
});
```

### Handling Alarms
```javascript
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Check if it's an end-of-task alarm
  if (alarm.name.includes("-endOfTask")) {
    // Notify that task should be done
    // Clear both alarms
    return;
  }
  // Regular reminder: show notification with motivation text
  // Update lastReminderAt in storage
});
```

---

## Storage Considerations

- `chrome.storage.local` has a default quota of ~5MB (10MB with `unlimitedStorage` permission — not currently requested)
- All data is stored as JSON-serializable objects
- There is no migration system — schema changes could break existing stored data
- The background script and popup share the same storage space
