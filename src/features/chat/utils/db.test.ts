import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import type { Conversation, MessageNode } from '@/stores/models';
import {
  addConversation,
  getAllConversations,
  updateConversation,
  deleteConversation,
  addMessage,
  getMessagesByConversation,
  deleteMessage,
  clearConversationMessages,
  updateMessage,
  chainFlatMessagesIntoTree,
  migrateV2MessagesToV3,
  putBlob,
  getBlob,
  deleteBlobs,
  type LegacyStoredMessage,
  type LegacyConversation,
} from './db';

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  const id = overrides.id ?? `conv-${Math.random().toString(36).slice(2, 9)}`;
  return {
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    activeLeafId: null,
    model: 'deepseek-v4-flash-vision-exp',
    ...overrides,
    id,
    rootId: overrides.rootId ?? `root-${id}`,
  };
}

function makeMessage(overrides: Partial<MessageNode> = {}): MessageNode {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: 'conv-test',
    role: 'user',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '测试消息',
    status: 'done',
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  const db = await openDB('ducksoup-chat', 4, {
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
        msgStore.createIndex('by-conversation-parent', [
          'conversationId',
          'parentId',
        ]);
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs');
      }
    },
  });
  await db.clear('conversations');
  await db.clear('messages');
  await db.clear('blobs');
  db.close();
});

describe('addConversation', () => {
  it('写入会话后可被查询到', async () => {
    const conv = makeConversation({ id: 'c1', title: '会话1' });
    await addConversation(conv);
    const all = await getAllConversations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('c1');
    expect(all[0].title).toBe('会话1');
  });

  it('重复 id 写入抛出错误', async () => {
    const conv = makeConversation({ id: 'c1' });
    await addConversation(conv);
    await expect(addConversation(conv)).rejects.toThrow();
  });
});

describe('getAllConversations', () => {
  it('空数据库返回空数组', async () => {
    const all = await getAllConversations();
    expect(all).toEqual([]);
  });

  it('按 updatedAt 升序排列', async () => {
    await addConversation(makeConversation({ id: 'c3', updatedAt: 300 }));
    await addConversation(makeConversation({ id: 'c1', updatedAt: 100 }));
    await addConversation(makeConversation({ id: 'c2', updatedAt: 200 }));

    const all = await getAllConversations();
    expect(all.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });
});

describe('updateConversation', () => {
  it('覆盖写入已存在的会话', async () => {
    const conv = makeConversation({ id: 'c1', title: '旧标题' });
    await addConversation(conv);
    await updateConversation({ ...conv, title: '新标题' });

    const all = await getAllConversations();
    expect(all[0].title).toBe('新标题');
  });

  it('更新 messageCount 和 updatedAt', async () => {
    const conv = makeConversation({ id: 'c1', messageCount: 0 });
    await addConversation(conv);
    const newUpdatedAt = Date.now();
    await updateConversation({
      ...conv,
      messageCount: 10,
      updatedAt: newUpdatedAt,
    });

    const all = await getAllConversations();
    expect(all[0].messageCount).toBe(10);
    expect(all[0].updatedAt).toBe(newUpdatedAt);
  });
});

describe('deleteConversation', () => {
  it('删除会话本身', async () => {
    const conv = makeConversation({ id: 'c1' });
    await addConversation(conv);
    await deleteConversation('c1');
    expect(await getAllConversations()).toHaveLength(0);
  });

  it('级联删除该会话下的所有消息', async () => {
    const conv = makeConversation({ id: 'c1' });
    await addConversation(conv);
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c1' }));

    await deleteConversation('c1');
    expect(await getMessagesByConversation('c1')).toHaveLength(0);
  });

  it('不影响其他会话的消息', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addConversation(makeConversation({ id: 'c2' }));
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c2' }));

    await deleteConversation('c1');
    const c2Msgs = await getMessagesByConversation('c2');
    expect(c2Msgs).toHaveLength(1);
    expect(c2Msgs[0].id).toBe('m2');
  });

  it('删除不存在的 id 不抛错', async () => {
    await expect(deleteConversation('nonexistent')).resolves.toBeUndefined();
  });
});

describe('addMessage', () => {
  it('写入消息后可被查询到', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(
      makeMessage({ id: 'm1', conversationId: 'c1', content: 'hello' }),
    );
    const msgs = await getMessagesByConversation('c1');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello');
  });

  it('重复 id 写入抛出错误', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await expect(
      addMessage(makeMessage({ id: 'm1', conversationId: 'c1' })),
    ).rejects.toThrow();
  });
});

describe('getMessagesByConversation', () => {
  it('按 createdAt 升序', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(
      makeMessage({ id: 'm2', conversationId: 'c1', createdAt: 200 }),
    );
    await addMessage(
      makeMessage({ id: 'm1', conversationId: 'c1', createdAt: 100 }),
    );
    const msgs = await getMessagesByConversation('c1');
    expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('相同时间戳时按 siblingIndex', async () => {
    const ts = Date.now();
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(
      makeMessage({
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        createdAt: ts,
        siblingIndex: 1,
      }),
    );
    await addMessage(
      makeMessage({
        id: 'u1',
        conversationId: 'c1',
        role: 'user',
        createdAt: ts,
        siblingIndex: 0,
      }),
    );

    const msgs = await getMessagesByConversation('c1');
    expect(msgs[0].id).toBe('u1');
    expect(msgs[1].id).toBe('a1');
  });

  it('只返回指定会话的消息', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addConversation(makeConversation({ id: 'c2' }));
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c2' }));

    const c1Msgs = await getMessagesByConversation('c1');
    expect(c1Msgs).toHaveLength(1);
    expect(c1Msgs[0].id).toBe('m1');
  });
});

describe('deleteMessage', () => {
  it('删除单条消息', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c1' }));

    await deleteMessage('m1');
    const msgs = await getMessagesByConversation('c1');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe('m2');
  });

  it('删除不存在的 id 不抛错', async () => {
    await expect(deleteMessage('nonexistent')).resolves.toBeUndefined();
  });
});

describe('clearConversationMessages', () => {
  it('清空指定会话的非根消息，保留虚拟根', async () => {
    const conv = makeConversation({ id: 'c1', rootId: 'root-c1' });
    await addConversation(conv);
    await addMessage(
      makeMessage({
        id: 'root-c1',
        conversationId: 'c1',
        role: 'system',
        content: '',
      }),
    );
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c1' }));

    await clearConversationMessages('c1');
    const left = await getMessagesByConversation('c1');
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe('root-c1');
    expect(left[0].activeChildId).toBeNull();
  });

  it('不影响其他会话', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addConversation(makeConversation({ id: 'c2' }));
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c2' }));

    await clearConversationMessages('c1');
    expect(await getMessagesByConversation('c2')).toHaveLength(1);
  });

  it('清空不存在的会话不抛错', async () => {
    await expect(
      clearConversationMessages('nonexistent'),
    ).resolves.toBeUndefined();
  });
});

describe('updateMessage', () => {
  it('覆盖写入已存在的消息', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(
      makeMessage({ id: 'm1', conversationId: 'c1', content: '旧' }),
    );
    await updateMessage(
      makeMessage({ id: 'm1', conversationId: 'c1', content: '新' }),
    );
    const msgs = await getMessagesByConversation('c1');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('新');
  });
});

describe('v1 → v2 迁移', () => {
  it('chainFlatMessagesIntoTree 链式化扁平消息并设置 activeLeafId', () => {
    const now = Date.now();
    const conv: LegacyConversation = {
      id: 'c1',
      title: '迁移',
      createdAt: now,
      updatedAt: now,
      messageCount: 4,
    };
    const messages: LegacyStoredMessage[] = [
      {
        id: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: '问1',
        createdAt: now,
      },
      {
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        content: '答1',
        createdAt: now,
      },
      {
        id: 'u2',
        conversationId: 'c1',
        role: 'user',
        content: '问2',
        createdAt: now + 1,
      },
      {
        id: 'a2',
        conversationId: 'c1',
        role: 'assistant',
        content: '答2',
        createdAt: now + 1,
      },
    ];

    chainFlatMessagesIntoTree(messages, [conv]);

    const byId = new Map(messages.map((m) => [m.id, m]));
    expect(byId.get('u1')!.parentId).toBeNull();
    expect(byId.get('u1')!.selectedChildId).toBe('a1');
    expect(byId.get('a1')!.parentId).toBe('u1');
    expect(byId.get('a1')!.selectedChildId).toBe('u2');
    expect(byId.get('u2')!.parentId).toBe('a1');
    expect(byId.get('u2')!.selectedChildId).toBe('a2');
    expect(byId.get('a2')!.parentId).toBe('u2');
    expect(byId.get('a2')!.selectedChildId).toBeNull();
    expect(conv.activeLeafId).toBe('a2');
  });

  it('chainFlatMessagesIntoTree 相同时间戳时 user 排在 assistant 前', () => {
    const ts = 1000;
    const messages: LegacyStoredMessage[] = [
      {
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        content: '答',
        createdAt: ts,
      },
      {
        id: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: '问',
        createdAt: ts,
      },
    ];
    const conv: LegacyConversation = {
      id: 'c1',
      title: 'x',
      createdAt: ts,
      updatedAt: ts,
      messageCount: 2,
    };

    chainFlatMessagesIntoTree(messages, [conv]);

    const byId = new Map(messages.map((m) => [m.id, m]));
    expect(byId.get('u1')!.parentId).toBeNull();
    expect(byId.get('u1')!.selectedChildId).toBe('a1');
    expect(byId.get('a1')!.parentId).toBe('u1');
    expect(conv.activeLeafId).toBe('a1');
  });

  it('chainFlatMessagesIntoTree 无消息时 no-op', () => {
    const conv: LegacyConversation = {
      id: 'c1',
      title: 'x',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
    };
    chainFlatMessagesIntoTree([], [conv]);
    expect(conv.activeLeafId).toBeNull();
  });
});

describe('v2 → v3 迁移', () => {
  it('插入虚拟根、reparent、赋 siblingIndex、rename selectedChildId', () => {
    const now = 1000;
    const conv: LegacyConversation = {
      id: 'c1',
      title: 'x',
      createdAt: now,
      updatedAt: now,
      messageCount: 2,
      activeLeafId: 'a1',
    };
    const messages: LegacyStoredMessage[] = [
      {
        id: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: '问',
        createdAt: now,
        parentId: null,
        selectedChildId: 'a1',
      },
      {
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        content: '答',
        createdAt: now + 1,
        parentId: 'u1',
        selectedChildId: null,
      },
    ];

    const ids = ['root-fixed'];
    const migrated = migrateV2MessagesToV3(messages, [conv], () => ids[0]);
    const byId = new Map(migrated.map((m) => [m.id, m]));

    expect(conv.rootId).toBe('root-fixed');
    expect(byId.get('root-fixed')!.role).toBe('system');
    expect(byId.get('root-fixed')!.activeChildId).toBe('u1');
    expect(byId.get('u1')!.parentId).toBe('root-fixed');
    expect(byId.get('u1')!.siblingIndex).toBe(0);
    expect(byId.get('u1')!.activeChildId).toBe('a1');
    expect(byId.get('a1')!.parentId).toBe('u1');
    expect(byId.get('a1')!.siblingIndex).toBe(0);
    expect(byId.get('a1')!.status).toBe('done');
    expect(byId.get('a1')!.deleted).toBe(false);
  });

  it('空会话只插入虚拟根', () => {
    const conv: LegacyConversation = {
      id: 'c1',
      title: 'x',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
      activeLeafId: null as string | null,
    };
    const migrated = migrateV2MessagesToV3([], [conv], () => 'root-empty');
    expect(migrated).toHaveLength(1);
    expect(migrated[0].id).toBe('root-empty');
    expect(conv.rootId).toBe('root-empty');
    expect(migrated[0].activeChildId).toBeNull();
  });
});

describe('blobs store', () => {
  it('putBlob / getBlob 读写二进制', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    await putBlob('k1', blob);
    const got = await getBlob('k1');
    expect(got).toBeInstanceOf(Blob);
    expect(got?.size).toBe(3);
    expect(new Uint8Array(await got!.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it('deleteBlobs 删除指定 key', async () => {
    await putBlob('k1', new Blob([new Uint8Array([1])]));
    await putBlob('k2', new Blob([new Uint8Array([2])]));
    await deleteBlobs(['k1']);
    expect(await getBlob('k1')).toBeUndefined();
    expect(await getBlob('k2')).toBeInstanceOf(Blob);
  });

  it('消息 attachments 随 addMessage 持久化', async () => {
    const conv = makeConversation({ id: 'c-blob' });
    await addConversation(conv);
    await addMessage(
      makeMessage({
        conversationId: conv.id,
        parentId: conv.rootId,
        attachments: [
          {
            id: 'att1',
            mime: 'image/png',
            width: 1,
            height: 1,
            byteLength: 3,
            blobKey: 'k1',
            filename: 'a.png',
          },
        ],
      }),
    );
    const rows = await getMessagesByConversation(conv.id);
    const user = rows.find((m) => m.attachments?.length);
    expect(user?.attachments?.[0]).toMatchObject({
      id: 'att1',
      blobKey: 'k1',
      mime: 'image/png',
    });
  });
});
