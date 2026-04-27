import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MoonIcon, PanelLeftCloseIcon, SunIcon } from 'lucide-react'
import type { Theme } from '@/hooks/useTheme'
import { SettingsDialog } from '@/components/SettingsDialog'
import { useAssistants } from '@/hooks/useAssistants'
import { NewAssistantDialog } from '@/components/assistants/NewAssistantDialog'
import { AssistantList } from '@/components/assistants/AssistantList'

interface SidebarProps {
  onClose?: () => void
  className?: string
  theme: Theme
  onToggleTheme: () => void
}

export function Sidebar({ onClose, className, theme, onToggleTheme }: SidebarProps) {
  const { assistants, activeAssistantId, setActiveAssistantId, deleteAssistant } = useAssistants()

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link to="/" className="text-lg font-bold">
          DuckSoup
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close sidebar">
            <PanelLeftCloseIcon />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        <NewAssistantDialog />
        <AssistantList
          assistants={assistants}
          activeAssistantId={activeAssistantId}
          onSelect={setActiveAssistantId}
          onDelete={deleteAssistant}
        />
      </div>

      <div className="p-2 space-y-1">
        <Button variant="ghost" className="w-full justify-start gap-2 px-3" onClick={onToggleTheme}>
          {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </Button>
        <SettingsDialog />
      </div>
    </div>
  )
}
