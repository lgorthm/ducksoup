# 项目依赖安装记录

> 日期：2026-05-28
> 包管理器：pnpm v10.28.0

## 安装的依赖清单

### 生产依赖

| 依赖                  | 版本    | 用途                                                   |
| --------------------- | ------- | ------------------------------------------------------ |
| `zustand`             | ^5.0.14 | 轻量级 React 客户端状态管理                            |
| `react-hook-form`     | ^7.76.1 | 高性能表单处理方案                                     |
| `@hookform/resolvers` | ^5.4.0  | React Hook Form 配合 Zod/Yup/Valibot 等校验库的解析器  |
| `react-router`        | ^7.15.1 | React Router v7，Data Mode 路由管理（loader + action） |
| `axios`               | ^1.16.1 | 基于 Promise 的 HTTP 客户端                            |

### 开发依赖

| 依赖                          | 版本    | 用途                                 |
| ----------------------------- | ------- | ------------------------------------ |
| `msw`                         | ^2.14.6 | Mock Service Worker，API Mock 方案   |
| `vitest`                      | ^4.1.7  | 基于 Vite 的单元测试框架             |
| `@vitest/ui`                  | ^4.1.7  | Vitest 可视化测试界面                |
| `@vitest/coverage-v8`         | ^4.1.7  | Vitest 代码覆盖率报告                |
| `@testing-library/react`      | ^16.3.2 | React 组件测试工具                   |
| `@testing-library/jest-dom`   | ^6.9.1  | DOM 断言扩展（toBeInTheDocument 等） |
| `@testing-library/user-event` | ^14.6.1 | 模拟用户交互                         |
| `jsdom`                       | ^29.1.1 | 模拟浏览器 DOM 环境，供 Vitest 使用  |
| `@playwright/test`            | ^1.60.0 | E2E 端到端浏览器测试框架             |

## 安装命令

```bash
# 生产依赖
pnpm add zustand react-hook-form @hookform/resolvers react-router axios

# 开发依赖
pnpm add -D msw vitest @vitest/ui @vitest/coverage-v8 @playwright/test @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

## MSW 构建脚本配置

MSW 需要在 `pnpm-workspace.yaml` 中允许运行构建脚本，否则 Service Worker 文件无法生成：

```yaml
# pnpm-workspace.yaml
onlyBuiltDependencies:
  - msw
```

配置后重新运行 `pnpm install` 触发 MSW 的 postinstall 脚本：

```bash
pnpm install
```

## 后续集成指南

### 1. Zustand — 状态管理

创建 store 文件，例如 `src/features/counter/stores/counter.ts`：

```typescript
import { create } from "zustand"

interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}))
```

### 2. React Router — 路由 (Data Mode)

采用 `createBrowserRouter` + `RouterProvider` 的 Data Mode，路由配置集中在 `src/routes/index.tsx`，各 feature 通过 `routes.tsx` 导出子路由。

在 `src/routes/index.tsx` 中配置路由：

```tsx
import { createBrowserRouter } from "react-router"

import App from "@/App"
// import { authRoutes } from "@/features/auth/routes"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      // ...authRoutes,
    ],
  },
])
```

在 `src/main.tsx` 中挂载：

```tsx
import { router } from "@/routes"
// ...

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>
)
```

**Data Mode 核心 API：**

| API               | 说明                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| `loader`          | 路由渲染前预取数据，组件内通过 `useLoaderData()` 获取                              |
| `action`          | 处理表单提交、数据变更（POST/PUT/DELETE），通过 `<Form>` 组件或 `useSubmit()` 触发 |
| `useLoaderData()` | 在组件中读取 `loader` 返回的数据                                                   |
| `useActionData()` | 在组件中读取 `action` 返回的数据                                                   |
| `useFetcher()`    | 不与导航绑定的数据交互（搜索、加载更多等）                                         |
| `errorElement`    | 路由级错误边界，捕获 loader/action/渲染异常                                        |

**与 Axios 配合的 loader 示例：**

```typescript
// src/features/posts/loaders.ts
import type { LoaderFunctionArgs } from "react-router"
import api from "@/shared/lib/axios"

export async function postsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const page = url.searchParams.get("page") || "1"
  const { data } = await api.get(`/posts?page=${page}`)
  return data
}
```

### 3. React Hook Form — 表单

配合 Zod 校验（需额外安装 zod）：

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function LoginForm() {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  })

  // ...
}
```

### 4. Axios — HTTP 请求

创建 `src/shared/lib/axios.ts` 实例：

```typescript
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 统一错误处理
    return Promise.reject(error)
  }
)

export default api
```

环境变量文件 `.env`：

```
VITE_API_BASE_URL=http://localhost:3000/api
```

### 5. MSW — API Mock

创建 `src/mocks/handlers/index.ts` 汇总所有 mock：

```typescript
import { http, HttpResponse } from "msw"

export const handlers = [
  http.get("/api/users", () => {
    return HttpResponse.json([{ id: 1, name: "John" }])
  }),
]
```

创建 `src/mocks/browser.ts`：

```typescript
import { setupWorker } from "msw/browser"
import { handlers } from "./handlers"

export const worker = setupWorker(...handlers)
```

在 `src/main.tsx` 中按环境启动：

```typescript
async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCK !== "true") return
  const { worker } = await import("./mocks/browser")
  return worker.start()
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(/* ... */)
})
```

### 6. Vitest + React Testing Library — 单元测试

创建 `vitest.config.ts`（或合并到 `vite.config.ts`）：

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
  },
})
```

**React Testing Library 编写测试示例：**

```tsx
// src/features/counter/components/Counter.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Counter } from "./Counter"

describe("Counter", () => {
  it("点击按钮后计数增加", async () => {
    const user = userEvent.setup()
    render(<Counter />)

    expect(screen.getByText("0")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "+" }))
    expect(screen.getByText("1")).toBeInTheDocument()
  })
})
```

**常用 API 速查：**

| API                              | 说明                   |
| -------------------------------- | ---------------------- |
| `render(<Component />)`          | 渲染组件，返回查询方法 |
| `screen.getByText()`             | 按文本查找元素         |
| `screen.getByRole()`             | 按 ARIA 角色查找       |
| `screen.getByLabelText()`        | 按表单标签查找         |
| `screen.getByTestId()`           | 按 `data-testid` 查找  |
| `userEvent.setup()`              | 创建用户交互模拟器     |
| `user.click()` / `user.type()`   | 模拟点击 / 输入        |
| `expect(el).toBeInTheDocument()` | 断言元素存在于 DOM     |

在 `package.json` 添加测试脚本：

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### 7. Playwright — E2E 测试

安装浏览器并创建配置：

```bash
pnpm exec playwright install
```

创建 `playwright.config.ts`：

```typescript
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm dev",
    port: 5173,
  },
})
```

在 `package.json` 添加脚本：

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## 当前完整依赖树

### dependencies

```
@fontsource-variable/inter  ^5.2.8
@hookform/resolvers         ^5.4.0    (新增)
@tailwindcss/vite           ^4
axios                       ^1.16.1   (新增)
class-variance-authority    ^0.7.1
clsx                        ^2.1.1
lucide-react                ^1.17.0
radix-ui                    ^1.4.3
react                       ^19.2.6
react-dom                   ^19.2.6
react-hook-form             ^7.76.1   (新增)
react-router                ^7.15.1   (新增)
shadcn                      ^4.8.2
tailwind-merge              ^3.6.0
tailwindcss                 ^4
tw-animate-css              ^1.4.0
zustand                     ^5.0.14   (新增)
```

### devDependencies

```
@eslint/js                    ^10
@playwright/test              ^1.60.0  (新增)
@testing-library/jest-dom     ^6.9.1   (新增)
@testing-library/react        ^16.3.2  (新增)
@testing-library/user-event   ^14.6.1  (新增)
@types/node                   ^24
@types/react                  ^19
@types/react-dom              ^19
@vitejs/plugin-react          ^6
@vitest/coverage-v8           ^4.1.7   (新增)
@vitest/ui                    ^4.1.7   (新增)
eslint                        ^10
eslint-plugin-react-hooks     ^7.1.1
eslint-plugin-react-refresh   ^0.5.2
globals                       ^17
jsdom                         ^29.1.1  (新增)
msw                           ^2.14.6  (新增)
prettier                      ^3.8.3
prettier-plugin-tailwindcss   ^0.8.0
typescript                    ~6
typescript-eslint             ^8
vite                          ^8
vitest                        ^4.1.7   (新增)
```
