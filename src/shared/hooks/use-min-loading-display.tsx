import { useEffect, useRef, useState } from 'react';
import { MIN_LOADING_DISPLAY_MS } from '@/shared/constants';

interface MinLoadingDisplay {
  /** ready 到达且距挂载满 minMs 后为 true，用于切换加载态与内容 */
  revealed: boolean;
  /** 挂载时是否处于加载中（用于决定内容出现时是否播放淡入动画） */
  wasLoading: boolean;
}

/**
 * 加载态最短展示时长：ready 很快到达时也至少展示 minMs 的加载态再切换，
 * 避免加载 UI 一闪而过；ready 到达耗时超过 minMs 则立即切换。
 */
export function useMinLoadingDisplay(
  ready: boolean,
  minMs: number = MIN_LOADING_DISPLAY_MS,
): MinLoadingDisplay {
  const [revealed, setRevealed] = useState(ready);
  const wasLoading = useRef(!ready).current;
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!ready || revealed) return;
    const remaining = Math.max(0, minMs - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => setRevealed(true), remaining);
    return () => clearTimeout(timer);
  }, [ready, revealed, minMs]);

  return { revealed, wasLoading };
}
