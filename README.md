# DuckSoup

> DeepSeek 驱动的流式聊天 Web 应用 —— 对话本地持久化、双语界面与亮 / 暗主题。

[![Build](https://img.shields.io/github/actions/workflow/status/lgorthm/ducksoup/deploy.yml?branch=main&label=部署&logo=githubactions&logoColor=white)](https://github.com/lgorthm/ducksoup/actions/workflows/deploy.yml)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-10-f69d20?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Biome](https://img.shields.io/badge/Biome-2-60a5fa?logo=biome&logoColor=white)](https://biomejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> 📖 English documentation: [README.en.md](./README.en.md)

<p align="center">
  <img src="public/duck.svg" width="80" alt="DuckSoup">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/preview-dark.png">
    <img src=".github/assets/preview-light.png" alt="DuckSoup 预览：浅色欢迎页 / 深色对话页">
  </picture>
</p>

<details>
<summary>浅色欢迎页 · 深色对话页</summary>

![欢迎页（浅色）](.github/assets/preview-light.png)
![对话页（深色）](.github/assets/preview-dark.png)

</details>

## 目录

- [特性](#features)
- [技术栈](#tech-stack)
- [前置要求](#prerequisites)
- [快速开始](#quick-start)
- [配置](#configuration)
- [命令速查](#commands)
- [添加 UI 组件](#ui-components)
- [项目结构](#structure)
- [测试](#testing)
- [性能与包体积](#perf)
- [部署](#deploy)
- [贡献](#contributing)
- [License](#license)
- [致谢](#thanks)

<a id="features"></a>

## ✨ 特性

- **流式响应** —— 基于 SSE 逐字渲染，支持思考过程展示与中途停止
- **双模型** —— DeepSeek V4 Flash（视觉）与 DeepSeek V4 Pro（文本）；会话创建后模型不可变
- **图片附件** —— Flash 支持 JPEG / PNG / GIF / WebP，单条最多 16 张；图片以 Blob 写入 IndexedDB
- **深度思考** —— 输入栏可开关 Deep Think（`reasoning.effort`）
- **消息操作** —— 复制、编辑、重新生成、中止后继续；编辑 / 再生成会分出消息分支，可在兄弟版本间切换
- **会话管理** —— 置顶、按日期分组（今天 / 昨天 / 7 天 / 30 天）；消息列表虚拟滚动
- **本地持久化** —— 对话与图片存于 IndexedDB（`idb`）；API Key 仅保存在 `localStorage`，除调用 DeepSeek 外不会离开浏览器
- **亮 / 暗主题** —— 在设置中切换 `light` / `dark` / `system`，并持久化
- **双语界面** —— 默认简体中文，英文回退，设置内随时切换
- **Markdown** —— GFM 语法、Prism 代码高亮，渲染器按需加载
- **账户余额** —— 设置中可查询 DeepSeek 账户余额
- **无障碍** —— 键盘可达；Playwright + `@axe-core/playwright` 覆盖 WCAG 2.0 / 2.1 A/AA

<a id="tech-stack"></a>

## 🛠️ 技术栈

| 类别     | 技术                                                    |
| -------- | ------------------------------------------------------- |
| 框架     | React 19 + TypeScript 6 + Vite 8                        |
| 样式     | Tailwind CSS v4 + shadcn/ui（`base-lyra`）              |
| UI       | Base UI、lucide-react、sonner                           |
| 状态     | Zustand 5 + Immer                                       |
| 路由     | react-router v7（Data Mode）                            |
| 国际化   | i18next + react-i18next                                 |
| 持久化   | `idb`（IndexedDB）                                      |
| LLM      | OpenAI SDK → DeepSeek API（SSE）                        |
| 虚拟滚动 | `@tanstack/react-virtual`                               |
| 质量     | Biome、Vitest、Playwright                               |
| 可观测性 | Sentry（生产环境，本地不需要）                          |

<a id="prerequisites"></a>

## 📋 前置要求

- **Node.js** ≥ 22
- **pnpm** ≥ 10（[安装指南](https://pnpm.io/installation)）

本仓库 `packageManager` 锁定为 `pnpm@10.28.0`。

<a id="quick-start"></a>

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone git@github.com:lgorthm/ducksoup.git
cd ducksoup

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```

打开 http://localhost:5173。首次进入会弹出 API Key 对话框，粘贴 [DeepSeek 开放平台](https://platform.deepseek.com/) 的 Key 即可开始对话。无需 `.env`。

<a id="configuration"></a>

## ⚙️ 配置

全部配置保存在浏览器 `localStorage`：

| 配置项           | localStorage Key   | 说明                                                                 |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| DeepSeek API Key | `deepseek-api-key` | 首次启动对话框或「设置 → API KEY」填写                               |
| 界面语言         | `i18nLang`         | `zh-CN`（默认）/ `en`；检测顺序：`localStorage` → 浏览器语言 → `en` |
| 主题模式         | `theme`            | `light` / `dark` / `system`；在「设置 → 通用」中切换                 |

> Key 只用于请求 DeepSeek API，不会上传到本应用服务器。

<a id="commands"></a>

## 💻 命令速查

| 命令                 | 作用                                                |
| -------------------- | --------------------------------------------------- |
| `pnpm dev`           | 启动 Vite 开发服务器                                |
| `pnpm build`         | 类型检查（`tsc -b`）+ 生产构建                      |
| `pnpm typecheck`     | 仅类型检查（`tsc -b`）                              |
| `pnpm lint`          | Biome 检查（lint + format）                         |
| `pnpm format`        | Biome 格式化 + 安全修复                             |
| `pnpm preview`       | 本地预览构建产物                                    |
| `pnpm test`          | 单元 / 集成测试（Vitest）                           |
| `pnpm test:watch`    | 测试监听模式                                        |
| `pnpm test:coverage` | 测试 + 覆盖率报告（阈值 75 / 65 / 70 / 75）         |
| `pnpm test:ui`       | Vitest 浏览器 UI                                    |
| `pnpm test:e2e`      | 端到端测试（Playwright）                            |
| `pnpm test:e2e:ui`   | Playwright 交互式 UI                                |
| `pnpm perf`          | 完整性能测量：构建 → 包体积 → Lighthouse CI → 对比  |
| `pnpm perf:bundle`   | 仅包体积检查（更快，无需浏览器）                    |

单独跑某个测试：`pnpm test <文件路径或模式>`。

<a id="ui-components"></a>

## 🧩 添加 UI 组件

shadcn/ui 安装目标是 `src/shared/components/ui/`（不是 `src/components/`），风格为 `base-lyra`：

```bash
pnpm dlx shadcn@latest add button
```

```tsx
import { Button } from '@/shared/components/ui/button';
```

<a id="structure"></a>

## 🏗️ 项目结构

```
src/
├── main.tsx                 # StrictMode → ThemeProvider → RouterProvider + Toaster
├── instrument.ts            # Sentry（仅生产且配置了 DSN 时启用）
├── routes/                  # createBrowserRouter：ChatLayout > ChatPage @ "/"
├── stores/                  # Zustand：slices / actions / selectors / models
├── features/
│   ├── chat/                # 聊天 UI、布局、SSE、IndexedDB、视觉附件
│   └── settings/            # 设置弹窗（主题 / 语言 / API Key / 余额）
├── shared/                  # shadcn、i18n、ThemeProvider、Markdown
├── mocks/                   # MSW：DeepSeek SSE mock
└── tests/setup.ts           # Vitest 全局 setup
```

<a id="testing"></a>

## 🧪 测试

**Vitest**（jsdom）：测试与源文件共置（`src/**/*.{test,spec}.{ts,tsx}`）。`src/tests/setup.ts` 已提供 `fake-indexeddb`、`matchMedia`、Resize / Intersection Observer、MSW 生命周期与 i18n，一般不必在单测里重复 mock。

**Playwright**：`desktop-chromium`（1440×900）与 `mobile-iphone`（iPhone 15）。覆盖聊天主流程、会话切换 / 置顶、滚动导航、视觉回归、无障碍审计，以及大数据量切换基准：

- 1K 条消息 < 200ms
- 5K < 350ms
- 10K < 500ms
- 500 个会话侧栏渲染；连续切换 10 次无衰减

视觉基线在 `e2e/visual/*.spec.ts-snapshots/`，更新：

```bash
pnpm exec playwright test e2e/visual/ -u
```

<a id="perf"></a>

## 📈 性能与包体积追踪

`pnpm perf` 流水线：

1. `PERF=1 pnpm build`（可选 `rollup-plugin-visualizer` → `perf/stats.html`）
2. `scripts/perf/collect-bundle.mjs` 采集 raw / gzip / brotli → `perf/history.json`
3. `lhci autorun`（3 次取中位数）
4. `scripts/perf/compare.mjs` 与上一条历史对比，超阈值则以退出码 1 失败

回归阈值写在 `scripts/perf/compare.mjs` 顶部：gzip 总量 > +2%、LCP > +200ms、CLS > +0.02、INP > +50ms、性能分 > −3 分。

`perf/history.json` 与 `perf/report.md` 纳入版本管理，作为跨机器 / CI 的共享基线。`pnpm perf:bundle` 跳过 Lighthouse，只比包体积。

<a id="deploy"></a>

## 🚀 部署

推送到 `main` 会触发 [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)：

1. `pnpm install --frozen-lockfile`（Node 22）
2. `pnpm build`
3. 将 `dist/` 通过 SSH / rsync 同步到 Nginx 主机

可选 CI secrets：`VITE_SENTRY_DSN`、`SENTRY_AUTH_TOKEN`（用于生产错误上报与 source map 上传）。本地开发不需要。

> **无预发布环境** —— `main` 即线上，请勿推送未通过构建的代码。

<a id="contributing"></a>

## 🤝 贡献

Git hooks（husky）会在提交前自动跑检查：

- **pre-commit**：`lint-staged` + `typecheck` + 单元测试
- **pre-push**：完整 E2E（Playwright 会自动启动开发服务器）

紧急情况可用 `--no-verify` 跳过。提交信息请遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：`type(scope): subject`（英文、祈使语气、句首小写、无句号）。

<a id="license"></a>

## 📄 License

本项目基于 [MIT License](./LICENSE) 开源。

Copyright (c) 2026 alwaysblue &lt;maybelxr@gmail.com&gt;

<a id="thanks"></a>

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) —— 大语言模型服务
- [shadcn/ui](https://ui.shadcn.com/) —— UI 组件体系
- [Base UI](https://base-ui.com/) —— 无样式无障碍原语
- [Tailwind CSS](https://tailwindcss.com/) —— 原子化 CSS
- [Vite](https://vite.dev/) —— 前端构建工具
