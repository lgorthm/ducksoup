import {
  createInitialMessageState,
  type MessageId,
  type MessageNode,
  type MessageState,
} from '@/stores/models';
import type { SliceCreator } from '@/stores/slices/settings';

export interface MessageSlice extends MessageState {
  setMessageTreeState: (
    messageNodes: Map<MessageId, MessageNode>,
    rootId: MessageId | null,
    activePath: MessageId[],
    activeLeafId: MessageId | null,
  ) => void;
  setStreamingMessageIdState: (id: MessageId | null) => void;
  setEditingMessageIdState: (id: string | null) => void;
  setActiveMessageIdState: (id: string | null) => void;
  setLoadingState: (isLoading: boolean) => void;
  setErrorState: (error: string | null) => void;
}

export const createMessageSlice: SliceCreator<MessageSlice> = (set) => ({
  ...createInitialMessageState(),

  setMessageTreeState: (messageNodes, rootId, activePath, activeLeafId) =>
    set(
      (state) => {
        state.messageNodes = messageNodes;
        state.rootId = rootId;
        state.activePath = activePath;
        state.activeLeafId = activeLeafId;
      },
      undefined,
      'message/setMessageTreeState',
    ),

  setStreamingMessageIdState: (id) =>
    set(
      (state) => {
        state.streamingMessageId = id;
      },
      undefined,
      'message/setStreamingMessageIdState',
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
