import { useCallback, useEffect, useRef, useState } from 'react'
import { useApiKey } from './useApiKey'
import { chatCompletionStream } from '@/lib/deepseek'
import { getMessages, saveMessage, deleteMessagesForAssistant } from '@/lib/db'
import type { ChatMessage } from '@/types/deepseek'

function createUserMessage(content: string, assistantId?: string | null): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: Date.now(),
    assistantId: assistantId ?? undefined,
  }
}

function createAssistantMessage(assistantId?: string | null): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    assistantId: assistantId ?? undefined,
  }
}

export function useChat(options?: { systemPrompt?: string; assistantId?: string | null }) {
  const { systemPrompt, assistantId } = options ?? {}
  const { apiKey } = useApiKey()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const sessionRef = useRef(0)
  // Keep ref in sync so sendMessage always has latest messages
  messagesRef.current = messages

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Load messages from IndexDB when assistantId changes
  useEffect(() => {
    sessionRef.current += 1
    abortRef.current?.abort()
    setIsStreaming(false)

    if (!assistantId) {
      setMessages([])
      setError(null)
      return
    }

    const capturedId = sessionRef.current

    void getMessages(assistantId).then((loaded) => {
      if (sessionRef.current === capturedId) {
        setMessages(loaded)
        setError(null)
      }
    })
  }, [assistantId])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    if (assistantId) {
      void deleteMessagesForAssistant(assistantId)
    }
  }, [assistantId])

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

      const userMessage = createUserMessage(trimmed, assistantId)
      const assistantPlaceholder = createAssistantMessage(assistantId)

      // Build API messages: prepend system prompt, add history, add new user message
      const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
      if (systemPrompt) {
        apiMessages.push({ role: 'system', content: systemPrompt })
      }
      for (const m of messagesRef.current) {
        apiMessages.push({ role: m.role as 'user' | 'assistant', content: m.content })
      }
      apiMessages.push({ role: 'user', content: trimmed })

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder])
      setError(null)

      // Persist user message to IndexDB
      if (assistantId) {
        void saveMessage(userMessage)
      }

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

        // Persist assistant response to IndexDB
        if (assistantId) {
          void saveMessage({
            ...assistantPlaceholder,
            content: accumulated,
          })
        }
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
    [apiKey, isStreaming, systemPrompt, assistantId],
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
