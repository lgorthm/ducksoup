import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainLayout } from './main-layout';

// matchMedia mock 已在 src/tests/setup.ts 中全局注册（默认桌面端：matches=false）

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
    let mobile = false;
    const mocked = vi.mocked(window.matchMedia);
    const original = mocked.getMockImplementation();
    mocked.mockImplementation((query: string) => ({
      matches: mobile,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const { container, rerender } = render(
        <MainLayout>
          <div>内容</div>
        </MainLayout>,
      );

      mobile = true;
      rerender(
        <MainLayout>
          <div>内容</div>
        </MainLayout>,
      );
      expect(container.querySelector('header')).not.toHaveClass(
        'transition-[margin-left]',
      );

      mobile = false;
      rerender(
        <MainLayout>
          <div>内容</div>
        </MainLayout>,
      );
      expect(container.querySelector('header')).toHaveClass(
        'transition-[margin-left]',
      );
    } finally {
      if (original) mocked.mockImplementation(original);
    }
  });
});
