import type { Page } from '@playwright/test';
import type {
  Conversation,
  StoredMessage,
} from '@/features/chat/types/deepseek';

const DB_NAME = 'ducksoup-chat';
const DB_VERSION = 1;

export async function seedIndexedDB(
  page: Page,
  conversations: Conversation[],
  messages: StoredMessage[],
): Promise<void> {
  await page.evaluate(
    async ({ conversations, messages, dbName, dbVersion }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('conversations')) {
            const convStore = db.createObjectStore('conversations', {
              keyPath: 'id',
            });
            convStore.createIndex('by-updatedAt', 'updatedAt');
          }
          if (!db.objectStoreNames.contains('messages')) {
            const msgStore = db.createObjectStore('messages', {
              keyPath: 'id',
            });
            msgStore.createIndex('by-conversationId', 'conversationId');
            msgStore.createIndex('by-createdAt', 'createdAt');
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['conversations', 'messages'], 'readwrite');
          const convStore = tx.objectStore('conversations');
          const msgStore = tx.objectStore('messages');

          for (const conv of conversations) {
            convStore.put(conv);
          }
          for (const msg of messages) {
            msgStore.put(msg);
          }

          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };

        request.onerror = () => reject(request.error);
      });
    },
    {
      conversations,
      messages,
      dbName: DB_NAME,
      dbVersion: DB_VERSION,
    },
  );
}

export async function clearIndexedDB(page: Page): Promise<void> {
  await page.evaluate(
    (dbName) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
    DB_NAME,
  );
}

export async function getIndexedDBData(
  page: Page,
): Promise<{ conversations: Conversation[]; messages: StoredMessage[] }> {
  return page.evaluate(
    (dbName) =>
      new Promise<{ conversations: Conversation[]; messages: StoredMessage[] }>(
        (resolve, reject) => {
          const request = indexedDB.open(dbName, 1);
          request.onsuccess = () => {
            const db = request.result;
            const result = {
              conversations: [] as Conversation[],
              messages: [] as StoredMessage[],
            };

            if (!db.objectStoreNames.contains('conversations')) {
              db.close();
              resolve(result);
              return;
            }

            const tx = db.transaction(
              ['conversations', 'messages'],
              'readonly',
            );
            const convReq = tx.objectStore('conversations').getAll();
            const msgReq = tx.objectStore('messages').getAll();

            tx.oncomplete = () => {
              result.conversations = convReq.result as Conversation[];
              result.messages = msgReq.result as StoredMessage[];
              db.close();
              resolve(result);
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
          };
          request.onerror = () => reject(request.error);
        },
      ),
    DB_NAME,
  );
}
