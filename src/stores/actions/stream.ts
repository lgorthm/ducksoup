import type { ChatMessage } from '@/features/chat/types/deepseek';
import type { Conversation } from '@/stores/models';
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
import { countVisibleMessages } from '@/stores/utils/tree';

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
  rootId: string;
}) {
  const name = createActionName('chat', runStream);
  const { conversationId, apiMessages, streamingMsgId, rootId } = opts;
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
              const node = state.streamingMessageId
                ? state.messageNodes.get(state.streamingMessageId)
                : undefined;
              if (node) {
                node.reasoningContent =
                  (node.reasoningContent ?? '') + event.text;
              }
            },
            undefined,
            name('thinking'),
          );
          break;

        case 'content':
          useStore.setState(
            (state) => {
              const node = state.streamingMessageId
                ? state.messageNodes.get(state.streamingMessageId)
                : undefined;
              if (node) {
                node.content += event.text;
              }
            },
            undefined,
            name('content'),
          );
          break;

        case 'done': {
          const node = useStore.getState().messageNodes.get(streamingMsgId);
          if (!node) break;

          useStore.setState(
            (state) => {
              const current = state.messageNodes.get(streamingMsgId);
              if (current) {
                current.status = 'done';
                if (!current.reasoningContent) {
                  current.reasoningContent = undefined;
                }
              }
              state.streamingMessageId = null;
              state.isLoading = false;
              const messageCount = countVisibleMessages(
                state.messageNodes,
                rootId,
              );
              state.conversations = state.conversations.map(
                (c: Conversation) =>
                  c.id === conversationId
                    ? {
                        ...c,
                        activeLeafId: streamingMsgId,
                        updatedAt: Date.now(),
                        messageCount,
                      }
                    : c,
              );
            },
            undefined,
            name('done'),
          );

          const finalNode = useStore
            .getState()
            .messageNodes.get(streamingMsgId);
          if (finalNode) {
            db.updateMessage(finalNode).catch(() => {});
          }
          const updatedConv = useStore
            .getState()
            .conversations.find((c: Conversation) => c.id === conversationId);
          if (updatedConv) {
            db.updateConversation(updatedConv).catch(() => {});
          }
          setActiveController(null);
          break;
        }

        case 'error':
          useStore.setState(
            (state) => {
              const current = state.messageNodes.get(streamingMsgId);
              if (current) {
                current.status = 'error';
              }
              state.streamingMessageId = null;
              state.isLoading = false;
              state.error = event.error.message;
            },
            undefined,
            name('error'),
          );
          {
            const errNode = useStore
              .getState()
              .messageNodes.get(streamingMsgId);
            if (errNode) {
              db.updateMessage(errNode).catch(() => {});
            }
          }
          setActiveController(null);
          break;
      }
    },
  });

  setActiveController(controller);
}
