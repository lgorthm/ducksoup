# AGENTS.md

## Project

DeepSeek-powered chat web app: streaming chat, conversation history persisted to IndexedDB (`idb`), API key in `localStorage`. React 19 + TypeScript 6 + Vite 8 + shadcn/ui + Tailwind CSS v4 + Zustand 5 + react-router v7 (Data Mode) + i18next. Bilingual UI (`zh-CN` default, `en` fallback).

## Package manager

**pnpm** (the workspace root is the only package). `pnpm-workspace.yaml` allowlists `msw` for build scripts.

## Commands

```bash
pnpm dev          # Vite dev server (press d to toggle dark/light theme)
pnpm build        # tsc -b (project references) then vite build
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint .
pnpm format       # prettier --write **/*.{ts,tsx}
pnpm test         # vitest run
pnpm test:watch   # vitest watch
pnpm preview      # vite preview
pnpm perf         # full measurement: build → bundle sizes → Lighthouse CI → compare vs history
pnpm perf:bundle  # bundle-only (faster, no browser): build → sizes → compare
```

`build` already typechecks. Run `pnpm lint` before committing. Single test: `pnpm test <path-or-pattern>`.

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
  mocks/handlers/                # MSW handlers (worker bootstrap not wired yet)
  tests/setup.ts                 # registers @testing-library/jest-dom matchers
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

- Vitest: `jsdom`, `globals: true`, setup `src/tests/setup.ts`. Test files match `src/**/*.{test,spec}.{ts,tsx}` and are co-located with source.
- **shadcn sidebar/dialog components need `window.matchMedia` mocked** in jsdom — copy the mock from `src/shared/components/layout/main-layout.test.tsx` when testing components that render the sidebar.
- MSW is installed for API mocking; handlers belong in `src/mocks/handlers/`. Playwright is installed but no `playwright.config.ts` or `e2e/` dir exists yet.

## Local-only (gitignored)

`docs/*`, `.playwright-mcp/*`, `.superpowers/`, `.worktrees/`, `.trae/` are gitignored — don't assume they exist for other contributors. Note: the local `docs/dependencies-setup.md` documents *intended* conventions for axios / zod / MSW worker / Playwright that are **not yet implemented** — verify against actual code before following it.

## Performance & bundle tracking

`pnpm perf` runs the full pipeline: `PERF=1 pnpm build` (with `rollup-plugin-visualizer` → `perf/stats.html`, gitignored) → `scripts/perf/collect-bundle.mjs` (raw/gzip/brotli per chunk, appended to `perf/history.json`) → `lhci autorun` (Lighthouse CI against `vite preview` on port 4173, 3 runs, median) → `scripts/perf/collect-lighthouse.mjs` (extracts performance score + FCP/LCP/TBT/CLS/INP/TTFB into the latest history entry) → `scripts/perf/compare.mjs` (diffs the last two history entries, writes `perf/report.md`, exits 1 on regressions beyond thresholds). `pnpm perf:bundle` skips Lighthouse for a fast bundle-only check.

- `perf/history.json` and `perf/report.md` are **committed** (shared baseline across machines/CI). `perf/stats.html` and `.lighthouseci/` are gitignored. `history.json` keeps at most 100 entries and dedupes by commit (re-running `pnpm perf` on the same commit replaces the prior entry instead of appending), so it won't grow unbounded.
- Regression thresholds live at the top of `scripts/perf/compare.mjs` (gzip total >+2%, LCP >+200ms, CLS >+0.02, INP >+50ms, performance score >-3 points). Tune there.
- The `scripts/perf/*.mjs` files are standalone Node ESM and are **not** covered by `tsc`/`eslint` (those only target `**/*.{ts,tsx}`); keep them dependency-free (only `node:*` builtins + `./_lib.mjs`).
- `PERF=1` env var gates `visualizer` in `vite.config.ts` so everyday `pnpm build` stays fast and doesn't emit `stats.html`.
- LHCI needs Chrome installed locally. To run in CI (ubuntu), add a Chrome install step to the workflow.
