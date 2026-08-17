import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { MainLayout } from './main-layout';

// matchMedia mock 已在 src/tests/setup.ts 中全局注册（所有 query 返回 matches=false）。
// 涉及断点的用例改用按 query 精确求值的 mock：mockViewportWidth(宽度)。

function evaluateMediaQuery(query: string, width: number) {
  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (min && width < Number(min[1])) return false;
  if (max && width > Number(max[1])) return false;
  return true;
}

let viewportWidth = 1440;

function mockViewportWidth(width: number) {
  viewportWidth = width;
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: evaluateMediaQuery(query, viewportWidth),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const originalMatchMediaImpl = vi
  .mocked(window.matchMedia)
  .getMockImplementation();

afterEach(() => {
  if (originalMatchMediaImpl) {
    vi.mocked(window.matchMedia).mockImplementation(originalMatchMediaImpl);
  }
});

describe('MainLayout', () => {
  it('应该渲染 children 内容', () => {
    render(
      <MainLayout>
        <div data-testid="main-content">主内容区域</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('main-content')).toHaveTextContent('主内容区域');
  });

  it('应该渲染 header 插槽内容', () => {
    render(
      <MainLayout header={<div data-testid="header-slot">会话标题</div>}>
        <div>内容</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('header-slot')).toHaveTextContent('会话标题');
  });

  it('应该渲染 sidebarContent', () => {
    render(
      <MainLayout
        sidebarContent={<div data-testid="sidebar-item">对话列表</div>}
      >
        <div>内容</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('sidebar-item')).toHaveTextContent('对话列表');
  });

  it('应该渲染 sidebarFooter', () => {
    render(
      <MainLayout
        sidebarFooter={<div data-testid="sidebar-footer">用户信息</div>}
      >
        <div>内容</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('sidebar-footer')).toHaveTextContent('用户信息');
  });

  it('当未传入 sidebarFooter 时，不应该渲染 footer 区域', () => {
    render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );

    // SidebarFooter 中的内容为空时不应出现
    expect(screen.queryByText('用户信息')).not.toBeInTheDocument();
  });

  it('应该渲染 Logo', () => {
    render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );

    const logo = screen.getByAltText('Logo');
    expect(logo).toBeInTheDocument();
    expect(logo.tagName).toBe('IMG');
  });

  it('应该支持 defaultOpen={false}', () => {
    render(
      <MainLayout defaultOpen={false}>
        <div data-testid="main-content">内容</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('main-content')).toBeInTheDocument();
  });

  it('桌面端 header 启用 margin-left 过渡', () => {
    mockViewportWidth(1440);
    const { container } = render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );

    expect(container.querySelector('header')).toHaveClass(
      'transition-[margin-left]',
    );
  });

  it('isMobile 翻转落定后，桌面端恢复 margin-left 过渡', () => {
    mockViewportWidth(1440);
    const { container, rerender } = render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );

    mockViewportWidth(390);
    rerender(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );
    expect(container.querySelector('header')).not.toHaveClass(
      'transition-[margin-left]',
    );

    mockViewportWidth(1440);
    rerender(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );
    expect(container.querySelector('header')).toHaveClass(
      'transition-[margin-left]',
    );
  });

  it('tablet 打开 sidebar 进入 mobile 后抽屉收起，回到 tablet 保持关闭', () => {
    mockViewportWidth(900);
    const { container, rerender } = render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );
    const sidebar = () => container.querySelector('[data-slot="sidebar"]');

    // tablet 初始为折叠（<1024px 自动折叠），点击 trigger 打开
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
    fireEvent.click(
      container.querySelector('[data-slot="sidebar-trigger"]') as HTMLElement,
    );
    expect(sidebar()).toHaveAttribute('data-state', 'expanded');

    // 切到 mobile：抽屉收起，切换为 mobile 抽屉形态
    mockViewportWidth(390);
    rerender(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
    expect(sidebar()).toHaveAttribute('data-mobile', 'true');

    // 回到 tablet：保持关闭，不再瞬间打开
    mockViewportWidth(900);
    rerender(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
    expect(sidebar()).not.toHaveAttribute('data-mobile');
  });

  it('mobile 下点击 trigger 打开抽屉，点击遮罩关闭', () => {
    mockViewportWidth(390);
    const { container } = render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );
    const sidebar = container.querySelector('[data-slot="sidebar"]');
    const backdrop = container.querySelector('[data-slot="sidebar-backdrop"]');

    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(backdrop).toHaveClass('opacity-0');

    fireEvent.click(
      container.querySelector(
        'header [data-slot="sidebar-trigger"]',
      ) as HTMLElement,
    );
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    expect(backdrop).toHaveClass('opacity-100');

    fireEvent.click(backdrop as HTMLElement);
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(backdrop).toHaveClass('opacity-0');
  });
});
