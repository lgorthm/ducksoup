import { useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { Button } from '@/components/ui/button'
import { SettingsIcon } from 'lucide-react'
import { useAssistants } from '@/hooks/useAssistants'
import { useChatActionsStore } from '@/stores/chat-actions'

export function Chat() {
  const { activeAssistant } = useAssistants()
  const { messages, isStreaming, error, sendMessage, abort, clearMessages, clearError, hasApiKey } =
    useChat({
      systemPrompt: activeAssistant?.systemPrompt,
      assistantId: activeAssistant?.id ?? null,
    })

  // Sync chat actions to layout header
  useEffect(() => {
    useChatActionsStore.setState({
      clearMessages,
      hasMessages: messages.length > 0,
    })
    return () => {
      useChatActionsStore.setState({
        clearMessages: () => {},
        hasMessages: false,
      })
    }
  }, [clearMessages, messages.length])

  if (!hasApiKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground text-sm text-center">
          Configure your DeepSeek API key in the sidebar settings to start chatting.
        </p>
        <SettingsIcon className="size-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="ghost" size="icon-xs" onClick={clearError} aria-label="Dismiss error">
            ✕
          </Button>
        </div>
      )}

      {/* Messages */}
      <MessageList messages={messages} isStreaming={isStreaming} />

      {/* Input */}
      <div className="p-4">
        <ChatInput onSend={sendMessage} onStop={abort} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
