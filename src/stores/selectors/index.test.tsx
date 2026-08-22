import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStore } from '@/stores';
import {
  createInitialMessageState,
  initialConversationState,
  initialSettingsState,
} from '@/stores/models';
import { appendChild, createRoot, rebuildActivePath } from '@/stores/utils/tree';
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
    expect(first.map((m) => m.id)).toEqual(['u1']);

    rerender();
    expect(result.current.messages).toBe(first);
  });
});
