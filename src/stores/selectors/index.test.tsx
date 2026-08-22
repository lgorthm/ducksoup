import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStore } from '@/stores';
import {
  createInitialMessageState,
  initialConversationState,
  initialSettingsState,
} from '@/stores/models';
import {
  appendChild,
  createRoot,
  rebuildActivePath,
} from '@/stores/utils/tree';
import { useMessageListState } from './index';

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
