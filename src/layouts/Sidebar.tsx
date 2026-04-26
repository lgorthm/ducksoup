import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MoonIcon, PanelLeftCloseIcon, SettingsIcon, SunIcon } from 'lucide-react'
import type { Theme } from '@/hooks/useTheme'

interface SidebarProps {
  onClose?: () => void
  className?: string
  theme: Theme
  onToggleTheme: () => void
}

export function Sidebar({ onClose, className, theme, onToggleTheme }: SidebarProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Link to="/" className="text-lg font-bold">
          DuckSoup
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sidebar">
            <PanelLeftCloseIcon />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2" />

      <div className="border-t p-2 space-y-1">
        <Button variant="ghost" className="w-full justify-start gap-2 px-3" onClick={onToggleTheme}>
          {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2 px-3" asChild>
          <Link to="/settings">
            <SettingsIcon className="size-4" />
            Settings
          </Link>
        </Button>
      </div>
    </div>
  )
}
