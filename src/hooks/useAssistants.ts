import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Assistant } from '@/types/deepseek'
import {
  getAllAssistants,
  addAssistant as addAssistantToDB,
  deleteAssistant as deleteAssistantFromDB,
} from '@/lib/db'

interface AssistantsContextValue {
  assistants: Assistant[]
  activeAssistantId: string | null
  activeAssistant: Assistant | null
  setActiveAssistantId: (id: string | null) => void
  createAssistant: (name: string, systemPrompt: string) => Promise<Assistant>
  deleteAssistant: (id: string) => Promise<void>
}

const AssistantsContext = createContext<AssistantsContextValue | null>(null)

const STORAGE_KEY = 'ducksoup-active-assistant'

export function AssistantsProvider({ children }: { children: ReactNode }) {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [activeAssistantId, setActiveAssistantIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  const refreshAssistants = useCallback(async () => {
    const list = await getAllAssistants()
    setAssistants(list)
  }, [])

  useEffect(() => {
    void refreshAssistants()
  }, [refreshAssistants])

  const setActiveAssistantId = useCallback((id: string | null) => {
    setActiveAssistantIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Clean up stale activeAssistantId if the assistant was deleted
  useEffect(() => {
    if (activeAssistantId && assistants.length > 0) {
      const exists = assistants.some((a) => a.id === activeAssistantId)
      if (!exists) {
        setActiveAssistantId(null)
      }
    }
  }, [assistants, activeAssistantId, setActiveAssistantId])

  const activeAssistant = useMemo(
    () => assistants.find((a) => a.id === activeAssistantId) ?? null,
    [assistants, activeAssistantId],
  )

  const createAssistant = useCallback(
    async (name: string, systemPrompt: string): Promise<Assistant> => {
      const assistant: Assistant = {
        id: crypto.randomUUID(),
        name,
        systemPrompt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await addAssistantToDB(assistant)
      await refreshAssistants()
      setActiveAssistantId(assistant.id)
      return assistant
    },
    [refreshAssistants, setActiveAssistantId],
  )

  const deleteAssistant = useCallback(
    async (id: string) => {
      await deleteAssistantFromDB(id)
      await refreshAssistants()
      if (activeAssistantId === id) {
        setActiveAssistantId(null)
      }
    },
    [refreshAssistants, activeAssistantId, setActiveAssistantId],
  )

  const value = useMemo(
    () => ({
      assistants,
      activeAssistantId,
      activeAssistant,
      setActiveAssistantId,
      createAssistant,
      deleteAssistant,
    }),
    [
      assistants,
      activeAssistantId,
      activeAssistant,
      setActiveAssistantId,
      createAssistant,
      deleteAssistant,
    ],
  )

  return createElement(AssistantsContext.Provider, { value }, children)
}

export function useAssistants(): AssistantsContextValue {
  const ctx = useContext(AssistantsContext)
  if (!ctx) {
    throw new Error('useAssistants must be used within an AssistantsProvider')
  }
  return ctx
}
