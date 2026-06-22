import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from '@/features/chat/components/chat-message';
import type {
  StoredMessage,
  StreamingMessage,
} from '@/features/chat/types/deepseek';

interface ChatMessageListProps {
  messages: StoredMessage[];
  streamingMessage?: StreamingMessage | null;
  children?: ReactNode;
}

export function ChatMessageList({
  messages,
  streamingMessage,
  children,
}: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 总条目数 = 历史消息 + 可能存在的流式消息
  const totalCount = messages.length + (streamingMessage ? 1 : 0);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: useCallback(() => scrollContainerRef.current, []),
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  // 记录上一次是否在底部
  const isAtBottomRef = useRef(true);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(totalCount - 1, { align: 'end' });
    });
  }, [totalCount, virtualizer]);

  // 新消息到来时自动滚动到底部
  const prevLength = useRef(totalCount);
  useEffect(() => {
    if (totalCount > 0 && prevLength.current !== totalCount) {
      if (prevLength.current === 0 || isAtBottomRef.current) {
        scrollToBottom();
      }
    }
    prevLength.current = totalCount;
  }, [totalCount, scrollToBottom]);

  // 流式消息内容变化时也自动滚动（防抖）
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  const streamingContent = streamingMessage?.content ?? '';
  const thinkingCount = streamingMessage?.thinkingSteps.length ?? 0;
  useEffect(() => {
    if (isAtBottomRef.current) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [streamingContent, thinkingCount, scrollToBottom]);

  // 监听用户手动滚动，记录是否在底部
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isAtBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
                    reasoningContent: streamingMessage.thinkingSteps
                      .map((s) => s.content)
                      .join(''),
                    thinkingSteps: streamingMessage.thinkingSteps,
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
