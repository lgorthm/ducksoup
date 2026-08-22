import type { MessageId } from './message.model';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  rootId: MessageId;
  activeLeafId: MessageId | null;
}

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
