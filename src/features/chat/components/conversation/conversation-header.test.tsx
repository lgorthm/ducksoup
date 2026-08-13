import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConversationHeader } from './conversation-header';

describe('ConversationHeader', () => {
  it('loading 时显示标题骨架屏而不是标题', () => {
    render(<ConversationHeader loading title="我的会话" />);

    expect(
      screen.getByTestId('conversation-title-skeleton'),
    ).toBeInTheDocument();
    expect(screen.queryByText('我的会话')).not.toBeInTheDocument();
  });

  it('loading 但没有会话标题时保持标题区域空白', () => {
    const { rerender } = render(<ConversationHeader loading />);

    expect(
      screen.queryByTestId('conversation-title-skeleton'),
    ).not.toBeInTheDocument();

    rerender(<ConversationHeader loading={false} />);

    expect(
      screen.queryByTestId('conversation-title-skeleton'),
    ).not.toBeInTheDocument();
  });

  it('loading 快速结束时骨架屏至少展示 200ms 再显示标题', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ConversationHeader loading title="我的会话" />,
    );

    // 30ms 后加载完成
    act(() => {
      vi.advanceTimersByTime(30);
    });
    rerender(<ConversationHeader loading={false} title="我的会话" />);
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

  it('加载完成后显示标题与模型名', () => {
    render(<ConversationHeader title="我的会话" modelName="DeepSeek Chat" />);

    expect(screen.getByText('我的会话')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek Chat')).toBeInTheDocument();
  });

  it('模型名缺省时不渲染模型名行', () => {
    const { container } = render(<ConversationHeader title="我的会话" />);

    expect(screen.getByText('我的会话')).toBeInTheDocument();
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });

  it('标题缺省时整体保持空白', () => {
    const { container } = render(<ConversationHeader />);

    expect(container).toBeEmptyDOMElement();
  });
});
