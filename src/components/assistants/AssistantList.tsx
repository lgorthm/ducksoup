import { Button } from '@/components/ui/button'
import { Trash2Icon } from 'lucide-react'
import type { Assistant } from '@/types/deepseek'

interface AssistantListProps {
  assistants: Assistant[]
  activeAssistantId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function AssistantList({
  assistants,
  activeAssistantId,
  onSelect,
  onDelete,
}: AssistantListProps) {
  if (assistants.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
        No assistants yet. Create one to get started!
      </p>
    )
  }

  return (
    <div className="space-y-0.5">
      {assistants.map((assistant) => (
        <div
          key={assistant.id}
          data-active={assistant.id === activeAssistantId ? true : undefined}
          className="group flex items-center rounded-md px-3 py-2 text-sm hover:bg-accent data-active:bg-accent"
        >
          <button
            type="button"
            className="flex-1 truncate text-left"
            onClick={() => onSelect(assistant.id)}
          >
            {assistant.name}
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(assistant.id)}
            aria-label={`Delete ${assistant.name}`}
          >
            <Trash2Icon className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  )
}
