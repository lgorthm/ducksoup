# AGENTS.md

## Project

DeepSeek-powered chat web app: streaming chat, conversation history persisted to IndexedDB (`idb`), API key in `localStorage`. React 19 + TypeScript 6 + Vite 8 + shadcn/ui + Tailwind CSS v4 + Zustand 5 + react-router v7 (Data Mode) + i18next. Bilingual UI (`zh-CN` default, `en` fallback).

## Package manager

**pnpm** (the workspace root is the only package). `pnpm-workspace.yaml` allowlists `msw` for build scripts.

## Commands

```bash
pnpm dev            # Vite dev server (press d to toggle dark/light theme)
pnpm build          # tsc -b (project references) then vite build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint .
pnpm format         # prettier --write **/*.{ts,tsx}
pnpm test           # vitest run (unit + integration, 205 tests)
pnpm test:watch     # vitest watch
pnpm test:coverage  # vitest run --coverage (thresholds: 75/65/70/75)
pnpm test:ui        # vitest --ui (browser UI)
pnpm test:e2e       # playwright test (E2E, 46 tests desktop + mobile)
pnpm test:e2e:ui    # playwright test --ui (interactive mode)
pnpm preview        # vite preview
pnpm perf           # full measurement: build → bundle sizes → Lighthouse CI → compare vs history
pnpm perf:bundle    # bundle-only (faster, no browser): build → sizes → compare
```

`build` already typechecks. Run `pnpm lint` before committing. Single test: `pnpm test <path-or-pattern>`.

## Git hooks (husky + lint-staged)

- **pre-commit**: `pnpm lint-staged && pnpm typecheck && pnpm test` — formats/lints staged files, typechecks, runs unit tests.
- **pre-push**: `pnpm exec playwright test` — runs full E2E suite (requires dev server, auto-started by Playwright).
- Bypass with `--no-verify` in emergencies.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: `pnpm build` (Node 22, `--frozen-lockfile`) then rsync of `dist/` to an Nginx host over SSH. There is **no staging** — `main` is live, so don't push a broken build.

## Code conventions

- Prettier: `semi`, `singleQuote`, `trailingComma: "all"`, `printWidth: 80`. `prettier-plugin-tailwindcss` sorts classes inside `cn`/`cva` (`tailwindStylesheet: src/index.css`).
- `@/*` path alias → `src/*` (configured in `vite.config.ts` and `tsconfig*.json`).
- TypeScript is strict: `verbatimModuleSyntax` (use `import type` for type-only imports), `noUnusedLocals`/`noUnusedParameters`, `erasableSyntaxOnly` (no enums / namespaces / parameter properties).
- UI strings go through i18next (`useTranslation` / `i18n.t`). Locales: `src/shared/i18n/locales/{zh-CN,en}.json`. Detection order: `localStorage["i18nLang"]` → `navigator`; fallback `en`.

## Architecture

```
src/
  main.tsx                       # StrictMode → ThemeProvider → RouterProvider + Toaster; side-effect imports index.css and @/shared/i18n
  routes/index.tsx               # createBrowserRouter — single route: ChatLayout > ChatPage at "/"
  features/
    chat/                        # Main feature: components/, layouts/, store/, types/, utils/ (chat-stream.ts, db.ts = IndexedDB)
    settings/                    # settings-dialog.tsx
  shared/
    components/ui/               # shadcn components — install target is here, NOT src/components/
    providers/theme-provider.tsx # custom ThemeProvider + useTheme
    i18n/                        # i18next init + locales/
    lib/utils.ts                 # cn() = clsx + tailwind-merge
    hooks/ constants/ types/ utils/ styles/
  mocks/handlers/                # MSW handlers (DeepSeek SSE mock)
  mocks/server.ts                # MSW setupServer (Node env, used by vitest)
  tests/setup.ts                 # jest-dom matchers, fake-indexeddb, matchMedia/ResizeObserver/IntersectionObserver mocks, MSW lifecycle, i18n init
```

State: Zustand stores live at `src/features/<name>/store/` (see `features/chat/store/chat-store.ts`, which owns streaming, IndexedDB persistence, and the DeepSeek API key under localStorage key `deepseek-api-key`).

## Key technical notes

- **React Compiler is enabled.** `vite.config.ts` runs `@rolldown/plugin-babel` with `reactCompilerPreset()` on every dev/build run — keep code compiler-safe (rules of hooks, no state mutation, stable refs).
- **Tailwind v4**: no `tailwind.config.js`. `@import "tailwindcss"` + `@custom-variant dark` in `src/index.css`; theme tokens are CSS variables (oklch) in `:root` / `.dark`. Dark mode = `.dark` class on `<html>`.
- **Theme toggle**: press `d` anywhere (handled in ThemeProvider; ignored in editable fields and with modifier keys). Persisted to localStorage key `theme`; supports `system`.
- **react-router v7**: import from `react-router` (not `react-router-dom`). Data Mode (`createBrowserRouter` + `RouterProvider`).
- **shadcn**: `components.json` uses style `radix-lyra`, baseColor `neutral`, iconLibrary `lucide`. Add with `pnpm dlx shadcn@latest add <name>` → installs to `src/shared/components/ui/`. The root `README.md` is stale (claims `src/components/`); trust `components.json`.
- **`next-themes` is installed but unused** — the app uses the custom `ThemeProvider` at `src/shared/providers/theme-provider.tsx`. Don't reach for `next-themes`.
- **ESLint** `react-refresh/only-export-components` is active — a provider that exports non-components needs `/* eslint-disable react-refresh/only-export-components */` (see theme-provider.tsx).

## Testing

### Unit & integration (Vitest)

- Vitest: `jsdom`, `globals: true`, setup `src/tests/setup.ts`. Test files match `src/**/*.{test,spec}.{ts,tsx}` and are co-located with source.
- **`src/tests/setup.ts` provides global mocks**: `fake-indexeddb/auto` (real IDB API in-memory), `window.matchMedia`, `ResizeObserver`, `IntersectionObserver`, `window.scrollTo`, MSW server lifecycle (`beforeAll`/`afterEach`/`afterAll`), i18n init (zh-CN), and `localStorage`/`sessionStorage` cleanup per test. No need to manually mock these in individual test files.
- **IDB testing strategy**: `db.ts` tests use `fake-indexeddb` (real IDB integration); `chat-store.ts` tests mock the `db` module (isolated unit tests). Both strategies run in parallel.
- **MSW handlers** live in `src/mocks/handlers/`. `deepseek.ts` exports `mockDeepSeekStream`/`mockDeepSeekError`/`mockDeepSeekNetworkError` factory functions for custom responses. The default handler returns a streaming SSE response.
- **Coverage**: `pnpm test:coverage` — thresholds at 75/65/70/75 (statements/branches/functions/lines). shadcn UI components, type definitions, prism, markdown-renderer, and routes are excluded from coverage.
- **`tsconfig.app.json`** includes `"vitest/globals"` in `types` — no need to explicitly import `describe`/`it`/`expect` from vitest (but existing tests do so for clarity).

### E2E (Playwright)

- `playwright.config.ts` — 2 projects: `desktop-chromium` (1440×900) and `mobile-iphone` (iPhone 15). WebServer auto-starts `pnpm dev`. Trace/screenshot/video on failure.
- **`e2e/helpers/setup.ts`** — `setupApp()` handles the 3-phase load: (1) start app + set localStorage, (2) clear IDB + seed data, (3) reload. Mobile viewport-aware waiting (sidebar hidden → wait for `sidebar-trigger` instead of `settings-button`).
- **`e2e/fixtures/db-seed.ts`** — `seedIndexedDB()`/`clearIndexedDB()`/`getIndexedDBData()` via `page.evaluate`. Uses `clear()` on stores (not `deleteDatabase`) to avoid connection blocking.
- **`e2e/fixtures/test-data.ts`** — data factories: `generateConversations(n)`, `generateMessages(convId, n, { contentLength, withThinking })`.
- **`e2e/helpers/sse-mock.ts`** — `page.route` based SSE mock. No-delay mode uses string body (reliable); delay mode uses `ReadableStream` + `setTimeout`.
- **`data-testid` attributes** are added to key components for E2E selectors. See `e2e/helpers/selectors.ts` for the full list.
- **Visual regression**: `e2e/visual/*.spec.ts` — screenshots with 1% pixel diff tolerance. Baselines in `*.spec.ts-snapshots/` (committed). Update with `pnpm exec playwright test e2e/visual/ -u`.
- **Performance**: `e2e/performance/large-dataset.spec.ts` — multi-tier benchmarks: 1K msgs <300ms, 5K <350ms, 10K <500ms, 500 conversations sidebar render, 10× sequential switch no degradation.
- **Accessibility**: `e2e/a11y/a11y.spec.ts` — `@axe-core/playwright` audits for WCAG 2.0/2.1 A/AA. Excludes `[data-slot="dropdown-menu-trigger"]` (known a11y issue: buttons without discernible text).

### Test directory structure

```
e2e/
  fixtures/          # db-seed.ts, test-data.ts
  helpers/           # setup.ts, selectors.ts, performance.ts, sse-mock.ts
  flows/             # chat-flow.spec.ts, conversation-switch.spec.ts
  position/          # layout.spec.ts (z-index, FixedToolbar visibility, header margin)
  performance/       # large-dataset.spec.ts (multi-tier benchmarks)
  visual/            # chat-page.spec.ts, settings.spec.ts, sidebar.spec.ts
  a11y/              # a11y.spec.ts (axe-core audits)
  smoke.spec.ts      # smoke tests (app load, sidebar, settings, theme toggle, input)
```

## Local-only (gitignored)

`docs/*`, `.playwright-mcp/*`, `.superpowers/`, `.worktrees/`, `.trae/` are gitignored — don't assume they exist for other contributors. `coverage/`, `test-results/`, `playwright-report/`, `blob-report/` are also gitignored (test artifacts).

## Performance & bundle tracking

`pnpm perf` runs the full pipeline: `PERF=1 pnpm build` (with `rollup-plugin-visualizer` → `perf/stats.html`, gitignored) → `scripts/perf/collect-bundle.mjs` (raw/gzip/brotli per chunk, appended to `perf/history.json`) → `lhci autorun` (Lighthouse CI against `vite preview` on port 4173, 3 runs, median) → `scripts/perf/collect-lighthouse.mjs` (extracts performance score + FCP/LCP/TBT/CLS/INP/TTFB into the latest history entry) → `scripts/perf/compare.mjs` (diffs the last two history entries, writes `perf/report.md`, exits 1 on regressions beyond thresholds). `pnpm perf:bundle` skips Lighthouse for a fast bundle-only check.

- `perf/history.json` and `perf/report.md` are **committed** (shared baseline across machines/CI). `perf/stats.html` and `.lighthouseci/` are gitignored. `history.json` keeps at most 100 entries and dedupes by commit (re-running `pnpm perf` on the same commit replaces the prior entry instead of appending), so it won't grow unbounded.
- Regression thresholds live at the top of `scripts/perf/compare.mjs` (gzip total >+2%, LCP >+200ms, CLS >+0.02, INP >+50ms, performance score >-3 points). Tune there.
- The `scripts/perf/*.mjs` files are standalone Node ESM and are **not** covered by `tsc`/`eslint` (those only target `**/*.{ts,tsx}`); keep them dependency-free (only `node:*` builtins + `./_lib.mjs`).
- `PERF=1` env var gates `visualizer` in `vite.config.ts` so everyday `pnpm build` stays fast and doesn't emit `stats.html`.
- LHCI needs Chrome installed locally. To run in CI (ubuntu), add a Chrome install step to the workflow.
