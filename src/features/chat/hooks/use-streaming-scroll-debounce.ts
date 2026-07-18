import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface UseStreamingScrollDebounceOptions {
  /** 流式消息内容（累积） */
  streamingContent: string;
  /** 流式推理内容长度（累积） */
  reasoningLength: number;
  /** 是否在底部（来自 useChatAutoScroll） */
  isAtBottomRef: RefObject<boolean>;
  /** 滚动到底部函数（来自 useChatAutoScroll） */
  scrollToBottom: () => void;
  /** 防抖延迟（ms），默认 50 */
  delay?: number;
}

/**
 * 流式消息内容防抖滚动：
 * - 当流式内容或推理内容增量变化时，若用户当前在底部，以 setTimeout 节流滚动到底部，
 *   避免高频 token 增量导致的滚动抖动。
 *
 * 依赖：需配合 useChatAutoScroll 提供的 isAtBottomRef / scrollToBottom 使用。
 *
 * 复用场景：AI 流式输出、实时日志流等"高频增量内容 + 贴底跟随"场景。
 */
export function useStreamingScrollDebounce({
  streamingContent,
  reasoningLength,
  isAtBottomRef,
  scrollToBottom,
  delay = 50,
}: UseStreamingScrollDebounceOptions) {
  const scrollTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (isAtBottomRef.current) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        scrollToBottom();
      }, delay);
    }
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [streamingContent, reasoningLength, scrollToBottom, delay, isAtBottomRef]);
}
