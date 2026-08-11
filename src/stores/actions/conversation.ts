import i18n from '@/shared/i18n';
import type { Conversation } from '@/features/chat/types/deepseek';
import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { createActionName } from '@/stores/utils/actionName';
import { generateId } from '@/stores/utils/ids';
import { deriveActivePath } from '@/stores/utils/tree';

export async function createConversation() {
  const name = createActionName('conversation', createConversation);
  const now = Date.now();
  const conv: Conversation = {
    id: generateId(),
    title: i18n.t('conversation.new'),
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    activeLeafId: null,
  };
  await db.addConversation(conv);
  useStore.setState(
    (state) => {
      state.conversations.push(conv);
      state.currentConversationId = conv.id;
      state.allMessages = [];
      state.messages = [];
      state.streamingMessage = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.error = null;
    },
    undefined,
    name(),
  );
}

export function startNewConversation() {
  const name = createActionName('conversation', startNewConversation);
  useStore.setState(
    (state) => {
      state.currentConversationId = null;
      state.allMessages = [];
      state.messages = [];
      state.streamingMessage = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.error = null;
    },
    undefined,
    name(),
  );
}

export async function switchConversation(id: string) {
  const name = createActionName('conversation', switchConversation);
  const allMessages = await db.getMessagesByConversation(id);
  const conv = useStore.getState().conversations.find((c) => c.id === id);
  const messages = deriveActivePath(allMessages, conv?.activeLeafId);
  useStore.setState(
    (state) => {
      state.currentConversationId = id;
      state.allMessages = allMessages;
      state.messages = messages;
      state.streamingMessage = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.error = null;
    },
    undefined,
    name(),
  );
}

export async function deleteConversation(id: string) {
  const name = createActionName('conversation', deleteConversation);
  await db.deleteConversation(id);
  useStore.setState(
    (state) => {
      state.conversations = state.conversations.filter((c) => c.id !== id);
    },
    undefined,
    name(),
  );

  if (useStore.getState().currentConversationId === id) {
    startNewConversation();
  }
}
