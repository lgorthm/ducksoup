import type {
  BranchInfo,
  StoredMessage,
  StreamingMessage,
} from '@/features/chat/types/deepseek';
import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { cancelStream, runStream } from '@/stores/actions/stream';
import { createActionName } from '@/stores/utils/actionName';
import { buildApiMessages } from '@/stores/utils/api-messages';
import { generateId } from '@/stores/utils/ids';
import { deriveActivePath, deriveBranchInfo } from '@/stores/utils/tree';

export function setEditingMessage(id: string | null) {
  const name = createActionName('message', setEditingMessage);
  useStore.setState(
    (state) => {
      state.editingMessageId = id;
    },
    undefined,
    name(),
  );
}

export function toggleActiveMessage(id: string) {
  const name = createActionName('message', toggleActiveMessage);
  useStore.setState(
    (state) => {
      state.activeMessageId = state.activeMessageId === id ? null : id;
    },
    undefined,
    name(),
  );
}

export async function sendMessage(content: string, _deepThink?: boolean) {
  const name = createActionName('chat', sendMessage);
  const { apiKey, currentConversationId, allMessages, conversations } =
    useStore.getState();
  if (!apiKey) return;

  cancelStream();

  let conv = conversations.find((c) => c.id === currentConversationId) ?? null;
  const prevLeafId = conv?.activeLeafId ?? null;
  if (!conv) {
    const now = Date.now();
    conv = {
      id: generateId(),
      title: content.length > 20 ? `${content.slice(0, 20)}...` : content,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      activeLeafId: null,
    };
    await db.addConversation(conv);
  }
  const conversationId = conv.id;

  const userMsg: StoredMessage = {
    id: generateId(),
    conversationId,
    role: 'user',
    content,
    createdAt: Date.now(),
    parentId: prevLeafId,
    selectedChildId: null,
  };
  const assistantId = generateId();
  userMsg.selectedChildId = assistantId;
  const assistantPlaceholder: StoredMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: Date.now() + 1,
    parentId: userMsg.id,
    selectedChildId: null,
  };
  const streamingMsg: StreamingMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    reasoningContent: '',
    createdAt: assistantPlaceholder.createdAt,
  };

  const newAll = [...allMessages, userMsg, assistantPlaceholder];
  const baseConversations =
    conv.id === currentConversationId
      ? conversations
      : [...conversations, conv];

  useStore.setState(
    (state) => {
      state.isLoading = true;
      state.error = null;
      state.allMessages = newAll;
      state.messages = deriveActivePath(newAll, userMsg.id);
      state.streamingMessage = streamingMsg;
      state.conversations = baseConversations;
      state.currentConversationId = conversationId;
    },
    undefined,
    name('start'),
  );

  const apiMessages = buildApiMessages(deriveActivePath(newAll, userMsg.id));

  runStream({
    conversationId,
    apiMessages,
    streamingMsgId: assistantId,
    streamingParentId: userMsg.id,
    parentUpdate: prevLeafId
      ? { parentId: prevLeafId, newChildId: userMsg.id }
      : null,
    userMsgToPersist: userMsg,
    messageCountDelta: 2,
  });
}

export async function clearMessages() {
  const name = createActionName('message', clearMessages);
  const { currentConversationId, conversations } = useStore.getState();
  if (!currentConversationId) return;
  await db.clearConversationMessages(currentConversationId);
  const updatedConversations = conversations.map((c) =>
    c.id === currentConversationId ? { ...c, activeLeafId: null } : c,
  );
  const updatedConv = updatedConversations.find(
    (c) => c.id === currentConversationId,
  );
  if (updatedConv) {
    db.updateConversation(updatedConv).catch(() => {});
  }
  useStore.setState(
    (state) => {
      state.allMessages = [];
      state.messages = [];
      state.streamingMessage = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.conversations = updatedConversations;
    },
    undefined,
    name(),
  );
}

export async function editMessage(messageId: string, newContent: string) {
  const name = createActionName('chat', editMessage);
  if (useStore.getState().isLoading) return;
  const { allMessages } = useStore.getState();
  const original = allMessages.find((m) => m.id === messageId);
  if (original?.role !== 'user' || !useStore.getState().apiKey) return;

  cancelStream();

  const conversationId = original.conversationId;
  const parentId = original.parentId ?? null;

  const newUserMsg: StoredMessage = {
    id: generateId(),
    conversationId,
    role: 'user',
    content: newContent,
    createdAt: Date.now(),
    parentId,
    selectedChildId: null,
  };
  const assistantId = generateId();
  newUserMsg.selectedChildId = assistantId;
  const assistantPlaceholder: StoredMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: Date.now() + 1,
    parentId: newUserMsg.id,
    selectedChildId: null,
  };
  const streamingMsg: StreamingMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    reasoningContent: '',
    createdAt: assistantPlaceholder.createdAt,
  };

  const newAll = [...allMessages, newUserMsg, assistantPlaceholder];
  useStore.setState(
    (state) => {
      state.isLoading = true;
      state.error = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.allMessages = newAll;
      state.messages = deriveActivePath(newAll, newUserMsg.id);
      state.streamingMessage = streamingMsg;
    },
    undefined,
    name('start'),
  );

  const apiMessages = buildApiMessages(deriveActivePath(newAll, newUserMsg.id));

  runStream({
    conversationId,
    apiMessages,
    streamingMsgId: assistantId,
    streamingParentId: newUserMsg.id,
    parentUpdate: parentId ? { parentId, newChildId: newUserMsg.id } : null,
    userMsgToPersist: newUserMsg,
    messageCountDelta: 2,
  });
}

export async function regenerateMessage(messageId: string) {
  const name = createActionName('chat', regenerateMessage);
  if (useStore.getState().isLoading) return;
  const { allMessages } = useStore.getState();
  const original = allMessages.find((m) => m.id === messageId);
  if (original?.role !== 'assistant' || !useStore.getState().apiKey) return;

  cancelStream();

  const conversationId = original.conversationId;
  const parentId = original.parentId ?? null;
  if (!parentId) return;

  const assistantId = generateId();
  const assistantPlaceholder: StoredMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    parentId,
    selectedChildId: null,
  };
  const streamingMsg: StreamingMessage = {
    id: assistantId,
    conversationId,
    role: 'assistant',
    content: '',
    reasoningContent: '',
    createdAt: assistantPlaceholder.createdAt,
  };

  const newAll = [...allMessages, assistantPlaceholder];
  useStore.setState(
    (state) => {
      state.isLoading = true;
      state.error = null;
      state.allMessages = newAll;
      state.messages = deriveActivePath(newAll, parentId);
      state.streamingMessage = streamingMsg;
    },
    undefined,
    name('start'),
  );

  const apiMessages = buildApiMessages(deriveActivePath(newAll, parentId));

  runStream({
    conversationId,
    apiMessages,
    streamingMsgId: assistantId,
    streamingParentId: parentId,
    parentUpdate: { parentId, newChildId: assistantId },
    userMsgToPersist: null,
    messageCountDelta: 1,
  });
}

export function switchSibling(messageId: string, direction: -1 | 1) {
  const name = createActionName('message', switchSibling);
  if (useStore.getState().isLoading) return;
  const { allMessages, conversations } = useStore.getState();
  const msg = allMessages.find((m) => m.id === messageId);
  if (!msg) return;

  const info = deriveBranchInfo(allMessages, msg);
  const targetSiblingId =
    direction === -1 ? info.prevSiblingId : info.nextSiblingId;
  if (!targetSiblingId) return;

  const byId = new Map(allMessages.map((m) => [m.id, m]));
  const seen = new Set<string>();
  let leaf = byId.get(targetSiblingId);
  while (leaf?.selectedChildId && !seen.has(leaf.id)) {
    seen.add(leaf.id);
    const next = byId.get(leaf.selectedChildId);
    if (!next) break;
    leaf = next;
  }
  const newLeafId = leaf ? leaf.id : targetSiblingId;

  let nextAll = allMessages;
  if (msg.parentId) {
    nextAll = allMessages.map((m) =>
      m.id === msg.parentId ? { ...m, selectedChildId: targetSiblingId } : m,
    );
    const parent = byId.get(msg.parentId);
    if (parent) {
      db.updateMessage({
        ...parent,
        selectedChildId: targetSiblingId,
      }).catch(() => {});
    }
  }

  const updatedConversations = conversations.map((c) =>
    c.id === msg.conversationId ? { ...c, activeLeafId: newLeafId } : c,
  );
  const updatedConv = updatedConversations.find(
    (c) => c.id === msg.conversationId,
  );
  if (updatedConv) {
    db.updateConversation(updatedConv).catch(() => {});
  }

  useStore.setState(
    (state) => {
      state.allMessages = nextAll;
      state.messages = deriveActivePath(nextAll, newLeafId);
      state.streamingMessage = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.conversations = updatedConversations;
    },
    undefined,
    name(),
  );
}

export function getBranchInfo(messageId: string): BranchInfo {
  const { allMessages } = useStore.getState();
  const msg = allMessages.find((m) => m.id === messageId);
  if (!msg) {
    return {
      current: 1,
      total: 1,
      prevSiblingId: null,
      nextSiblingId: null,
    };
  }
  return deriveBranchInfo(allMessages, msg);
}
