import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from './chat-message';
import {
  useChatListController,
  type ChatListController,
} from '@/features/chat/hooks/use-chat-list-controller';
import {
  STICK_TO_BOTTOM_THRESHOLD,
  shouldAdjustScrollOnItemSizeChange,
  useStickToBottom,
  type StickVirtualizer,
} from '@/features/chat/hooks/use-stick-to-bottom';
import { useMessageListState } from '@/stores/selectors';

interface ChatMessageListProps {
  children?: ReactNode;
  /** 外部传入的 ref，组件挂载后会填充控制器实例 */
  controllerRef?: RefObject<ChatListController | null>;
}

export function ChatMessageList({
  children,
  controllerRef,
}: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizerRef = useRef<StickVirtualizer | null>(null);
  const { stuck, stuckRef, reStick } = useStickToBottom(
    scrollContainerRef,
    virtualizerRef,
  );
  const { messages, editingMessageId, streamingMessageId, branchInfoMap } =
    useMessageListState();

  const totalCount = messages.length;
  // 当前激活路径上"最后一条用户消息"与"最后一条 AI 回复"的下标；
  // 这两条消息与有分支的消息操作栏常显；其余消息在 hover/focus 时显示，
  // 移动端（主输入不可 hover）通过点击消息气泡逐条激活显示。
  const lastActionIndices = useMemo(() => {
    let lastUser = -1;
    let lastAssistant = -1;
    for (let i = 0; i < messages.length; i++) {
      const role = messages[i].role;
      if (role === 'user') lastUser = i;
      else if (role === 'assistant') lastAssistant = i;
    }
    return { lastUser, lastAssistant };
  }, [messages]);

  // TanStack Virtual 返回不稳定函数引用，已通过 'use no memo' 显式跳过记忆化
  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: useCallback(() => scrollContainerRef.current, []),
    estimateSize: useCallback(() => 80, []),
    overscan: 0,
    // 端锚定：prepend 历史时保持视口稳定。末尾项增长是否跟随，由
    // scrollEndThreshold + shouldAdjustScrollPositionOnItemSizeChange
    // 与 useStickToBottom 的 stuck 状态共同决定。
    anchorTo: 'end',
    // 视口已贴底时，追加新 item 自动跟随到底部；用户上滚时不打断。
    followOnAppend: 'auto',
    // 取消贴底后阈值归零，避免 wasAtEnd 在 50px 内把用户粘回底部。
    scrollEndThreshold: stuck ? STICK_TO_BOTTOM_THRESHOLD : 0,
    // 位置与容器高度由 virtualizer 在 onChange 中直接写 DOM（同帧生效），
    // 不再等 React 重渲染——消除 resize 时"文字已重排但条目位置慢一帧"
    // 导致的重叠/跳动。开启后条目不得再在 JSX 中设置 transform，
    // 容器不得再设置 height（均由 virtualizer 接管）。
    // 注意：不要开 useAnimationFrameWithResizeObserver——RO 回调本身在
    // 绘制前执行，延迟到 rAF 反而会让修正晚一帧。
    directDomUpdates: true,
  });
  virtualizerRef.current = virtualizer;
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
    item,
    _delta,
    instance,
  ) => shouldAdjustScrollOnItemSizeChange(stuckRef.current, item, instance);

  useLayoutEffect(() => {
    virtualizer.scrollToEnd();
  }, [virtualizer]);

  // 新一轮流式开始时重新贴底。同一条 streaming id 的后续 token 不打断上滑。
  const prevStreamingIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevStreamingIdRef.current;
    prevStreamingIdRef.current = streamingMessageId;
    if (streamingMessageId != null && streamingMessageId !== prev) {
      reStick();
      virtualizer.scrollToEnd();
    }
  }, [reStick, streamingMessageId, virtualizer]);

  useChatListController({
    scrollContainerRef,
    virtualizer,
    controllerRef,
    onScrollToEnd: reStick,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      data-testid="message-list"
      // overflow-anchor:none：禁用浏览器原生 scroll anchoring，
      // 避免与 virtualizer 的 JS 滚动补偿重复修正导致 resize 时跳动
      className="chat-scrollbar flex-1 overflow-y-auto [overflow-anchor:none]"
    >
      <div
        ref={virtualizer.containerRef}
        className="relative mx-auto w-full max-w-[744px]"
      >
        {virtualItems.map((virtualItem) => {
          const msg = messages[virtualItem.index];
          const isStreaming = msg.id === streamingMessageId;

          return (
            <div
              key={msg.id}
              data-testid="message-item"
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="group absolute top-0 left-0 w-full pr-4 pb-4 pl-4"
            >
              <ChatMessage
                message={msg}
                isStreaming={isStreaming}
                branchInfo={branchInfoMap[msg.id]}
                isEditing={editingMessageId === msg.id}
                isLast={
                  virtualItem.index === lastActionIndices.lastUser ||
                  virtualItem.index === lastActionIndices.lastAssistant
                }
              />
            </div>
          );
        })}
      </div>
      {children && (
        <div className="mx-auto w-full max-w-[744px] px-4">{children}</div>
      )}
    </div>
  );
}
