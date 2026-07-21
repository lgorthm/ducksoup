import { useCallback, useEffect, useState } from 'react';
import type { FocusEvent, MouseEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
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

/** 导航栏最大高度（px），超出后导航栏自身可滚动 */
const NAV_MAX_HEIGHT = 320;

/** 预览框与横杠之间的水平间距（px） */
const PREVIEW_GAP = 8;

/**
 * hover/focus 预览框状态。
 * 定位坐标在事件回调中一次性算好（fixed 定位），
 * 避免渲染期读取 window/getBoundingClientRect 造成的不纯渲染。
 */
interface PreviewState {
  /** 对应的虚拟列表索引 */
  index: number;
  /** fixed 定位 top：横杠垂直中心 */
  top: number;
  /** fixed 定位 right：横杠左缘再向左留出间距 */
  right: number;
}

/**
 * 消息滚动导航栏：
 * 在宽屏下于视口右侧渲染一组横杠，每条横杠对应一条用户消息。
 * - 高亮当前正在阅读的用户消息（TOC 锚线语义，rAF 节流）；
 * - 点击横杠滚动到对应消息；
 * - hover 或键盘聚焦横杠时，在左侧浮出消息内容预览。
 */
export function ChatScrollNav({
  userMessages,
  controllerRef,
}: ChatScrollNavProps) {
  const { t } = useTranslation();
  const isWideScreen = useMediaQuery(`(min-width: ${MIN_VIEWPORT_WIDTH}px)`);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  /**
   * 计算当前应激活的用户消息索引。
   *
   * 采用"当前章节"语义（TOC 锚线）：以视口中心为锚线，激活偏移
   * 不超过锚线的最后一条用户消息——只有滚动到某条消息时它的横杠
   * 才激活，浏览其回复期间保持激活。像素空间判定，不受消息高度
   * 差异影响，也不会超前激活尚未滚到的消息。
   *
   * 端点钳制保证每条横杠都可激活：滚到最顶激活首条、滚到最底激活
   * 末条（锚线可达范围之外的端点消息不会被跳过）。
   *
   * 偏移不可用（列表未就绪等瞬态）时返回 null，调用方保持原高亮。
   */
  const computeActiveIndex = useCallback((): number | null => {
    const controller = controllerRef.current;
    const container = controller?.scrollContainer;
    if (!controller || !container || userMessages.length === 0) return null;

    const first = userMessages[0];
    const last = userMessages[userMessages.length - 1];

    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return last.index;
    if (container.scrollTop <= 0) return first.index;
    if (container.scrollTop >= maxScroll - 1) return last.index;

    const anchor = container.scrollTop + container.clientHeight / 2;

    // userMessages 按索引升序，其偏移同为升序：
    // 取最后一个偏移不超过锚线的消息（正在阅读的那组问答）
    let active = first;
    for (const msg of userMessages) {
      const offset = controller.getItemOffset(msg.index);
      if (offset === null) return null;
      if (offset > anchor) break;
      active = msg;
    }
    return active.index;
  }, [controllerRef, userMessages]);

  // 监听滚动并同步高亮；userMessages 变化时（computeActiveIndex 引用变化）重算一次。
  // 统一的 cleanup 同时移除监听并取消未执行的 rAF。
  useEffect(() => {
    const container = controllerRef.current?.scrollContainer;
    if (!container) return;

    let rafId = 0;
    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const next = computeActiveIndex();
        if (next !== null) {
          setActiveIndex((prev) => (prev === next ? prev : next));
        }
      });
    };

    container.addEventListener('scroll', scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      container.removeEventListener('scroll', scheduleUpdate);
      cancelAnimationFrame(rafId);
    };
  }, [controllerRef, computeActiveIndex]);

  if (!isWideScreen || userMessages.length === 0) return null;

  const scrollToMessage = (index: number) => {
    controllerRef.current?.scrollToIndex(index, 'center');
  };

  const showPreview = (
    index: number,
    e: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPreview({
      index,
      top: rect.top + rect.height / 2,
      right: window.innerWidth - rect.left + PREVIEW_GAP,
    });
  };

  const hidePreview = () => setPreview(null);

  const previewMessage = preview
    ? userMessages.find((m) => m.index === preview.index)
    : null;

  return (
    <>
      {/* 预览框：fixed 定位，脱离 overflow 容器，避免被裁剪 */}
      {preview && previewMessage && (
        <div
          data-testid="scroll-nav-preview"
          role="tooltip"
          className="pointer-events-none fixed z-40 max-w-[240px] -translate-y-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{ top: preview.top, right: preview.right }}
        >
          <p className="line-clamp-3 break-words whitespace-pre-wrap">
            {previewMessage.content.slice(0, PREVIEW_MAX_CHARS)}
            {previewMessage.content.length > PREVIEW_MAX_CHARS ? '…' : ''}
          </p>
        </div>
      )}
      <nav
        aria-label={t('chat.scrollNav.label')}
        data-testid="chat-scroll-nav"
        className="fixed top-1/2 right-3 z-30 -translate-y-1/2"
      >
        <div
          className="flex flex-col items-end gap-1.5 overflow-y-auto"
          style={{ maxHeight: NAV_MAX_HEIGHT }}
        >
          {userMessages.map((msg, position) => (
            <div key={msg.index} className="p-1">
              {/* 横杠 */}
              <button
                type="button"
                onClick={() => scrollToMessage(msg.index)}
                onMouseEnter={(e) => showPreview(msg.index, e)}
                onMouseLeave={hidePreview}
                onFocus={(e) => showPreview(msg.index, e)}
                onBlur={hidePreview}
                aria-label={t('chat.scrollNav.jumpTo', {
                  position: position + 1,
                })}
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
      </nav>
    </>
  );
}
