import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/stores';
import type { BranchInfo } from '@/stores/models';
import { buildBranchInfoMap, pathNodes } from '@/stores/utils/tree';

export function useConversationListState() {
  return useStore(
    useShallow((s) => ({
      conversations: s.conversations,
      currentConversationId: s.currentConversationId,
      initialized: s.initialized,
    })),
  );
}

export function useChatLayoutState() {
  return useStore(
    useShallow((s) => ({
      conversations: s.conversations,
      currentConversationId: s.currentConversationId,
      initialized: s.initialized,
    })),
  );
}

/**
 * 消息列表订阅。不要在 Zustand selector 内调用 `pathNodes`：
 * 每次 getSnapshot 都会得到新数组，React 19 的 useSyncExternalStore
 * 会判定 store 一直在变，触发 Maximum update depth exceeded。
 * 线性路径在 hook 内用 useMemo 派生，依赖 Map / activePath 引用。
 */
export function useMessageListState() {
  const snapshot = useStore(
    useShallow((s) => ({
      messageNodes: s.messageNodes,
      activePath: s.activePath,
      editingMessageId: s.editingMessageId,
      streamingMessageId: s.streamingMessageId,
    })),
  );
  const messages = useMemo(
    () => pathNodes(snapshot.messageNodes, snapshot.activePath),
    [snapshot.messageNodes, snapshot.activePath],
  );
  const prevBranchInfoRef = useRef<Record<string, BranchInfo>>({});
  const branchInfoMap = useMemo(() => {
    const next = buildBranchInfoMap(
      messages,
      snapshot.messageNodes,
      prevBranchInfoRef.current,
    );
    prevBranchInfoRef.current = next;
    return next;
  }, [messages, snapshot.messageNodes]);
  return { ...snapshot, messages, branchInfoMap };
}

/**
 * 流式会话状态。isStreaming 用布尔值而非节点对象：
 * 流式 token 累积不会触发本 selector 的重渲染。
 */
export function useStreamStatus() {
  return useStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
      isStreaming: s.streamingMessageId !== null,
      error: s.error,
    })),
  );
}

export function useEditFormState() {
  return useStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
    })),
  );
}

export function useMessageActionsState() {
  return useStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
    })),
  );
}

export function useHasContent() {
  return useStore((s) => s.activePath.length > 0);
}

export function useInitialized() {
  return useStore((s) => s.initialized);
}
