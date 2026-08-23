import type { ChatMessage } from '@/features/chat/types/deepseek';
import type { Conversation, ModelName } from '@/stores/models';
import {
  createChatStream,
  type ChatStreamEvent,
} from '@/features/chat/utils/chat-stream';
import {
  appendCitation,
  appendThinkingActivity,
  appendWebSearchActivity,
  upsertWebSearchCalls,
} from '@/features/chat/utils/web-search';
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
  status: 'done' | 'error' | 'aborted';
  actionName: string;
  conversationId: string;
  rootId: string;
  error?: string;
}) {
  const { streamingMsgId, status, actionName, conversationId, rootId, error } =
    opts;
  const persistConversation = status === 'done' || status === 'aborted';

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
        if (status === 'done' && !current.webSearchCalls?.length) {
          current.webSearchCalls = undefined;
        }
        if (status === 'done' && !current.citations?.length) {
          current.citations = undefined;
        }
        if (status === 'done' && !current.activity?.length) {
          current.activity = undefined;
        }
      }
      state.streamingMessageId = null;
      state.isLoading = false;
      if (error !== undefined) {
        state.error = error;
      }
      if (persistConversation) {
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
  if (persistConversation) {
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
    status:
      node.content || node.reasoningContent || node.webSearchCalls?.length
        ? 'aborted'
        : 'error',
    actionName: name(),
    conversationId: node.conversationId,
    rootId,
  });
}

export function runStream(opts: {
  conversationId: string;
  model: ModelName;
  apiMessages: ChatMessage[];
  streamingMsgId: string;
  rootId: string;
}) {
  const name = createActionName('chat', runStream);
  const { conversationId, model, apiMessages, streamingMsgId, rootId } = opts;
  const { apiKey, deepThink, webSearch } = useStore.getState();

  const controller = createChatStream({
    apiKey,
    model,
    messages: apiMessages,
    deepThink,
    webSearch,
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
                node.activity = appendThinkingActivity(
                  node.activity,
                  event.text,
                );
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

        case 'web_search':
          useStore.setState(
            (state) => {
              const node = state.streamingMessageId
                ? state.messageNodes.get(state.streamingMessageId)
                : undefined;
              if (node) {
                node.webSearchCalls = upsertWebSearchCalls(
                  node.webSearchCalls,
                  event.call,
                );
                node.activity = appendWebSearchActivity(
                  node.activity,
                  event.call.id,
                );
              }
            },
            undefined,
            name('web_search'),
          );
          break;

        case 'citation':
          useStore.setState(
            (state) => {
              const node = state.streamingMessageId
                ? state.messageNodes.get(state.streamingMessageId)
                : undefined;
              if (node) {
                node.citations = appendCitation(node.citations, event.citation);
              }
            },
            undefined,
            name('citation'),
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
