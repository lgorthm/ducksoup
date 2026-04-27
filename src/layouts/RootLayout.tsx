import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { PanelLeftOpenIcon, Trash2Icon } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useSidebar } from '@/hooks/useSidebar'
import { useTheme } from '@/hooks/useTheme'
import { useAssistants, useAssistantsStore } from '@/hooks/useAssistants'
import { useChatActionsStore } from '@/stores/chat-actions'

export default function RootLayout() {
  const { sidebarOpen, openSidebar, closeSidebar, breakpoint } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const { activeAssistant } = useAssistants()
  const { clearMessages, hasMessages } = useChatActionsStore()

  // Load assistants from IndexedDB on mount
  useEffect(() => {
    void useAssistantsStore.getState().refreshAssistants()
  }, [])

  const isMobile = breakpoint === 'mobile'
  const isModalOpen = sidebarOpen && isMobile

  // 避免重复 JSX 的按钮封装
  const OpenSidebarButton = ({ className }: { className?: string }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={openSidebar}
      className={className}
      aria-label="Open sidebar"
    >
      <PanelLeftOpenIcon />
    </Button>
  )

  return (
    <div id="app" className="flex h-svh">
      {/* 桌面端侧边栏（常驻，通过宽度过渡显隐） */}
      <aside
        data-state={sidebarOpen ? 'open' : 'closed'}
        className="hidden h-full shrink-0 overflow-hidden border-r bg-sidebar transition-all duration-300 md:block data-[state=closed]:w-0 data-[state=open]:w-60"
      >
        <Sidebar onClose={closeSidebar} theme={theme} onToggleTheme={toggleTheme} />
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          {/* 移动端始终显示打开侧边栏按钮 */}
          <OpenSidebarButton className="md:hidden" />

          {/* 桌面端侧边栏关闭时，显示打开侧边栏按钮 */}
          {!sidebarOpen && (
            <div className="hidden items-center gap-2 md:flex">
              <OpenSidebarButton />
            </div>
          )}

          {activeAssistant && (
            <span className="truncate text-xs font-medium text-muted-foreground max-w-[40%]">
              {activeAssistant.name}
            </span>
          )}

          <div className="flex-1" />

          {hasMessages && (
            <Button variant="ghost" size="icon-xs" onClick={clearMessages} aria-label="Clear chat">
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* 移动端侧边栏：遮罩层 */}
      <div
        data-state={isModalOpen ? 'open' : 'closed'}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
        onClick={closeSidebar}
      />

      {/* 移动端侧边栏：抽屉面板 */}
      <div
        data-state={isModalOpen ? 'open' : 'closed'}
        className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-lg transition-transform duration-300 md:hidden data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
      >
        <Sidebar onClose={closeSidebar} theme={theme} onToggleTheme={toggleTheme} />
      </div>
    </div>
  )
}
