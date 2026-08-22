import { describe, expect, it } from 'vitest';
import type { MessageNode } from '@/stores/models';
import {
  appendChild,
  countVisibleMessages,
  createRoot,
  deriveBranchInfo,
  hydrateTree,
  liveSiblings,
  pathNodes,
  rebuildActivePath,
  settlePendingNodes,
  softDelete,
  switchActiveChild,
} from './tree';

function node(
  overrides: Partial<MessageNode> & Pick<MessageNode, 'id'>,
): MessageNode {
  return {
    conversationId: 'c1',
    role: 'user',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '',
    status: 'done',
    createdAt: 1,
    ...overrides,
  };
}

describe('createRoot', () => {
  it('创建虚拟根：system、无父、空 children', () => {
    const root = createRoot('c1', 'root-1');
    expect(root).toMatchObject({
      id: 'root-1',
      conversationId: 'c1',
      role: 'system',
      parentId: null,
      childrenIds: [],
      siblingIndex: 0,
      activeChildId: null,
      content: '',
    });
  });
});

describe('hydrateTree', () => {
  it('按 siblingIndex 填 childrenIds，含已软删槽位', () => {
    const rows: MessageNode[] = [
      node({
        id: 'root',
        role: 'system',
        siblingIndex: 0,
      }),
      node({
        id: 'u1',
        parentId: 'root',
        siblingIndex: 0,
        content: 'a',
      }),
      node({
        id: 'u2',
        parentId: 'root',
        siblingIndex: 1,
        deleted: true,
        content: 'b',
      }),
      node({
        id: 'u3',
        parentId: 'root',
        siblingIndex: 2,
        content: 'c',
      }),
    ];
    const map = hydrateTree(rows);
    expect(map.get('root')!.childrenIds).toEqual(['u1', 'u2', 'u3']);
    expect(map.get('u2')!.deleted).toBe(true);
  });

  it('忽略行上已有的 childrenIds，以 siblingIndex 为准', () => {
    const rows: MessageNode[] = [
      node({
        id: 'root',
        role: 'system',
        childrenIds: ['stale'],
      }),
      node({
        id: 'u1',
        parentId: 'root',
        siblingIndex: 0,
        childrenIds: ['nope'],
      }),
    ];
    const map = hydrateTree(rows);
    expect(map.get('root')!.childrenIds).toEqual(['u1']);
    expect(map.get('u1')!.childrenIds).toEqual([]);
  });
});

describe('appendChild', () => {
  it('siblingIndex 等于插入时 childrenIds.length，且只增不改序', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);

    const a = appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '一',
      createdAt: 1,
    });
    const b = appendChild(map, 'root', {
      id: 'u2',
      conversationId: 'c1',
      role: 'user',
      content: '二',
      createdAt: 2,
    });

    expect(a.siblingIndex).toBe(0);
    expect(b.siblingIndex).toBe(1);
    expect(map.get('root')!.childrenIds).toEqual(['u1', 'u2']);
    expect(map.get('root')!.activeChildId).toBe('u2');
    expect(a.parentId).toBe('root');
  });

  it('编辑首条用户消息 = 在 root 下追加兄弟', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '原问',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '原答',
      createdAt: 2,
    });

    const u2 = appendChild(map, 'root', {
      id: 'u2',
      conversationId: 'c1',
      role: 'user',
      content: '改问',
      createdAt: 3,
    });

    expect(u2.parentId).toBe('root');
    expect(u2.siblingIndex).toBe(1);
    expect(map.get('root')!.childrenIds).toEqual(['u1', 'u2']);
    expect(map.get('root')!.activeChildId).toBe('u2');
    expect(map.get('u1')!.siblingIndex).toBe(0);
  });
});

describe('rebuildActivePath', () => {
  it('沿 activeChildId 走，不含 root', () => {
    const map = new Map<string, MessageNode>();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '答',
      createdAt: 2,
    });

    expect(rebuildActivePath(map, 'root')).toEqual(['u1', 'a1']);
  });

  it('activeChildId 指向已删节点时改走最近未删兄弟', () => {
    const map = hydrateTree([
      node({ id: 'root', role: 'system', activeChildId: 'u2' }),
      node({ id: 'u1', parentId: 'root', siblingIndex: 0, content: 'a' }),
      node({
        id: 'u2',
        parentId: 'root',
        siblingIndex: 1,
        deleted: true,
        content: 'b',
      }),
      node({ id: 'u3', parentId: 'root', siblingIndex: 2, content: 'c' }),
    ]);

    expect(rebuildActivePath(map, 'root')).toEqual(['u1']);
  });
});

describe('switchActiveChild', () => {
  it('改父 activeChildId 并沿子链落到叶子', () => {
    const map = new Map<string, MessageNode>();
    map.set('root', createRoot('c1', 'root'));
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '答1',
      createdAt: 2,
    });
    appendChild(map, 'u1', {
      id: 'a2',
      conversationId: 'c1',
      role: 'assistant',
      content: '答2',
      createdAt: 3,
    });

    const leaf = switchActiveChild(map, 'u1', 'a1');
    expect(map.get('u1')!.activeChildId).toBe('a1');
    expect(leaf).toBe('a1');
    expect(rebuildActivePath(map, 'root')).toEqual(['u1', 'a1']);
  });
});

describe('softDelete', () => {
  it('不 splice childrenIds，siblingIndex 不变', () => {
    const map = new Map<string, MessageNode>();
    map.set('root', createRoot('c1', 'root'));
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '一',
      createdAt: 1,
    });
    appendChild(map, 'root', {
      id: 'u2',
      conversationId: 'c1',
      role: 'user',
      content: '二',
      createdAt: 2,
    });

    softDelete(map, 'u1');

    expect(map.get('u1')!.deleted).toBe(true);
    expect(map.get('u1')!.siblingIndex).toBe(0);
    expect(map.get('root')!.childrenIds).toEqual(['u1', 'u2']);
    expect(map.get('u2')!.siblingIndex).toBe(1);
  });

  it('若删除的是 activeChild，改指最近未删兄弟', () => {
    const map = new Map<string, MessageNode>();
    map.set('root', createRoot('c1', 'root'));
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '一',
      createdAt: 1,
    });
    appendChild(map, 'root', {
      id: 'u2',
      conversationId: 'c1',
      role: 'user',
      content: '二',
      createdAt: 2,
    });

    softDelete(map, 'u2');
    expect(map.get('root')!.activeChildId).toBe('u1');
  });
});

describe('liveSiblings / deriveBranchInfo', () => {
  it('只计未删兄弟，current 为 1-based 存活下标', () => {
    const map = hydrateTree([
      node({ id: 'root', role: 'system', activeChildId: 'a3' }),
      node({
        id: 'u1',
        parentId: 'root',
        siblingIndex: 0,
        activeChildId: 'a3',
        content: '问',
      }),
      node({
        id: 'a1',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 0,
        content: '1',
      }),
      node({
        id: 'a2',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 1,
        deleted: true,
        content: '2',
      }),
      node({
        id: 'a3',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 2,
        content: '3',
      }),
    ]);

    expect(liveSiblings(map, 'u1').map((n) => n.id)).toEqual(['a1', 'a3']);
    expect(deriveBranchInfo(map, 'a3')).toEqual({
      current: 2,
      total: 2,
      prevSiblingId: 'a1',
      nextSiblingId: null,
    });
  });
});

describe('pathNodes / countVisibleMessages', () => {
  it('pathNodes 按 activePath 取节点', () => {
    const map = new Map<string, MessageNode>();
    map.set('root', createRoot('c1', 'root'));
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问',
      createdAt: 1,
    });
    const nodes = pathNodes(map, ['u1']);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].content).toBe('问');
  });

  it('countVisibleMessages 不含 root 与已删', () => {
    const map = hydrateTree([
      node({ id: 'root', role: 'system' }),
      node({ id: 'u1', parentId: 'root', siblingIndex: 0 }),
      node({
        id: 'a1',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 0,
        deleted: true,
      }),
      node({
        id: 'a2',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 1,
      }),
    ]);
    expect(countVisibleMessages(map, 'root')).toBe(2);
  });
});

describe('settlePendingNodes', () => {
  it('将残留 pending 收口为 done 或 error，并返回被改写的节点', () => {
    const map = hydrateTree([
      node({ id: 'root', role: 'system' }),
      node({
        id: 'u1',
        parentId: 'root',
        siblingIndex: 0,
        status: 'done',
      }),
      node({
        id: 'a1',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 0,
        content: '半句',
        status: 'pending',
      }),
      node({
        id: 'a2',
        role: 'assistant',
        parentId: 'u1',
        siblingIndex: 1,
        content: '',
        status: 'pending',
      }),
    ]);

    const settled = settlePendingNodes(map);

    expect(settled.map((n) => n.id).sort()).toEqual(['a1', 'a2']);
    expect(map.get('a1')?.status).not.toBe('pending');
    expect(['done', 'error']).toContain(map.get('a1')?.status);
    expect(map.get('a2')?.status).not.toBe('pending');
    expect(['done', 'error']).toContain(map.get('a2')?.status);
    expect(map.get('u1')?.status).toBe('done');
  });

  it('没有 pending 时不改写', () => {
    const map = hydrateTree([
      node({ id: 'root', role: 'system' }),
      node({ id: 'u1', parentId: 'root', siblingIndex: 0, status: 'done' }),
    ]);
    expect(settlePendingNodes(map)).toEqual([]);
    expect(map.get('u1')?.status).toBe('done');
  });
});
