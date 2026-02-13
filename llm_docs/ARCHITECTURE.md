# Architecture & File Structure

## Directory Tree

```
notes-ext/
├── index.html                  # Single HTML entry point (React SPA)
├── package.json                # Client dependencies & scripts
├── vite.config.ts              # Vite config (React SWC, API proxy)
├── postcss.config.cjs          # PostCSS config (Mantine preset)
├── tsconfig.json               # TS project references
├── tsconfig.app.json           # TS config for src/
├── tsconfig.node.json          # TS config for vite.config.ts
├── eslint.config.js            # ESLint config
│
├── public/                     # Static assets (copied to dist/ as-is)
│   ├── manifest.json           # Chrome Extension manifest (v3)
│   ├── content.js              # Content script (currently disabled)
│   ├── vite.svg                # Favicon
│   └── icons/                  # Extension icons
│       ├── icon.png            # Source icon
│       ├── icon-16.png         # 16x16 generated
│       ├── icon-48.png         # 48x48 generated
│       └── icon-128.png        # 128x128 generated
│
├── src/
│   ├── main.tsx                # React entry + React Router + MantineProvider setup
│   ├── theme.ts                # Mantine theme (colors, fonts, component defaults)
│   ├── index.css               # Global styles, CSS variables, legacy utility classes
│   ├── types.ts                # All TypeScript type definitions
│   ├── vite-env.d.ts           # Vite type declarations
│   ├── internationalization.ts # i18next initialization
│   │
│   ├── assets/
│   │   └── svgs.tsx            # 30+ inline SVG icon components (SVGS object)
│   │
│   ├── components/             # Reusable UI components
│   │   ├── Button/             # Button with icon support
│   │   ├── Calendar/           # Calendar view for tasks
│   │   ├── Chat/               # AI chat interface
│   │   ├── CircularProgress/   # Loading spinner
│   │   ├── CommandPalette/     # Command palette (quick actions)
│   │   ├── Container/          # Layout container wrapper
│   │   ├── Content/            # Home page navigation buttons
│   │   ├── Editor/             # Rich text editor (Yoop.tsx)
│   │   ├── Formatters/         # AI text formatters
│   │   ├── LabeledInput/       # Form input with label
│   │   ├── MoneyManager/       # Money/budget manager
│   │   ├── Navbar/             # Top navigation bar
│   │   ├── Note/               # Single note card
│   │   ├── NotesManager/       # Notes list + CRUD
│   │   ├── PageReader/         # Page content extraction
│   │   ├── RenderMarkdown/     # Markdown rendering
│   │   ├── Section/            # Page section wrapper with header
│   │   ├── Select/             # Dropdown select
│   │   ├── Snapties/           # Quick snippets manager
│   │   ├── TaskManager/        # Tasks list + CRUD + forms
│   │   └── Textarea/           # Markdown-capable textarea
│   │
│   ├── hooks/
│   │   └── useDebounce.ts      # Debounce hook for search/input
│   │
│   ├── locales/
│   │   ├── en.json             # English translations
│   │   └── es.json             # Spanish translations
│   │
│   ├── managers/
│   │   ├── Storage.ts          # ChromeStorageManager wrapper
│   │   ├── store.ts            # Zustand store instance
│   │   └── storeTypes.ts       # Zustand store type definitions
│   │
│   ├── routes/                 # Page-level route components
│   │   ├── index/
│   │   │   └── App.tsx         # Home page
│   │   ├── chat/
│   │   │   └── page.tsx        # Chat page
│   │   ├── config/
│   │   │   └── page.tsx        # Settings page
│   │   ├── formatters/
│   │   │   ├── page.tsx        # Formatters list page
│   │   │   └── detail/
│   │   │       └── page.tsx    # Formatter detail/edit page
│   │   ├── notes/
│   │   │   └── detail/
│   │   │       └── page.tsx    # Note detail/edit page
│   │   ├── snapties/
│   │   │   ├── page.tsx        # Snapties list page
│   │   │   └── detail/
│   │   │       └── page.tsx    # Snaptie detail page
│   │   └── tasks/
│   │       └── detail/
│   │           └── page.tsx    # Task detail/edit page
│   │
│   ├── background.ts           # Background service worker (TypeScript, built as separate Vite entry)
│   │
│   └── utils/
│       ├── ai.ts               # OpenAI SDK wrappers
│       ├── chromeFunctions.ts  # Chrome API helpers
│       ├── generateIcons.js    # Sharp-based icon generator script
│       └── lib.ts              # General utility functions
│
├── server/                     # Backend server (optional)
│   ├── index.ts                # Express + Stripe endpoints
│   ├── package.json            # Server dependencies
│   ├── package-lock.json
│   ├── tsconfig.json           # Server TS config
│   └── .env.example            # Environment variables template
│
└── llm_docs/                   # This documentation directory
```

## Routing Structure

All routing is defined in `src/main.tsx` using React Router v7:

| Route                | Component          | Description             |
| -------------------- | ------------------ | ----------------------- |
| `/` or `/index.html` | `App`              | Home page               |
| `/notes`             | `NotesManager`     | Notes list              |
| `/notes/:id`         | `NoteDetail`       | Note editor             |
| `/tasks`             | `TaskManager`      | Tasks list              |
| `/tasks/:id`         | `TaskDetail`       | Task editor             |
| `/chat`              | `Chat`             | AI chat interface       |
| `/config`            | `Config`           | Settings page           |
| `/snapties`          | `Snapties`         | Snapties list           |
| `/snapties/:id`      | `SnaptieDetail`    | Snaptie detail          |
| `/calendar`          | `Calendar`         | Calendar view           |
| `/formatters`        | `FormattersPage`   | Formatters list         |
| `/formatters/:id`    | `FormatterDetail`  | Formatter editor        |

## Data Flow

### Reading Data
```
Component mount → ChromeStorageManager.get("key") → chrome.storage.local → setState()
```

### Writing Data
```
User action → ChromeStorageManager.add("key", value) → chrome.storage.local
```

### AI Completion (Popup)
```
Component → createCompletion() / createStreamingResponse()
    → OpenAI SDK (browser) → OpenAI API → response → setState()
```

### AI Completion (Background - keyboard shortcuts / context menus)
```
background.js command listener
    → chrome.scripting.executeScript (inject function into active tab)
    → injected function reads page context
    → chrome.runtime.sendMessage("generateCompletion", ...)
    → background.js receives message → fetch OpenAI API
    → sendResponse → injected function receives result → modifies DOM
```

### Task Reminders
```
Task created with reminderEvery → chrome.alarms.create()
    → alarm fires → background.js listener
    → reads tasks from storage → chrome.notifications.create()
    → updates lastReminderAt in storage
```

## Component Hierarchy

```
<BrowserRouter>
  └─ <Routes>
       ├─ App (home)
       │   └─ Content → navigation buttons to each feature
       ├─ NotesManager → Note[] cards
       │   └─ NoteDetail → Note editor (markdown, colors, tags)
       ├─ TaskManager → TaskCard[] + TaskForm
       │   └─ TaskDetail → Task editor (form fields, alarms)
       ├─ Chat → message list + input
       ├─ Config → settings (API key, language, theme colors)
       ├─ Snapties → snaptie cards by category
       │   └─ SnaptieDetail → snaptie editor
       ├─ Calendar → calendar grid with tasks/notes
       ├─ FormattersPage → formatter cards
       │   └─ FormatterDetail → formatter editor + runner
       └─ (shared) Section, Navbar, Button, LabeledInput, Select, etc.
```

## Build Pipeline

1. **Development**: `npm run dev` → Vite dev server with HMR + API proxy to `:3003`
2. **Production**: `npm run build` → `tsc -b && vite build` → outputs to `dist/`
   - Vite builds two entry points: `index.html` (main app) and `src/background.ts` (service worker)
   - The background script is output as `dist/background.js` with a fixed filename (no hash)
   - The main app is output as `dist/assets/main-[hash].js` + CSS
3. **Watch mode**: `npm run watch` → `vite build --watch` (for extension development)
4. **Load in Chrome**: Load `dist/` folder as unpacked extension via `chrome://extensions`

## Key Conventions

- **Component pattern**: Each component lives in its own folder (`ComponentName/ComponentName.tsx` + optional `.css`)
- **Route pages**: Live in `src/routes/{feature}/page.tsx` (Next.js-inspired naming)
- **Storage keys**: Flat keys in chrome.storage.local (e.g., `"notes"`, `"tasks"`, `"openaiApiKey"`)
- **IDs**: Generated with `Math.random().toString(36).substring(2, 15)` concatenation
- **Navigation caching**: `cacheLocation()` / `getLastPage()` stores last visited route
- **CSS variables**: Theme is applied by setting CSS custom properties on `:root`
- **UI library**: Mantine v8 with dark color scheme; components are being incrementally migrated from custom CSS to Mantine
- **Icons**: `@tabler/icons-react` for new icons; legacy custom SVGs in `src/assets/svgs.tsx`
- **Theme**: Defined in `src/theme.ts` using Mantine's `createTheme()`, applied via `MantineProvider` in `main.tsx`
