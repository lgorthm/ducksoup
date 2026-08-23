import i18n from '@/shared/i18n';
import type { Conversation } from '@/stores/models';
import { DEFAULT_MODEL } from '@/stores/models';
import * as db from '@/features/chat/utils/db';
import { useStore } from '@/stores';
import { createActionName } from '@/stores/utils/actionName';
import { generateId } from '@/stores/utils/ids';
import { cancelStream } from '@/stores/actions/stream';
import { deleteImageFile } from '@/features/chat/utils/files-api';
import {
  createRoot,
  hydrateConversation,
  settlePendingNodes,
} from '@/stores/utils/tree';

function emptyTree(state: {
  messageNodes: Map<string, unknown>;
  rootId: string | null;
  activeLeafId: string | null;
  activePath: string[];
  streamingMessageId: string | null;
  editingMessageId: string | null;
  activeMessageId: string | null;
  error: string | null;
}) {
  state.messageNodes = new Map();
  state.rootId = null;
  state.activeLeafId = null;
  state.activePath = [];
  state.streamingMessageId = null;
  state.editingMessageId = null;
  state.activeMessageId = null;
  state.error = null;
}

export async function createConversation() {
  cancelStream();
  const name = createActionName('conversation', createConversation);
  const now = Date.now();
  const id = generateId();
  const root = createRoot(id, generateId(), now);
  const conv: Conversation = {
    id,
    title: i18n.t('conversation.new'),
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    rootId: root.id,
    activeLeafId: null,
    model: DEFAULT_MODEL,
  };
  await db.addConversation(conv);
  await db.addMessage(root);
  useStore.setState(
    (state) => {
      state.conversations.push(conv);
      state.currentConversationId = conv.id;
      state.messageNodes = new Map([[root.id, root]]);
      state.rootId = root.id;
      state.activeLeafId = null;
      state.activePath = [];
      state.streamingMessageId = null;
      state.editingMessageId = null;
      state.activeMessageId = null;
      state.error = null;
    },
    undefined,
    name(),
  );
}

export function startNewConversation() {
  cancelStream();
  const name = createActionName('conversation', startNewConversation);
  useStore.setState(
    (state) => {
      state.currentConversationId = null;
      emptyTree(state);
    },
    undefined,
    name(),
  );
}

export async function switchConversation(id: string) {
  cancelStream();
  const name = createActionName('conversation', switchConversation);
  const rows = await db.getMessagesByConversation(id);
  const conv = useStore.getState().conversations.find((c) => c.id === id);
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
      state.currentConversationId = id;
      state.messageNodes = hydrated.map;
      state.rootId = rootId ?? null;
      state.activePath = hydrated.activePath;
      state.activeLeafId = hydrated.activeLeafId;
      state.streamingMessageId = null;
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
  if (useStore.getState().currentConversationId === id) {
    cancelStream();
  }
  const rows = await db.getMessagesByConversation(id);
  const fileIds = db.fileIdsOf(rows);
  const apiKey = useStore.getState().apiKey;
  await db.deleteConversation(id);
  if (apiKey) {
    for (const fileId of fileIds) {
      void deleteImageFile(apiKey, fileId);
    }
  }
  useStore.setState(
    (state) => {
      state.conversations = state.conversations.filter(
        (c: Conversation) => c.id !== id,
      );
    },
    undefined,
    name(),
  );

  if (useStore.getState().currentConversationId === id) {
    startNewConversation();
  }
}

function withoutPinnedAt(conv: Conversation): Conversation {
  const next = { ...conv };
  delete next.pinnedAt;
  return next;
}

export async function togglePinConversation(id: string) {
  const name = createActionName('conversation', togglePinConversation);
  const conv = useStore.getState().conversations.find((c) => c.id === id);
  if (!conv) return;

  const next: Conversation =
    conv.pinnedAt != null
      ? withoutPinnedAt(conv)
      : { ...conv, pinnedAt: Date.now() };

  useStore.setState(
    (state) => {
      state.conversations = state.conversations.map((c: Conversation) =>
        c.id === id ? next : c,
      );
    },
    undefined,
    name(),
  );

  await db.updateConversation(next);
}
