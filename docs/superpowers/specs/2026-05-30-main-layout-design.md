# MainLayout 布局组件

**日期**: 2026-05-30
**需求**: 为 AI 大模型聊天软件提供 ChatGPT 风格的侧边栏 + 聊天区布局壳子

## 概述

实现一个 `MainLayout` 组件，采用 shadcn SidebarProvider 方案，提供左侧可折叠侧边栏 + 右侧内容区的布局结构。组件为纯布局壳子，不包含业务逻辑，通过插槽和 children 接收内容。

## 架构

### 文件位置

```
src/shared/components/layout/
  main-layout.tsx
  index.ts
```

### 组件树

```
MainLayout
├── SidebarProvider
│   ├── Sidebar
│   │   ├── SidebarHeader      ← sidebarHeader prop
│   │   ├── SidebarContent     ← sidebarContent prop
│   │   │   └── SidebarMenu
│   │   └── SidebarFooter      ← sidebarFooter prop
│   ├── SidebarTrigger         ← 固定在 SidebarInset 顶部
│   └── SidebarInset
│       └── {children}
```

### Props 接口

```tsx
interface MainLayoutProps {
  /** 侧边栏头部内容 */
  sidebarHeader?: React.ReactNode;
  /** 侧边栏主体内容 */
  sidebarContent?: React.ReactNode;
  /** 侧边栏底部内容 */
  sidebarFooter?: React.ReactNode;
  /** 侧边栏默认展开状态，默认 true */
  defaultOpen?: boolean;
  /** 主内容区 */
  children: React.ReactNode;
}
```

三个侧边栏插槽均为可选，不传则不渲染对应区块。

### 依赖

- `@/shared/components/ui/sidebar` — 项目已有的 shadcn sidebar 组件
- `@/shared/components/ui/button` — SidebarTrigger 内部使用
- `lucide-react` — 提供 SidebarTrigger 的 PanelLeftIcon

## 数据流

- 侧边栏折叠/展开状态由 `SidebarProvider` 内部管理，通过 cookie 持久化
- `SidebarTrigger` 触发 `toggleSidebar`，支持 `Ctrl+B` 键盘快捷键
- 移动端自动切换为 Sheet 抽屉模式
- 组件不持有路由状态，路由由外部调用方通过 `children` 控制

## 路由集成

当前不改变路由逻辑。使用方式：

```tsx
{
  path: '/',
  element: (
    <MainLayout
      sidebarHeader={...}
      sidebarContent={...}
      sidebarFooter={...}
    >
      <App />
    </MainLayout>
  ),
}
```

后续需要子路由时，将 `children` 替换为 `<Outlet />` 即可。

## App.tsx 改动

移除 App 组件外层的 `flex min-h-svh p-6` 容器——MainLayout 已提供布局结构。App 内部只关注聊天内容渲染。

## 移动端行为

由 shadcn sidebar 的 `offcanvas` 模式处理：
- 侧边栏默认隐藏
- `SidebarTrigger` 点击后以 Sheet 抽屉形式滑出
- 抽屉宽度使用 `SIDEBAR_WIDTH_MOBILE` (18rem)

## 不做什么

- 不在此阶段定义侧边栏内的具体 UI（对话列表、用户菜单等）——用占位符填充
- 不处理聊天路由逻辑
- 不处理主题切换（已有 ThemeProvider）
