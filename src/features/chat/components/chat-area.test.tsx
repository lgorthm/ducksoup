import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatArea } from './chat-area';
import { useStore } from '@/stores';
import type { MessageNode } from '@/stores/models';

vi.mock('@/features/chat/components/message/chat-message-list', () => ({
  ChatMessageList: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="message-list">{children}</div>
  ),
}));

vi.mock('@/features/chat/components/message/chat-scroll-nav', () => ({
  ChatScrollNav: () => null,
}));

vi.mock('@/features/chat/components/message/chat-scroll-to-bottom', () => ({
  ChatScrollToBottom: () => null,
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

function makeMsg(overrides: Partial<MessageNode> = {}): MessageNode {
  return {
    id: `m-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: 'c1',
    role: 'user',
    parentId: null,
    childrenIds: [],
    siblingIndex: 0,
    activeChildId: null,
    content: '消息',
    status: 'done',
    createdAt: Date.now(),
    ...overrides,
  };
}

function showMessages(msgs: MessageNode[], streamingId: string | null = null) {
  useStore.setState({
    messageNodes: new Map(msgs.map((m) => [m.id, m])),
    activePath: msgs.map((m) => m.id),
    streamingMessageId: streamingId,
  });
}

beforeEach(() => {
  useStore.setState({
    messageNodes: new Map(),
    activePath: [],
    streamingMessageId: null,
  });
});

describe('ChatArea', () => {
  it('无消息时显示 ChatWelcome', () => {
    render(<ChatArea />);
    expect(screen.getByTestId('chat-welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });

  it('有消息时显示消息列表和输入框', () => {
    showMessages([makeMsg({ id: 'm1', content: '你好' })]);

    render(<ChatArea />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome')).not.toBeInTheDocument();
  });

  it('有流式消息时显示消息列表', () => {
    const pending = makeMsg({
      id: 's1',
      role: 'assistant',
      content: '流式中',
      status: 'pending',
    });
    showMessages([pending], 's1');

    render(<ChatArea />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('显示免责声明', () => {
    showMessages([makeMsg()]);

    render(<ChatArea />);
    expect(screen.getByText('内容由AI生成，请仔细甄别')).toBeInTheDocument();
  });
});
