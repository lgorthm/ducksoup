# MainLayout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ChatGPT 风格的 MainLayout 布局组件（侧边栏 + 内容区），并接入现有路由。

**Architecture:** 使用 shadcn SidebarProvider 方案，MainLayout 通过插槽 props 接收侧边栏内容，children 渲染主内容区。组件为纯布局壳子，不包含业务逻辑。

**Tech Stack:** React 19, TypeScript, shadcn/ui (SidebarProvider), Tailwind CSS v4

---

### Task 1: 创建 useIsMobile hook

**Files:**
- Create: `src/shared/hooks/use-mobile.tsx`

sidebar 组件依赖 `useIsMobile` hook，需要先创建。

- [ ] **Step 1: 创建 useIsMobile hook**

```tsx
import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: PASS (无类型错误)

- [ ] **Step 3: 提交**

```bash
git add src/shared/hooks/use-mobile.tsx
git commit -m "feat: add useIsMobile hook for sidebar responsive behavior"
```

---

### Task 2: 创建 MainLayout 组件

**Files:**
- Create: `src/shared/components/layout/main-layout.tsx`

- [ ] **Step 1: 创建 MainLayout 组件**

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarTrigger,
} from '@/shared/components/ui/sidebar';

interface MainLayoutProps {
  sidebarHeader?: React.ReactNode;
  sidebarContent?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function MainLayout({
  sidebarHeader,
  sidebarContent,
  sidebarFooter,
  defaultOpen = true,
  children,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="offcanvas">
        {sidebarHeader != null && (
          <SidebarHeader>{sidebarHeader}</SidebarHeader>
        )}
        <SidebarContent>
          <SidebarMenu>
            {sidebarContent ?? (
              <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
                暂无对话
              </div>
            )}
          </SidebarMenu>
        </SidebarContent>
        {sidebarFooter != null && (
          <SidebarFooter>{sidebarFooter}</SidebarFooter>
        )}
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/shared/components/layout/main-layout.tsx
git commit -m "feat: add MainLayout component with sidebar and content area"
```

---

### Task 3: 创建 layout/index.ts 导出

**Files:**
- Create: `src/shared/components/layout/index.ts`

- [ ] **Step 1: 创建导出文件**

```ts
export { MainLayout } from './main-layout';
export type { MainLayoutProps } from './main-layout';
```

Wait — TypeScript `export type` with `--isolatedModules` requires the type to be standalone. Since `MainLayoutProps` is defined in the same file as `MainLayout`, we need to either re-export it or make `index.ts` only export the component. Let's do just the component export, since the props interface can be inferred.

```ts
export { MainLayout } from './main-layout';
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/shared/components/layout/index.ts
git commit -m "feat: add layout barrel export"
```

---

### Task 4: 改造 App.tsx 移除外层容器

**Files:**
- Modify: `src/App.tsx`

MainLayout 已提供布局结构，App 不再需要最外层 `flex min-h-svh p-6` 容器。

- [ ] **Step 1: 更新 App.tsx**

Before:
```tsx
import { Button } from '@/shared/components/ui/button';

export function App() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>
      </div>
    </div>
  );
}

export default App;
```

After:
```tsx
import { Button } from '@/shared/components/ui/button';

export function App() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6 text-sm leading-loose">
      <div>
        <h1 className="font-medium">Project ready!</h1>
        <p>You may now add components and start building.</p>
        <p>We&apos;ve already added the button component for you.</p>
        <Button className="mt-2">Button</Button>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        (Press <kbd>d</kbd> to toggle dark mode)
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "refactor: remove outer container from App, MainLayout provides layout"
```

---

### Task 5: 接入路由使用 MainLayout

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: 更新路由配置**

Before:
```tsx
import { createBrowserRouter } from 'react-router';

import App from '@/App';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
]);
```

After:
```tsx
import { createBrowserRouter } from 'react-router';

import App from '@/App';
import { MainLayout } from '@/shared/components/layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <MainLayout>
        <App />
      </MainLayout>
    ),
  },
]);
```

**注意：** 当前不传 sidebarHeader/sidebarContent/sidebarFooter，使用组件内部的默认空状态占位（显示"暂无对话"）。后续添加对话列表等业务组件时再传入对应插槽。

- [ ] **Step 2: 验证类型检查**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/routes/index.tsx
git commit -m "feat: integrate MainLayout into routes"
```

---

### Task 6: 启动开发服务器验证

**Files:**
- 无新建/修改

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm dev`
Expected: 服务启动成功

- [ ] **Step 2: 手动验证**

在浏览器中检查：
- 左侧侧边栏默认展开，显示"暂无对话"
- 点击左上角 SidebarTrigger 按钮可折叠/展开侧边栏
- 按 `Ctrl+B` 可切换侧边栏
- 右侧内容区显示原有 App 内容
- 移动端视口（<768px）侧边栏自动隐藏，点击按钮以 Sheet 形式滑出
- 深色/浅色主题切换正常（按 `d` 键）

- [ ] **Step 3: 确认无控制台错误**

打开浏览器开发者工具，确认 Console 无报错。
