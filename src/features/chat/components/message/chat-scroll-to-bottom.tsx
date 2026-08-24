import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useStreamStatus } from '@/stores/selectors';
import type { ChatListController } from '@/features/chat/hooks/use-chat-list-controller';

interface ChatScrollToBottomProps {
  controllerRef: RefObject<ChatListController | null>;
}

/** 与 virtualizer `scrollEndThreshold` 对齐 */
const BOTTOM_THRESHOLD = 50;

function canScrollDown(el: HTMLElement): boolean {
  return el.scrollHeight - el.clientHeight - el.scrollTop > BOTTOM_THRESHOLD;
}

/**
 * 会话未贴底时，在输入框右上角显示回到底部按钮。
 */
export function ChatScrollToBottom({ controllerRef }: ChatScrollToBottomProps) {
  const { t } = useTranslation();
  const { isStreaming } = useStreamStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = controllerRef.current?.scrollContainer;
    if (!container) return;

    let rafId = 0;
    const update = () => {
      setVisible(canScrollDown(container));
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(container);
    if (container.firstElementChild) {
      ro.observe(container.firstElementChild);
    }
    update();

    return () => {
      container.removeEventListener('scroll', scheduleUpdate);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [controllerRef]);

  const handleClick = () => {
    setVisible(false);
    controllerRef.current?.scrollToEnd();
  };

  if (!visible) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-testid="scroll-to-bottom"
      aria-label={t('chat.scrollToBottom')}
      onClick={handleClick}
      className={cn(
        'absolute right-3 bottom-full z-20 mb-3 size-9 rounded-full',
        'border-transparent bg-secondary/90 text-foreground shadow-md backdrop-blur-md',
        'ring-1 ring-foreground/12',
        'dark:border-transparent dark:bg-secondary',
        'animate-in fade-in-0 zoom-in-95 duration-200',
        'hover:border-transparent hover:bg-secondary hover:text-foreground hover:ring-primary/40',
        'active:scale-[0.96]',
      )}
    >
      <ArrowDown />
      {isStreaming ? (
        <span
          data-testid="scroll-to-bottom-unread"
          aria-hidden
          className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background"
        />
      ) : null}
    </Button>
  );
}
