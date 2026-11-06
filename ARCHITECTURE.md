# Architecture

Automator is a Manifest V3 Chrome extension. One React app is the popup and a full tab. A service worker calls the model and owns page actions. Notes and tasks stay in `chrome.storage.local`.

Read this file before changing how the popup, the worker, or a web page talk. Update it when one of those boundaries changes.

## Runtimes

| Piece | Entry | Role |
|---|---|---|
| React UI | `index.html` → `src/main.tsx` | Screens, editing, starting AI jobs |
| Service worker | `src/background.ts` → `background.js` | Model calls, jobs, alarms, shortcuts, context menus |
| Content script | `public/content.js` | Registered on every page. The file body is commented out |
| Stripe server | `server/index.ts` | Optional checkout. Local use does not need it |

Page actions do not live in `content.js`. `autoComplete`, `translateSelection`, and `checkGrammar` sit at the bottom of `src/background.ts`. Chrome injects them with `chrome.scripting.executeScript`. Each function must stay self-contained. No imports and no module variables inside them.

The same React tree mounts in the popup and in a tab. `src/main.tsx` adds `extension-popup` or `extension-tab` on `document.body`. A tab also saves `lastExtensionTab` so the worker can focus it.

Routes live in `src/main.tsx`: `/`, `/notes`, `/notes/:id`, `/tasks`, `/tasks/:id`, `/chat`, `/config`, `/command-shortcuts`, `/snapties`, `/snapties/:id`, `/formatters`, `/formatters/:id`.

## Who calls the model

The UI never calls the model with the API key. It sends `chrome.runtime.sendMessage` to the worker. The worker reads the key from storage and calls the API.

`chrome.runtime.onMessage` in `src/background.ts` handles these actions:

| Action | Reply |
|---|---|
| `generateCompletion` | Waits, then `sendResponse` with the text |
| `extensionToolCompletion` | Same wait. Commands: `auto-complete`, `translate-selection`, `check-grammar` |
| `generateChatTurn` | Accepts and returns. Progress is in storage |
| `generateNoteAssistantTurn` | Accepts and returns. Progress is in storage |
| `generateNoteImage` | Accepts and returns. Progress is in storage |
| `generateNoteCover` | Accepts and returns. Progress is in storage |
| `notify` | Shows a desktop notification |

Chat, note-assistant, and image work are jobs. The worker can die, so the job record stays in storage and the UI reads it back. Job helpers: `src/utils/chatJobs.ts`, `src/utils/noteAssistantJobs.ts`, `src/utils/imageJobs.ts`.

Shortcut prompts can be overridden. Overrides live under `commandPromptOverrides` (`src/commandPrompts.ts`).

## Storage

`src/managers/Storage.ts` is the UI's door to storage. Inside the extension it uses `chrome.storage.local`. In a normal browser it uses `localStorage`. The worker has its own small copy of that door in `src/background.ts`.

Durable records:

| Key | What |
|---|---|
| `notes`, `tasks`, `snapties`, `formatters` | The user's lists |
| `conversations`, `lastMainConversationId` | Chat threads |
| `aiConfig`, `openaiApiKey`, `language`, `colorPreferences` | Settings |
| `commandPromptOverrides` | Shortcut prompt text |
| `aiChatJobs`, `aiNoteAssistantJobs`, `aiImageJobs`, `aiCoverJobs` | In-flight AI work |
| `lastExtensionTab` | Tab to focus when opening Automator |

`src/utils/backup.ts` exports and imports the user lists and settings. It does not include job keys. Optional cloud copy goes through Supabase in `src/utils/cloudSync.ts` (`notes_ext_backups`). That path needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Zustand (`src/managers/store.ts`) holds in-memory UI config only. It is not the database.

## Build

Vite has two inputs in `vite.config.ts`: `index.html` and `src/background.ts`. The worker file is emitted as `background.js`. `public/` is copied as-is, including `manifest.json` and `content.js`. Load the unpacked extension from `dist/`.

`npm run build` is `tsc -b && vite build`. Run it after application, config, or dependency changes.

## Change this here

| You want to… | Edit |
|---|---|
| Add a screen | A route in `src/main.tsx` and a page under `src/routes/` or `src/components/` |
| Add a keyboard shortcut | `commands` in `public/manifest.json`, then the listener in `src/background.ts` |
| Change a page AI action | The injected function in `src/background.ts`, and keep it self-contained |
| Add a model tool for chat or notes | `src/utils/chatTools.ts` or `src/utils/noteAssistantTools.ts`, plus the job runner in `src/background.ts` |
| Store a new user record | A key via `ChromeStorageManager`, and add it to `BACKUP_KEYS` in `src/utils/backup.ts` if backups should include it |
| Add a payment endpoint | `server/index.ts` only. The extension still runs without that server |
