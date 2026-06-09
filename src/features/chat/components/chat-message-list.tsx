import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChatMessage } from '@/features/chat/components/chat-message';
import type { StoredMessage } from '@/shared/types/deepseek';

interface ChatMessageListProps {
  messages: StoredMessage[];
  children?: ReactNode;
}

export function ChatMessageList({ messages, children }: ChatMessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: useCallback(() => scrollContainerRef.current, []),
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  // 新消息到来时自动滚动到底部
  const prevLength = useRef(messages.length);
  useEffect(() => {
    const container = scrollContainerRef.current;
    const wasAtBottom =
      container &&
      container.scrollHeight - container.scrollTop - container.clientHeight <
        100;

    if (messages.length > 0 && prevLength.current < messages.length) {
      if (prevLength.current === 0 || wasAtBottom) {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      }
    }
    prevLength.current = messages.length;
  }, [messages.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      className="chat-scrollbar flex-1 overflow-y-auto"
    >
      <div
        className="relative mx-auto w-full max-w-[776px]"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualItem) => {
          const msg = messages[virtualItem.index];
          return (
            <div
              key={msg.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pr-4 pb-4 pl-4"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <div>
                <ChatMessage message={msg} />
              </div>
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
