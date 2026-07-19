import { openDB } from 'idb';
import type {
  Conversation,
  DuckSoupDBSchema,
  StoredMessage,
} from '@/features/chat/types/deepseek';

const DB_NAME = 'ducksoup-chat';
const DB_VERSION = 2;

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
      // v1 → v2：把扁平消息链式化为树结构（parentId / selectedChildId / activeLeafId）
      if (oldVersion < 2) {
        const msgStore = transaction.objectStore('messages');
        const convStore = transaction.objectStore('conversations');
        const allMsgs = await msgStore.getAll();
        const allConvs = await convStore.getAll();
        chainFlatMessagesIntoTree(allMsgs, allConvs);
        for (const m of allMsgs) await msgStore.put(m);
        for (const c of allConvs) await convStore.put(c);
      }
    },
  });
}

/**
 * 把 v1 扁平消息链式化为树结构（原地变更）：
 * 按 conversationId 分组、沿 createdAt 排序（同时间戳 user 在前），
 * 链式写入 parentId / selectedChildId，并把每个会话的 activeLeafId 指向末条消息。
 * 纯函数，便于单测；无数据时 no-op。
 */
export function chainFlatMessagesIntoTree(
  messages: StoredMessage[],
  conversations: Conversation[],
): void {
  const byConv = new Map<string, StoredMessage[]>();
  for (const m of messages) {
    const list = byConv.get(m.conversationId) ?? [];
    list.push(m);
    byConv.set(m.conversationId, list);
  }
  for (const msgs of byConv.values()) {
    msgs.sort((a, b) => {
      const d = a.createdAt - b.createdAt;
      if (d !== 0) return d;
      // 相同时间戳时 user 排在 assistant 前
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

// ========== 会话 CRUD ==========

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
  // 级联删除该会话下的所有消息
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

// ========== 消息 CRUD ==========

export async function addMessage(msg: StoredMessage): Promise<void> {
  const db = await getDB();
  await db.add('messages', msg);
}

export async function updateMessage(msg: StoredMessage): Promise<void> {
  const db = await getDB();
  await db.put('messages', msg);
}

export async function getMessagesByConversation(
  conversationId: string,
): Promise<StoredMessage[]> {
  const db = await getDB();
  const messages = await db.getAllFromIndex(
    'messages',
    'by-conversationId',
    conversationId,
  );
  return messages.sort((a, b) => {
    const timeDiff = a.createdAt - b.createdAt;
    if (timeDiff !== 0) return timeDiff;
    // 相同时间戳时，user 消息排在前面
    return a.role === 'user' ? -1 : b.role === 'user' ? 1 : 0;
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
  const messages = await db.getAllFromIndex(
    'messages',
    'by-conversationId',
    conversationId,
  );
  const tx = db.transaction('messages', 'readwrite');
  for (const msg of messages) {
    await tx.store.delete(msg.id);
  }
  await tx.done;
}
