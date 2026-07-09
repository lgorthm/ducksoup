# DuckSoup

> DeepSeek 驱动的流式聊天 Web 应用 —— 对话本地持久化、双语界面与一键主题切换。

[![Build](https://img.shields.io/github/actions/workflow/status/lgorthm/ducksoup/deploy.yml?branch=main&label=部署&logo=githubactions&logoColor=white)](https://github.com/lgorthm/ducksoup/actions/workflows/deploy.yml)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-10-f69d20?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> 📖 English documentation: [README.en.md](./README.en.md)

<!-- 截图占位:将应用主界面截图放入 public/ 或 .github/assets/ 后替换下方链接 -->

![DuckSoup 预览](public/duck.svg)

## ✨ 特性

- **⚡ 流式响应** —— 基于 SSE 实时逐字渲染,支持思考过程展示
- **💾 本地持久化** —— 对话存储于 IndexedDB(`idb`),刷新不丢失;API Key 安全保存在 `localStorage`
- **🌗 亮 / 暗主题** —— 任意位置按 `D` 即可切换,支持跟随系统,持久化保存
- **🌍 双语界面** —— 中文(简体)为默认语言,英文回退,可随时切换
- **🧩 Markdown 渲染** —— 支持 GFM 语法、Prism 代码高亮
- **♿ 无障碍优先** —— 通过 `@axe-core/playwright` 进行 WCAG 2.0 / 2.1 A/AA 审计,键盘可达
- **🚀 React Compiler** —— 编译期优化,无需手写 `useMemo` / `useCallback`
- **🎨 shadcn/ui + Tailwind v4** —— 原子化样式,主题基于 CSS 变量(`oklch`)定义

## 🛠️ 技术栈

| 类别     | 技术                                           |
| -------- | ---------------------------------------------- |
| 框架     | React 19 + TypeScript 6 + Vite 8               |
| 样式     | Tailwind CSS v4 + shadcn/ui(`radix-lyra` 风格) |
| 状态管理 | Zustand 5                                      |
| 路由     | react-router v7(Data Mode)                     |
| 国际化   | i18next + react-i18next                        |
| 持久化   | `idb`(IndexedDB)                               |
| UI 交互  | Radix UI、lucide-react、sonner                 |
| 构建工具 | Vite 8、babel-plugin-react-compiler            |

## 📋 前置要求

- **Node.js** ≥ 22
- **pnpm** ≥ 10([安装指南](https://pnpm.io/installation))

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone git@github.com:lgorthm/ducksoup.git
cd ducksoup

# 2. 安装依赖
pnpm install

# 3. 配置 DeepSeek API Key(见下方"配置"章节)

# 4. 启动开发服务器
pnpm dev
```

启动后访问 http://localhost:5173,在应用设置内粘贴你的 DeepSeek API Key 即可开始对话。

> 💡 可在开发时按 `D` 键切换亮 / 暗主题(在可编辑字段或按住修饰键时此快捷键会被忽略)。

## ⚙️ 配置

本应用无需 `.env` 文件,所有配置保存在浏览器 `localStorage` 中:

| 配置项           | localStorage Key   | 说明                                                                 |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| DeepSeek API Key | `deepseek-api-key` | 可在应用设置弹窗内填写,或直接写入                                    |
| 界面语言         | `i18nLang`         | `zh-CN`(默认)/ `en`;检测顺序:`localStorage` → 浏览器语言 → `en` 回退 |
| 主题模式         | `theme`            | `light` / `dark` / `system`                                          |

> 🔑 API Key 获取:前往 [DeepSeek 开放平台](https://platform.deepseek.com/)创建。

## 💻 命令速查

| 命令                 | 作用                                              |
| -------------------- | ------------------------------------------------- |
| `pnpm dev`           | 启动 Vite 开发服务器                              |
| `pnpm build`         | 类型检查(`tsc -b`)+ 生产构建                      |
| `pnpm typecheck`     | 仅运行类型检查(`tsc --noEmit`)                    |
| `pnpm lint`          | ESLint 检查                                       |
| `pnpm format`        | Prettier 格式化                                   |
| `pnpm preview`       | 本地预览构建产物                                  |
| `pnpm test`          | 运行单元 / 集成测试(Vitest)                       |
| `pnpm test:watch`    | 测试监听模式                                      |
| `pnpm test:coverage` | 测试 + 覆盖率报告(阈值:75/65/70/75)               |
| `pnpm test:ui`       | 浏览器 UI 界面运行测试                            |
| `pnpm test:e2e`      | 运行端到端测试(Playwright)                        |
| `pnpm test:e2e:ui`   | Playwright 交互式 UI 模式                         |
| `pnpm perf`          | 完整性能测量:构建 → 包体积 → Lighthouse CI → 对比 |
| `pnpm perf:bundle`   | 仅包体积检查(更快,无需浏览器)                     |

> 单独运行某个测试:`pnpm test <文件路径或模式>`

## 🧩 添加 UI 组件

本项目使用 shadcn/ui,组件安装到 `src/shared/components/ui/`(而非 `src/components/`):

```bash
pnpm dlx shadcn@latest add button
```

导入方式:

```tsx
import { Button } from '@/shared/components/ui/button';
```

## 🏗️ 项目结构

```
src/
├── main.tsx                       # 入口:StrictMode → ThemeProvider → RouterProvider + Toaster
├── routes/index.tsx               # 路由:ChatLayout > ChatPage @ "/"
├── features/
│   ├── chat/                      # 聊天主功能:components / layouts / store / types / utils
│   │   ├── store/chat-store.ts   # Zustand store:流式、IndexedDB 持久化、API Key
│   │   └── utils/                 # chat-stream.ts(SSE)、db.ts(IndexedDB)
│   └── settings/                  # 设置弹窗
├── shared/
│   ├── components/ui/             # shadcn 组件(安装目标)
│   ├── providers/                 # 自定义 ThemeProvider + useTheme
│   ├── i18n/                      # i18next 初始化 + locales/{zh-CN,en}.json
│   ├── lib/utils.ts               # cn() = clsx + tailwind-merge
│   ├── hooks/ constants/ types/ utils/ styles/
└── mocks/handlers/                # MSW 处理器(DeepSeek SSE mock)
```

## 🧪 测试

### 单元 / 集成测试(Vitest)

- 环境:`jsdom`,`globals: true`,setup 文件 `src/tests/setup.ts`
- 全局 Mock(已在 setup 中提供,无需逐个文件重复):`fake-indexeddb`、`matchMedia`、`ResizeObserver`、`IntersectionObserver`、MSW 生命周期、i18n 初始化
- 覆盖率阈值:语句 75% / 分支 65% / 函数 70% / 行 75%
- 测试与源文件共置:`src/**/*.{test,spec}.{ts,tsx}`

### 端到端测试(Playwright)

- 两个项目:`desktop-chromium`(1440×900)与 `mobile-iphone`(iPhone 15)
- 覆盖范围:核心聊天流程、对话切换、布局定位、大列表性能基准、视觉回归、无障碍审计
- 视觉回归基线提交于 `e2e/visual/*.spec.ts-snapshots/`,更新命令:
  ```bash
  pnpm exec playwright test e2e/visual/ -u
  ```

### 性能基准

`e2e/performance/large-dataset.spec.ts` 多级基准:1K 消息 <300ms、5K <350ms、10K <500ms;500 会话侧栏渲染;10 次连续切换无性能衰减。

## 📈 性能与包体积追踪

`pnpm perf` 完整流水线:

`PERF=1 pnpm build`(含 rollup-plugin-visualizer → `perf/stats.html`)
→ `scripts/perf/collect-bundle.mjs`(采集 raw / gzip / brotli 体积 → `perf/history.json`)
→ `lhci autorun`(Lighthouse CI,3 次取中位数)
→ `scripts/perf/compare.mjs`(与上一条历史对比,超阈值则退出码 1)

回归阈值(位于 `scripts/perf/compare.mjs` 顶部):gzip 总量 >+2%、LCP >+200ms、CLS >+0.02、INP >+50ms、性能分 >-3 分。

`perf/history.json` 与 `perf/report.md` 已纳入版本管理,作为跨机器 / CI 的共享基线。

## 🚀 部署

推送到 `main` 分支会触发 `.github/workflows/deploy.yml`:

1. `pnpm install --frozen-lockfile`(Node 22)
2. `pnpm build`
3. 将 `dist/` 通过 SSH 同步(rsync)至 Nginx 主机

> ⚠️ **无预发布环境** —— `main` 即线上,请勿推送未通过构建的代码。

## 🤝 贡献

- 提交前请运行 `pnpm lint` 与 `pnpm typecheck`(已由 Git Hooks 自动执行)
- **pre-commit**:`lint-staged` + `typecheck` + 单元测试
- **pre-push**:完整 E2E 套件(Playwright 会自动启动开发服务器)
- 紧急情况可用 `--no-verify` 跳过

提交信息建议遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范。

## 📄 License

本项目基于 [MIT License](./LICENSE) 开源。

Copyright (c) 2026 alwaysblue <maybelxr@gmail.com>

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) —— 大语言模型服务
- [shadcn/ui](https://ui.shadcn.com/) —— UI 组件体系
- [Tailwind CSS](https://tailwindcss.com/) —— 原子化 CSS 框架
- [Vite](https://vite.dev/) —— 下一代前端构建工具

# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from '@/components/ui/button';
```
