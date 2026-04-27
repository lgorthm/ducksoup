import { create } from 'zustand'

interface ChatActionsState {
  clearMessages: () => void
  hasMessages: boolean
}

export const useChatActionsStore = create<ChatActionsState>(() => ({
  clearMessages: () => {},
  hasMessages: false,
}))
