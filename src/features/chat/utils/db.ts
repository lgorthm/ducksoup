import { openDB } from 'idb';
import type {
  Conversation,
  DuckSoupDBSchema,
  StoredMessage,
} from '@/features/chat/types/deepseek';

const DB_NAME = 'ducksoup-chat';
const DB_VERSION = 1;

function getDB() {
  return openDB<DuckSoupDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
    },
  });
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
