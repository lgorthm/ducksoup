import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';

interface UseChatAutoScrollOptions {
  /** 滚动容器 ref */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** 虚拟列表实例，用于调用 scrollToEnd */
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  /** 当前列表总条目数（历史 + 流式） */
  totalCount: number;
  /** 判定"贴底"的像素阈值，默认 100 */
  bottomThreshold?: number;
}

export interface UseChatAutoScrollResult {
  /** 当前是否处于底部的 ref（避免触发渲染） */
  isAtBottomRef: RefObject<boolean>;
  /** 滚动到底部（rAF 内执行） */
  scrollToBottom: () => void;
}

/**
 * 聊天列表自动滚动管理：
 * - 新消息到来时，若用户当前在底部（或列表从空到有），自动滚动到底部。
 * - 监听原生 scroll 事件，维护"是否贴底"状态，避免打断用户阅读。
 *
 * 复用场景：实时日志、直播弹幕、评论信息流等"增量内容 + 贴底跟随"列表。
 */
export function useChatAutoScroll({
  scrollContainerRef,
  virtualizer,
  totalCount,
  bottomThreshold = 100,
}: UseChatAutoScrollOptions): UseChatAutoScrollResult {
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      virtualizer.scrollToEnd();
    });
  }, [virtualizer]);

  // 新消息到来时自动滚动到底部
  const prevLength = useRef(totalCount);
  useEffect(() => {
    if (totalCount > 0 && prevLength.current !== totalCount) {
      if (prevLength.current === 0 || isAtBottomRef.current) {
        scrollToBottom();
      }
    }
    prevLength.current = totalCount;
  }, [totalCount, scrollToBottom, isAtBottomRef]);

  // 监听用户手动滚动，记录是否在底部
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isAtBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        bottomThreshold;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollContainerRef, bottomThreshold, isAtBottomRef]);

  return { isAtBottomRef, scrollToBottom };
}
