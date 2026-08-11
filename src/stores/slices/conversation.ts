import type { Conversation } from '@/features/chat/types/deepseek';
import {
  initialConversationState,
  type ConversationState,
} from '@/stores/models';
import type { SliceCreator } from '@/stores/slices/settings';

export interface ConversationSlice extends ConversationState {
  setConversationsState: (conversations: Conversation[]) => void;
  setCurrentConversationIdState: (id: string | null) => void;
  setInitializedState: (initialized: boolean) => void;
}

export const createConversationSlice: SliceCreator<ConversationSlice> = (
  set,
) => ({
  ...initialConversationState,

  setConversationsState: (conversations) =>
    set(
      (state) => {
        state.conversations = conversations;
      },
      undefined,
      'conversation/setConversationsState',
    ),

  setCurrentConversationIdState: (id) =>
    set(
      (state) => {
        state.currentConversationId = id;
      },
      undefined,
      'conversation/setCurrentConversationIdState',
    ),

  setInitializedState: (initialized) =>
    set(
      (state) => {
        state.initialized = initialized;
      },
      undefined,
      'conversation/setInitializedState',
    ),
});
