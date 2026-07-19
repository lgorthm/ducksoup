import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { StoredMessage } from '@/features/chat/types/deepseek';
import { ChatMessage } from './chat-message';

vi.mock('@/shared/components/markdown-renderer', () => ({
  MarkdownRenderer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="markdown-renderer">{children}</div>
  ),
}));

function makeMessage(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    content: '测试内容',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('ChatMessage', () => {
  it('user 消息渲染纯文本内容', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText('你好')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-renderer')).not.toBeInTheDocument();
  });

  it('assistant 消息使用 MarkdownRenderer', async () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '# 标题',
    });
    render(<ChatMessage message={msg} />);
    const markdown = await screen.findByTestId('markdown-renderer');
    expect(markdown).toBeInTheDocument();
    expect(screen.getByText('# 标题')).toBeInTheDocument();
  });

  it('无思考步骤时不显示思考区域', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(<ChatMessage message={msg} />);
    expect(screen.queryByText(/思考过程/)).not.toBeInTheDocument();
  });

  it('有推理内容时显示思考区域（折叠）', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '回复',
      reasoningContent: '首先理解问题\n然后寻找解决方案',
    });
    render(<ChatMessage message={msg} />);
    expect(screen.getByText(/思考过程/)).toBeInTheDocument();
    // 折叠状态：不显示推理内容
    expect(screen.queryByText('首先理解问题')).not.toBeInTheDocument();
  });

  it('点击展开思考区域', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '回复',
      reasoningContent: '推理内容',
    });
    render(<ChatMessage message={msg} />);
    const toggleBtn = screen.getByText(/思考过程/);
    fireEvent.click(toggleBtn);
    expect(screen.getByText('推理内容')).toBeInTheDocument();
  });

  it('流式且无内容时显示脉冲占位符', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
    });
    render(<ChatMessage message={msg} isStreaming />);
    // 应显示 animate-pulse 占位符
    const pulse = document.querySelector('.animate-pulse');
    expect(pulse).toBeInTheDocument();
  });

  it('流式且有推理内容时显示"思考中..."', () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '',
      reasoningContent: '思考',
    });
    render(<ChatMessage message={msg} isStreaming />);
    expect(screen.getByText('思考中...')).toBeInTheDocument();
  });

  it('流式且有内容时使用 MarkdownRenderer', async () => {
    const msg = makeMessage({
      role: 'assistant',
      content: '部分内容',
    });
    render(<ChatMessage message={msg} isStreaming />);
    const markdown = await screen.findByTestId('markdown-renderer');
    expect(markdown).toBeInTheDocument();
  });
});

describe('ChatMessage 操作栏', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('完成的消息渲染操作栏与复制按钮', () => {
    const msg = makeMessage({ role: 'user', content: '你好' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-actions')).toBeInTheDocument();
    expect(screen.getByTestId('message-copy-button')).toBeInTheDocument();
  });

  it('assistant 完成消息同样渲染复制按钮', () => {
    const msg = makeMessage({ role: 'assistant', content: '回复' });
    render(<ChatMessage message={msg} />);
    expect(screen.getByTestId('message-copy-button')).toBeInTheDocument();
  });

  it('流式消息不渲染操作栏', () => {
    const msg = makeMessage({ role: 'assistant', content: '部分内容' });
    render(<ChatMessage message={msg} isStreaming />);
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('点击复制按钮写入剪贴板并切换为已复制状态', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.useFakeTimers();
    try {
      const msg = makeMessage({ role: 'user', content: '待复制内容' });
      render(<ChatMessage message={msg} />);
      const btn = screen.getByTestId('message-copy-button');
      await act(async () => {
        fireEvent.click(btn);
      });
      expect(writeText).toHaveBeenCalledWith('待复制内容');
      expect(btn).toHaveAttribute('aria-label', '已复制');
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(btn).toHaveAttribute('aria-label', '复制');
    } finally {
      vi.useRealTimers();
    }
  });
});
