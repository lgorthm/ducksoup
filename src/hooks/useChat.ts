import { useCallback, useEffect, useRef, useState } from 'react'
import { useApiKey } from './useApiKey'
import { chatCompletionStream } from '@/lib/deepseek'
import type { ChatMessage } from '@/types/deepseek'

function createUserMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function createAssistantMessage(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  }
}

export function useChat() {
  const { apiKey } = useApiKey()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  // Keep ref in sync so sendMessage always has latest messages
  messagesRef.current = messages

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || isStreaming) return

      if (!apiKey) {
        setError('Please configure your DeepSeek API key in settings.')
        return
      }

      const userMessage = createUserMessage(trimmed)
      const assistantPlaceholder = createAssistantMessage()

      // Build API messages from current messages + new user message
      const apiMessages = [...messagesRef.current, userMessage].map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder])
      setError(null)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const stream = chatCompletionStream(apiKey, apiMessages, {
          signal: controller.signal,
        })

        setIsStreaming(true)

        let accumulated = ''
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? ''
          accumulated += delta
          setMessages((prev) => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: accumulated }
            }
            return copy
          })
        }

        setIsStreaming(false)
      } catch (err) {
        setIsStreaming(false)
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Remove the placeholder assistant message on abort
          setMessages((prev) => prev.filter((m) => m.id !== assistantPlaceholder.id))
          return
        }
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        setError(message)
        // Remove the placeholder assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantPlaceholder.id))
      }
    },
    [apiKey, isStreaming],
  )

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    abort,
    clearMessages,
    clearError,
    hasApiKey: !!apiKey,
  } as const
}
