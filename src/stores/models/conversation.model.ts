import type { Conversation } from '@/features/chat/types/deepseek';

export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  initialized: boolean;
}

export const initialConversationState: ConversationState = {
  conversations: [],
  currentConversationId: null,
  initialized: false,
};
