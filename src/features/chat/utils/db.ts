import { openDB, type DBSchema } from 'idb';
import type { Conversation, MessageNode } from '@/stores/models';
import { DEFAULT_MODEL } from '@/stores/models';
import { generateId } from '@/stores/utils/ids';
import { createRoot } from '@/stores/utils/tree';

export const DB_NAME = 'ducksoup-chat';
export const DB_VERSION = 4;

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
  blobs: {
    key: string;
    value: StoredBlob | Blob;
  };
}

/** IndexedDB 中的图片二进制；用 ArrayBuffer 包装以便 fake-indexeddb 也能完整往返 */
export interface StoredBlob {
  type: string;
  data: ArrayBuffer;
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

      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs');
        }
        const convStore = transaction.objectStore('conversations');
        const allConvs = (await convStore.getAll()) as LegacyConversation[];
        for (const c of allConvs) {
          await convStore.put({
            ...(c as Conversation),
            model: (c as Conversation).model ?? DEFAULT_MODEL,
          });
        }
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
    attachments: node.attachments,
    reasoningContent: node.reasoningContent,
    webSearchCalls: node.webSearchCalls,
    citations: node.citations,
    activity: node.activity,
    status: node.status,
    createdAt: node.createdAt,
    deleted: node.deleted ?? false,
  };
}

function toStoredBlob(blob: Blob, data: ArrayBuffer): StoredBlob {
  return { type: blob.type, data };
}

function fromStoredBlob(value: StoredBlob | Blob): Blob {
  if (value instanceof Blob) return value;
  return new Blob([value.data], { type: value.type });
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await getDB();
  const data = await blob.arrayBuffer();
  await db.put('blobs', toStoredBlob(blob, data), key);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await getDB();
  const value = await db.get('blobs', key);
  if (!value) return undefined;
  return fromStoredBlob(value);
}

export async function deleteBlobs(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('blobs', 'readwrite');
  for (const key of unique) {
    await tx.store.delete(key);
  }
  await tx.done;
}

export function blobKeysOf(messages: MessageNode[]): string[] {
  return messages.flatMap((m) => m.attachments?.map((a) => a.blobKey) ?? []);
}

export function fileIdsOf(messages: MessageNode[]): string[] {
  return messages.flatMap(
    (m) =>
      m.attachments?.map((a) => a.fileId).filter((id): id is string => !!id) ??
      [],
  );
}

export async function stripAllAttachmentFileIds(): Promise<void> {
  const db = await getDB();
  const messages = await db.getAll('messages');
  const tx = db.transaction('messages', 'readwrite');
  for (const msg of messages) {
    if (!msg.attachments?.some((a) => a.fileId)) continue;
    await tx.store.put(
      toDbMessage({
        ...msg,
        attachments: msg.attachments.map((a) => ({
          id: a.id,
          mime: a.mime,
          width: a.width,
          height: a.height,
          byteLength: a.byteLength,
          blobKey: a.blobKey,
          filename: a.filename,
        })),
      }),
    );
  }
  await tx.done;
}

export async function addConversation(conv: Conversation): Promise<void> {
  const db = await getDB();
  await db.add('conversations', conv);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDB();
  const rows = await db.getAllFromIndex('conversations', 'by-updatedAt');
  // v3 及更早的记录没有 model 字段，读取时归一化为默认模型，
  // 待下次 updateConversation 落盘补写
  return rows.map((c) => ({ ...c, model: c.model ?? DEFAULT_MODEL }));
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
  const blobKeys = blobKeysOf(messages);
  const storeNames = (['messages', 'conversations', 'blobs'] as const).filter(
    (name) => db.objectStoreNames.contains(name),
  );
  const tx = db.transaction(storeNames, 'readwrite');
  for (const msg of messages) {
    await tx.objectStore('messages').delete(msg.id);
  }
  await tx.objectStore('conversations').delete(id);
  if (storeNames.includes('blobs')) {
    const blobs = tx.objectStore('blobs');
    for (const key of blobKeys) {
      await blobs.delete(key);
    }
  }
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
  const blobKeys = blobKeysOf(
    messages.filter((msg) => !(rootId && msg.id === rootId)),
  );
  const storeNames = (['messages', 'blobs'] as const).filter((name) =>
    db.objectStoreNames.contains(name),
  );
  const tx = db.transaction(storeNames, 'readwrite');
  const msgStore = tx.objectStore('messages');
  for (const msg of messages) {
    if (rootId && msg.id === rootId) {
      await msgStore.put(
        toDbMessage({
          ...msg,
          childrenIds: [],
          activeChildId: null,
          attachments: undefined,
        }),
      );
      continue;
    }
    await msgStore.delete(msg.id);
  }
  if (storeNames.includes('blobs')) {
    const blobs = tx.objectStore('blobs');
    for (const key of blobKeys) {
      await blobs.delete(key);
    }
  }
  await tx.done;
}
