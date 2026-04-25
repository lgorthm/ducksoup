import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PanelLeftCloseIcon, PlusIcon, SettingsIcon } from 'lucide-react'

interface SidebarContentProps {
  onClose?: () => void
  className?: string
}

export function SidebarContent({ onClose, className }: SidebarContentProps) {
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

      <div className="flex-1 overflow-y-auto p-2">
        <Button variant="ghost" className="w-full justify-start gap-2 px-3" asChild>
          <Link to="/">
            <PlusIcon className="size-4" />
            New Chat
          </Link>
        </Button>
      </div>

      <div className="border-t p-2">
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
