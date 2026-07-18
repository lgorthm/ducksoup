import { useCallback, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from '@/features/chat/components/chat-message';
import type {
  StoredMessage,
  StreamingMessage,
} from '@/features/chat/types/deepseek';
import { useChatAutoScroll } from '@/features/chat/hooks/use-chat-auto-scroll';
import { useStreamingScrollDebounce } from '@/features/chat/hooks/use-streaming-scroll-debounce';
import {
  useChatListController,
  type ChatListController,
} from '@/features/chat/hooks/use-chat-list-controller';

// 向后兼容：保留 ChatListController 类型的 re-export
export type { ChatListController };

interface ChatMessageListProps {
  messages: StoredMessage[];
  streamingMessage?: StreamingMessage | null;
  children?: ReactNode;
  /** 外部传入的 ref，组件挂载后会填充控制器实例 */
  controllerRef?: RefObject<ChatListController | null>;
}

export function ChatMessageList({
  messages,
  streamingMessage,
  children,
  controllerRef,
}: ChatMessageListProps) {
  // TanStack Virtual 的 useVirtualizer 返回不稳定函数引用，
  // 与 React Compiler 自动记忆化不兼容，故显式跳过本组件的记忆化。
  'use no memo';
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 总条目数 = 历史消息 + 可能存在的流式消息
  const totalCount = messages.length + (streamingMessage ? 1 : 0);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual 返回不稳定函数引用，已通过 'use no memo' 显式跳过记忆化
  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: useCallback(() => scrollContainerRef.current, []),
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  // 滚动管理：自动贴底 + 用户手动滚动检测
  const { isAtBottomRef, scrollToBottom } = useChatAutoScroll({
    scrollContainerRef,
    virtualizer,
    totalCount,
  });

  // 流式消息内容变化时防抖滚动
  useStreamingScrollDebounce({
    streamingContent: streamingMessage?.content ?? '',
    reasoningLength: streamingMessage?.reasoningContent.length ?? 0,
    isAtBottomRef,
    scrollToBottom,
  });

  // 填充外部控制器（供滚动导航栏使用）
  useChatListController({
    scrollContainerRef,
    virtualizer,
    controllerRef,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      data-testid="message-list"
      className="chat-scrollbar flex-1 overflow-y-auto"
    >
      <div
        className="relative mx-auto w-full max-w-[776px]"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualItem) => {
          const isStreaming =
            streamingMessage != null && virtualItem.index === messages.length;

          if (isStreaming) {
            return (
              <div
                key={`streaming-${streamingMessage.id}`}
                data-testid="message-item"
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full pr-4 pb-4 pl-4"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ChatMessage
                  message={{
                    id: streamingMessage.id,
                    conversationId: streamingMessage.conversationId,
                    role: 'assistant',
                    content: streamingMessage.content,
                    reasoningContent: streamingMessage.reasoningContent,
                    createdAt: streamingMessage.createdAt,
                  }}
                  isStreaming
                />
              </div>
            );
          }

          const msg = messages[virtualItem.index];
          return (
            <div
              key={msg.id}
              data-testid="message-item"
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pr-4 pb-4 pl-4"
              style={{
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatMessage message={msg} />
            </div>
          );
        })}
      </div>
      {children && (
        <div className="mx-auto w-full max-w-[776px] px-4">{children}</div>
      )}
    </div>
  );
}
