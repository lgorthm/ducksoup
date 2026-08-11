import type {
  ChatMessage,
  Conversation,
  StoredMessage,
} from '@/features/chat/types/deepseek';
import {
  createChatStream,
  type ChatStreamEvent,
} from '@/features/chat/utils/chat-stream';
import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { createActionName } from '@/stores/utils/actionName';
import {
  getActiveController,
  setActiveController,
} from '@/stores/utils/stream-controller';
import { deriveActivePath } from '@/stores/utils/tree';

export function cancelStream() {
  const controller = getActiveController();
  if (controller) {
    controller.abort();
    setActiveController(null);
  }
}

export function runStream(opts: {
  conversationId: string;
  apiMessages: ChatMessage[];
  streamingMsgId: string;
  streamingParentId: string | null;
  parentUpdate: { parentId: string; newChildId: string } | null;
  userMsgToPersist?: StoredMessage | null;
  messageCountDelta: number;
}) {
  const name = createActionName('chat', runStream);
  const {
    conversationId,
    apiMessages,
    streamingParentId,
    parentUpdate,
    userMsgToPersist,
    messageCountDelta,
  } = opts;

  if (userMsgToPersist) {
    db.addMessage(userMsgToPersist).catch(() => {});
  }

  const { apiKey, selectedModel, deepThink } = useStore.getState();

  const controller = createChatStream({
    apiKey,
    model: selectedModel,
    messages: apiMessages,
    deepThink,
    onEvent: (event: ChatStreamEvent) => {
      switch (event.type) {
        case 'thinking':
          useStore.setState(
            (state) => {
              if (state.streamingMessage) {
                state.streamingMessage.reasoningContent += event.text;
              }
            },
            undefined,
            name('thinking'),
          );
          break;

        case 'content':
          useStore.setState(
            (state) => {
              if (state.streamingMessage) {
                state.streamingMessage.content += event.text;
              }
            },
            undefined,
            name('content'),
          );
          break;

        case 'done': {
          const finalStreaming = useStore.getState().streamingMessage;
          if (!finalStreaming) break;

          const entry = useStore
            .getState()
            .allMessages.find((m) => m.id === finalStreaming.id);
          const assistantMsg: StoredMessage = {
            id: finalStreaming.id,
            conversationId,
            role: 'assistant',
            content: finalStreaming.content,
            reasoningContent: finalStreaming.reasoningContent || undefined,
            createdAt: finalStreaming.createdAt,
            parentId: entry?.parentId ?? null,
            selectedChildId: entry?.selectedChildId ?? null,
          };
          db.addMessage(assistantMsg).catch(() => {});

          let nextAll = useStore
            .getState()
            .allMessages.map((m) =>
              m.id === assistantMsg.id ? assistantMsg : m,
            );
          if (parentUpdate) {
            nextAll = nextAll.map((m) =>
              m.id === parentUpdate.parentId
                ? { ...m, selectedChildId: parentUpdate.newChildId }
                : m,
            );
            const parent = useStore
              .getState()
              .allMessages.find((m) => m.id === parentUpdate.parentId);
            if (parent) {
              db.updateMessage({
                ...parent,
                selectedChildId: parentUpdate.newChildId,
              }).catch(() => {});
            }
          }

          const conversations = useStore.getState().conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  activeLeafId: assistantMsg.id,
                  updatedAt: Date.now(),
                  messageCount: c.messageCount + messageCountDelta,
                }
              : c,
          );
          const updatedConv = conversations.find(
            (c) => c.id === conversationId,
          );
          if (updatedConv) {
            db.updateConversation(updatedConv).catch(() => {});
          }

          useStore.setState(
            (state) => {
              state.allMessages = nextAll;
              state.messages = deriveActivePath(nextAll, assistantMsg.id);
              state.streamingMessage = null;
              state.isLoading = false;
              state.conversations = conversations;
            },
            undefined,
            name('done'),
          );
          setActiveController(null);
          break;
        }

        case 'error':
          useStore.setState(
            (state) => {
              const conv = state.conversations.find(
                (c: Conversation) => c.id === conversationId,
              );
              state.streamingMessage = null;
              state.isLoading = false;
              state.error = event.error.message;
              state.messages = deriveActivePath(
                state.allMessages,
                conv?.activeLeafId,
              );
            },
            undefined,
            name('error'),
          );
          setActiveController(null);
          break;
      }
    },
  });

  void streamingParentId;
  setActiveController(controller);
}
