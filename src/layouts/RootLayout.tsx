import { Link, Outlet } from 'react-router'
import { Button } from '@/components/ui/button'
import { PanelLeftOpenIcon, PlusIcon } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useSidebar } from '@/hooks/useSidebar'

export default function RootLayout() {
  const { sidebarOpen, openSidebar, closeSidebar, breakpoint } = useSidebar()

  const isMobile = breakpoint === 'mobile'
  const isModalOpen = sidebarOpen && isMobile // 移动端模态显示

  return (
    <div id="app" className="flex h-svh">
      {/* Desktop sidebar */}
      <aside
        data-state={sidebarOpen ? 'open' : 'closed'}
        className="hidden h-full shrink-0 overflow-hidden border-r bg-sidebar transition-all duration-300 md:block data-[state=closed]:w-0 data-[state=open]:w-60"
      >
        <div className="w-60 h-full">
          <Sidebar onClose={closeSidebar} />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          {/* Mobile: hamburger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={openSidebar}
            className="md:hidden"
            aria-label="Open sidebar"
          >
            <PanelLeftOpenIcon />
          </Button>

          {/* Desktop: Open Sidebar + New Chat (when sidebar closed) */}
          {!sidebarOpen && (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" size="icon" onClick={openSidebar} aria-label="Open sidebar">
                <PanelLeftOpenIcon />
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/" aria-label="New chat">
                  <PlusIcon />
                </Link>
              </Button>
            </div>
          )}

          <div className="flex-1" />

          {/* New Chat — always visible on mobile; on desktop only shown when sidebar is open */}
          <Button variant="ghost" size="icon" asChild className={!sidebarOpen ? 'md:hidden' : ''}>
            <Link to="/" aria-label="New chat">
              <PlusIcon />
            </Link>
          </Button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="flex h-12 shrink-0 items-center border-t px-4" />
      </div>

      {/* Mobile sidebar (modal overlay) */}
      <div
        data-state={isModalOpen ? 'open' : 'closed'}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:opacity-100"
        onClick={closeSidebar}
      />
      <div
        data-state={isModalOpen ? 'open' : 'closed'}
        className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar shadow-lg transition-transform duration-300 md:hidden data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0"
      >
        <Sidebar onClose={closeSidebar} />
      </div>
    </div>
  )
}
