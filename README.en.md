# DuckSoup

> A DeepSeek-powered streaming chat web app — local persistence, bilingual UI, and one-key theme toggle.

[![Build](https://img.shields.io/github/actions/workflow/status/lgorthm/ducksoup/deploy.yml?branch=main&label=deploy&logo=githubactions&logoColor=white)](https://github.com/lgorthm/ducksoup/actions/workflows/deploy.yml)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-10-f69d20?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

> 📖 中文文档:[README.md](./README.md)

<!-- Screenshot placeholder: drop a screenshot of the app into public/ or .github/assets/ and replace the link below -->

![DuckSoup Preview](public/duck.svg)

## ✨ Features

- **⚡ Streaming responses** — real-time token-by-token rendering via SSE, with thinking process support
- **💾 Local persistence** — conversations stored in IndexedDB (`idb`), survive refreshes; API key kept safely in `localStorage`
- **🌗 Light / Dark theme** — press `D` anywhere to toggle, supports `system`, persisted
- **🌍 Bilingual UI** — Chinese (Simplified) as default, English fallback, switchable anytime
- **🧩 Markdown rendering** — GFM syntax support, Prism code highlighting
- **♿ Accessibility-first** — audited against WCAG 2.0 / 2.1 A/AA via `@axe-core/playwright`, keyboard navigable
- **🚀 React Compiler** — compile-time optimization, no manual `useMemo` / `useCallback` needed
- **🎨 shadcn/ui + Tailwind v4** — atomic styling, theme tokens defined as CSS variables (`oklch`)

## 🛠️ Tech Stack

| Category      | Technology                                       |
| ------------- | ------------------------------------------------ |
| Framework     | React 19 + TypeScript 6 + Vite 8                 |
| Styling       | Tailwind CSS v4 + shadcn/ui (`radix-lyra` style) |
| State         | Zustand 5                                        |
| Routing       | react-router v7 (Data Mode)                      |
| i18n          | i18next + react-i18next                          |
| Persistence   | `idb` (IndexedDB)                                |
| UI primitives | Radix UI, lucide-react, sonner                   |
| Build tooling | Vite 8, babel-plugin-react-compiler              |

## 📋 Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 10 ([install guide](https://pnpm.io/installation))

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone git@github.com:lgorthm/ducksoup.git
cd ducksoup

# 2. Install dependencies
pnpm install

# 3. Configure your DeepSeek API key (see "Configuration" below)

# 4. Start the dev server
pnpm dev
```

Open http://localhost:5173 and paste your DeepSeek API key in the in-app settings to start chatting.

> 💡 Press `D` during development to toggle light / dark theme (ignored inside editable fields or with modifier keys).

## ⚙️ Configuration

No `.env` file is required — all configuration is stored in the browser's `localStorage`:

| Setting          | localStorage key   | Notes                                                                                        |
| ---------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| DeepSeek API key | `deepseek-api-key` | Set via in-app settings dialog, or write directly                                            |
| UI language      | `i18nLang`         | `zh-CN` (default) / `en`; detection order: `localStorage` → browser language → `en` fallback |
| Theme mode       | `theme`            | `light` / `dark` / `system`                                                                  |

> 🔑 Get an API key from the [DeepSeek platform](https://platform.deepseek.com/).

## 💻 Command Reference

| Command              | Action                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`           | Start the Vite dev server                                                 |
| `pnpm build`         | Type-check (`tsc -b`) + production build                                  |
| `pnpm typecheck`     | Run type-checking only (`tsc --noEmit`)                                   |
| `pnpm lint`          | ESLint check                                                              |
| `pnpm format`        | Prettier formatting                                                       |
| `pnpm preview`       | Preview the production build locally                                      |
| `pnpm test`          | Run unit / integration tests (Vitest)                                     |
| `pnpm test:watch`    | Watch mode for tests                                                      |
| `pnpm test:coverage` | Tests + coverage report (thresholds: 75/65/70/75)                         |
| `pnpm test:ui`       | Run tests in the browser UI                                               |
| `pnpm test:e2e`      | Run end-to-end tests (Playwright)                                         |
| `pnpm test:e2e:ui`   | Playwright interactive UI mode                                            |
| `pnpm perf`          | Full performance pipeline: build → bundle sizes → Lighthouse CI → compare |
| `pnpm perf:bundle`   | Bundle-only check (faster, no browser)                                    |

> Run a single test: `pnpm test <file-path-or-pattern>`

## 🧩 Adding UI Components

This project uses shadcn/ui; components are installed to `src/shared/components/ui/` (not `src/components/`):

```bash
pnpm dlx shadcn@latest add button
```

Import usage:

```tsx
import { Button } from '@/shared/components/ui/button';
```

## 🏗️ Project Structure

```
src/
├── main.tsx                       # Entry: StrictMode → ThemeProvider → RouterProvider + Toaster
├── routes/index.tsx               # Router: ChatLayout > ChatPage @ "/"
├── features/
│   ├── chat/                      # Main chat feature: components / layouts / store / types / utils
│   │   ├── store/chat-store.ts   # Zustand store: streaming, IndexedDB persistence, API key
│   │   └── utils/                 # chat-stream.ts (SSE), db.ts (IndexedDB)
│   └── settings/                  # Settings dialog
├── shared/
│   ├── components/ui/             # shadcn components (install target)
│   ├── providers/                 # Custom ThemeProvider + useTheme
│   ├── i18n/                      # i18next init + locales/{zh-CN,en}.json
│   ├── lib/utils.ts               # cn() = clsx + tailwind-merge
│   ├── hooks/ constants/ types/ utils/ styles/
└── mocks/handlers/                # MSW handlers (DeepSeek SSE mock)
```

## 🧪 Testing

### Unit & Integration (Vitest)

- Environment: `jsdom`, `globals: true`, setup file `src/tests/setup.ts`
- Global mocks provided by setup (no need to re-mock per file): `fake-indexeddb`, `matchMedia`, `ResizeObserver`, `IntersectionObserver`, MSW lifecycle, i18n init
- Coverage thresholds: statements 75% / branches 65% / functions 70% / lines 75%
- Tests are co-located with source: `src/**/*.{test,spec}.{ts,tsx}`

### End-to-End (Playwright)

- Two projects: `desktop-chromium` (1440×900) and `mobile-iphone` (iPhone 15)
- Coverage: core chat flow, conversation switching, layout positioning, large-dataset performance benchmarks, visual regression, accessibility audit
- Visual regression baselines are committed under `e2e/visual/*.spec.ts-snapshots/`; update with:
  ```bash
  pnpm exec playwright test e2e/visual/ -u
  ```

### Performance Benchmarks

`e2e/performance/large-dataset.spec.ts` multi-tier benchmarks: 1K messages <300ms, 5K <350ms, 10K <500ms; 500-conversation sidebar render; 10× sequential switches with no degradation.

## 📈 Performance & Bundle Tracking

`pnpm perf` runs the full pipeline:

`PERF=1 pnpm build` (with rollup-plugin-visualizer → `perf/stats.html`)
→ `scripts/perf/collect-bundle.mjs` (collect raw / gzip / brotli sizes → `perf/history.json`)
→ `lhci autorun` (Lighthouse CI, 3 runs, median)
→ `scripts/perf/compare.mjs` (diff against the previous history entry, exits 1 on regression)

Regression thresholds (at the top of `scripts/perf/compare.mjs`): gzip total >+2%, LCP >+200ms, CLS >+0.02, INP >+50ms, performance score >-3 points.

`perf/history.json` and `perf/report.md` are committed as a shared baseline across machines / CI.

## 🚀 Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`:

1. `pnpm install --frozen-lockfile` (Node 22)
2. `pnpm build`
3. Sync `dist/` to an Nginx host over SSH (rsync)

> ⚠️ **No staging environment** — `main` is live; do not push a broken build.

## 🤝 Contributing

- Run `pnpm lint` and `pnpm typecheck` before committing (enforced by Git hooks)
- **pre-commit**: `lint-staged` + `typecheck` + unit tests
- **pre-push**: full E2E suite (Playwright auto-starts the dev server)
- Bypass with `--no-verify` in emergencies

Commit messages are recommended to follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## 📄 License

This project does not yet specify an open-source license (`package.json` is marked `private: true`). If you intend to open-source it, please add a `LICENSE` file first (MIT recommended).

## 🙏 Acknowledgements

- [DeepSeek](https://www.deepseek.com/) — LLM service
- [shadcn/ui](https://ui.shadcn.com/) — UI component system
- [Tailwind CSS](https://tailwindcss.com/) — Atomic CSS framework
- [Vite](https://vite.dev/) — Next-gen frontend build tool
