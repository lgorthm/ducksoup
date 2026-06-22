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
      <button onClick={() => setTheme('dark')}>set dark</button>
      <button onClick={() => setTheme('light')}>set light</button>
      <button onClick={() => setTheme('system')}>set system</button>
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
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('system 主题 matchMedia=false 解析为 light', () => {
    setMatchMedia(false); // prefers light
    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('应用 dark class 到 html 元素', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('切换主题时移除旧 class 添加新 class', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    fireEvent.click(screen.getByText('set light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

describe('d 键切换主题', () => {
  it('按 d 键 dark → light', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'd' });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'light',
    );
  });

  it('按 d 键 light → dark', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'd' });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('按 d 键 system → 反向系统主题', () => {
    setMatchMedia(true); // system = dark → toggle to light
    render(
      <ThemeProvider defaultTheme="system">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'd' });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'light',
    );
  });

  it('带修饰键(metaKey)时忽略', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'd', metaKey: true });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('带修饰键(ctrlKey)时忽略', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('在 input 中按键时忽略', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <input data-testid="test-input" />
      </ThemeProvider>,
    );
    const input = screen.getByTestId('test-input');
    act(() => {
      fireEvent.keyDown(input, { key: 'd' });
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('在 contentEditable 中按键时忽略', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <div
          data-testid="test-editor"
          contentEditable
          suppressContentEditableWarning
        />
      </ThemeProvider>,
    );
    const editor = screen.getByTestId('test-editor');
    act(() => {
      fireEvent.keyDown(editor, { key: 'd' });
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('按键重复(repeat)时忽略', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'd', repeat: true });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  it('大写 D 也能切换', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeConsumer />
      </ThemeProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'D' });
    });
    expect(screen.getByTestId('consumer')).toHaveAttribute(
      'data-theme',
      'light',
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
