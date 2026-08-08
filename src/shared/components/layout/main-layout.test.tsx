import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainLayout } from './main-layout';

// matchMedia mock 已在 src/tests/setup.ts 中全局注册

describe('MainLayout', () => {
  it('应该渲染 children 内容', () => {
    render(
      <MainLayout>
        <div data-testid="main-content">主内容区域</div>
      </MainLayout>,
    );

    expect(screen.getByTestId('main-content')).toHaveTextContent('主内容区域');
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

  it('当未传入 sidebarContent 时，应该显示占位文字"暂无对话"', () => {
    render(
      <MainLayout>
        <div>内容</div>
      </MainLayout>,
    );

    expect(screen.getByText('暂无对话')).toBeInTheDocument();
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

  it('titleLoading 时显示标题骨架屏而不是标题', () => {
    render(
      <MainLayout titleLoading conversationTitle="我的会话">
        <div>内容</div>
      </MainLayout>,
    );

    expect(
      screen.getByTestId('conversation-title-skeleton'),
    ).toBeInTheDocument();
    expect(screen.queryByText('我的会话')).not.toBeInTheDocument();
  });

  it('titleLoading 但没有会话标题时保持标题区域空白', () => {
    const { rerender } = render(
      <MainLayout titleLoading>
        <div>内容</div>
      </MainLayout>,
    );

    expect(
      screen.queryByTestId('conversation-title-skeleton'),
    ).not.toBeInTheDocument();

    rerender(
      <MainLayout titleLoading={false}>
        <div>内容</div>
      </MainLayout>,
    );

    expect(
      screen.queryByTestId('conversation-title-skeleton'),
    ).not.toBeInTheDocument();
  });

  it('titleLoading 快速结束时骨架屏至少展示 200ms 再显示标题', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <MainLayout titleLoading conversationTitle="我的会话">
        <div>内容</div>
      </MainLayout>,
    );

    // 30ms 后加载完成
    act(() => {
      vi.advanceTimersByTime(30);
    });
    rerender(
      <MainLayout titleLoading={false} conversationTitle="我的会话">
        <div>内容</div>
      </MainLayout>,
    );
    // 不足最短展示时长，仍显示骨架屏
    expect(
      screen.getByTestId('conversation-title-skeleton'),
    ).toBeInTheDocument();
    expect(screen.queryByText('我的会话')).not.toBeInTheDocument();

    // 到达最短展示时长后显示标题
    act(() => {
      vi.advanceTimersByTime(170);
    });
    expect(screen.getByText('我的会话')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
