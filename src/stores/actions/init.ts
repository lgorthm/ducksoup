import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { createActionName } from '@/stores/utils/actionName';
import { API_KEY_STORAGE_KEY } from '@/stores/utils/constants';
import { hydrateConversation, settlePendingNodes } from '@/stores/utils/tree';

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

    const conv = conversations.find((c) => c.id === currentId);
    const rows = currentId ? await db.getMessagesByConversation(currentId) : [];
    const rootId = conv?.rootId;
    const hydrated = rootId
      ? hydrateConversation(rows, rootId)
      : { map: new Map(), activePath: [] as string[], activeLeafId: null };
    const settled = settlePendingNodes(hydrated.map);
    for (const node of settled) {
      db.updateMessage(node).catch(() => {});
    }

    useStore.setState(
      (state) => {
        state.apiKey = storedKey;
        state.hasApiKey = hasKey;
        state.conversations = conversations;
        state.currentConversationId = currentId;
        state.messageNodes = hydrated.map;
        state.rootId = rootId ?? null;
        state.activePath = hydrated.activePath;
        state.activeLeafId = hydrated.activeLeafId;
        state.initialized = true;
        state.streamingMessageId = null;
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
