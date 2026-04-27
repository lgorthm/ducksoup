import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PlusIcon } from 'lucide-react'
import { useAssistants } from '@/hooks/useAssistants'

export function NewAssistantDialog() {
  const { createAssistant } = useAssistants()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setName('')
      setSystemPrompt('')
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    await createAssistant(name.trim(), systemPrompt.trim())
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 px-3">
          <PlusIcon className="size-4" />
          New Assistant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Assistant</DialogTitle>
          <DialogDescription>Configure your assistant's name and system prompt.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Assistant"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="system-prompt">System Prompt</Label>
            <textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              className="h-8 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 [&:not(:focus)]:hover:border-input/80"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
