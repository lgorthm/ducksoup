import type {
  StoredMessage,
  StreamingMessage,
} from '@/features/chat/types/deepseek';
import { initialMessageState, type MessageState } from '@/stores/models';
import type { SliceCreator } from '@/stores/slices/settings';

export interface MessageSlice extends MessageState {
  setMessageTreeState: (
    allMessages: StoredMessage[],
    messages: StoredMessage[],
  ) => void;
  setStreamingMessageState: (streamingMessage: StreamingMessage | null) => void;
  setEditingMessageIdState: (id: string | null) => void;
  setActiveMessageIdState: (id: string | null) => void;
  setLoadingState: (isLoading: boolean) => void;
  setErrorState: (error: string | null) => void;
}

export const createMessageSlice: SliceCreator<MessageSlice> = (set) => ({
  ...initialMessageState,

  setMessageTreeState: (allMessages, messages) =>
    set(
      (state) => {
        state.allMessages = allMessages;
        state.messages = messages;
      },
      undefined,
      'message/setMessageTreeState',
    ),

  setStreamingMessageState: (streamingMessage) =>
    set(
      (state) => {
        state.streamingMessage = streamingMessage;
      },
      undefined,
      'message/setStreamingMessageState',
    ),

  setEditingMessageIdState: (id) =>
    set(
      (state) => {
        state.editingMessageId = id;
      },
      undefined,
      'message/setEditingMessageIdState',
    ),

  setActiveMessageIdState: (id) =>
    set(
      (state) => {
        state.activeMessageId = id;
      },
      undefined,
      'message/setActiveMessageIdState',
    ),

  setLoadingState: (isLoading) =>
    set(
      (state) => {
        state.isLoading = isLoading;
      },
      undefined,
      'message/setLoadingState',
    ),

  setErrorState: (error) =>
    set(
      (state) => {
        state.error = error;
      },
      undefined,
      'message/setErrorState',
    ),
});
