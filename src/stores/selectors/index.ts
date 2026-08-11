import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores';

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

export function useMessageListState() {
  return useStore(
    useShallow((s) => ({
      messages: s.messages,
      streamingMessage: s.streamingMessage,
      allMessages: s.allMessages,
      editingMessageId: s.editingMessageId,
    })),
  );
}

/**
 * 流式会话状态，供 ChatComposer / ChatStatus 等只关心"是否在加载/流式"的组件使用。
 * isStreaming 用布尔值而非 streamingMessage 对象：流式 token 累积不会触发重渲染。
 */
export function useStreamStatus() {
  return useStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
      isStreaming: s.streamingMessage !== null,
      error: s.error,
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
