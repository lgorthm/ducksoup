# AGENTS.md

## Project

React 19 + TypeScript 6 + Vite 8 + shadcn/ui + Tailwind CSS v4. Early scaffold stage.

## Package manager

Always use **pnpm**. `pnpm-workspace.yaml` is present.

## Commands

```bash
pnpm dev          # Vite dev server (press d to toggle dark mode)
pnpm build        # tsc -b (project references) then vite build
pnpm typecheck    # tsc --noEmit (app-only type checking)
pnpm lint         # ESLint
pnpm format       # Prettier (writes files)
```

Build already runs typechecking via `tsc -b`. Run `pnpm lint` before committing.

## Code conventions

- **Semicolons** required (`semi: true`)
- **Single quotes** (`singleQuote: true`)
- **Trailing commas** everywhere (`trailingComma: "all"`)
- **Mobile-first**: Use mobile-first responsive design with Tailwind breakpoints (`sm:`, `md:`, `lg:`). Start with mobile layout, scale up to desktop.
- `@/*` path alias maps to `src/*` (configured in both `vite.config.ts` and `tsconfig*.json`)

## Architecture

```
src/
  main.tsx          # Entry: StrictMode → ThemeProvider → RouterProvider
  App.tsx           # Root route component
  features/         # Feature modules (organize new code here)
  shared/           # Shared code
    components/ui/  # shadcn UI components (auto-installed here)
    lib/utils.ts    # cn() helper (clsx + tailwind-merge)
    hooks/          # Shared hooks
    types/          # Shared types
    constants/      # Shared constants
    utils/          # Shared utilities
  routes/index.tsx  # React Router v7 createBrowserRouter config
  tests/setup.ts    # Vitest setup (imports jest-dom matchers)
```

## Key technical notes

- **Tailwind CSS v4**: No `tailwind.config.js`. Uses `@import "tailwindcss"` in `index.css`. Dark mode via `.dark` class on `<html>`, toggled by pressing `d`.
- **react-router v7**: Uses `createBrowserRouter` from `react-router` (not react-router-dom).
- **shadcn**: Components auto-install to `src/shared/components/ui/`, not `src/components/`. Run `npx shadcn@latest add <name>` to add.
- **Zustand 5**: Installed but not yet used. Place stores under `src/features/<name>/` or `src/shared/`.
- **Testing**: Vitest + Testing Library + MSW + Playwright installed. No test files or playwright config exist yet. `src/tests/setup.ts` registers jest-dom matchers.
