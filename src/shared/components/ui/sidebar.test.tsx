import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from './sidebar';

// --- 可控 matchMedia：按当前宽度动态计算 matches，setWidth 时触发 change ---
function setupViewport(initialWidth: number) {
  let width = initialWidth;
  const changeListeners = new Set<() => void>();

  const computeMatches = (query: string): boolean => {
    const maxMatch = query.match(/max-width:\s*(\d+)px/);
    const minMatch = query.match(/min-width:\s*(\d+)px/);
    if (maxMatch && minMatch) {
      return (
        width >= Number.parseInt(minMatch[1], 10) &&
        width <= Number.parseInt(maxMatch[1], 10)
      );
    }
    if (maxMatch) return width <= Number.parseInt(maxMatch[1], 10);
    if (minMatch) return width >= Number.parseInt(minMatch[1], 10);
    return false;
  };

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return computeMatches(query);
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) =>
      changeListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) =>
      changeListeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return {
    setWidth(nextWidth: number) {
      width = nextWidth;
      act(() => {
        for (const listener of changeListeners) listener();
      });
    },
  };
}

type ProbeState = {
  open: boolean;
  openMobile: boolean;
  isMobile: boolean;
  state: 'expanded' | 'collapsed';
};

function setupProvider(width: number) {
  const viewport = setupViewport(width);
  let toggle: () => void = () => {};

  function Probe() {
    const { open, openMobile, isMobile, state, toggleSidebar } = useSidebar();
    toggle = toggleSidebar;
    return (
      <output data-testid="probe">
        {JSON.stringify({ open, openMobile, isMobile, state })}
      </output>
    );
  }

  render(
    <SidebarProvider>
      <Probe />
    </SidebarProvider>,
  );

  return {
    viewport,
    read: (): ProbeState =>
      JSON.parse(screen.getByTestId('probe').textContent ?? '{}'),
    toggle: () => act(() => toggle()),
  };
}

describe('SidebarProvider 断点行为', () => {
  it('桌面端（>=1024px）默认展开', () => {
    const { read } = setupProvider(1280);
    expect(read().open).toBe(true);
    expect(read().state).toBe('expanded');
  });

  it('平板（768-1023px）默认折叠', () => {
    const { read } = setupProvider(900);
    expect(read().open).toBe(false);
  });

  it('移动端（<768px）默认折叠且抽屉关闭', () => {
    const { read } = setupProvider(375);
    const state = read();
    expect(state.isMobile).toBe(true);
    expect(state.open).toBe(false);
    expect(state.openMobile).toBe(false);
  });

  it('桌面 -> 平板：自动折叠', () => {
    const { viewport, read } = setupProvider(1280);
    viewport.setWidth(900);
    expect(read().open).toBe(false);
  });

  it('平板 -> 桌面：无手动操作时自动展开', () => {
    const { viewport, read } = setupProvider(900);
    viewport.setWidth(1280);
    expect(read().open).toBe(true);
  });

  it('桌面手动关闭后，跨越断点来回仍保持折叠', () => {
    const { viewport, read, toggle } = setupProvider(1280);
    toggle(); // 手动关闭
    expect(read().open).toBe(false);
    viewport.setWidth(900); // -> 平板
    expect(read().open).toBe(false);
    viewport.setWidth(1280); // -> 桌面
    expect(read().open).toBe(false);
  });

  it('手动关闭后再次手动打开，恢复断点自动行为', () => {
    const { viewport, read, toggle } = setupProvider(1280);
    toggle(); // 关
    toggle(); // 开
    viewport.setWidth(900);
    expect(read().open).toBe(false);
    viewport.setWidth(1280);
    expect(read().open).toBe(true);
  });

  it('平板上手动打开后回到桌面，保持展开', () => {
    const { viewport, read, toggle } = setupProvider(900);
    toggle(); // 平板手动打开
    expect(read().open).toBe(true);
    viewport.setWidth(1280);
    expect(read().open).toBe(true);
  });

  it('进入移动端：桌面 open 记为关闭，toggle 只驱动抽屉', () => {
    const { viewport, read, toggle } = setupProvider(1280);
    viewport.setWidth(500);
    expect(read().isMobile).toBe(true);
    expect(read().open).toBe(false);
    toggle();
    const state = read();
    expect(state.openMobile).toBe(true);
    expect(state.open).toBe(false);
    expect(state.state).toBe('expanded');
  });

  it('移动端回到平板：sidebar 保持关闭', () => {
    const { viewport, read } = setupProvider(500);
    viewport.setWidth(900);
    expect(read().open).toBe(false);
  });
});

function renderDrawer(children: ReactNode) {
  setupViewport(375);
  render(
    <SidebarProvider>
      <Sidebar>{children}</Sidebar>
      <button type="button" data-testid="outside">
        outside
      </button>
      <SidebarTrigger data-testid="trigger" />
    </SidebarProvider>,
  );
}

describe('移动端抽屉焦点管理', () => {
  it('打开时挂载 dialog 语义（aria-label 走 i18n），焦点进入抽屉', () => {
    renderDrawer(<button type="button">item</button>);
    fireEvent.click(screen.getByTestId('trigger'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', '侧边栏');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(dialog);
    // trigger 的无障碍名称同步走 i18n
    expect(screen.getByTestId('trigger')).toHaveTextContent('切换侧边栏');
  });

  it('Esc 关闭抽屉，焦点归还给打开前的元素', () => {
    renderDrawer(<button type="button">item</button>);
    const outside = screen.getByTestId('outside');
    outside.focus();
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(outside);
  });

  it('Tab 在抽屉内循环，跳过不可见元素', () => {
    renderDrawer(
      <>
        <button type="button" data-testid="first">
          first
        </button>
        <button type="button" data-testid="last">
          last
        </button>
        <button type="button" data-testid="hidden" style={{ display: 'none' }}>
          hidden
        </button>
      </>,
    );
    fireEvent.click(screen.getByTestId('trigger'));
    const first = screen.getByTestId('first');
    const last = screen.getByTestId('last');
    // 隐藏按钮位于 DOM 末尾：若未过滤，Tab 在 last 上不会回卷
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    // Shift+Tab 反向回卷同样跳过隐藏按钮
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('正 tabindex 的元素按数值优先参与循环', () => {
    renderDrawer(
      <>
        <button type="button" data-testid="a">
          a
        </button>
        {/* 下面两个按钮故意使用正 tabindex，验证焦点循环按数值排序 */}
        {/* biome-ignore lint/a11y/noPositiveTabindex: 故意构造正 tabindex，验证焦点循环按数值排序 */}
        <button type="button" data-testid="b" tabIndex={2}>
          b
        </button>
        {/* biome-ignore lint/a11y/noPositiveTabindex: 故意构造正 tabindex，验证焦点循环按数值排序 */}
        <button type="button" data-testid="c" tabIndex={1}>
          c
        </button>
      </>,
    );
    fireEvent.click(screen.getByTestId('trigger'));
    // 真实 Tab 顺序为 c(1) -> b(2) -> a(0)，a 上回卷应到 c 而非 DOM 首个
    screen.getByTestId('a').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('c'));
  });
});
