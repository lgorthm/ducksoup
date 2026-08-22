import type { BranchInfo, Conversation, MessageNode } from '@/stores/models';
import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { cancelStream, runStream } from '@/stores/actions/stream';
import { createActionName } from '@/stores/utils/actionName';
import { buildApiMessages } from '@/stores/utils/api-messages';
import { generateId } from '@/stores/utils/ids';
import {
  appendChild,
  createRoot,
  deriveBranchInfo,
  liveSiblings,
  rebuildActivePath,
  resetRoot,
  switchActiveChild,
} from '@/stores/utils/tree';

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

function persistNode(node: MessageNode | undefined) {
  if (!node) return;
  db.updateMessage(node).catch(() => {});
}

function persistNewNode(node: MessageNode | undefined) {
  if (!node) return;
  db.addMessage(node).catch(() => {});
}

export async function sendMessage(content: string, _deepThink?: boolean) {
  const name = createActionName('chat', sendMessage);
  const { apiKey, currentConversationId, conversations, rootId, activeLeafId } =
    useStore.getState();
  if (!apiKey) return;

  cancelStream();

  let conv = conversations.find((c) => c.id === currentConversationId) ?? null;
  let createdRoot: MessageNode | null = null;
  if (!conv) {
    const now = Date.now();
    const convId = generateId();
    createdRoot = createRoot(convId, generateId(), now);
    conv = {
      id: convId,
      title: content.length > 20 ? `${content.slice(0, 20)}...` : content,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      rootId: createdRoot.id,
      activeLeafId: null,
    };
    await db.addConversation(conv);
    await db.addMessage(createdRoot);
  }

  const conversationId = conv.id;
  const currentRootId = createdRoot?.id ?? rootId ?? conv.rootId;
  const parentId = createdRoot
    ? createdRoot.id
    : (activeLeafId ?? currentRootId);
  const userId = generateId();
  const assistantId = generateId();
  const now = Date.now();

  useStore.setState(
    (state) => {
      if (createdRoot) {
        state.messageNodes = new Map([[createdRoot.id, createdRoot]]);
        state.rootId = createdRoot.id;
        state.conversations =
          conv.id === currentConversationId
            ? state.conversations
            : [...state.conversations, conv];
        state.currentConversationId = conversationId;
      }
      const tree = state.messageNodes;
      const userParent = parentId;
      appendChild(tree, userParent, {
        id: userId,
        conversationId,
        role: 'user',
        content,
        createdAt: now,
        status: 'done',
      });
      appendChild(tree, userId, {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: now + 1,
        status: 'pending',
      });
      state.activePath = rebuildActivePath(tree, currentRootId);
      state.activeLeafId = assistantId;
      state.streamingMessageId = assistantId;
      state.isLoading = true;
      state.error = null;
    },
    undefined,
    name('start'),
  );

  const state = useStore.getState();
  persistNewNode(state.messageNodes.get(userId));
  persistNewNode(state.messageNodes.get(assistantId));
  persistNode(state.messageNodes.get(parentId));

  runStream({
    conversationId,
    apiMessages: buildApiMessages(state.messageNodes, state.activePath),
    streamingMsgId: assistantId,
    rootId: currentRootId,
  });
}

export async function clearMessages() {
  const name = createActionName('message', clearMessages);
  const { currentConversationId, conversations } = useStore.getState();
  if (!currentConversationId) return;
  await db.clearConversationMessages(currentConversationId);
  const updatedConversations = conversations.map((c) =>
    c.id === currentConversationId
      ? { ...c, activeLeafId: null, messageCount: 0 }
      : c,
  );
  const updatedConv = updatedConversations.find(
    (c) => c.id === currentConversationId,
  );
  if (updatedConv) {
    db.updateConversation(updatedConv).catch(() => {});
  }
  useStore.setState(
    (state) => {
      if (state.rootId) {
        resetRoot(state.messageNodes, state.rootId);
      } else {
        state.messageNodes = new Map();
      }
      state.activePath = [];
      state.activeLeafId = null;
      state.streamingMessageId = null;
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
  const original = useStore.getState().messageNodes.get(messageId);
  if (original?.role !== 'user' || !useStore.getState().apiKey) return;
  const parentId = original.parentId;
  if (!parentId) return;

  cancelStream();

  const conversationId = original.conversationId;
  const userId = generateId();
  const assistantId = generateId();
  const now = Date.now();
  const rootId = useStore.getState().rootId;
  if (!rootId) return;

  useStore.setState(
    (state) => {
      const tree = state.messageNodes;
      appendChild(tree, parentId, {
        id: userId,
        conversationId,
        role: 'user',
        content: newContent,
        createdAt: now,
        status: 'done',
      });
      appendChild(tree, userId, {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: now + 1,
        status: 'pending',
      });
      state.activePath = rebuildActivePath(tree, rootId);
      state.activeLeafId = assistantId;
      state.streamingMessageId = assistantId;
      state.isLoading = true;
      state.error = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
    },
    undefined,
    name('start'),
  );

  const state = useStore.getState();
  persistNewNode(state.messageNodes.get(userId));
  persistNewNode(state.messageNodes.get(assistantId));
  persistNode(state.messageNodes.get(parentId));

  runStream({
    conversationId,
    apiMessages: buildApiMessages(state.messageNodes, state.activePath),
    streamingMsgId: assistantId,
    rootId,
  });
}

export async function regenerateMessage(messageId: string) {
  const name = createActionName('chat', regenerateMessage);
  if (useStore.getState().isLoading) return;
  const original = useStore.getState().messageNodes.get(messageId);
  if (original?.role !== 'assistant' || !useStore.getState().apiKey) return;
  const parentId = original.parentId;
  if (!parentId) return;
  const rootId = useStore.getState().rootId;
  if (!rootId) return;

  cancelStream();

  const conversationId = original.conversationId;
  const assistantId = generateId();
  const now = Date.now();

  useStore.setState(
    (state) => {
      const tree = state.messageNodes;
      appendChild(tree, parentId, {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        createdAt: now,
        status: 'pending',
      });
      state.activePath = rebuildActivePath(tree, rootId);
      state.activeLeafId = assistantId;
      state.streamingMessageId = assistantId;
      state.isLoading = true;
      state.error = null;
    },
    undefined,
    name('start'),
  );

  const state = useStore.getState();
  persistNewNode(state.messageNodes.get(assistantId));
  persistNode(state.messageNodes.get(parentId));

  runStream({
    conversationId,
    apiMessages: buildApiMessages(state.messageNodes, state.activePath),
    streamingMsgId: assistantId,
    rootId,
  });
}

export function switchSibling(messageId: string, direction: -1 | 1) {
  const name = createActionName('message', switchSibling);
  if (useStore.getState().isLoading) return;
  const { messageNodes, rootId, conversations } = useStore.getState();
  const msg = messageNodes.get(messageId);
  if (!msg?.parentId || !rootId) return;

  const siblings = liveSiblings(messageNodes, msg.parentId);
  const idx = siblings.findIndex((s) => s.id === messageId);
  const target = siblings[idx + direction];
  if (!target) return;

  const parentId = msg.parentId;

  useStore.setState(
    (state) => {
      const leaf = switchActiveChild(state.messageNodes, parentId, target.id);
      state.activePath = rebuildActivePath(state.messageNodes, rootId);
      state.activeLeafId = leaf;
      state.streamingMessageId = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.conversations = conversations.map((c) =>
        c.id === msg.conversationId ? { ...c, activeLeafId: leaf } : c,
      );
    },
    undefined,
    name(),
  );

  persistNode(useStore.getState().messageNodes.get(parentId));
  const updatedConv = useStore
    .getState()
    .conversations.find((c: Conversation) => c.id === msg.conversationId);
  if (updatedConv) {
    db.updateConversation(updatedConv).catch(() => {});
  }
}

export function getBranchInfo(messageId: string): BranchInfo {
  return deriveBranchInfo(useStore.getState().messageNodes, messageId);
}
