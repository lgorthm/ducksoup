import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatArea } from './chat-area';
import { useStore } from '@/stores';
import type { StoredMessage } from '@/features/chat/types/deepseek';

vi.mock('@/features/chat/components/message/chat-message-list', () => ({
  ChatMessageList: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="message-list">{children}</div>
  ),
}));

vi.mock('@/features/chat/components/message/chat-scroll-nav', () => ({
  ChatScrollNav: () => null,
}));

vi.mock('@/features/chat/components/message/chat-status', () => ({
  ChatStatus: () => null,
}));

vi.mock('@/features/chat/components/chat-composer', () => ({
  ChatComposer: () => <div data-testid="chat-input" />,
}));

vi.mock('@/features/chat/components/chat-welcome', () => ({
  ChatWelcome: () => <div data-testid="chat-welcome" />,
}));

function makeMsg(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: `m-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    content: '消息',
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  useStore.setState({ messages: [], streamingMessage: null });
});

describe('ChatArea', () => {
  it('无消息时显示 ChatWelcome', () => {
    render(<ChatArea />);
    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });

  it('有消息时显示消息列表和输入框', () => {
    useStore.setState({ messages: [makeMsg({ id: 'm1', content: '你好' })] });

    render(<ChatArea />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome')).not.toBeInTheDocument();
  });

  it('有流式消息时显示消息列表', () => {
    useStore.setState({
      streamingMessage: {
        id: 's1',
        conversationId: 'c1',
        role: 'assistant',
        content: '流式中',
        reasoningContent: '',
        createdAt: Date.now(),
      },
    });

    render(<ChatArea />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('显示免责声明', () => {
    useStore.setState({ messages: [makeMsg()] });

    render(<ChatArea />);
    expect(screen.getByText('内容由AI生成，请仔细甄别')).toBeInTheDocument();
  });
});
