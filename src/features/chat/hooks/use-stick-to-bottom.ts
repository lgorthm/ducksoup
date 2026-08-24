import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * 贴底时 virtualizer `wasAtEnd` 阈值。略宽以补偿 scrollOffset 异步滞后
 * （窗口缩放、流式增高时内部偏移尚未跟上 DOM）。
 */
export const STICK_TO_BOTTOM_THRESHOLD = 50;

/**
 * 重新贴底的真实 DOM 距底阈值。必须远小于 STICK_TO_BOTTOM_THRESHOLD：
 * 小幅上滑后若仍用 50px 判断，紧随其后的 scroll 事件会立刻重新贴底。
 */
const RESTICK_THRESHOLD = 1;

export interface StickVirtualizer {
  options: { scrollEndThreshold: number; count: number };
  range: { startIndex: number; endIndex: number } | null;
}

interface StickToBottom {
  /** 是否跟随列表底部（流式增高 / 视口缩放时钉底） */
  stuck: boolean;
  /** 与 stuck 同步的 ref，供 virtualizer 尺寸回调在非 React 帧读取 */
  stuckRef: RefObject<boolean>;
  /** 强制贴底（发送新消息、点击回到底部） */
  reStick: () => void;
}

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.clientHeight - el.scrollTop;
}

/**
 * 虚拟列表未测条目按 estimateSize 占位，DOM 底部可能远早于最后一条消息。
 * 只有最后一项已经进入可见范围，才把「距底 ≤ 1px」当成真正贴底。
 */
function canRestickToEnd(virtualizer: StickVirtualizer | null): boolean {
  if (!virtualizer) return true;
  const count = virtualizer.options.count;
  if (!count) return true;
  const end = virtualizer.range?.endIndex;
  if (end == null) return true;
  return end === count - 1;
}

/**
 * 流式最后一项变高时，是否要把尺寸差补到 scrollTop 上。
 *
 * 贴底时交给 virtualizer 的 wasAtEnd；取消贴底后最后一项（正在流式的回复）
 * 增高不得拖动视口，否则松手后仍会跟着新 token 往下走。
 */
export function shouldAdjustScrollOnItemSizeChange(
  stuck: boolean,
  item: { index: number; start: number },
  instance: {
    options: { count: number };
    scrollOffset: number | null;
    scrollDirection: 'forward' | 'backward' | null;
  },
): boolean {
  if (stuck) return false;
  if (item.index === instance.options.count - 1) return false;
  const offset = instance.scrollOffset ?? 0;
  return item.start < offset && instance.scrollDirection !== 'backward';
}

/**
 * 聊天列表贴底：
 * - 用户在底部时跟随流式增高与视口缩放；
 * - 主动上滑（滚轮 / 触摸 / 滚动条）后钉住阅读位置；
 * - 滚回底部或 reStick() 后重新跟随。
 *
 * ResizeObserver 同时观察视口与内部内容容器，但钉底受 stuck 门控：
 * 贴底时流式增高 / 视口缩放当帧跟上；取消贴底后内容变高不得改 scrollTop。
 */
export function useStickToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  virtualizerRef: RefObject<StickVirtualizer | null>,
): StickToBottom {
  const [stuck, setStuck] = useState(true);
  const stuckRef = useRef(true);
  const ignoreProgrammaticScrollRef = useRef(false);

  const setStuckAndSync = useCallback(
    (next: boolean) => {
      stuckRef.current = next;
      const virtualizer = virtualizerRef.current;
      if (virtualizer) {
        virtualizer.options.scrollEndThreshold = next
          ? STICK_TO_BOTTOM_THRESHOLD
          : 0;
      }
      setStuck((prev) => (prev === next ? prev : next));
    },
    [virtualizerRef],
  );

  const pinToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !stuckRef.current) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    if (Math.abs(el.scrollTop - max) <= RESTICK_THRESHOLD) return;
    ignoreProgrammaticScrollRef.current = true;
    el.scrollTop = max;
  }, [scrollRef]);

  const reStick = useCallback(() => {
    setStuckAndSync(true);
    pinToBottom();
  }, [pinToBottom, setStuckAndSync]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let lastScrollTop = el.scrollTop;
    let lastTouchY: number | null = null;
    let rafId = 0;

    const onScroll = () => {
      const top = el.scrollTop;
      if (ignoreProgrammaticScrollRef.current) {
        ignoreProgrammaticScrollRef.current = false;
        lastScrollTop = top;
        return;
      }
      if (
        distanceFromBottom(el) <= RESTICK_THRESHOLD &&
        canRestickToEnd(virtualizerRef.current)
      ) {
        setStuckAndSync(true);
      } else if (top < lastScrollTop - 1) {
        setStuckAndSync(false);
      }
      lastScrollTop = top;
    };

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) setStuckAndSync(false);
    };

    const onTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (lastTouchY != null && y != null && y > lastTouchY + 2) {
        setStuckAndSync(false);
      }
      lastTouchY = y ?? lastTouchY;
    };

    const onViewportResize = () => {
      pinToBottom();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(pinToBottom);
    };

    const ro = new ResizeObserver(onViewportResize);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [pinToBottom, scrollRef, setStuckAndSync, virtualizerRef]);

  return { stuck, stuckRef, reStick };
}
