import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SendIcon, SquareIcon } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isStreaming && !disabled) {
      inputRef.current?.focus()
    }
  }, [isStreaming, disabled])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const text = (formData.get('message') as string) ?? ''
        if (text.trim()) {
          onSend(text)
          e.currentTarget.reset()
        }
      }}
      className="flex items-center gap-2"
    >
      <Input
        ref={inputRef}
        name="message"
        placeholder="Ask anything..."
        disabled={disabled || isStreaming}
        autoComplete="off"
        className="flex-1"
      />
      {isStreaming ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onStop}
          aria-label="Stop generating"
        >
          <SquareIcon className="size-4 fill-current" />
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={disabled}>
          <SendIcon className="size-4" />
        </Button>
      )}
    </form>
  )
}
