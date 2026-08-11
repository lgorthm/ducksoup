import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatStatus } from './chat-status';
import { useStore } from '@/stores';

beforeEach(() => {
  useStore.setState({ isLoading: false, streamingMessage: null, error: null });
});

describe('ChatStatus', () => {
  it('加载中且非流式时显示思考指示器', () => {
    useStore.setState({ isLoading: true });
    render(<ChatStatus />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText('思考中...')).toBeInTheDocument();
  });

  it('流式时不显示加载指示器', () => {
    useStore.setState({
      isLoading: true,
      streamingMessage: {
        id: 's1',
        conversationId: 'c1',
        role: 'assistant',
        content: '流式中',
        reasoningContent: '',
        createdAt: Date.now(),
      },
    });
    render(<ChatStatus />);
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('有错误时显示错误信息', () => {
    useStore.setState({ error: 'API 调用失败' });
    render(<ChatStatus />);
    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'API 调用失败',
    );
  });

  it('正常态不渲染任何指示', () => {
    const { container } = render(<ChatStatus />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });
});
