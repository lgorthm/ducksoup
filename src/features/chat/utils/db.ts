import { openDB, type DBSchema } from 'idb';
import type { Conversation, MessageNode } from '@/stores/models';
import { generateId } from '@/stores/utils/ids';
import { createRoot } from '@/stores/utils/tree';

export const DB_NAME = 'ducksoup-chat';
export const DB_VERSION = 3;

export interface DuckSoupDBSchema extends DBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-updatedAt': number };
  };
  messages: {
    key: string;
    value: MessageNode;
    indexes: {
      'by-conversationId': string;
      'by-createdAt': number;
      'by-conversation-parent': [string, string];
    };
  };
}

/** v1/v2 扁平或半树消息，仅用于升级迁移 */
export interface LegacyStoredMessage {
  id: string;
  conversationId: string;
  role: MessageNode['role'];
  content: string;
  reasoningContent?: string;
  createdAt: number;
  parentId?: string | null;
  selectedChildId?: string | null;
  siblingIndex?: number;
  activeChildId?: string | null;
  status?: MessageNode['status'];
  deleted?: boolean;
  childrenIds?: string[];
}

export interface LegacyConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  activeLeafId?: string | null;
  rootId?: string;
}

function getDB() {
  return openDB<DuckSoupDBSchema>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', {
          keyPath: 'id',
        });
        convStore.createIndex('by-updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by-conversationId', 'conversationId');
        msgStore.createIndex('by-createdAt', 'createdAt');
      }
      const msgStore = transaction.objectStore('messages');
      if (!msgStore.indexNames.contains('by-conversation-parent')) {
        msgStore.createIndex('by-conversation-parent', [
          'conversationId',
          'parentId',
        ]);
      }

      if (oldVersion < 2) {
        const allMsgs = (await msgStore.getAll()) as LegacyStoredMessage[];
        const convStore = transaction.objectStore('conversations');
        const allConvs = (await convStore.getAll()) as LegacyConversation[];
        chainFlatMessagesIntoTree(allMsgs, allConvs);
        for (const m of allMsgs) await msgStore.put(m as MessageNode);
        for (const c of allConvs) await convStore.put(c as Conversation);
      }

      if (oldVersion < 3) {
        const allMsgs = (await msgStore.getAll()) as LegacyStoredMessage[];
        const convStore = transaction.objectStore('conversations');
        const allConvs = (await convStore.getAll()) as LegacyConversation[];
        const migrated = migrateV2MessagesToV3(allMsgs, allConvs);
        for (const m of migrated) await msgStore.put(m);
        for (const c of allConvs) await convStore.put(c as Conversation);
      }
    },
  });
}

/**
 * v1 → v2：按 conversationId 分组、沿 createdAt 排序（同时间戳 user 在前），
 * 链式写入 parentId / selectedChildId，并把每个会话的 activeLeafId 指向末条消息。
 */
export function chainFlatMessagesIntoTree(
  messages: LegacyStoredMessage[],
  conversations: LegacyConversation[],
): void {
  const byConv = new Map<string, LegacyStoredMessage[]>();
  for (const m of messages) {
    const list = byConv.get(m.conversationId) ?? [];
    list.push(m);
    byConv.set(m.conversationId, list);
  }
  for (const msgs of byConv.values()) {
    msgs.sort((a, b) => {
      const d = a.createdAt - b.createdAt;
      if (d !== 0) return d;
      return a.role === 'user' ? -1 : b.role === 'user' ? 1 : 0;
    });
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      m.parentId = i > 0 ? msgs[i - 1].id : null;
      m.selectedChildId = i < msgs.length - 1 ? msgs[i + 1].id : null;
    }
  }
  for (const conv of conversations) {
    const msgs = byConv.get(conv.id);
    conv.activeLeafId =
      msgs && msgs.length > 0 ? msgs[msgs.length - 1].id : null;
  }
}

/**
 * v2 → v3：插入虚拟根、reparent 首条消息、selectedChildId → activeChildId、
 * 按父分组赋 siblingIndex，已有消息 status=done。
 */
export function migrateV2MessagesToV3(
  messages: LegacyStoredMessage[],
  conversations: LegacyConversation[],
  nextId: () => string = generateId,
): MessageNode[] {
  const byConv = new Map<string, LegacyStoredMessage[]>();
  for (const m of messages) {
    const list = byConv.get(m.conversationId) ?? [];
    list.push(m);
    byConv.set(m.conversationId, list);
  }

  const result: MessageNode[] = [];

  for (const conv of conversations) {
    const rootId = conv.rootId || nextId();
    conv.rootId = rootId;
    const root = createRoot(conv.id, rootId, conv.createdAt);
    const convMsgs = byConv.get(conv.id) ?? [];

    const nodes: MessageNode[] = convMsgs.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      parentId: m.parentId ?? null,
      childrenIds: [],
      siblingIndex: 0,
      activeChildId: m.activeChildId ?? m.selectedChildId ?? null,
      content: m.content,
      reasoningContent: m.reasoningContent,
      status: m.status ?? 'done',
      createdAt: m.createdAt,
      deleted: m.deleted ?? false,
    }));

    for (const n of nodes) {
      if (n.parentId == null) n.parentId = rootId;
    }

    const byParent = new Map<string, MessageNode[]>();
    for (const n of nodes) {
      const pid = n.parentId ?? rootId;
      const list = byParent.get(pid) ?? [];
      list.push(n);
      byParent.set(pid, list);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => {
        const d = a.createdAt - b.createdAt;
        if (d !== 0) return d;
        return a.role === 'user' ? -1 : b.role === 'user' ? 1 : 0;
      });
      for (let i = 0; i < siblings.length; i++) {
        siblings[i].siblingIndex = i;
      }
    }

    if (conv.activeLeafId) {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      let cur = byId.get(conv.activeLeafId);
      let first = cur;
      while (cur?.parentId && cur.parentId !== rootId) {
        const parent = byId.get(cur.parentId);
        if (!parent) break;
        cur = parent;
        first = cur;
      }
      root.activeChildId = first?.id ?? null;
    }

    result.push(root, ...nodes);
  }

  return result;
}

export function toDbMessage(node: MessageNode): MessageNode {
  return {
    id: node.id,
    conversationId: node.conversationId,
    role: node.role,
    parentId: node.parentId,
    childrenIds: [],
    siblingIndex: node.siblingIndex,
    activeChildId: node.activeChildId,
    content: node.content,
    reasoningContent: node.reasoningContent,
    status: node.status,
    createdAt: node.createdAt,
    deleted: node.deleted ?? false,
  };
}

export async function addConversation(conv: Conversation): Promise<void> {
  const db = await getDB();
  await db.add('conversations', conv);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDB();
  return db.getAllFromIndex('conversations', 'by-updatedAt');
}

export async function updateConversation(conv: Conversation): Promise<void> {
  const db = await getDB();
  await db.put('conversations', conv);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  const messages = await db.getAllFromIndex(
    'messages',
    'by-conversationId',
    id,
  );
  const tx = db.transaction(['messages', 'conversations'], 'readwrite');
  for (const msg of messages) {
    await tx.objectStore('messages').delete(msg.id);
  }
  await tx.objectStore('conversations').delete(id);
  await tx.done;
}

export async function addMessage(msg: MessageNode): Promise<void> {
  const db = await getDB();
  await db.add('messages', toDbMessage(msg));
}

export async function updateMessage(msg: MessageNode): Promise<void> {
  const db = await getDB();
  await db.put('messages', toDbMessage(msg));
}

export async function getMessagesByConversation(
  conversationId: string,
): Promise<MessageNode[]> {
  const db = await getDB();
  const messages = await db.getAllFromIndex(
    'messages',
    'by-conversationId',
    conversationId,
  );
  return messages.sort((a, b) => {
    const timeDiff = a.createdAt - b.createdAt;
    if (timeDiff !== 0) return timeDiff;
    return (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0);
  });
}

export async function deleteMessage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('messages', id);
}

export async function clearConversationMessages(
  conversationId: string,
): Promise<void> {
  const db = await getDB();
  const conv = await db.get('conversations', conversationId);
  const messages = await db.getAllFromIndex(
    'messages',
    'by-conversationId',
    conversationId,
  );
  const rootId = conv?.rootId;
  const tx = db.transaction('messages', 'readwrite');
  for (const msg of messages) {
    if (rootId && msg.id === rootId) {
      await tx.store.put(
        toDbMessage({
          ...msg,
          childrenIds: [],
          activeChildId: null,
        }),
      );
      continue;
    }
    await tx.store.delete(msg.id);
  }
  await tx.done;
}
