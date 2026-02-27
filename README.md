# Automator — Chrome Extension

A Chrome extension that brings AI-powered productivity tools directly into your browser. Manage notes, tasks, and snippets from the popup, and use keyboard shortcuts or the right-click menu to autocomplete, translate, and fix grammar on any page.

## Features

### In-popup app
| Route | Feature |
|---|---|
| `/` | Home / dashboard |
| `/notes` | Markdown note editor and manager |
| `/tasks` | Task manager with priorities, status, estimated time, and reminders |
| `/chat` | AI chat interface |
| `/snapties` | Saved snippets / bookmarks |
| `/calendar` | Calendar view |
| `/formatters` | Text formatters |
| `/config` | Extension settings (OpenAI API key, theme, etc.) |

### Page-level AI actions
These work on any webpage via keyboard shortcut or right-click context menu:

| Action | Shortcut (Windows/Mac) | Description |
|---|---|---|
| Auto Complete | `Ctrl+Shift+V` / `⌘+Shift+V` | AI fills the focused input based on page context |
| Translate | `Ctrl+Shift+L` / `⌘+Shift+L` | Toggle EN ↔ ES translation of selected text |
| Fix Grammar | `Ctrl+Shift+K` / `⌘+Shift+K` | Correct grammar and spelling in selected text |
| Open Automator | `Ctrl+Shift+Y` / `⌘+Shift+Y` | Open the extension popup in a tab |

Translation and grammar results are applied in-place for editable elements. For read-only selections, a clickable notification appears — click it to copy the result.

Task reminders fire as desktop notifications via Chrome Alarms at a configurable interval.

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **Mantine** (UI components, dark theme)
- **React Router** (client-side routing inside the popup)
- **Zustand** (state management)
- **i18next** (internationalization)
- **React Hot Toast** (toast notifications)
- **OpenAI API** (`gpt-4o-mini`) — called directly from the service worker
- **Chrome Extensions Manifest V3**

## Setup

### Prerequisites
- Node.js 18+
- A Chromium-based browser (Chrome, Edge, Brave, …)
- An OpenAI API key

### Install & build

```bash
npm install
npm run build
```

### Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

### Add your API key

Open the extension popup → go to **Config** → paste your OpenAI API key.

## Development

```bash
npm run dev
```

This starts the Vite dev server. For extension testing, rebuild with `npm run build` and reload the unpacked extension in `chrome://extensions`.

## Optional server (Stripe payments)

The `server/` directory contains an Express + TypeScript backend for subscription payments via Stripe. It is not required for local use.

```bash
cd server
cp .env.example .env   # fill in STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET
npm install
npm run dev
```

Endpoints:
- `POST /api/create-checkout-session` — create a Stripe Checkout session
- `POST /api/webhook` — handle Stripe webhook events

## Permissions used

| Permission | Reason |
|---|---|
| `storage` | Persist notes, tasks, config |
| `notifications` | Task reminders and AI action results |
| `alarms` | Scheduled task reminders |
| `contextMenus` | Right-click AI actions |
| `scripting` | Inject AI action functions into pages |
| `commands` | Keyboard shortcuts |
| `tts` | Text-to-speech (future use) |
| `<all_urls>` | Run content scripts and scripting on any page |
