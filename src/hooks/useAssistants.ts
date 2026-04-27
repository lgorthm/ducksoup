import { useMemo } from 'react'
import { create } from 'zustand'
import type { Assistant } from '@/types/deepseek'
import {
  getAllAssistants,
  addAssistant as addAssistantToDB,
  deleteAssistant as deleteAssistantFromDB,
} from '@/lib/db'

const STORAGE_KEY = 'ducksoup-active-assistant'

interface AssistantsState {
  assistants: Assistant[]
  activeAssistantId: string | null
  refreshAssistants: () => Promise<void>
  setActiveAssistantId: (id: string | null) => void
  createAssistant: (name: string, systemPrompt: string) => Promise<Assistant>
  deleteAssistant: (id: string) => Promise<void>
}

export const useAssistantsStore = create<AssistantsState>((set, get) => ({
  assistants: [],
  activeAssistantId: localStorage.getItem(STORAGE_KEY),

  refreshAssistants: async () => {
    const list = await getAllAssistants()
    set((state) => {
      const currentId = state.activeAssistantId
      if (currentId && list.length > 0) {
        const exists = list.some((a) => a.id === currentId)
        if (!exists) {
          localStorage.removeItem(STORAGE_KEY)
          return { assistants: list, activeAssistantId: null }
        }
      }
      return { assistants: list }
    })
  },

  setActiveAssistantId: (id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    set({ activeAssistantId: id })
  },

  createAssistant: async (name: string, systemPrompt: string): Promise<Assistant> => {
    const assistant: Assistant = {
      id: crypto.randomUUID(),
      name,
      systemPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await addAssistantToDB(assistant)
    await get().refreshAssistants()
    get().setActiveAssistantId(assistant.id)
    return assistant
  },

  deleteAssistant: async (id: string) => {
    await deleteAssistantFromDB(id)
    await get().refreshAssistants()
  },
}))

export function useAssistants() {
  const assistants = useAssistantsStore((s) => s.assistants)
  const activeAssistantId = useAssistantsStore((s) => s.activeAssistantId)
  const setActiveAssistantId = useAssistantsStore((s) => s.setActiveAssistantId)
  const createAssistant = useAssistantsStore((s) => s.createAssistant)
  const deleteAssistant = useAssistantsStore((s) => s.deleteAssistant)

  const activeAssistant = useMemo(
    () => assistants.find((a) => a.id === activeAssistantId) ?? null,
    [assistants, activeAssistantId],
  )

  return {
    assistants,
    activeAssistantId,
    activeAssistant,
    setActiveAssistantId,
    createAssistant,
    deleteAssistant,
  } as const
}
