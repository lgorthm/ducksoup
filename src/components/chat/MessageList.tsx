import { useRef, useEffect } from 'react'
import type { ChatMessage } from '@/types/deepseek'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        {message.content}
        {isStreaming && !isUser && (
          <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-current align-text-bottom" />
        )}
      </div>
    </div>
  )
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Ask me anything!</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {messages.map((msg, i) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
