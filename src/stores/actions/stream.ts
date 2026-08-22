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

function completeStreaming(opts: {
  streamingMsgId: string;
  status: 'done' | 'error';
  actionName: string;
  conversationId: string;
  rootId: string;
  error?: string;
}) {
  const { streamingMsgId, status, actionName, conversationId, rootId, error } =
    opts;

  useStore.setState(
    (state) => {
      const current = state.messageNodes.get(streamingMsgId);
      if (current) {
        if (current.status === 'pending') {
          current.status = status;
        }
        if (status === 'done' && !current.reasoningContent) {
          current.reasoningContent = undefined;
        }
      }
      state.streamingMessageId = null;
      state.isLoading = false;
      if (error !== undefined) {
        state.error = error;
      }
      if (status === 'done') {
        const messageCount = countVisibleMessages(state.messageNodes, rootId);
        state.conversations = state.conversations.map((c: Conversation) =>
          c.id === conversationId
            ? {
                ...c,
                activeLeafId: streamingMsgId,
                updatedAt: Date.now(),
                messageCount,
              }
            : c,
        );
      }
    },
    undefined,
    actionName,
  );

  const finalNode = useStore.getState().messageNodes.get(streamingMsgId);
  if (finalNode) {
    db.updateMessage(finalNode).catch(() => {});
  }
  if (status === 'done') {
    const updatedConv = useStore
      .getState()
      .conversations.find((c: Conversation) => c.id === conversationId);
    if (updatedConv) {
      db.updateConversation(updatedConv).catch(() => {});
    }
  }
  setActiveController(null);
}

export function cancelStream() {
  const name = createActionName('chat', cancelStream);
  const controller = getActiveController();
  if (controller) {
    controller.abort();
    setActiveController(null);
  }

  const { streamingMessageId, rootId } = useStore.getState();
  if (!streamingMessageId) return;
  const node = useStore.getState().messageNodes.get(streamingMessageId);
  if (!node || !rootId) {
    useStore.setState(
      (state) => {
        state.streamingMessageId = null;
        state.isLoading = false;
      },
      undefined,
      name(),
    );
    return;
  }

  completeStreaming({
    streamingMsgId: streamingMessageId,
    status: node.content || node.reasoningContent ? 'done' : 'error',
    actionName: name(),
    conversationId: node.conversationId,
    rootId,
  });
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
          completeStreaming({
            streamingMsgId,
            status: 'done',
            actionName: name('done'),
            conversationId,
            rootId,
          });
          break;
        }

        case 'error':
          completeStreaming({
            streamingMsgId,
            status: 'error',
            actionName: name('error'),
            conversationId,
            rootId,
            error: event.error.message,
          });
          break;
      }
    },
  });

  setActiveController(controller);
}
