import type {
  StoredMessage,
  StreamingMessage,
} from '@/features/chat/types/deepseek';

export interface MessageState {
  allMessages: StoredMessage[];
  messages: StoredMessage[];
  streamingMessage: StreamingMessage | null;
  editingMessageId: string | null;
  activeMessageId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const initialMessageState: MessageState = {
  allMessages: [],
  messages: [],
  streamingMessage: null,
  editingMessageId: null,
  activeMessageId: null,
  isLoading: false,
  error: null,
};
