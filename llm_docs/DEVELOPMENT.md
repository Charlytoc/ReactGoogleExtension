# Development Guide

## Prerequisites

- **Node.js** (v18+ recommended)
- **npm** (comes with Node.js)
- **Google Chrome** (for testing the extension)
- **OpenAI API Key** (for AI features)

---

## Getting Started

### 1. Install Dependencies

```bash
# Client (root directory)
npm install

# Server (optional, only for Stripe payments)
cd server
npm install
```

### 2. Development Mode

```bash
# Start Vite dev server with HMR
npm run dev
```

This starts a local server at `http://localhost:5173` with hot module replacement. The Vite config includes a proxy that forwards `/api` requests to `http://localhost:3003` (the Express server).

> **Note**: For extension development, you typically need the built output. Use watch mode instead.

### 3. Watch Mode (Recommended for Extension Dev)

```bash
npm run watch
```

This runs `vite build --watch`, which rebuilds `dist/` on every file change. You can then reload the extension in Chrome to see changes.

### 4. Production Build

```bash
npm run build
```

Runs `tsc -b && vite build`. Output goes to `dist/`.

### 5. Load Extension in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `dist/` folder
5. The extension icon appears in the toolbar

### 6. Start the Server (Optional)

Only needed if you want Stripe payment functionality:

```bash
cd server
cp .env.example .env
# Fill in your Stripe credentials in .env
npm run dev
```

---

## Available Scripts

### Client (root)

| Script          | Command                      | Description                         |
| --------------- | ---------------------------- | ----------------------------------- |
| `npm run dev`   | `vite`                       | Dev server with HMR                 |
| `npm run build` | `tsc -b && vite build`       | Type-check + production build       |
| `npm run watch` | `vite build --watch`         | Rebuild on file changes             |
| `npm run lint`  | `eslint .`                   | Run ESLint                          |
| `npm run preview`| `vite preview`              | Preview production build locally    |

### Server

| Script           | Command                             | Description               |
| ---------------- | ----------------------------------- | ------------------------- |
| `npm run dev`    | `ts-node-dev --respawn index.ts`    | Dev server with auto-restart |
| `npm run build`  | `tsc -p tsconfig.json`              | Compile TypeScript        |
| `npm run start`  | `node dist/index.js`                | Run compiled server       |

---

## Project Configuration

### Vite Config (`vite.config.ts`)
- **React SWC plugin**: Fast JSX compilation
- **Tailwind CSS plugin**: PostCSS-free Tailwind v4
- **API Proxy**: `/api` → `http://localhost:3003` (for Stripe server in dev)

### TypeScript
- **Strict mode** enabled
- **No unused locals/parameters** enforced
- Target: ES2020, Module: ESNext
- Bundler module resolution (for Vite)

### ESLint
- TypeScript ESLint recommended rules
- React Hooks rules
- React Refresh rules (warn on non-component exports)

---

## Environment Variables

### Server (`server/.env`)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3003
```

### Client
No `.env` file is used for the client. The OpenAI API key is entered by the user in the Settings page and stored in `chrome.storage.local`.

---

## Generating Icons

Extension icons are generated from a source image using Sharp:

```bash
node src/utils/generateIcons.js
```

This reads `public/icons/icon.png` and creates `icon-16.png`, `icon-48.png`, and `icon-128.png`.

---

## Development Tips

### Testing Extension Features
- **Popup**: Click the extension icon in Chrome toolbar
- **Keyboard shortcuts**: Navigate to any webpage and use Ctrl+Shift+V/L/G/Y
- **Context menus**: Right-click on a page or selected text
- **Alarms**: Create a task with a reminder and wait for the interval
- **Storage inspection**: Use Chrome DevTools → Application → Storage → Extension Storage

### Debugging
- **Popup DevTools**: Right-click the popup → "Inspect"
- **Background script**: Go to `chrome://extensions` → find Automator → click "Service worker" link
- **Content script**: Regular DevTools console on any webpage (look for extension messages)

### Common Issues
1. **"No API key found"**: Set your OpenAI API key in Settings (`/config`)
2. **Keyboard shortcuts not working**: Check `chrome://extensions/shortcuts` to verify no conflicts
3. **Changes not appearing**: Reload the extension from `chrome://extensions` after rebuilding
4. **Alarms not firing**: Service worker may have gone idle. Chrome will wake it on alarm events, but check for errors in the service worker console.

---

## Styling Guide

### CSS Variables (Theme System)
The theme is controlled by CSS custom properties on `:root`:

```css
--font-color: rgba(255, 255, 255, 0.87)
--font-color-secondary: rgba(255, 255, 255, 0.5)
--bg-color: #09090d
--bg-color-secondary: #1b1b33
--active-color: #be90ff
--danger-color: #f45c5c
--success-color: #7cff7c
--warning-color: #ffc107
--extension-width: 500px
--extension-height: 600px
```

These are dynamically updated when the user changes theme colors in Settings.

### Mantine v8 (Component Library)
Mantine is the primary component library. It is configured via:
- `src/theme.ts` — custom theme with purple primary color, dark background palette, fonts
- `src/main.tsx` — `<MantineProvider theme={theme} defaultColorScheme="dark">` wraps the app
- `postcss.config.cjs` — PostCSS preset for Mantine (required for responsive styles)
- `@mantine/core/styles.css` — imported before app CSS in `main.tsx`

When migrating components to Mantine, use Mantine components (`Button`, `TextInput`, `Select`, `Stack`, `Group`, `Card`, `ActionIcon`, etc.) instead of custom HTML + CSS classes.

### Icons (@tabler/icons-react)
All icons use the Tabler Icons library (tree-shakable, ~5000 icons). The centralized icon map lives in `src/assets/svgs.tsx` — it exports a `SVGS` object where each key maps to a Tabler `<Icon* size={20} />` element. Components consume icons via `SVGS.close`, `SVGS.note`, etc.

To add a new icon, import it in `svgs.tsx` and add an entry to the `SVGS` object:
```tsx
import { IconSearch } from "@tabler/icons-react";
// In SVGS:  search: <IconSearch size={20} />,
```

Tabler icons use `currentColor`, so they automatically follow the parent's CSS `color` property — no need for explicit color props.

### Legacy Custom Utility Classes (being migrated)
The project is incrementally migrating from custom CSS classes to Mantine components. During the transition, these legacy utilities remain in `src/index.css`:
- Layout: `.flex-row`, `.flex-column`, `.gap-{n}`, `.w-100`
- Spacing: `.padding-{n}`
- Alignment: `.align-center`, `.justify-center`, `.justify-between`
- Theme: `.bg-gradient`, `.active-on-hover`
- Tailwind replacements: `.text-gray-*`, `.text-sm`, `.text-xs`, `.font-mono`, `.line-clamp-2`, etc.

These will be removed as each component is migrated to use Mantine's built-in props and components.

### Component CSS
Components with complex styling have their own `.css` file (e.g., `Chat.css`, `TaskManager.css`, `Note.css`). These will be simplified or removed as components adopt Mantine styling.

---

## Adding a New Feature

1. **Create component**: `src/components/FeatureName/FeatureName.tsx` (+ optional `.css`)
2. **Create route page**: `src/routes/featurename/page.tsx`
3. **Add route**: In `src/main.tsx`, add a new `<Route>` element
4. **Add navigation**: In `src/components/Content/Content.tsx`, add a button
5. **Define types**: Add types to `src/types.ts`
6. **Storage**: Use `ChromeStorageManager.add/get/delete()` with a new key
7. **Translations**: Add keys to both `src/locales/en.json` and `src/locales/es.json`
8. **Icons**: Add new Tabler icons to `src/assets/svgs.tsx` and reference via `SVGS.iconName`

---

## Server Architecture

The Express server (`server/index.ts`) is minimal and handles only Stripe payments:

### Endpoints

| Method | Path                           | Purpose                          |
| ------ | ------------------------------ | -------------------------------- |
| POST   | `/api/create-checkout-session` | Create Stripe checkout session   |
| POST   | `/api/webhook`                 | Stripe webhook handler           |

### Webhook Events Handled
- `checkout.session.completed` — Payment successful (TODO: mark user as premium)
- `invoice.payment_failed` — Payment failed (TODO: downgrade user)

The server is **optional** and the extension works fully without it. It exists as infrastructure for a future subscription/premium model.
