# Automator - Project Overview

## What is Automator?

**Automator** is a Chrome browser extension (Manifest V3) that serves as an AI-powered productivity suite. It combines note-taking, task management, AI chat, text formatting, quick snippets, and browser automation — all accessible from a popup or keyboard shortcuts.

- **Extension name**: Automator
- **Current version**: 0.0.53
- **Package name**: `automator` (client) / `automator-server` (server)

## Purpose

The extension is designed to help users:

1. **Manage notes** — create rich, customizable notes with markdown, tags, colors, and backgrounds
2. **Track tasks** — organize tasks with priorities, statuses, due dates, and recurring reminders
3. **Chat with AI** — have conversations with OpenAI models (including streaming and function calling)
4. **Format text with AI** — create reusable "Formatters" that transform inputs using AI prompts
5. **Save quick snippets** — "Snapties" for saving and organizing text clips and URLs by category
6. **Automate browser actions** — auto-complete inputs, translate selections, and fix grammar directly on any webpage

## Tech Stack

| Layer            | Technology                                        |
| ---------------- | ------------------------------------------------- |
| Frontend         | React 18 + TypeScript                             |
| Build tool       | Vite 6 (with SWC for Fast Refresh)                |
| Styling          | Mantine v8 + CSS variables + component CSS        |
| State management | Zustand 5                                         |
| Routing          | React Router 7                                    |
| AI               | OpenAI SDK (`openai` npm package)                 |
| i18n             | react-i18next (English + Spanish)                 |
| Toasts           | react-hot-toast                                   |
| Markdown         | react-markdown + remark-gfm                       |
| Icons            | @tabler/icons-react + custom inline SVGs          |
| Persistence      | chrome.storage.local                              |
| Backend          | Express.js + Stripe (subscription payments)       |
| Extension        | Chrome Manifest V3                                |

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│                 Chrome Extension                 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Popup   │  │Background│  │Content Script  │  │
│  │ (React)  │  │(Service  │  │(Injected into  │  │
│  │          │  │ Worker)  │  │  web pages)    │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │          │
│       ├──────────────┼────────────────┤          │
│       │     chrome.runtime messages   │          │
│       │     chrome.storage.local      │          │
│       │     chrome.alarms             │          │
│       │     chrome.notifications      │          │
│       │                               │          │
│  ┌────┴───────────────────────────────┴──────┐   │
│  │          OpenAI API (external)            │   │
│  └───────────────────────────────────────────┘   │
│                                                  │
│  ┌───────────────────────────────────────────┐   │
│  │    Express Server (Stripe payments)       │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Browser-first AI**: The OpenAI SDK runs directly in the browser (`dangerouslyAllowBrowser: true`) using the user's own API key, avoiding the need for a backend proxy for AI calls.
2. **Chrome Storage**: All data (notes, tasks, conversations, snapties, formatters, settings) is persisted in `chrome.storage.local`, making it portable and offline-capable.
3. **No database**: There is no traditional database. Everything is stored in Chrome's local storage.
4. **Zustand for runtime state**: Only theme/config is managed in Zustand; entity data (notes, tasks, etc.) is loaded directly from Chrome storage in each component.
5. **TypeScript background script**: The background service worker (`src/background.ts`) is written in TypeScript and built by Vite as a separate entry point. It uses `import type` for shared types (erased at compile time), keeping the output self-contained. The manifest declares `"type": "module"` for the service worker (Chrome 92+).
6. **Stripe server is optional**: The Express server exists only for subscription payment handling. The extension works fully without it.
