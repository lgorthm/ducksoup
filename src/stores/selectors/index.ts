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

/**
 * 只订阅当前会话的标题/模型等原始字段。
 * 侧边栏其它会话的增删改不会让 ChatLayout 重渲染。
 */
export function useChatLayoutState() {
  return useStore(
    useShallow((s) => {
      const current =
        s.currentConversationId == null
          ? undefined
          : s.conversations.find((c) => c.id === s.currentConversationId);
      return {
        initialized: s.initialized,
        title: current?.title,
        model: current?.model,
      };
    }),
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

/** 滚动导航栏用的用户消息摘要（虚拟列表索引 + 预览文本） */
export interface ScrollNavUserMessage {
  index: number;
  content: string;
}

export function navUserMessagesEqual(
  a: ScrollNavUserMessage[],
  b: ScrollNavUserMessage[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].index !== b[i].index || a[i].content !== b[i].content) {
      return false;
    }
  }
  return true;
}

/**
 * 滚动导航栏订阅。selector 必须返回原始值：在 selector 内 `pathNodes`
 * 再返回新数组会让 React 19 的 useSyncExternalStore 判定 store 一直在变。
 * 签名只含用户消息的 index/content，assistant 流式 token 不会触发重渲染。
 */
export function useScrollNavUserMessages(): ScrollNavUserMessage[] {
  const signature = useStore((s) => {
    const messages = pathNodes(s.messageNodes, s.activePath);
    let sig = '';
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        sig += `${i}:${msg.content}\0`;
      }
    }
    return sig;
  });
  return useMemo(() => {
    void signature;
    const state = useStore.getState();
    const messages = pathNodes(state.messageNodes, state.activePath);
    const acc: ScrollNavUserMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        acc.push({ index: i, content: msg.content });
      }
    }
    return acc;
  }, [signature]);
}

export function useInitialized() {
  return useStore((s) => s.initialized);
}
