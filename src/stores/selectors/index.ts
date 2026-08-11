import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores';

export function useChatAreaState() {
  return useStore(
    useShallow((s) => ({
      messages: s.messages,
      streamingMessage: s.streamingMessage,
      isLoading: s.isLoading,
      error: s.error,
      deepThink: s.deepThink,
    })),
  );
}

export function useConversationListState() {
  return useStore(
    useShallow((s) => ({
      conversations: s.conversations,
      currentConversationId: s.currentConversationId,
      initialized: s.initialized,
    })),
  );
}

export function useChatLayoutState() {
  return useStore(
    useShallow((s) => ({
      conversations: s.conversations,
      currentConversationId: s.currentConversationId,
      selectedModel: s.selectedModel,
      initialized: s.initialized,
    })),
  );
}

export function useChatWelcomeState() {
  return useStore(
    useShallow((s) => ({
      selectedModel: s.selectedModel,
      isLoading: s.isLoading,
      deepThink: s.deepThink,
    })),
  );
}

export function useMessageListState() {
  return useStore(
    useShallow((s) => ({
      allMessages: s.allMessages,
      editingMessageId: s.editingMessageId,
    })),
  );
}

export function useEditFormState() {
  return useStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
    })),
  );
}

export function useMessageActionsState() {
  return useStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
    })),
  );
}

export function useHasContent() {
  return useStore((s) => s.messages.length > 0 || s.streamingMessage !== null);
}

export function useInitialized() {
  return useStore((s) => s.initialized);
}
