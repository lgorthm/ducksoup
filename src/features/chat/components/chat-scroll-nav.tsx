import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/lib/utils';
import type { ChatListController } from '@/features/chat/hooks/use-chat-list-controller';

/** 导航栏中每条用户消息的元数据 */
export interface NavUserMessage {
  /** 在 messages 数组中的索引（虚拟列表索引） */
  index: number;
  /** 消息内容（用于预览摘要） */
  content: string;
}

interface ChatScrollNavProps {
  /** 所有用户消息（已按索引升序排列） */
  userMessages: NavUserMessage[];
  /** 虚拟列表控制器 ref */
  controllerRef: RefObject<ChatListController | null>;
}

/** 预览摘要最大字符数 */
const PREVIEW_MAX_CHARS = 80;

/** 视口宽度阈值：超过此值才渲染导航栏 */
const MIN_VIEWPORT_WIDTH = 1201;

/** 横杠导航栏宽度（px），用于限制导航栏自身高度并决定是否启用滚动 */
const NAV_MAX_HEIGHT = 320;

export function ChatScrollNav({
  userMessages,
  controllerRef,
}: ChatScrollNavProps) {
  const isWideScreen = useMediaQuery(`(min-width: ${MIN_VIEWPORT_WIDTH}px)`);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    top: number;
    left: number;
    height: number;
  } | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  /**
   * 根据当前可见虚拟项范围，计算最接近视口中心的用户消息索引
   */
  const computeActiveIndex = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    const range = controller.getVisibleRange();
    if (!range) return;

    const [startIdx, endIdx] = range;
    const center = (startIdx + endIdx) / 2;

    // 优先在可见范围内查找用户消息
    const inRange = userMessages.filter(
      (m) => m.index >= startIdx && m.index <= endIdx,
    );

    if (inRange.length > 0) {
      const nearest = inRange.reduce((prev, curr) =>
        Math.abs(curr.index - center) < Math.abs(prev.index - center)
          ? curr
          : prev,
      );
      setActiveIndex(nearest.index);
      return;
    }

    // 可见范围内无用户消息时，找最接近的
    const nearest = userMessages.reduce((prev, curr) =>
      Math.abs(curr.index - startIdx) < Math.abs(prev.index - startIdx)
        ? curr
        : prev,
    );
    setActiveIndex(nearest.index);
  }, [controllerRef, userMessages]);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(computeActiveIndex);
  }, [computeActiveIndex]);

  // 挂载 scroll 监听
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller?.scrollContainer) return;

    const container = controller.scrollContainer;
    container.addEventListener('scroll', handleScroll, { passive: true });
    // 初始计算一次
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [controllerRef, handleScroll]);

  // 卸载时清理 rAF
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // userMessages 变化时重新计算
  useEffect(() => {
    handleScroll();
  }, [userMessages, handleScroll]);

  if (!isWideScreen || userMessages.length === 0) return null;

  const handleBarClick = (index: number) => {
    controllerRef.current?.scrollToIndex(index, 'center');
  };

  const handleMouseEnter = (
    index: number,
    e: MouseEvent<HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredBar({
      index,
      top: rect.top,
      left: rect.left,
      height: rect.height,
    });
  };

  const hoveredMsg = hoveredBar
    ? userMessages.find((m) => m.index === hoveredBar.index)
    : null;

  return (
    <>
      {/* hover 预览框：使用 fixed 定位，脱离 overflow 容器，避免被裁剪 */}
      {hoveredBar && hoveredMsg && (
        <div
          data-testid="scroll-nav-preview"
          className="pointer-events-none fixed z-40 max-w-[240px] -translate-y-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{
            top: `${hoveredBar.top + hoveredBar.height / 2}px`,
            right: `${window.innerWidth - hoveredBar.left + 8}px`,
          }}
        >
          <p className="line-clamp-3 break-words whitespace-pre-wrap">
            {hoveredMsg.content.slice(0, PREVIEW_MAX_CHARS)}
            {hoveredMsg.content.length > PREVIEW_MAX_CHARS ? '…' : ''}
          </p>
        </div>
      )}
      <div
        data-testid="chat-scroll-nav"
        className="fixed top-1/2 right-3 z-30 -translate-y-1/2"
      >
        <div
          className="flex flex-col items-end gap-1.5 overflow-y-auto"
          style={{ maxHeight: `${NAV_MAX_HEIGHT}px` }}
        >
          {userMessages.map((msg) => (
            <div key={msg.index} className="p-1">
              {/* 横杠 */}
              <button
                type="button"
                onClick={() => handleBarClick(msg.index)}
                onMouseEnter={(e) => handleMouseEnter(msg.index, e)}
                onMouseLeave={() => setHoveredBar(null)}
                aria-label={`跳转到用户消息 ${msg.index + 1}`}
                className={cn(
                  'block h-1.5 w-5 cursor-pointer rounded-full transition-colors',
                  activeIndex === msg.index
                    ? 'bg-yellow-400'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50',
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
