import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsBelowDesktop,
  useCanHover,
} from './use-media-query';

function setupMatchMediaForWidth(width: number) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    let matches = false;
    const maxMatch = query.match(/max-width:\s*(\d+)px/);
    const minMatch = query.match(/min-width:\s*(\d+)px/);
    if (maxMatch && minMatch) {
      const min = parseInt(minMatch[1]);
      const max = parseInt(maxMatch[1]);
      matches = width >= min && width <= max;
    } else if (maxMatch) {
      matches = width <= parseInt(maxMatch[1]);
    } else if (minMatch) {
      matches = width >= parseInt(minMatch[1]);
    }
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

function renderHook<T>(hook: () => T): { current: T } {
  const result: { current: T } = { current: undefined as unknown as T };
  function TestComp() {
    result.current = hook();
    return null;
  }
  render(<TestComp />);
  return result;
}

beforeEach(() => {
  setupMatchMediaForWidth(1024);
});

describe('useMediaQuery', () => {
  it('返回 matchMedia 的 matches 值', () => {
    setupMatchMediaForWidth(500);
    const result = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(true);
  });

  it('不匹配时返回 false', () => {
    setupMatchMediaForWidth(1200);
    const result = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);
  });
});

describe('useIsMobile', () => {
  it('宽度 < 768 返回 true', () => {
    setupMatchMediaForWidth(375);
    const result = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('宽度 >= 768 返回 false', () => {
    setupMatchMediaForWidth(768);
    const result = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('宽度 = 767 返回 true', () => {
    setupMatchMediaForWidth(767);
    const result = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});

describe('useIsTablet', () => {
  it('宽度 768~1023 返回 true', () => {
    setupMatchMediaForWidth(900);
    const result = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it('宽度 < 768 返回 false', () => {
    setupMatchMediaForWidth(500);
    const result = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it('宽度 >= 1024 返回 false', () => {
    setupMatchMediaForWidth(1024);
    const result = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it('宽度 = 768 返回 true', () => {
    setupMatchMediaForWidth(768);
    const result = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it('宽度 = 1023 返回 true', () => {
    setupMatchMediaForWidth(1023);
    const result = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });
});

describe('useIsBelowDesktop', () => {
  it('宽度 < 1024 返回 true', () => {
    setupMatchMediaForWidth(800);
    const result = renderHook(() => useIsBelowDesktop());
    expect(result.current).toBe(true);
  });

  it('宽度 >= 1024 返回 false', () => {
    setupMatchMediaForWidth(1024);
    const result = renderHook(() => useIsBelowDesktop());
    expect(result.current).toBe(false);
  });

  it('宽度 = 1023 返回 true', () => {
    setupMatchMediaForWidth(1023);
    const result = renderHook(() => useIsBelowDesktop());
    expect(result.current).toBe(true);
  });

  it('移动端宽度也返回 true', () => {
    setupMatchMediaForWidth(375);
    const result = renderHook(() => useIsBelowDesktop());
    expect(result.current).toBe(true);
  });
});

describe('useCanHover', () => {
  it('主输入支持 hover 时返回 true', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(hover: hover)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const result = renderHook(() => useCanHover());
    expect(result.current).toBe(true);
  });

  it('主输入不支持 hover（触摸设备）时返回 false', () => {
    // 全局 matchMedia mock 对所有 query 返回 matches:false
    const result = renderHook(() => useCanHover());
    expect(result.current).toBe(false);
  });
});
