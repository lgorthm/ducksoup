import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import { ThemeProvider, useTheme } from './theme-provider';

function setMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
  setMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function ThemeConsumer({ onTheme }: { onTheme?: (t: string) => void }) {
  const { theme, setTheme } = useTheme();
  React.useEffect(() => {
    onTheme?.(theme);
  }, [theme, onTheme]);
  return (
    <div data-testid="consumer" data-theme={theme}>
      <button type="button" onClick={() => setTheme('dark')}>
        set dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        set light
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        set system
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('默认主题为 system', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'system',
    );
  });

  it('从 localStorage 读取主题', () => {
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('setTheme 更新状态和 localStorage', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('set dark'));
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('system 主题根据 matchMedia 解析为 light 或 dark', () => {
    setMatchMedia(true); // prefers dark
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('system 主题 matchMedia=false 解析为 light', () => {
    setMatchMedia(false); // prefers light
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('应用 dark class 到 html 元素', () => {
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('切换主题时移除旧 class 添加新 class', () => {
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByText('set light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

describe('跨标签页 storage 同步', () => {
  function dispatchStorage(init: StorageEventInit) {
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', init));
    });
  }

  it('其他标签页修改主题时同步更新', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    dispatchStorage({
      key: 'theme',
      newValue: 'dark',
      storageArea: localStorage,
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('其他标签页 localStorage.clear() 时重置为默认主题', () => {
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    dispatchStorage({ key: null, newValue: null, storageArea: localStorage });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'system',
    );
  });

  it('storageArea 为 null 时仍能同步(部分浏览器行为)', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    dispatchStorage({ key: 'theme', newValue: 'dark', storageArea: null });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('忽略 sessionStorage 的变更', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    dispatchStorage({
      key: 'theme',
      newValue: 'dark',
      storageArea: sessionStorage,
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'system',
    );
  });
});

describe('useTheme', () => {
  it('在 Provider 外使用抛出错误', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeConsumer />)).toThrow(
      'useTheme must be used within a ThemeProvider',
    );
    spy.mockRestore();
  });
});
