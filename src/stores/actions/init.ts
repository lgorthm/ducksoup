import type { StoredMessage } from '@/features/chat/types/deepseek';
import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { createActionName } from '@/stores/utils/actionName';
import { API_KEY_STORAGE_KEY } from '@/stores/utils/constants';
import { deriveActivePath } from '@/stores/utils/tree';

export async function init() {
  const name = createActionName('chat', init);
  const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
  const hasKey = storedKey.length > 0;

  try {
    const conversations = await db.getAllConversations();
    const currentId =
      conversations.length > 0
        ? conversations[conversations.length - 1].id
        : null;

    let allMessages: StoredMessage[] = [];
    if (currentId) {
      allMessages = await db.getMessagesByConversation(currentId);
    }
    const conv = conversations.find((c) => c.id === currentId);
    const messages = deriveActivePath(allMessages, conv?.activeLeafId);

    useStore.setState(
      (state) => {
        state.apiKey = storedKey;
        state.hasApiKey = hasKey;
        state.conversations = conversations;
        state.currentConversationId = currentId;
        state.allMessages = allMessages;
        state.messages = messages;
        state.initialized = true;
        state.streamingMessage = null;
        state.editingMessageId = null;
        state.activeMessageId = null;
        state.error = null;
      },
      undefined,
      name('success'),
    );
  } catch {
    useStore.setState(
      (state) => {
        state.apiKey = storedKey;
        state.hasApiKey = hasKey;
        state.initialized = true;
      },
      undefined,
      name('error'),
    );
  }
}
