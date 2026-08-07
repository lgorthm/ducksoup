import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMinLoadingDisplay } from './use-min-loading-display';

afterEach(() => {
  vi.useRealTimers();
});

describe('useMinLoadingDisplay', () => {
  it('ready 初始为 true 时立即 revealed，wasLoading 为 false', () => {
    const { result } = renderHook(() => useMinLoadingDisplay(true));

    expect(result.current.revealed).toBe(true);
    expect(result.current.wasLoading).toBe(false);
  });

  it('ready 未到达时不 revealed，wasLoading 为 true', () => {
    const { result } = renderHook(() => useMinLoadingDisplay(false));

    expect(result.current.revealed).toBe(false);
    expect(result.current.wasLoading).toBe(true);
  });

  it('ready 快速到达时至少展示 minMs 再 revealed', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ ready }) => useMinLoadingDisplay(ready, 200),
      { initialProps: { ready: false } },
    );

    // 30ms 后加载完成
    act(() => {
      vi.advanceTimersByTime(30);
    });
    rerender({ ready: true });
    // 不足最短展示时长，仍未 revealed
    expect(result.current.revealed).toBe(false);

    // 到达 200ms 后 revealed
    act(() => {
      vi.advanceTimersByTime(170);
    });
    expect(result.current.revealed).toBe(true);
  });

  it('加载耗时超过 minMs 时 ready 一到立即 revealed', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ ready }) => useMinLoadingDisplay(ready, 200),
      { initialProps: { ready: false } },
    );

    // 500ms 后加载完成，已超过最短展示时长
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender({ ready: true });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.revealed).toBe(true);
  });

  it('revealed 后 ready 变化不影响结果', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ ready }) => useMinLoadingDisplay(ready, 200),
      { initialProps: { ready: true } },
    );

    rerender({ ready: false });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.revealed).toBe(true);
  });
});
