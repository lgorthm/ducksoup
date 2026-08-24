import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStore } from '@/stores';
import {
  createInitialMessageState,
  initialConversationState,
  initialSettingsState,
  type Conversation,
} from '@/stores/models';
import {
  appendChild,
  createRoot,
  rebuildActivePath,
} from '@/stores/utils/tree';
import {
  navUserMessagesEqual,
  useChatLayoutState,
  useMessageListState,
  useScrollNavUserMessages,
} from './index';

beforeEach(() => {
  useStore.setState({
    ...initialSettingsState,
    ...initialConversationState,
    ...createInitialMessageState(),
  });
});

describe('useMessageListState', () => {
  it('订阅稳定：store 未变时不会因派生数组触发无限更新', () => {
    const map = new Map();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: 'hi',
      createdAt: 1,
    });
    const path = rebuildActivePath(map, 'root');
    useStore.setState({
      messageNodes: map,
      rootId: root.id,
      activePath: path,
      activeLeafId: 'u1',
    });

    const { result, rerender } = renderHook(() => useMessageListState());
    const first = result.current.messages;
    const firstBranch = result.current.branchInfoMap;
    expect(first.map((m) => m.id)).toEqual(['u1']);

    rerender();
    expect(result.current.messages).toBe(first);
    expect(result.current.branchInfoMap).toBe(firstBranch);
  });

  it('流式追加 token 时历史消息的 branchInfo 保持同一引用', () => {
    const map = new Map();
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
      content: '历史回复',
      createdAt: 2,
    });
    appendChild(map, 'a1', {
      id: 'u2',
      conversationId: 'c1',
      role: 'user',
      content: '继续',
      createdAt: 3,
    });
    appendChild(map, 'u2', {
      id: 'a2',
      conversationId: 'c1',
      role: 'assistant',
      content: '流',
      status: 'pending',
      createdAt: 4,
    });
    const path = rebuildActivePath(map, 'root');
    useStore.setState({
      messageNodes: map,
      rootId: root.id,
      activePath: path,
      activeLeafId: 'a2',
      streamingMessageId: 'a2',
    });

    const { result } = renderHook(() => useMessageListState());
    const nodesBefore = result.current.messageNodes;
    const historicalMsg = result.current.messages.find((m) => m.id === 'a1');
    const historicalBranch = result.current.branchInfoMap.a1;
    const streamingBranch = result.current.branchInfoMap.a2;
    expect(historicalMsg).toBeDefined();
    expect(historicalBranch).toBeDefined();

    act(() => {
      useStore.setState((state) => {
        const node = state.messageNodes.get('a2');
        if (node) node.content += '式';
      });
    });

    expect(result.current.messageNodes).not.toBe(nodesBefore);
    expect(result.current.messages.find((m) => m.id === 'a1')).toBe(
      historicalMsg,
    );
    expect(result.current.branchInfoMap.a1).toBe(historicalBranch);
    expect(result.current.branchInfoMap.a2).toBe(streamingBranch);
    expect(result.current.messages.find((m) => m.id === 'a2')?.content).toBe(
      '流式',
    );
  });
});

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    title: '会话一',
    createdAt: 1,
    updatedAt: 1,
    messageCount: 0,
    rootId: 'root-c1',
    activeLeafId: null,
    model: 'deepseek-v4-flash-vision-exp',
    ...overrides,
  };
}

describe('useChatLayoutState', () => {
  it('只暴露当前会话的 title/model，不因其它会话变更而换快照', () => {
    const current = makeConv({ id: 'c1', title: '当前', rootId: 'root-c1' });
    const other = makeConv({ id: 'c2', title: '其它', rootId: 'root-c2' });
    useStore.setState({
      conversations: [current, other],
      currentConversationId: 'c1',
      initialized: true,
    });

    const { result } = renderHook(() => useChatLayoutState());
    const first = result.current;
    expect(first).toEqual({
      initialized: true,
      title: '当前',
      model: 'deepseek-v4-flash-vision-exp',
    });

    act(() => {
      useStore.setState({
        conversations: [current, { ...other, pinnedAt: 99, title: '已置顶' }],
      });
    });

    expect(result.current).toBe(first);
  });

  it('当前会话标题变化时更新 title', () => {
    const current = makeConv({ title: '旧标题' });
    useStore.setState({
      conversations: [current],
      currentConversationId: 'c1',
      initialized: true,
    });

    const { result } = renderHook(() => useChatLayoutState());

    act(() => {
      useStore.setState({
        conversations: [{ ...current, title: '新标题' }],
      });
    });

    expect(result.current.title).toBe('新标题');
    expect(result.current.model).toBe(current.model);
  });
});

describe('navUserMessagesEqual', () => {
  it('比较 index 与 content，忽略对象引用', () => {
    const a = [{ index: 0, content: 'hi' }];
    const b = [{ index: 0, content: 'hi' }];
    expect(navUserMessagesEqual(a, b)).toBe(true);
    expect(navUserMessagesEqual(a, [{ index: 0, content: 'hey' }])).toBe(false);
  });
});

describe('useScrollNavUserMessages', () => {
  function seedQa() {
    const map = new Map();
    const root = createRoot('c1', 'root');
    map.set(root.id, root);
    appendChild(map, 'root', {
      id: 'u1',
      conversationId: 'c1',
      role: 'user',
      content: '问题1',
      createdAt: 1,
    });
    appendChild(map, 'u1', {
      id: 'a1',
      conversationId: 'c1',
      role: 'assistant',
      content: '回答1',
      createdAt: 2,
    });
    useStore.setState({
      messageNodes: map,
      rootId: 'root',
      activePath: rebuildActivePath(map, 'root'),
      activeLeafId: 'a1',
    });
  }

  it('assistant 内容变化时不重渲染', () => {
    seedQa();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScrollNavUserMessages();
    });
    expect(result.current).toEqual([{ index: 0, content: '问题1' }]);
    const afterMount = renders;

    act(() => {
      useStore.setState((state) => {
        const node = state.messageNodes.get('a1');
        if (node) node.content = '回答1 token';
      });
    });

    expect(renders).toBe(afterMount);
    expect(result.current).toEqual([{ index: 0, content: '问题1' }]);
  });

  it('user 内容变化时重渲染', () => {
    seedQa();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useScrollNavUserMessages();
    });
    const afterMount = renders;

    act(() => {
      useStore.setState((state) => {
        const node = state.messageNodes.get('u1');
        if (node) node.content = '改写后的问题';
      });
    });

    expect(renders).toBeGreaterThan(afterMount);
    expect(result.current).toEqual([{ index: 0, content: '改写后的问题' }]);
  });
});
