import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import type {
  Conversation,
  StoredMessage,
} from '@/features/chat/types/deepseek';
import {
  addConversation,
  getAllConversations,
  updateConversation,
  deleteConversation,
  addMessage,
  getMessagesByConversation,
  deleteMessage,
  clearConversationMessages,
} from './db';

// ========== 辅助工厂 ==========

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id: `conv-${Math.random().toString(36).slice(2, 9)}`,
    title: '测试会话',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: 'conv-test',
    role: 'user',
    content: '测试消息',
    createdAt: Date.now(),
    ...overrides,
  };
}

// ========== 测试前清空数据库 ==========

beforeEach(async () => {
  const db = await openDB('ducksoup-chat', 1, {
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
  await db.clear('conversations');
  await db.clear('messages');
  db.close();
});

// ========== 会话 CRUD ==========

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

// ========== 消息 CRUD ==========

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
  it('无消息时返回空数组', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    const msgs = await getMessagesByConversation('c1');
    expect(msgs).toEqual([]);
  });

  it('按 createdAt 升序排列', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(
      makeMessage({ id: 'm3', conversationId: 'c1', createdAt: 300 }),
    );
    await addMessage(
      makeMessage({ id: 'm1', conversationId: 'c1', createdAt: 100 }),
    );
    await addMessage(
      makeMessage({ id: 'm2', conversationId: 'c1', createdAt: 200 }),
    );

    const msgs = await getMessagesByConversation('c1');
    expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('相同时间戳时 user 消息排在 assistant 前', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    const ts = 1000;
    await addMessage(
      makeMessage({
        id: 'a1',
        conversationId: 'c1',
        role: 'assistant',
        createdAt: ts,
      }),
    );
    await addMessage(
      makeMessage({
        id: 'u1',
        conversationId: 'c1',
        role: 'user',
        createdAt: ts,
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
  it('清空指定会话的所有消息', async () => {
    await addConversation(makeConversation({ id: 'c1' }));
    await addMessage(makeMessage({ id: 'm1', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm2', conversationId: 'c1' }));
    await addMessage(makeMessage({ id: 'm3', conversationId: 'c1' }));

    await clearConversationMessages('c1');
    expect(await getMessagesByConversation('c1')).toHaveLength(0);
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
